import os

from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# Use DATABASE_URL (PostgreSQL) in production; fall back to SQLite locally.
_DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./ma_cats.db")

# Railway PostgreSQL URLs start with "postgres://" but SQLAlchemy requires "postgresql://"
if _DATABASE_URL.startswith("postgres://"):
    _DATABASE_URL = _DATABASE_URL.replace("postgres://", "postgresql://", 1)

_is_sqlite = _DATABASE_URL.startswith("sqlite")

engine = create_engine(
    _DATABASE_URL,
    connect_args={"check_same_thread": False} if _is_sqlite else {},
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables():
    from .models import Project, Product, TargetProduct, CategorizationDimension, BackgroundJob  # noqa
    Base.metadata.create_all(bind=engine)
