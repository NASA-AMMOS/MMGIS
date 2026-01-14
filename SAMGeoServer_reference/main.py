"""FastAPI application entry point for SAMGeo3 API."""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api import routes
from app.core.config import settings


# Create FastAPI app
app = FastAPI(
    title="SAMGeo3 API",
    description="REST API for SAM3 image segmentation with GeoJSON output",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS middleware - allow all origins for development
# In production, restrict to specific origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(routes.router, prefix="/api/v1")


@app.on_event("startup")
async def startup_event():
    """Initialize on startup."""
    # Create temp directory if it doesn't exist
    os.makedirs(settings.TEMP_DIR, exist_ok=True)
    print(f"Created temporary directory: {settings.TEMP_DIR}")

    print(f"SAMGeo3 API started successfully on {settings.HOST}:{settings.PORT}")
    print(f"Model path: {settings.MODEL_PATH}")
    print(f"Device: {settings.DEVICE}")
    print(f"Redis URL: {settings.REDIS_URL}")
    print(f"API documentation available at: http://{settings.HOST}:{settings.PORT}/docs")


@app.on_event("shutdown")
async def shutdown_event():
    """Cleanup on shutdown."""
    print("SAMGeo3 API shutting down")


@app.get("/", tags=["Root"])
async def root():
    """Root endpoint."""
    return {
        "message": "SAMGeo3 API",
        "version": "1.0.0",
        "docs": "/docs",
        "health": "/api/v1/health"
    }
