# bulk_tiles.py

```shell
usage: bulk_tiles.py [-h] [-c COLORMAP_DIR] [-i INPUT_DIR] [-j JSON_CONFIG]
                     [-l LEGENDS_DIR] [-o OUTPUT_DIR] [-p PROCESS_DIR]
                     [--prefix PREFIX]

Bulk process raster tiles.

optional arguments:
  -h, --help            show this help message and exit
  -c COLORMAP_DIR, --colormap_dir COLORMAP_DIR
                        Directory containing colormaps
  -i INPUT_DIR, --input_dir INPUT_DIR
                        Directory containing raw input TIFF files
  -j JSON_CONFIG, --json_config JSON_CONFIG
                        If specified, outputs JSON layer configurations that
                        can be copied into MMGIS config
  -l LEGENDS_DIR, --legends_dir LEGENDS_DIR
                        Directory on file system to store legend CSV files
  -o OUTPUT_DIR, --output_dir OUTPUT_DIR
                        Directory on file system to store output files
  -p PROCESS_DIR, --process_dir PROCESS_DIR
                        Directory containing processed files
  --prefix PREFIX       Process only files beginning with prefix string
```
