Usage:
  - Generate a color relief of the input DEM as well as a Legend that works with MMWebGIS.
    - DEM outputted as inputCR.ext and Legend outputted as legend.csv.
    =======================================================================

    rastertocolorlegended.py input_dem color_relief.txt -discrete

    =======================================================================
    -For the last argument: if left blank, it defaults to exact_color_entry;
      '-discrete' as a last argument would change it to nearest_color_entry.


color_relief.txt format:

100% 255 0 0
50% 255 255 0
0% 0 128 0
nv 0 0 0 0

Where 100% is the highest elevation in the DEM followed by R G B
All single space separated and on new lines.
nv is no value and 'nv 0 0 0 0' signifies no data pixels will be black / transparent.
Alternatively, instead of percents, the actual elevation data may be used such as:
  -4300 240 250 150