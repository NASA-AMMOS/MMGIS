"""API route handlers for segmentation endpoints."""
import os
import json
import torch
from uuid import uuid4
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from app.api.schemas import (
    TextSegmentRequest,
    BoxSegmentRequest,
    PointSegmentRequest,
    TaskResponse,
    TaskStatusResponse,
    SegmentationResult,
    HealthResponse
)
from app.core.config import settings
from app.tasks.segmentation import celery_app, segment_by_text, segment_by_boxes, segment_by_points


router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """Check server health and GPU availability."""
    gpu_available = torch.cuda.is_available()
    device = "cuda" if gpu_available else "cpu"
    gpu_name = None

    if gpu_available:
        try:
            gpu_name = torch.cuda.get_device_name(0)
        except:
            gpu_name = "Unknown GPU"

    return HealthResponse(
        status="healthy",
        gpu_available=gpu_available,
        device=device,
        gpu_name=gpu_name
    )


@router.post("/segment/text", response_model=TaskResponse, tags=["Segmentation"])
async def segment_text(
    file: UploadFile = File(..., description="Image file to segment"),
    data: str = Form(..., description="JSON string with TextSegmentRequest parameters")
):
    """
    Segment image by text prompt (natural language description).

    Example request data:
    {
        "prompt": "building",
        "confidence_threshold": 0.7,
        "min_size": 0,
        "max_size": null
    }

    Returns a task_id that can be used to check status and retrieve results.
    """
    try:
        # Parse request data
        request = TextSegmentRequest.parse_raw(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid request data: {str(e)}")

    # Validate file size
    file_content = await file.read()
    if len(file_content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE / (1024*1024)}MB"
        )

    # Create temp directory if it doesn't exist
    os.makedirs(settings.TEMP_DIR, exist_ok=True)

    # Save uploaded file
    file_extension = os.path.splitext(file.filename)[1] if file.filename else '.png'
    temp_path = os.path.join(settings.TEMP_DIR, f"{uuid4()}{file_extension}")

    try:
        with open(temp_path, "wb") as f:
            f.write(file_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")

    # Submit to Celery
    task = segment_by_text.apply_async(
        args=[
            temp_path,
            request.prompt,
            request.confidence_threshold,
            request.min_size,
            request.max_size
        ]
    )

    return TaskResponse(task_id=task.id, status='pending')


@router.post("/segment/boxes", response_model=TaskResponse, tags=["Segmentation"])
async def segment_boxes(
    file: UploadFile = File(..., description="Image file to segment"),
    data: str = Form(..., description="JSON string with BoxSegmentRequest parameters")
):
    """
    Segment image by bounding boxes.

    Example request data:
    {
        "boxes": [[100, 100, 400, 400], [500, 500, 800, 800]],
        "confidence_threshold": 0.5,
        "min_size": 0,
        "max_size": null
    }

    Returns a task_id that can be used to check status and retrieve results.
    """
    try:
        # Parse request data
        request = BoxSegmentRequest.parse_raw(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid request data: {str(e)}")

    # Validate file size
    file_content = await file.read()
    if len(file_content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE / (1024*1024)}MB"
        )

    # Create temp directory if it doesn't exist
    os.makedirs(settings.TEMP_DIR, exist_ok=True)

    # Save uploaded file
    file_extension = os.path.splitext(file.filename)[1] if file.filename else '.png'
    temp_path = os.path.join(settings.TEMP_DIR, f"{uuid4()}{file_extension}")

    try:
        with open(temp_path, "wb") as f:
            f.write(file_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")

    # Submit to Celery
    task = segment_by_boxes.apply_async(
        args=[
            temp_path,
            request.boxes,
            request.confidence_threshold,
            request.min_size,
            request.max_size
        ]
    )

    return TaskResponse(task_id=task.id, status='pending')


@router.post("/segment/points", response_model=TaskResponse, tags=["Segmentation"])
async def segment_points(
    file: UploadFile = File(..., description="Image file to segment"),
    data: str = Form(..., description="JSON string with PointSegmentRequest parameters")
):
    """
    Segment image by point coordinates.

    Example request data:
    {
        "point_coords": [[250, 250], [750, 750]],
        "point_labels": [1, 1],
        "multimask_output": true,
        "confidence_threshold": 0.5,
        "min_size": 0,
        "max_size": null
    }

    Returns a task_id that can be used to check status and retrieve results.
    """
    try:
        # Parse request data
        request = PointSegmentRequest.parse_raw(data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid request data: {str(e)}")

    # Validate point coordinates and labels match
    if len(request.point_coords) != len(request.point_labels):
        raise HTTPException(
            status_code=400,
            detail="Number of point_coords must match number of point_labels"
        )

    # Validate file size
    file_content = await file.read()
    if len(file_content) > settings.MAX_UPLOAD_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large. Maximum size is {settings.MAX_UPLOAD_SIZE / (1024*1024)}MB"
        )

    # Create temp directory if it doesn't exist
    os.makedirs(settings.TEMP_DIR, exist_ok=True)

    # Save uploaded file
    file_extension = os.path.splitext(file.filename)[1] if file.filename else '.png'
    temp_path = os.path.join(settings.TEMP_DIR, f"{uuid4()}{file_extension}")

    try:
        with open(temp_path, "wb") as f:
            f.write(file_content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save uploaded file: {str(e)}")

    # Submit to Celery
    task = segment_by_points.apply_async(
        args=[
            temp_path,
            request.point_coords,
            request.point_labels,
            request.multimask_output,
            request.confidence_threshold,
            request.min_size,
            request.max_size
        ]
    )

    return TaskResponse(task_id=task.id, status='pending')


@router.get("/tasks/{task_id}", response_model=TaskStatusResponse, tags=["Tasks"])
async def get_task_status(task_id: str):
    """
    Get the status of a background task.

    Returns the current state and whether the task is ready (completed or failed).
    """
    task = celery_app.AsyncResult(task_id)

    return TaskStatusResponse(
        task_id=task_id,
        status=task.state,
        ready=task.ready()
    )


@router.get("/tasks/{task_id}/result", response_model=SegmentationResult, tags=["Tasks"])
async def get_task_result(task_id: str):
    """
    Get the result of a completed background task.

    This endpoint will block until the task completes (up to 5 minutes).
    For non-blocking status checks, use GET /tasks/{task_id}.
    """
    task = celery_app.AsyncResult(task_id)

    # Check if task exists
    if task.state == 'PENDING':
        raise HTTPException(status_code=404, detail="Task not found or not started")

    try:
        # Wait for result (5 minute timeout)
        result = task.get(timeout=300)

        return SegmentationResult(**result)

    except Exception as e:
        # Handle timeout or other errors
        if task.failed():
            return SegmentationResult(
                success=False,
                num_objects=0,
                geojson=None,
                error=f"Task failed: {str(task.info)}"
            )
        else:
            raise HTTPException(
                status_code=500,
                detail=f"Error retrieving task result: {str(e)}"
            )
