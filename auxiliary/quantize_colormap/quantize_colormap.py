#!/usr/bin/env python3

import os
import sys
import argparse
import glob
import matplotlib as mpl
import matplotlib.pyplot as plt
from matplotlib import cm
import numpy as np
from osgeo import gdal

# https://matplotlib.org/stable/gallery/color/colormap_reference.html
cmaps = [('Perceptually Uniform Sequential', [
            'viridis', 'plasma', 'inferno', 'magma', 'cividis']),
         ('Sequential', [
            'Greys', 'Purples', 'Blues', 'Greens', 'Oranges', 'Reds',
            'YlOrBr', 'YlOrRd', 'OrRd', 'PuRd', 'RdPu', 'BuPu',
            'GnBu', 'PuBu', 'YlGnBu', 'PuBuGn', 'BuGn', 'YlGn']),
         ('Sequential (2)', [
            'binary', 'gist_yarg', 'gist_gray', 'gray', 'bone', 'pink',
            'spring', 'summer', 'autumn', 'winter', 'cool', 'Wistia',
            'hot', 'afmhot', 'gist_heat', 'copper']),
         ('Diverging', [
            'PiYG', 'PRGn', 'BrBG', 'PuOr', 'RdGy', 'RdBu',
            'RdYlBu', 'RdYlGn', 'Spectral', 'coolwarm', 'bwr', 'seismic']),
         ('Cyclic', ['twilight', 'twilight_shifted', 'hsv']),
         ('Qualitative', [
            'Pastel1', 'Pastel2', 'Paired', 'Accent',
            'Dark2', 'Set1', 'Set2', 'Set3',
            'tab10', 'tab20', 'tab20b', 'tab20c']),
         ('Miscellaneous', [
            'flag', 'prism', 'ocean', 'gist_earth', 'terrain', 'gist_stern',
            'gnuplot', 'gnuplot2', 'CMRmap', 'cubehelix', 'brg',
            'gist_rainbow', 'rainbow', 'jet', 'turbo', 'nipy_spectral',
            'gist_ncar'])]


class MplColorHelper:

    def __init__(self, cmap_name, start_val, stop_val):
        self.cmap_name = cmap_name
        self.cmap = plt.get_cmap(cmap_name)
        self.norm = mpl.colors.Normalize(vmin=start_val, vmax=stop_val)
        self.scalarMap = cm.ScalarMappable(norm=self.norm, cmap=self.cmap)

    def get_rgb(self, val):
        return self.scalarMap.to_rgba(val)


def quantize_colormap_from_tiff(tiff, output_dir, colormap, nodata, ignore_zeroes, ignore_min):
    print('Processing', tiff)
    output_file = output_dir + '/' + os.path.basename(tiff).split('.')[0] + '.txt'

    # open the dataset and retrieve raster data as an array
    dataset = gdal.Open(tiff)
    array = dataset.ReadAsArray()

    # get min max values
    min = np.min(array)
    max = np.max(array)

    # remove 0 and negative values
    if ignore_zeroes:
        array = array[array > 0]
    # remove min values
    if ignore_min:
        array = array[array != min]

    # use the numpy percentile function to calculate quantile thresholds
    print('Calculating quantiles...')
    print(max, min)
    percentiles = []
    for i in np.arange(100, 0, -10).tolist():
        percentiles.append(np.percentile(array, i))
    percentiles.append(np.min(array))
    print(percentiles)

    print('Generating', output_file)
    out = open(output_file, 'w+')
    mch = MplColorHelper(colormap, 0, len(percentiles))
    for i in range(0, len(percentiles)):
        val = percentiles[i]
        rgba = (mch.scalarMap.to_rgba(len(percentiles)-1-i))
        r = round(rgba[0] * 255)
        g = round(rgba[1] * 255)
        b = round(rgba[2] * 255)
        a = round(rgba[3] * 255)
        out_str = ' '.join([str(round(val)), str(r), str(g), str(b), str(a)])
        out.write(out_str + '\n')

    if not str(nodata) == 'nv':
        if float(nodata) <= min:
            out.write(f'{str(nodata)} 0 0 0 0\n')
    else:
        out.write(f'nv 0 0 0 0\n')
    out.seek(0)
    print(out.read())
    out.close()


parser = argparse.ArgumentParser(description='Generate quantized MPL colormaps from tiff files.')
parser.add_argument(
    '-c',
    '--colormap',
    default='viridis',
    dest='colormap',
    help='matplotlib colormap to use',
    action='store')
parser.add_argument(
    '-i',
    '--input',
    default='Raw/',
    dest='input',
    help='TIFF file or directory containing raw input TIFF files',
    action='store')
parser.add_argument(
    '-n',
    '--nodata',
    dest='nodata',
    default='nv',
    help='nodata value',
    action='store')
parser.add_argument(
    '-o',
    '--output_dir',
    default='Colormaps/',
    dest='output_dir',
    help='Directory containing output colormaps',
    action='store')
parser.add_argument(
    '-0',
    '--ignore_zeroes',
    default=False,
    dest='ignore_zeroes',
    help='Ignore zero and under values',
    action='store_true')
parser.add_argument(
    '-m',
    '--ignore_min',
    default=False,
    dest='ignore_min',
    help='Ignore min value',
    action='store_true')

args = parser.parse_args()

if not os.path.isdir(args.output_dir):
    print(args.output_dir, 'is not a directory.')
    sys.exit()

if os.path.isfile(args.input):
    quantize_colormap_from_tiff(args.input, args.output_dir, args.colormap, args.nodata, args.ignore_zeroes, args.ignore_min)
else:
    print('Searching', args.input)
    input_files = glob.glob(args.input + '*.tif*', recursive=True)
    for input_file in input_files:
        quantize_colormap_from_tiff(input_file, args.output_dir, args.colormap, args.nodata, args.ignore_zeroes, args.ignore_min)

sys.exit()
