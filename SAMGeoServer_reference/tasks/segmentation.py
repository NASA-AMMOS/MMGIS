"""Celery tasks for background segmentation processing."""
import os
import traceback
from celery import Celery
from celery.signals import worker_ready
from app.core.config import settings
from app.core.model_manager import ModelManager
from app.utils.geojson_converter import masks_to_geojson


# Initialize Celery app
celery_app = Celery(
    'samgeo',
    broker=settings.REDIS_URL,
    backend=settings.CELERY_RESULT_BACKEND
)

# Celery configuration
celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='UTC',
    enable_utc=True,
    result_expires=settings.RESULT_EXPIRY,
)


@worker_ready.connect
def on_worker_ready(**kwargs):
    """
    Initialize SAM3 model when Celery worker starts.

    This ensures the model is loaded once at startup rather than
    on the first request, providing consistent response times.
    """
    print("=" * 60)
    print("Celery worker starting - initializing SAM3 model...")
    print("=" * 60)

    try:
        model_manager = ModelManager.get_instance()
        model_manager.initialize()
        print("✓ SAM3 model initialized successfully!")
        print("✓ Worker is ready to process segmentation tasks")
        print("=" * 60)
    except Exception as e:
        print(f"✗ Failed to initialize SAM3 model: {e}")
        print("=" * 60)
        raise


@celery_app.task(bind=True, name='segment_by_text')
def segment_by_text(self, image_path: str, prompt: str, confidence_threshold: float = 0.7,
                    min_size: int = 0, max_size: int = None):
    """
    Background task for text-based segmentation.

    Args:
        self: Celery task instance
        image_path: Path to uploaded image
        prompt: Natural language description
        confidence_threshold: Minimum confidence score
        min_size: Minimum mask size in pixels
        max_size: Maximum mask size in pixels

    Returns:
        Dict with success status, num_objects, and geojson
    """
    try:
        # Update task state
        self.update_state(state='PROCESSING', meta={'step': 'Loading model'})

        # Get model instance
        model_manager = ModelManager.get_instance()
        if not model_manager.is_initialized:
            model_manager.initialize()

        sam = model_manager.get_model()

        # Update task state
        self.update_state(state='PROCESSING', meta={'step': 'Setting image'})

        # Set image
        sam.set_image(image_path)

        # Update task state
        self.update_state(state='PROCESSING', meta={'step': 'Generating masks'})

        # Generate masks
        sam.generate_masks(
            prompt=prompt,
            confidence_threshold=confidence_threshold
        )

        # Filter by size if specified
        if sam.masks and (min_size > 0 or max_size is not None):
            filtered_masks = []
            filtered_scores = []

            for mask, score in zip(sam.masks, sam.scores):
                mask_size = sum(sum(mask > 0))
                if min_size > 0 and mask_size < min_size:
                    continue
                if max_size is not None and mask_size > max_size:
                    continue
                filtered_masks.append(mask)
                filtered_scores.append(score)

            sam.masks = filtered_masks
            sam.scores = filtered_scores

        # Update task state
        self.update_state(state='PROCESSING', meta={'step': 'Converting to GeoJSON'})

        # Convert to GeoJSON
        if sam.masks and len(sam.masks) > 0:
            geojson = masks_to_geojson(
                sam.masks,
                sam.scores,
                image_path,
                settings.TEMP_DIR
            )
        else:
            geojson = {
                "type": "FeatureCollection",
                "features": []
            }

        return {
            'success': True,
            'num_objects': len(sam.masks) if sam.masks else 0,
            'geojson': geojson
        }

    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Error in segment_by_text: {error_trace}")
        return {
            'success': False,
            'num_objects': 0,
            'geojson': None,
            'error': str(e)
        }

    finally:
        # Cleanup uploaded image
        if os.path.exists(image_path):
            try:
                os.remove(image_path)
            except Exception as e:
                print(f"Failed to delete temporary file {image_path}: {e}")


