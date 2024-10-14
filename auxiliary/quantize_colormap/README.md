# quantize_colormap.py

```shell
usage: quantize_colormap.py [-h] [-c COLORMAP] [-i INPUT] [-n NODATA] [-o OUTPUT_DIR] [-0] [-m]

Generate quantized MPL colormaps from tiff files.

options:
  -h, --help            show this help message and exit
  -c COLORMAP, --colormap COLORMAP
                        matplotlib colormap to use
  -i INPUT, --input INPUT
                        TIFF file or directory containing raw input TIFF files
  -n NODATA, --nodata NODATA
                        nodata value
  -o OUTPUT_DIR, --output_dir OUTPUT_DIR
                        Directory containing output colormaps
  -0, --ignore_zeroes   Ignore zero and under values
  -m, --ignore_min      Ignore min value
```
