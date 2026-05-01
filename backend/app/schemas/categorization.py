from pydantic import BaseModel


# ── Dimensions ────────────────────────────────────────────────────────────────

class DimensionCreate(BaseModel):
    name: str
    description: str | None = None
    taxonomy_values: list[str]
    approved: bool = False
    order: int = 0


class DimensionUpdate(DimensionCreate):
    id: int | None = None


class DimensionOut(BaseModel):
    id: int
    project_id: int
    name: str
    description: str | None
    taxonomy_values: list[str]
    ai_suggested: bool
    approved: bool
    order: int

    model_config = {"from_attributes": True}


class DimensionsBulkUpdate(BaseModel):
    dimensions: list[DimensionUpdate]


class DimensionLockRequest(BaseModel):
    """Lock (approve) a single dimension — taxonomy becomes immutable for AI."""
    pass


# ── Job ───────────────────────────────────────────────────────────────────────

class JobOut(BaseModel):
    id: str
    project_id: int
    job_type: str
    status: str
    progress: int
    processed: int
    total: int
    error: str | None

    model_config = {"from_attributes": True}


# ── Dashboard summary ─────────────────────────────────────────────────────────

class RelevanceSummary(BaseModel):
    label: str
    count: int
    kept: int
    excluded: int
    pending: int


class DimensionBreakdown(BaseModel):
    dimension_name: str
    values: dict[str, int]   # value → count


class DashboardOut(BaseModel):
    total_products: int
    relevance_summary: list[RelevanceSummary]
    kept_count: int
    excluded_count: int
    pending_count: int
    categorized_count: int
    dimension_breakdowns: list[DimensionBreakdown]

