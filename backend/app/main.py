from contextlib import asynccontextmanager
import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.db.database import create_tables
from app.api import projects, target_product, categorization, exports


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_tables()
    yield


app = FastAPI(
    title="MA-Cats",
    description="AI-powered product categorization for Amazon/Helium 10 datasets",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow all origins when CORS_ALLOW_ALL=true (set in Railway for cross-origin access)
_allow_all = os.getenv("CORS_ALLOW_ALL", "false").lower() == "true"

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if _allow_all else [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://marketcats.vercel.app",
    ],
    allow_credentials=not _allow_all,  # credentials not allowed with wildcard
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

app.include_router(projects.router,       prefix="/api/projects", tags=["projects"])
app.include_router(target_product.router, prefix="/api/projects", tags=["target-product"])
app.include_router(categorization.router, prefix="/api/projects", tags=["categorization"])
app.include_router(exports.router,        prefix="/api/projects", tags=["exports"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
