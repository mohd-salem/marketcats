from datetime import datetime
from typing import Any
from pydantic import BaseModel


# ── Project ───────────────────────────────────────────────────────────────────

class ProjectCreate(BaseModel):
    name: str
    description: str | None = None


class ProjectOut(BaseModel):
    id: int
    name: str
    description: str | None
    original_filename: str | None
    file_columns: list[str] | None
    status: str
    product_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ── Target Product ─────────────────────────────────────────────────────────────

class TargetProductUpsert(BaseModel):
    asin: str | None = None
    amazon_url: str | None = None
    image_url: str | None = None
    image_data: str | None = None
    description: str | None = None
    main_function: str | None = None
    exclusion_rules: list[str] | None = None


class TargetProductOut(TargetProductUpsert):
    id: int
    project_id: int

    model_config = {"from_attributes": True}


# ── Products ──────────────────────────────────────────────────────────────────

class ProductOut(BaseModel):
    id: int
    row_index: int
    data: dict[str, Any]

    # Relevance
    ai_relevance: str | None
    ai_relevance_confidence: float | None
    ai_relevance_reasoning: str | None
    user_relevance: str | None
    keep: bool | None
    relevance_reviewed: bool

    # Categorization
    ai_categories: list[dict[str, Any]] | None
    final_categories: dict[str, str] | None
    categorized: bool
    final_notes: str | None
    manual_override: str | None

    model_config = {"from_attributes": True}


class ProductsPage(BaseModel):
    products: list[ProductOut]
    total: int
    page: int
    per_page: int


# ── Relevance patch (single product) ─────────────────────────────────────────

class RelevancePatch(BaseModel):
    user_relevance: str | None = None
    keep: bool | None = None
    relevance_reviewed: bool | None = None


# ── Relevance bulk patch ──────────────────────────────────────────────────────

class RelevanceBulkPatch(BaseModel):
    product_ids: list[int]
    keep: bool


# ── Category patch (single product) ──────────────────────────────────────────

class CategoryPatch(BaseModel):
    final_categories: dict[str, str] | None = None
    final_notes: str | None = None
    manual_override: str | None = None
    categorized: bool | None = None


# ── Category bulk patch ────────────────────────────────────────────────────────

class CategoryBulkPatch(BaseModel):
    product_ids: list[int]
    dimension_name: str
    value: str

