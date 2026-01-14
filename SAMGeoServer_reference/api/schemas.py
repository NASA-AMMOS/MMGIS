"""Pydantic schemas for request and response models."""
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class TextSegmentRequest(BaseModel):
    """Request schema for text-based segmentation."""
    prompt: str = Field(..., description="Natural language description of objects to segment (e.g., 'building', 'tree')")
    confidence_threshold: float = Field(0.7, ge=0.0, le=1.0, description="Minimum confidence score for masks")
    min_size: int = Field(0, ge=0, description="Minimum mask size in pixels")
    max_size: Optional[int] = Field(None, ge=0, description="Maximum mask size in pixels")


class BoxSegmentRequest(BaseModel):
    """Request schema for bounding box-based segmentation."""
    boxes: List[List[float]] = Field(..., description="Bounding boxes in [[xmin, ymin, xmax, ymax], ...] format")
    confidence_threshold: float = Field(0.5, ge=0.0, le=1.0, description="Minimum confidence score for masks")
    min_size: int = Field(0, ge=0, description="Minimum mask size in pixels")
    max_size: Optional[int] = Field(None, ge=0, description="Maximum mask size in pixels")


class PointSegmentRequest(BaseModel):
    """Request schema for point-based segmentation."""
    point_coords: List[List[float]] = Field(..., description="Point coordinates in [[x, y], ...] format")
    point_labels: List[int] = Field(..., description="Point labels: 1=foreground, 0=background")
    multimask_output: bool = Field(True, description="Whether to output multiple masks per point")
    confidence_threshold: float = Field(0.5, ge=0.0, le=1.0, description="Minimum confidence score for masks")
    min_size: int = Field(0, ge=0, description="Minimum mask size in pixels")
    max_size: Optional[int] = Field(None, ge=0, description="Maximum mask size in pixels")


class TaskResponse(BaseModel):
    """Response schema for task submission."""
    task_id: str = Field(..., description="Unique identifier for the background task")
    status: str = Field(..., description="Current task status: 'pending', 'processing', 'success', 'failure'")


class TaskStatusResponse(BaseModel):
    """Response schema for task status check."""
    task_id: str = Field(..., description="Unique identifier for the background task")
    status: str = Field(..., description="Current task status")
    ready: bool = Field(..., description="Whether the task has completed (success or failure)")


class SegmentationResult(BaseModel):
    """Response schema for segmentation results."""
    success: bool = Field(..., description="Whether the segmentation succeeded")
    num_objects: int = Field(..., description="Number of objects detected")
    geojson: Optional[Dict[str, Any]] = Field(None, description="GeoJSON FeatureCollection with segmentation polygons")
    error: Optional[str] = Field(None, description="Error message if segmentation failed")


class HealthResponse(BaseModel):
    """Response schema for health check."""
    status: str = Field(..., description="Server status: 'healthy' or 'unhealthy'")
    gpu_available: bool = Field(..., description="Whether GPU is available")
    device: str = Field(..., description="Device being used: 'cuda' or 'cpu'")
    gpu_name: Optional[str] = Field(None, description="Name of GPU if available")
