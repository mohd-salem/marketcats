"""
Background job service for relevance classification and categorization.

Both jobs follow the same pattern:
  - Create a BackgroundJob record
  - Launch an asyncio task
  - Update progress on each batch commit
  - AI output is validated before being written to DB
  - User must still review before results are considered final
"""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from app.config import settings
from app.db.database import SessionLocal
from app.db.models import BackgroundJob, CategorizationDimension, Product, Project
from app.services.ai.factory import get_ai_provider

logger = logging.getLogger(__name__)

_running_jobs: dict[str, asyncio.Task] = {}


def _project_target_dict(project: Project) -> dict[str, Any] | None:
    tp = project.target_product
    if not tp:
        return None
    return {
        "asin": tp.asin,
        "amazon_url": tp.amazon_url,
        "image_url": tp.image_url,
        "description": tp.description,
        "main_function": tp.main_function,
        "exclusion_rules": tp.exclusion_rules or [],
    }


# ── Relevance job ──────────────────────────────────────────────────────────────

async def _run_relevance(job_id: str, project_id: int) -> None:
    db: Session = SessionLocal()
    try:
        job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
        if not job:
            return
        job.status = "running"
        db.commit()

        project = db.query(Project).filter(Project.id == project_id).first()
        target = _project_target_dict(project)
        if not target:
            job.status = "failed"
            job.error = "No target product defined. Set a target product before running relevance classification."
            db.commit()
            return

        products = (
            db.query(Product)
            .filter(Product.project_id == project_id)
            .order_by(Product.row_index)
            .all()
        )

        total = len(products)
        job.total = total
        db.commit()

        ai = get_ai_provider()
        batch_size = settings.categorization_batch_size

        for start in range(0, total, batch_size):
            batch = products[start: start + batch_size]
            batch_data = [p.data for p in batch]

            try:
                results = await ai.classify_relevance_batch(batch_data, target)
            except Exception as exc:
                logger.exception("Relevance batch failed at index %d", start)
                job.status = "failed"
                job.error = str(exc)
                db.commit()
                return

            for product, result in zip(batch, results):
                product.ai_relevance = result["relevance"]
                product.ai_relevance_confidence = result["confidence"]
                product.ai_relevance_reasoning = result["reasoning"]
                # Default keep/exclude based on label
                if product.keep is None:
                    product.keep = result["relevance"] != "Not Relevant"

            processed = min(start + batch_size, total)
            job.processed = processed
            job.progress = int(processed / total * 100)
            db.commit()
            await asyncio.sleep(0)

        project.status = "relevance_review"
        job.status = "completed"
        job.progress = 100
        job.processed = total
        job.completed_at = datetime.utcnow()
        db.commit()

    except Exception as exc:
        logger.exception("Unexpected error in relevance job %s", job_id)
        try:
            job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error = str(exc)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
        _running_jobs.pop(job_id, None)


# ── Categorization job ─────────────────────────────────────────────────────────

async def _run_categorization(job_id: str, project_id: int) -> None:
    db: Session = SessionLocal()
    try:
        job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
        if not job:
            return
        job.status = "running"
        db.commit()

        project = db.query(Project).filter(Project.id == project_id).first()
        target = _project_target_dict(project)

        # Only categorize kept products
        products = (
            db.query(Product)
            .filter(Product.project_id == project_id, Product.keep == True)  # noqa: E712
            .order_by(Product.row_index)
            .all()
        )

        dimensions = (
            db.query(CategorizationDimension)
            .filter(
                CategorizationDimension.project_id == project_id,
                CategorizationDimension.approved == True,  # noqa: E712
            )
            .order_by(CategorizationDimension.order)
            .all()
        )

        dims_payload = [
            {
                "id": d.id,
                "name": d.name,
                "description": d.description,
                "taxonomy_values": d.taxonomy_values,
            }
            for d in dimensions
        ]

        total = len(products)
        job.total = total
        db.commit()

        ai = get_ai_provider()
        batch_size = settings.categorization_batch_size

        for start in range(0, total, batch_size):
            batch = products[start: start + batch_size]
            batch_data = [p.data for p in batch]

            try:
                results = await ai.categorize_products_batch(batch_data, dims_payload, target)
            except Exception as exc:
                logger.exception("Categorization batch failed at index %d", start)
                job.status = "failed"
                job.error = str(exc)
                db.commit()
                return

            for product, assignments in zip(batch, results):
                product.ai_categories = assignments
                # Pre-populate final_categories from AI (user must still review)
                product.final_categories = {
                    a["dimension_name"]: a["value"] for a in assignments
                }
                product.categorized = False  # user hasn't approved yet

            processed = min(start + batch_size, total)
            job.processed = processed
            job.progress = int(processed / total * 100)
            db.commit()
            await asyncio.sleep(0)

        project.status = "review"
        job.status = "completed"
        job.progress = 100
        job.processed = total
        job.completed_at = datetime.utcnow()
        db.commit()

    except Exception as exc:
        logger.exception("Unexpected error in categorization job %s", job_id)
        try:
            job = db.query(BackgroundJob).filter(BackgroundJob.id == job_id).first()
            if job:
                job.status = "failed"
                job.error = str(exc)
                db.commit()
        except Exception:
            pass
    finally:
        db.close()
        _running_jobs.pop(job_id, None)


# ── Public API ─────────────────────────────────────────────────────────────────

async def start_relevance_job(project_id: int) -> str:
    job_id = str(uuid.uuid4())
    db: Session = SessionLocal()
    try:
        job = BackgroundJob(
            id=job_id, project_id=project_id,
            job_type="relevance", status="pending",
        )
        db.add(job)
        project = db.query(Project).filter(Project.id == project_id).first()
        project.status = "relevance_pending"
        db.commit()
    finally:
        db.close()

    task = asyncio.create_task(_run_relevance(job_id, project_id))
    _running_jobs[job_id] = task
    return job_id


async def start_categorization_job(project_id: int) -> str:
    job_id = str(uuid.uuid4())
    db: Session = SessionLocal()
    try:
        job = BackgroundJob(
            id=job_id, project_id=project_id,
            job_type="categorization", status="pending",
        )
        db.add(job)
        project = db.query(Project).filter(Project.id == project_id).first()
        project.status = "categorizing"
        db.commit()
    finally:
        db.close()

    task = asyncio.create_task(_run_categorization(job_id, project_id))
    _running_jobs[job_id] = task
    return job_id

