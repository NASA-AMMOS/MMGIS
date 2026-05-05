## Tool: Curtain

_View Ground Penetrating Radar (GPR) subsurface imagery along traverse paths._

### Overview

The Curtain Tool displays radargram images as vertical curtain panels along surface traverse paths, allowing visualization of subsurface structure beneath rover tracks or other linear features.

### Interface

- **Clear** — Remove all active curtain displays.
- **Keep On in 3D** — Checkbox to persist curtain imagery when switching to 3D globe view.
- **Vertical Exaggeration** — Adjust the vertical scale of the curtain display.
- **Vertical Offset** — Adjust the vertical position of the curtain relative to the surface.

#### Usage

Click on a feature with associated radargram data to display its curtain. Multiple curtains can be displayed simultaneously. Hover over the curtain to see coordinate information.

### Configuration

| Variable | Description |
|---|---|
| `datasetLinks` | Map of layer names to radargram image URLs |
