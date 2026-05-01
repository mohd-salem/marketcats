from contextlib import asynccontextmanager

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

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://marketcats.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(projects.router,       prefix="/api/projects", tags=["projects"])
app.include_router(target_product.router, prefix="/api/projects", tags=["target-product"])
app.include_router(categorization.router, prefix="/api/projects", tags=["categorization"])
app.include_router(exports.router,        prefix="/api/projects", tags=["exports"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
