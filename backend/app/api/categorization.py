"""
Categorization workflow endpoints:
  - Relevance: run AI, poll status
  - Dimensions: suggest, CRUD, lock
  - Categorization: run AI, poll status
  - Dashboard summary
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import (
    BackgroundJob, CategorizationDimension, Product, Project
)
from app.db.models import RELEVANCE_LABELS
from app.schemas.categorization import (
    DashboardOut, DimensionBreakdown, DimensionCreate, DimensionOut,
    DimensionsBulkUpdate, JobOut, RelevanceSummary,
)
from app.services.ai.factory import get_ai_provider
from app.services.categorization_service import start_relevance_job, start_categorization_job

router = APIRouter()


# ── Relevance ─────────────────────────────────────────────────────────────────

@router.post("/{project_id}/relevance/run", response_model=JobOut, status_code=202)
async def run_relevance(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status == "created":
        raise HTTPException(status_code=400, detail="Upload a product file first")
    if not project.target_product:
        raise HTTPException(status_code=400, detail="Define a target product first")

    # Block if already running
    running = (
        db.query(BackgroundJob)
        .filter(
            BackgroundJob.project_id == project_id,
            BackgroundJob.job_type == "relevance",
            BackgroundJob.status.in_(["pending", "running"]),
        )
        .first()
    )
    if running:
        raise HTTPException(status_code=409, detail="A relevance job is already running")

    job_id = await start_relevance_job(project_id)
    job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
    if not job:
        return JobOut(
            id=job_id, project_id=project_id, job_type="relevance",
            status="pending", progress=0, processed=0, total=0, error=None,
        )
    return job


@router.get("/{project_id}/relevance/status", response_model=JobOut | None)
def relevance_status(project_id: int, db: Session = Depends(get_db)):
    return (
        db.query(BackgroundJob)
        .filter(BackgroundJob.project_id == project_id, BackgroundJob.job_type == "relevance")
        .order_by(BackgroundJob.created_at.desc())
        .first()
    )


# ── Dimensions ────────────────────────────────────────────────────────────────

@router.get("/{project_id}/dimensions", response_model=list[DimensionOut])
def get_dimensions(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.dimensions


@router.post("/{project_id}/dimensions/suggest", response_model=list[DimensionOut])
async def suggest_dimensions(
    project_id: int,
    num_dimensions: int = 5,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status == "created":
        raise HTTPException(status_code=400, detail="Upload a product file first")

    # Use only kept products for dimension suggestions
    kept_products = (
        db.query(Product)
        .filter(Product.project_id == project_id, Product.keep == True)  # noqa: E712
        .limit(settings.sample_size_for_suggestions)
        .all()
    )
    if not kept_products:
        # Fall back to all products if no keep decisions have been made yet
        kept_products = (
            db.query(Product)
            .filter(Product.project_id == project_id)
            .limit(settings.sample_size_for_suggestions)
            .all()
        )

    products_data = [p.data for p in kept_products]
    target_product = None
    if project.target_product:
        tp = project.target_product
        target_product = {
            "asin": tp.asin,
            "description": tp.description,
            "main_function": tp.main_function,
            "exclusion_rules": tp.exclusion_rules,
        }

    ai = get_ai_provider()
    try:
        suggestions = await ai.suggest_dimensions(products_data, target_product, num_dimensions)
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"AI provider error: {exc}")

    # Delete previous AI-suggested unapproved dimensions only
    db.query(CategorizationDimension).filter(
        CategorizationDimension.project_id == project_id,
        CategorizationDimension.ai_suggested == True,  # noqa: E712
        CategorizationDimension.approved == False,  # noqa: E712
    ).delete()

    created = []
    for i, s in enumerate(suggestions):
        dim = CategorizationDimension(
            project_id=project_id,
            name=s["name"],
            description=s.get("description"),
            taxonomy_values=s["taxonomy_values"],
            ai_suggested=True,
            approved=False,
            order=i,
        )
        db.add(dim)
        created.append(dim)

    project.status = "taxonomy_building"
    db.commit()
    for dim in created:
        db.refresh(dim)
    return created


@router.post("/{project_id}/dimensions", response_model=DimensionOut, status_code=201)
def add_dimension(
    project_id: int,
    payload: DimensionCreate,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    count = (
        db.query(CategorizationDimension)
        .filter(CategorizationDimension.project_id == project_id)
        .count()
    )
    dim = CategorizationDimension(
        project_id=project_id,
        name=payload.name,
        description=payload.description,
        taxonomy_values=payload.taxonomy_values,
        ai_suggested=False,
        approved=False,
        order=payload.order if payload.order else count,
    )
    db.add(dim)
    db.commit()
    db.refresh(dim)
    return dim


@router.put("/{project_id}/dimensions", response_model=list[DimensionOut])
def bulk_update_dimensions(
    project_id: int,
    payload: DimensionsBulkUpdate,
    db: Session = Depends(get_db),
):
    """Replace all dimensions for a project with the provided list."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    incoming_ids = {d.id for d in payload.dimensions if d.id is not None}
    existing = {
        d.id: d
        for d in db.query(CategorizationDimension)
        .filter(CategorizationDimension.project_id == project_id)
        .all()
    }

    for dim_id, dim in existing.items():
        if dim_id not in incoming_ids:
            # Never delete a locked (approved) dimension silently
            if dim.approved:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot delete locked dimension '{dim.name}'. Unlock it first.",
                )
            db.delete(dim)

    result = []
    for idx, item in enumerate(payload.dimensions):
        if item.id and item.id in existing:
            dim = existing[item.id]
            if dim.approved and (
                dim.taxonomy_values != item.taxonomy_values or dim.name != item.name
            ):
                raise HTTPException(
                    status_code=400,
                    detail=f"Dimension '{dim.name}' is locked. Unlock before editing.",
                )
            dim.name = item.name
            dim.description = item.description
            dim.taxonomy_values = item.taxonomy_values
            dim.approved = item.approved
            dim.order = idx
        else:
            dim = CategorizationDimension(
                project_id=project_id,
                name=item.name,
                description=item.description,
                taxonomy_values=item.taxonomy_values,
                ai_suggested=False,
                approved=item.approved,
                order=idx,
            )
            db.add(dim)
        result.append(dim)

    db.commit()
    for dim in result:
        db.refresh(dim)
    return result


@router.post("/{project_id}/dimensions/{dimension_id}/lock", response_model=DimensionOut)
def lock_dimension(project_id: int, dimension_id: int, db: Session = Depends(get_db)):
    """Approve (lock) a dimension — taxonomy values become immutable for AI."""
    dim = (
        db.query(CategorizationDimension)
        .filter(
            CategorizationDimension.id == dimension_id,
            CategorizationDimension.project_id == project_id,
        )
        .first()
    )
    if not dim:
        raise HTTPException(status_code=404, detail="Dimension not found")
    if len(dim.taxonomy_values) < 2:
        raise HTTPException(status_code=400, detail="A dimension must have at least 2 taxonomy values to lock")
    dim.approved = True
    db.commit()
    db.refresh(dim)
    return dim


@router.post("/{project_id}/dimensions/{dimension_id}/unlock", response_model=DimensionOut)
def unlock_dimension(project_id: int, dimension_id: int, db: Session = Depends(get_db)):
    """Unlock a dimension so its taxonomy can be edited (resets AI categorization for it)."""
    dim = (
        db.query(CategorizationDimension)
        .filter(
            CategorizationDimension.id == dimension_id,
            CategorizationDimension.project_id == project_id,
        )
        .first()
    )
    if not dim:
        raise HTTPException(status_code=404, detail="Dimension not found")
    dim.approved = False
    db.commit()
    db.refresh(dim)
    return dim


@router.delete("/{project_id}/dimensions/{dimension_id}", status_code=204)
def delete_dimension(project_id: int, dimension_id: int, db: Session = Depends(get_db)):
    dim = (
        db.query(CategorizationDimension)
        .filter(
            CategorizationDimension.id == dimension_id,
            CategorizationDimension.project_id == project_id,
        )
        .first()
    )
    if not dim:
        raise HTTPException(status_code=404, detail="Dimension not found")
    if dim.approved:
        raise HTTPException(status_code=400, detail="Unlock dimension before deleting")
    db.delete(dim)
    db.commit()


# ── Lock all dimensions ────────────────────────────────────────────────────────

