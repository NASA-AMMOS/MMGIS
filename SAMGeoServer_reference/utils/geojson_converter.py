"""Convert segmentation masks to GeoJSON polygons."""
import os
import json
import numpy as np
from uuid import uuid4
from typing import List, Dict, Any
from PIL import Image
from samgeo import common


def masks_to_geojson(
    masks: List[np.ndarray],
    scores: List[float],
    image_path: str,
    temp_dir: str,
    simplify_tolerance: float = 0.5
) -> Dict[str, Any]:
    """
    Convert segmentation masks to GeoJSON polygons.

    Uses samgeo's raster_to_vector functionality:
    1. Create temporary GeoTIFF from masks with unique values per mask
    2. Convert raster to vector using common.raster_to_vector()
    3. Parse resulting GeoJSON
    4. Add properties (confidence scores, object IDs)
    5. Clean up temporary files

    Args:
        masks: List of binary mask arrays
        scores: List of confidence scores for each mask
        image_path: Path to original image (for georeferencing)
        temp_dir: Directory for temporary files
        simplify_tolerance: Tolerance for polygon simplification

    Returns:
        GeoJSON FeatureCollection with polygon features
    """
    if not masks or len(masks) == 0:
        return {
            "type": "FeatureCollection",
            "features": []
        }

    # Get image dimensions
    with Image.open(image_path) as img:
        width, height = img.size

    # Create mask array with unique values for each mask
    mask_array = np.zeros((height, width), dtype=np.uint16)

    for idx, mask in enumerate(masks):
        # Handle different mask formats
        if hasattr(mask, "cpu"):
            mask_np = mask.squeeze().cpu().numpy()
        elif hasattr(mask, "numpy"):
            mask_np = mask.squeeze().numpy()
        else:
            mask_np = mask.squeeze() if hasattr(mask, "squeeze") else mask

        # Ensure mask is 2D
        if mask_np.ndim > 2:
            mask_np = mask_np[0]

        # Convert to boolean
        mask_bool = mask_np > 0

        # Assign unique value (starting from 1)
        mask_array[mask_bool] = idx + 1

    # Generate unique filenames
    unique_id = str(uuid4())
    temp_raster = os.path.join(temp_dir, f"masks_{unique_id}.tif")
    temp_vector = os.path.join(temp_dir, f"vectors_{unique_id}.geojson")

    try:
        # Save mask array as GeoTIFF using samgeo's utility
        common.array_to_image(mask_array, temp_raster, image_path, dtype="uint16")

        # Convert raster to vector (GeoJSON)
        common.raster_to_vector(
            temp_raster,
            temp_vector,
            simplify_tolerance=simplify_tolerance
        )

        # Read GeoJSON
        with open(temp_vector, 'r') as f:
            geojson = json.load(f)

        # Enhance features with confidence scores and object IDs
        # The raster_to_vector function creates features with a 'value' property
        # that corresponds to the mask value (1, 2, 3, ...)
        for feature in geojson.get('features', []):
            # Get the mask value from properties
            mask_value = feature.get('properties', {}).get('value', 0)

            if mask_value > 0:
                # Convert to 0-based index
                idx = int(mask_value) - 1

                if idx < len(scores):
                    # Add confidence score
                    if hasattr(scores[idx], "item"):
                        score = scores[idx].item()
                    else:
                        score = float(scores[idx])

                    feature['properties']['confidence'] = score
                    feature['properties']['object_id'] = idx + 1

        return geojson

    finally:
        # Cleanup temporary files
        if os.path.exists(temp_raster):
            os.remove(temp_raster)
        if os.path.exists(temp_vector):
            os.remove(temp_vector)


def masks_to_geojson_simple(
    masks: List[np.ndarray],
    scores: List[float]
) -> Dict[str, Any]:
    """
    Simplified version without georeferencing.
    Creates basic GeoJSON with bounding box polygons.

    Args:
        masks: List of binary mask arrays
        scores: List of confidence scores

    Returns:
        GeoJSON FeatureCollection with bounding box polygons
    """
    features = []

    for idx, mask in enumerate(masks):
        # Handle different mask formats
        if hasattr(mask, "cpu"):
            mask_np = mask.squeeze().cpu().numpy()
        elif hasattr(mask, "numpy"):
            mask_np = mask.squeeze().numpy()
        else:
            mask_np = mask.squeeze() if hasattr(mask, "squeeze") else mask

        # Ensure mask is 2D
        if mask_np.ndim > 2:
            mask_np = mask_np[0]

        # Get bounding box
        ys, xs = np.where(mask_np > 0)

        if len(xs) > 0 and len(ys) > 0:
            xmin, xmax = int(xs.min()), int(xs.max())
            ymin, ymax = int(ys.min()), int(ys.max())

            # Create bounding box polygon
            bbox_coords = [
                [[xmin, ymin], [xmax, ymin], [xmax, ymax], [xmin, ymax], [xmin, ymin]]
            ]

            # Get score
            if hasattr(scores[idx], "item"):
                score = scores[idx].item()
            else:
                score = float(scores[idx])

            feature = {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": bbox_coords
                },
                "properties": {
                    "object_id": idx + 1,
                    "confidence": score,
                    "area": int(np.sum(mask_np > 0))
                }
            }

            features.append(feature)

    return {
        "type": "FeatureCollection",
        "features": features
    }
