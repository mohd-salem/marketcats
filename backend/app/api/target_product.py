"""
Target product endpoints.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import Project, TargetProduct
from app.schemas.project import TargetProductUpsert, TargetProductOut

router = APIRouter()


@router.get("/{project_id}/target-product", response_model=TargetProductOut | None)
def get_target_product(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    return project.target_product


@router.put("/{project_id}/target-product", response_model=TargetProductOut)
def upsert_target_product(
    project_id: int,
    payload: TargetProductUpsert,
    db: Session = Depends(get_db),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    tp = project.target_product
    if tp is None:
        tp = TargetProduct(project_id=project_id)
        db.add(tp)

    for field, val in payload.model_dump(exclude_unset=False).items():
        setattr(tp, field, val)

    db.commit()
    db.refresh(tp)
    return tp


@router.delete("/{project_id}/target-product", status_code=204)
def delete_target_product(project_id: int, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if project.target_product:
        db.delete(project.target_product)
        db.commit()