@router.post("/{project_id}/dimensions/lock-all", response_model=list[DimensionOut])
def lock_all_dimensions(project_id: int, db: Session = Depends(get_db)):
    dims = (
        db.query(CategorizationDimension)
        .filter(CategorizationDimension.project_id == project_id)
        .all()
    )
    invalid = [d.name for d in dims if len(d.taxonomy_values) < 2]
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"These dimensions need at least 2 values: {', '.join(invalid)}",
        )
    for dim in dims:
        dim.approved = True

    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        project.status = "taxonomy_locked"
    db.commit()
    for dim in dims:
        db.refresh(dim)
    return dims


# ── Categorization run ────────────────────────────────────────────────────────

@router.post("/{project_id}/categorization/run", response_model=JobOut, status_code=202)
async def run_categorization(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.status == "created":
        raise HTTPException(status_code=400, detail="Upload a product file first")

    locked_count = (
        db.query(CategorizationDimension)
        .filter(
            CategorizationDimension.project_id == project_id,
            CategorizationDimension.approved == True,  # noqa: E712
        )
        .count()
    )
    if locked_count == 0:
        raise HTTPException(status_code=400, detail="Lock at least one dimension before running categorization")

    kept_count = (
        db.query(Product)
        .filter(Product.project_id == project_id, Product.keep == True)  # noqa: E712
        .count()
    )
    if kept_count == 0:
        raise HTTPException(status_code=400, detail="No products are marked as kept. Review relevance first.")

    running = (
        db.query(BackgroundJob)
        .filter(
            BackgroundJob.project_id == project_id,
            BackgroundJob.job_type == "categorization",
            BackgroundJob.status.in_(["pending", "running"]),
        )
        .first()
    )
    if running:
        raise HTTPException(status_code=409, detail="A categorization job is already running")

    job_id = await start_categorization_job(project_id)
    job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
    if not job:
        return JobOut(
            id=job_id, project_id=project_id, job_type="categorization",
            status="pending", progress=0, processed=0, total=0, error=None,
        )
    return job


@router.get("/{project_id}/categorization/status", response_model=JobOut | None)
def categorization_status(project_id: int, db: Session = Depends(get_db)):
    return (
        db.query(BackgroundJob)
        .filter(BackgroundJob.project_id == project_id, BackgroundJob.job_type == "categorization")
        .order_by(BackgroundJob.created_at.desc())
        .first()
    )


# ── Dashboard ─────────────────────────────────────────────────────────────────

@router.get("/{project_id}/dashboard", response_model=DashboardOut)
def get_dashboard(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    products = (
        db.query(Product)
        .filter(Product.project_id == project_id)
        .all()
    )

    total = len(products)
    kept = sum(1 for p in products if p.keep is True)
    excluded = sum(1 for p in products if p.keep is False)
    pending = sum(1 for p in products if p.keep is None)
    categorized = sum(1 for p in products if p.categorized)

    # Relevance summary
    relevance_summary: list[RelevanceSummary] = []
    for label in RELEVANCE_LABELS:
        label_products = [p for p in products if p.ai_relevance == label]
        relevance_summary.append(RelevanceSummary(
            label=label,
            count=len(label_products),
            kept=sum(1 for p in label_products if p.keep is True),
            excluded=sum(1 for p in label_products if p.keep is False),
            pending=sum(1 for p in label_products if p.keep is None),
        ))

    # Dimension breakdowns (only kept + categorized products)
    dimensions = (
        db.query(CategorizationDimension)
        .filter(
            CategorizationDimension.project_id == project_id,
            CategorizationDimension.approved == True,  # noqa: E712
        )
        .order_by(CategorizationDimension.order)
        .all()
    )

    breakdowns: list[DimensionBreakdown] = []
    kept_categorized = [p for p in products if p.keep and p.final_categories]
    for dim in dimensions:
        value_counts: dict[str, int] = {}
        for p in kept_categorized:
            val = p.final_categories.get(dim.name, "Unknown")
            value_counts[val] = value_counts.get(val, 0) + 1
        breakdowns.append(DimensionBreakdown(dimension_name=dim.name, values=value_counts))

    return DashboardOut(
        total_products=total,
        relevance_summary=relevance_summary,
        kept_count=kept,
        excluded_count=excluded,
        pending_count=pending,
        categorized_count=categorized,
        dimension_breakdowns=breakdowns,
    )

