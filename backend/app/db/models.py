from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON, Float
)
from sqlalchemy.orm import relationship
from .database import Base


# ─────────────────────────────────────────────────────────────────────────────
# Project
# Workflow stages:
#   created → uploaded → relevance_pending → relevance_review →
#   taxonomy_building → taxonomy_locked → categorizing → review → done
# ─────────────────────────────────────────────────────────────────────────────

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    file_path = Column(String, nullable=True)
    original_filename = Column(String, nullable=True)
    file_columns = Column(JSON, nullable=True)          # list[str] original order
    status = Column(String, default="created")
    product_count = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    products = relationship("Product", back_populates="project", cascade="all, delete-orphan")
    target_product = relationship(
        "TargetProduct", back_populates="project", uselist=False, cascade="all, delete-orphan"
    )
    dimensions = relationship(
        "CategorizationDimension", back_populates="project",
        cascade="all, delete-orphan", order_by="CategorizationDimension.order"
    )
    jobs = relationship("BackgroundJob", back_populates="project", cascade="all, delete-orphan")


# ─────────────────────────────────────────────────────────────────────────────
# Product row
# ─────────────────────────────────────────────────────────────────────────────

class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    row_index = Column(Integer, nullable=False)
    data = Column(JSON, nullable=False)                 # {col: value, ...} from original file

    # ── Step 1: Relevance ─────────────────────────────────────────────────────
    # AI-assigned fields (never shown as final until user approves)
    ai_relevance = Column(String, nullable=True)        # one of RELEVANCE_LABELS
    ai_relevance_confidence = Column(Float, nullable=True)   # 0.0-1.0
    ai_relevance_reasoning = Column(Text, nullable=True)

    # User decision
    user_relevance = Column(String, nullable=True)      # overrides AI
    keep = Column(Boolean, nullable=True)               # True=keep, False=exclude, None=pending
    relevance_reviewed = Column(Boolean, default=False)

    # ── Step 2: Categorization ────────────────────────────────────────────────
    # AI-assigned, stored per-dimension as a list parallel to project.dimensions
    # [{dimension_id, value, confidence, reasoning}, ...]
    ai_categories = Column(JSON, nullable=True)

    # User-approved final categories {dimension_id: value}
    final_categories = Column(JSON, nullable=True)
    categorized = Column(Boolean, default=False)

    # Free-text fields
    final_notes = Column(Text, nullable=True)
    manual_override = Column(Text, nullable=True)

    project = relationship("Project", back_populates="products")


# ─────────────────────────────────────────────────────────────────────────────
# Target Product definition
# ─────────────────────────────────────────────────────────────────────────────

class TargetProduct(Base):
    __tablename__ = "target_products"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False, unique=True)
    asin = Column(String, nullable=True)
    amazon_url = Column(String, nullable=True)
    image_url = Column(String, nullable=True)
    image_data = Column(Text, nullable=True)            # base64 uploaded image
    description = Column(Text, nullable=True)
    main_function = Column(Text, nullable=True)
    exclusion_rules = Column(JSON, nullable=True)       # list[str]

    project = relationship("Project", back_populates="target_product")


# ─────────────────────────────────────────────────────────────────────────────
# Categorization Dimension
# Taxonomy values are locked once approved — AI cannot add new values.
# ─────────────────────────────────────────────────────────────────────────────

class CategorizationDimension(Base):
    __tablename__ = "categorization_dimensions"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    taxonomy_values = Column(JSON, nullable=False)      # list[str] — the locked approved values
    ai_suggested = Column(Boolean, default=False)
    approved = Column(Boolean, default=False)           # True = locked, AI must use only these values
    order = Column(Integer, default=0)

    project = relationship("Project", back_populates="dimensions")


# ─────────────────────────────────────────────────────────────────────────────
# Background Job (relevance or categorization run)
# ─────────────────────────────────────────────────────────────────────────────

class BackgroundJob(Base):
    __tablename__ = "background_jobs"

    id = Column(String, primary_key=True)               # UUID
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    job_type = Column(String, nullable=False)           # "relevance" | "categorization"
    status = Column(String, default="pending")          # pending | running | completed | failed
    progress = Column(Integer, default=0)               # 0-100
    processed = Column(Integer, default=0)
    total = Column(Integer, default=0)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)

    project = relationship("Project", back_populates="jobs")


# ─────────────────────────────────────────────────────────────────────────────
# Constants
# ─────────────────────────────────────────────────────────────────────────────

RELEVANCE_LABELS = [
    "Exact Target",
    "Close Target",
    "Functional Alternative",
    "Related but Different",
    "Not Relevant",
]
