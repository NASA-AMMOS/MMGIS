# 3D Model Layers

This directory is for **optional** local 3D model files. By default, the Kitchen Sink configuration uses **external URLs** to NASA 3D Resources.

## Purpose

Demonstrate MMGIS Model layer type for Globe (Cesium) view, showing spacecraft, landers, and other 3D assets.

## Formats Supported

### GLTF/GLB (Recommended)
- **GLTF** (.gltf): JSON format with separate geometry/texture files
- **GLB** (.glb): Binary format with embedded data
- Best performance and features in Cesium
- Supports animations, PBR materials

### OBJ
- **OBJ** (.obj): Geometry file
- **MTL** (.mtl): Material definitions
- **Textures**: PNG/JPG texture files
- Widely supported, simple format

### COLLADA (DAE)
- **DAE** (.dae): XML-based format
- Can include geometry, materials, animations
- Good for complex models

## Where to Get Models

### NASA 3D Resources (Primary Source)
**URL**: https://science.nasa.gov/3d-resources/

Available models include:
- Mars rovers (Curiosity, Perseverance, etc.)
- Spacecraft (Voyager, Cassini, James Webb, etc.)
- Planets and moons
- Landers and orbiters

**Format**: Most models available in OBJ, GLTF, COLLADA

### Other Sources
- **Sketchfab**: https://sketchfab.com/ (some free models)
- **NASA Photojournal**: https://photojournal.jpl.nasa.gov/
- **Cesium Ion**: https://ion.cesium.com/ (optimized 3D content)

## Configuration

The Kitchen Sink config uses **external URLs** by default:

```json
{
  "name": "Model - GLTF - Curiosity Rover",
  "type": "model",
  "url": "https://science.nasa.gov/...path-to-model.gltf",
  "position": [37.8, -122.4, 100],
  "scale": 10,
  "rotation": [0, 0, 0]
}
```

### Why External URLs?

- **No large files in git**: 3D models can be 10-100MB+
- **No git-lfs needed**: Avoids complexity
- **NASA CDN**: Fast, reliable hosting
- **Easy updates**: Change URL without re-downloading

### Using Local Models (Optional)

If you prefer local models:

1. Download model from NASA 3D Resources
2. Place in this directory (e.g., `curiosity_rover.gltf`)
3. Update config URL: `"url": "Missions/Kitchen-Sink/Layers/Models/curiosity_rover.gltf"`

**Note**: Add to `.gitignore` if files are large.

## Example Configuration

```json
{
  "name": "Model - GLTF - Mars Rover",
  "type": "model",
  "url": "Missions/Kitchen-Sink/Layers/Models/rover.gltf",
  "position": [37.8, -122.4, 50],
  "scale": 5,
  "rotation": [0, 45, 0],
  "show": true
}
```

**Parameters**:
- `position`: [latitude, longitude, height_in_meters]
- `scale`: Size multiplier
- `rotation`: [pitch, yaw, roll] in degrees

## Notes

- Models are **optional** (external URLs used by default)
- Globe view required to see 3D models
- External NASA URLs are stable and recommended
- Local models useful for offline demos
- Keep file sizes reasonable (< 50MB if possible)