@celery_app.task(bind=True, name='segment_by_boxes')
def segment_by_boxes(self, image_path: str, boxes: list, confidence_threshold: float = 0.5,
                     min_size: int = 0, max_size: int = None):
    """
    Background task for bounding box-based segmentation.

    Args:
        self: Celery task instance
        image_path: Path to uploaded image
        boxes: List of bounding boxes [[xmin, ymin, xmax, ymax], ...]
        confidence_threshold: Minimum confidence score
        min_size: Minimum mask size in pixels
        max_size: Maximum mask size in pixels

    Returns:
        Dict with success status, num_objects, and geojson
    """
    try:
        # Update task state
        self.update_state(state='PROCESSING', meta={'step': 'Loading model'})

        # Get model instance
        model_manager = ModelManager.get_instance()
        if not model_manager.is_initialized:
            model_manager.initialize()

        sam = model_manager.get_model()

        # Update task state
        self.update_state(state='PROCESSING', meta={'step': 'Setting image'})

        # Set image
        sam.set_image(image_path)

        # Update task state
        self.update_state(state='PROCESSING', meta={'step': 'Generating masks from boxes'})

        # Generate masks from boxes
        sam.generate_masks_by_boxes(
            boxes=boxes,
            confidence_threshold=confidence_threshold
        )

        # Filter by size if specified
        if sam.masks and (min_size > 0 or max_size is not None):
            filtered_masks = []
            filtered_scores = []

            for mask, score in zip(sam.masks, sam.scores):
                mask_size = sum(sum(mask > 0))
                if min_size > 0 and mask_size < min_size:
                    continue
                if max_size is not None and mask_size > max_size:
                    continue
                filtered_masks.append(mask)
                filtered_scores.append(score)

            sam.masks = filtered_masks
            sam.scores = filtered_scores

        # Update task state
        self.update_state(state='PROCESSING', meta={'step': 'Converting to GeoJSON'})

        # Convert to GeoJSON
        if sam.masks and len(sam.masks) > 0:
            geojson = masks_to_geojson(
                sam.masks,
                sam.scores,
                image_path,
                settings.TEMP_DIR
            )
        else:
            geojson = {
                "type": "FeatureCollection",
                "features": []
            }

        return {
            'success': True,
            'num_objects': len(sam.masks) if sam.masks else 0,
            'geojson': geojson
        }

    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Error in segment_by_boxes: {error_trace}")
        return {
            'success': False,
            'num_objects': 0,
            'geojson': None,
            'error': str(e)
        }

    finally:
        # Cleanup uploaded image
        if os.path.exists(image_path):
            try:
                os.remove(image_path)
            except Exception as e:
                print(f"Failed to delete temporary file {image_path}: {e}")


@celery_app.task(bind=True, name='segment_by_points')
def segment_by_points(self, image_path: str, point_coords: list, point_labels: list,
                      multimask_output: bool = True, confidence_threshold: float = 0.5,
                      min_size: int = 0, max_size: int = None):
    """
    Background task for point-based segmentation.

    Args:
        self: Celery task instance
        image_path: Path to uploaded image
        point_coords: List of point coordinates [[x, y], ...]
        point_labels: List of point labels (1=foreground, 0=background)
        multimask_output: Whether to output multiple masks per point
        confidence_threshold: Minimum confidence score
        min_size: Minimum mask size in pixels
        max_size: Maximum mask size in pixels

    Returns:
        Dict with success status, num_objects, and geojson
    """
    try:
        # Update task state
        self.update_state(state='PROCESSING', meta={'step': 'Loading model'})

        # Get model instance
        model_manager = ModelManager.get_instance()
        if not model_manager.is_initialized:
            model_manager.initialize()

        sam = model_manager.get_model()

        # Update task state
        self.update_state(state='PROCESSING', meta={'step': 'Setting image'})

        # Set image
        sam.set_image(image_path)

        # Update task state
        self.update_state(state='PROCESSING', meta={'step': 'Generating masks from points'})

        # Generate masks from points
        sam.generate_masks_by_points(
            point_coords_batch=point_coords,
            point_labels_batch=point_labels,
            multimask_output=multimask_output,
            confidence_threshold=confidence_threshold
        )

        # Filter by size if specified
        if sam.masks and (min_size > 0 or max_size is not None):
            filtered_masks = []
            filtered_scores = []

            for mask, score in zip(sam.masks, sam.scores):
                mask_size = sum(sum(mask > 0))
                if min_size > 0 and mask_size < min_size:
                    continue
                if max_size is not None and mask_size > max_size:
                    continue
                filtered_masks.append(mask)
                filtered_scores.append(score)

            sam.masks = filtered_masks
            sam.scores = filtered_scores

        # Update task state
        self.update_state(state='PROCESSING', meta={'step': 'Converting to GeoJSON'})

        # Convert to GeoJSON
        if sam.masks and len(sam.masks) > 0:
            geojson = masks_to_geojson(
                sam.masks,
                sam.scores,
                image_path,
                settings.TEMP_DIR
            )
        else:
            geojson = {
                "type": "FeatureCollection",
                "features": []
            }

        return {
            'success': True,
            'num_objects': len(sam.masks) if sam.masks else 0,
            'geojson': geojson
        }

    except Exception as e:
        error_trace = traceback.format_exc()
        print(f"Error in segment_by_points: {error_trace}")
        return {
            'success': False,
            'num_objects': 0,
            'geojson': None,
            'error': str(e)
        }

    finally:
        # Cleanup uploaded image
        if os.path.exists(image_path):
            try:
                os.remove(image_path)
            except Exception as e:
                print(f"Failed to delete temporary file {image_path}: {e}")
