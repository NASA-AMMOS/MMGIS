---
layout: page
title: Video
permalink: /configure/layers/video
parent: Layers
grand_parent: Configure
---

# Video Layer

Video layers display .webm, .mp4, and .gif video files overlaid on the map using Leaflet's VideoOverlay API. The video is positioned on the map using a bounding box and can be controlled through the LayersTool settings panel.

#### Layer Name

_type:_ string
The unique display name and identifier of the layer. It must be unique and contain no special characters.

#### URL

_type:_ string
A file path that points to a video file (.webm, .mp4, or .gif). If the path is relative, it will be relative to the mission's directory. The video will be displayed as an overlay on the map.

#### Bounding Box

_type:_ array
A comma-separated array of four numbers defining the video overlay's position: `[minx, miny, maxx, maxy]` in longitude/latitude coordinates. This defines where on the map the video will be positioned.

Example: `[-122.5, 37.7, -122.3, 37.9]`

#### Initial Visibility

_type:_ bool
Whether the layer is on initially.

#### Initial Opacity

_type:_ float
A value from 0 (transparent) to 1 (opaque) of the layer's initial opacity. 1 is fully opaque.

#### Minimum Zoom

_type:_ integer _optional_
The lowest (smallest number) zoom level for which to show this layer. If the current Map's zoom level is less than this, the layer will not be rendered even if the layer is still on.

#### Maximum Zoom

_type:_ integer _optional_
The highest (greatest number) zoom level for which to show this layer. If the current Map's zoom level is higher/deeper than this, the layer will not be rendered even if the layer is still on.

## Video Settings

#### Autoplay

_type:_ bool
Whether the video should automatically start playing when the layer is loaded.

#### Loop

_type:_ bool
Whether the video should loop continuously when it reaches the end.

#### Muted

_type:_ bool
Whether the video should be muted by default. Note that many browsers require videos to be muted for autoplay to work.

#### Plays Inline

_type:_ bool
Forces the video to play inline rather than in fullscreen mode on mobile devices.

## Playback Controls

Video layers include playback controls in the LayersTool settings panel:

- **Play/Pause**: Toggle video playback
- **Restart**: Restart the video from the beginning
- **Mute/Unmute**: Toggle audio on/off

These controls allow users to interact with the video overlay directly from the MMGIS interface without needing to access browser video controls.

## Supported Formats

Video layers support the following video formats:

- **.webm** - Recommended for web use, good compression and quality
- **.mp4** - Widely supported format, good for compatibility
- **.gif** - Animated GIF files (though .webm or .mp4 are recommended for better performance)

## Performance Notes

- Video layers use the browser's native video element, so performance depends on the video file size and format
- For best performance, use optimized video files with appropriate resolutions for your map scale
- Consider using .webm format for better compression and web performance
- Large video files may take time to load and could impact map performance on slower connections

## Example Configuration

```json
{
  "name": "Weather Animation",
  "type": "video",
  "url": "data/weather_animation.webm",
  "boundingBox": [-118.5, 34.0, -117.8, 34.5],
  "visibility": true,
  "initialOpacity": 0.8,
  "minZoom": 10,
  "maxZoom": 16,
  "variables": {
    "video": {
      "autoplay": false,
      "loop": true,
      "muted": true
    }
  }
}
```