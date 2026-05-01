"""
Excel export endpoint.
"""

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import CategorizationDimension, Product, Project
from app.services.excel_service import build_excel_export

router = APIRouter()


@router.get("/{project_id}/export/excel")
def export_excel(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if not project.file_path or not Path(project.file_path).exists():
        raise HTTPException(status_code=400, detail="Original file not found — re-upload the source file")

    approved_dimensions = (
        db.query(CategorizationDimension)
        .filter(
            CategorizationDimension.project_id == project_id,
            CategorizationDimension.approved == True,  # noqa: E712
        )
        .order_by(CategorizationDimension.order)
        .all()
    )

    products = (
        db.query(Product)
        .filter(Product.project_id == project_id)
        .order_by(Product.row_index)
        .all()
    )

    products_payload = [
        {
            "row_index": p.row_index,
            "data": p.data,
            "ai_relevance": p.ai_relevance,
            "ai_relevance_confidence": p.ai_relevance_confidence,
            "ai_relevance_reasoning": p.ai_relevance_reasoning,
            "keep": p.keep,
            "ai_categories": p.ai_categories or [],
            "final_categories": p.final_categories or {},
            "final_notes": p.final_notes,
            "manual_override": p.manual_override,
            "categorized": p.categorized,
        }
        for p in products
    ]

    dimensions_payload = [{"id": d.id, "name": d.name} for d in approved_dimensions]

    xlsx_bytes = build_excel_export(
        Path(project.file_path),
        products_payload,
        dimensions_payload,
    )

    safe_name = (project.original_filename or "export").rsplit(".", 1)[0]
    filename = f"{safe_name}_categorized.xlsx"

    return Response(
        content=xlsx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )

