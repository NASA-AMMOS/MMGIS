"""Configuration settings for SAMGeo3 API."""
import os
from typing import Optional
from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Application settings."""

    # Model settings
    MODEL_PATH: str = "sam3.pt"
    DEVICE: str = "cuda"
    CONFIDENCE_THRESHOLD: float = 0.7
    ENABLE_INST_INTERACTIVITY: bool = True

    # Redis/Celery
    REDIS_URL: str = "redis://redis:6379/0"
    CELERY_RESULT_BACKEND: str = "redis://redis:6379/1"

    # API settings
    MAX_UPLOAD_SIZE: int = 20 * 1024 * 1024  # 20MB
    TEMP_DIR: str = "/tmp/samgeo"
    RESULT_EXPIRY: int = 3600  # 1 hour

    # Server settings
    HOST: str = "0.0.0.0"
    PORT: int = 8115
    LOG_LEVEL: str = "info"

    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()
