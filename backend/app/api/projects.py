"""
Project CRUD + file upload + product read/patch endpoints.
"""

import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import get_db
from app.db.models import Product, Project
from app.schemas.project import (
    CategoryBulkPatch, CategoryPatch,
    ProductOut, ProductsPage,
    ProjectCreate, ProjectOut,
    RelevanceBulkPatch, RelevancePatch,
)

from app.services.helium10_parser import parse_upload

router = APIRouter()


# ── Projects ──────────────────────────────────────────────────────────────────

@router.get("", response_model=list[ProjectOut])
def list_projects(db: Session = Depends(get_db)):
    return db.query(Project).order_by(Project.created_at.desc()).all()


@router.post("", response_model=ProjectOut, status_code=201)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    project = Project(name=payload.name, description=payload.description)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/{project_id}", response_model=ProjectOut)
def get_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.delete("/{project_id}", status_code=204)
def delete_project(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.file_path:
        p = Path(project.file_path)
        if p.exists():
            p.unlink()
    db.delete(project)
    db.commit()


# ── File upload ────────────────────────────────────────────────────────────────

@router.post("/{project_id}/upload", response_model=ProjectOut)
async def upload_file(
    project_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    suffix = Path(file.filename).suffix.lower()
    if suffix not in (".csv", ".xlsx", ".xls"):
        raise HTTPException(status_code=400, detail="Only .csv, .xlsx, and .xls files are supported")

    data = await file.read()
    if len(data) > settings.max_upload_size_mb * 1024 * 1024:
        raise HTTPException(status_code=413, detail=f"File exceeds {settings.max_upload_size_mb} MB limit")

    safe_name = f"{uuid.uuid4()}{suffix}"
    dest = settings.upload_dir / safe_name
    with open(dest, "wb") as f:
        f.write(data)

    if project.file_path:
        old = Path(project.file_path)
        if old.exists():
            old.unlink()

    try:
        columns, rows = parse_upload(dest)
    except Exception as exc:
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=422, detail=f"Failed to parse file: {exc}")

    db.query(Product).filter(Product.project_id == project_id).delete()

    products = [
        Product(project_id=project_id, row_index=i, data=row)
        for i, row in enumerate(rows)
    ]
    db.bulk_save_objects(products)

    project.file_path = str(dest)
    project.original_filename = file.filename
    project.file_columns = columns
    project.product_count = len(rows)
    project.status = "uploaded"
    db.commit()
    db.refresh(project)
    return project



# ── Products list ──────────────────────────────────────────────────────────────

@router.get("/{project_id}/products", response_model=ProductsPage)
def list_products(
    project_id: int,
    page: int = 1,
    per_page: int = 50,
    relevance: str | None = None,
    keep: bool | None = None,
    dimension: str | None = None,
    value: str | None = None,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    query = db.query(Product).filter(Product.project_id == project_id)

    if relevance:
        query = query.filter(Product.ai_relevance == relevance)
    if keep is not None:
        query = query.filter(Product.keep == keep)

    # Dimension/value filter requires Python-side filtering (SQLite JSON)
    if dimension and value:
        all_p = query.order_by(Product.row_index).all()
        filtered = [
            p for p in all_p
            if p.final_categories and p.final_categories.get(dimension) == value
        ]
        total = len(filtered)
        start = (page - 1) * per_page
        products = filtered[start: start + per_page]
    else:
        total = query.count()
        products = (
            query.order_by(Product.row_index)
            .offset((page - 1) * per_page)
            .limit(per_page)
            .all()
        )

    return ProductsPage(products=products, total=total, page=page, per_page=per_page)


# ── Product relevance patch ────────────────────────────────────────────────────

@router.patch("/{project_id}/products/{product_id}/relevance", response_model=ProductOut)
def patch_relevance(
    project_id: int,
    product_id: int,
    payload: RelevancePatch,
    db: Session = Depends(get_db),
):
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.project_id == project_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, val)
    db.commit()
    db.refresh(product)
    return product


@router.post("/{project_id}/products/relevance/bulk", response_model=dict)
def bulk_patch_relevance(
    project_id: int,
    payload: RelevanceBulkPatch,
    db: Session = Depends(get_db),
):
    updated = (
        db.query(Product)
        .filter(
            Product.project_id == project_id,
            Product.id.in_(payload.product_ids),
        )
        .all()
    )
    for p in updated:
        p.keep = payload.keep
        p.relevance_reviewed = True
    db.commit()
    return {"updated": len(updated)}


# ── Product category patch ─────────────────────────────────────────────────────

@router.patch("/{project_id}/products/{product_id}/categories", response_model=ProductOut)
def patch_categories(
    project_id: int,
    product_id: int,
    payload: CategoryPatch,
    db: Session = Depends(get_db),
):
    product = (
        db.query(Product)
        .filter(Product.id == product_id, Product.project_id == project_id)
        .first()
    )
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    for field, val in payload.model_dump(exclude_unset=True).items():
        setattr(product, field, val)
    db.commit()
    db.refresh(product)
    return product


@router.post("/{project_id}/products/categories/bulk", response_model=dict)
def bulk_patch_categories(
    project_id: int,
    payload: CategoryBulkPatch,
    db: Session = Depends(get_db),
):
    """Set one dimension value for multiple products at once."""
    products = (
        db.query(Product)
        .filter(
            Product.project_id == project_id,
            Product.id.in_(payload.product_ids),
        )
        .all()
    )
    for p in products:
        cats = dict(p.final_categories or {})
        cats[payload.dimension_name] = payload.value
        p.final_categories = cats
    db.commit()
    return {"updated": len(products)}


# ── Approve all reviewed products ──────────────────────────────────────────────

@router.post("/{project_id}/products/approve-all", response_model=dict)
def approve_all_categories(project_id: int, db: Session = Depends(get_db)):
    """Mark all categorized products as user-approved (categorized=True)."""
    products = (
        db.query(Product)
        .filter(Product.project_id == project_id, Product.keep == True)  # noqa: E712
        .all()
    )
    count = 0
    for p in products:
        if p.final_categories:
            p.categorized = True
            count += 1
    project = db.query(Project).filter(Project.id == project_id).first()
    if project:
        project.status = "done"
    db.commit()
    return {"approved": count}

