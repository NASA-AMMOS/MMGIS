#!/usr/bin/env python

"""
This script bulk processes a directory of TIFs into TMS tiles
"""

import os
import subprocess
import sys
import argparse
import shutil
import glob
import json
from pathlib import Path
from lxml import etree


def process_tiffs(input_dir, process_dir, colormap_dir, legends_dir, prefix=''):
    output_files = []
    if os.path.isdir(input_dir):
        input_files = sorted(glob.glob(input_dir + '/' + prefix + '*.tif', recursive=True))
    else:
        input_files = [colormap_dir]
    if os.path.isdir(colormap_dir):
        colormap_files = sorted(glob.glob(colormap_dir+'/*.txt', recursive=True))
        colormap_dict = {}
        for colormap_file in colormap_files:
            colormap_key = os.path.basename(colormap_file).split('_')[1].split('.')[0]
            colormap_dict[colormap_key] = colormap_file
    else:
        print('Warning: ' + colormap_dir + ' directory does not exist')
        print('Processing without colormap')
        # sys.exit()
    if not os.path.exists(process_dir):
        os.makedirs(process_dir)
    for input_file in input_files:
        print('\nProcessing GeoTIFF file ' + input_file)

        # Figure out the colormap map to use for the file
        colormap = None
        for key in colormap_dict:
            if key in input_file:
                colormap = colormap_dict[key]
        if colormap is None:
            print('Warning: Skipping...no colormap found for ' + input_file)
            continue
        else:
            print('Using colormap: ' + colormap)

        # Colorize the TIFF file with its respective colormap
        rastertolegend = str(Path(os.path.dirname(os.path.realpath(__file__)) + '/../rastertolegend/rastertolegend.py')
                             .absolute())
        color_tiff = ['python', rastertolegend, input_file, colormap, '-discrete']
        print("Running:", " ".join(color_tiff))
        process = subprocess.Popen(color_tiff, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        process.wait()
        for output in process.stdout:
            print(output.decode())
        for error in process.stderr:
            print(error.decode())
        # Move files to Processed directory
        color_outputs = glob.glob(os.path.splitext(input_file)[0] + '_*', recursive=True)
        for color_output in color_outputs:
            if 'legend' in color_output:
                legend_file = str(Path(input_file).name.replace('.tif', '.csv'))
                print('Moving ' + color_output + ' to ' + legends_dir + '/' + legend_file)
                shutil.move(color_output, legends_dir + '/' + legend_file)
            else:
                output_file = process_dir + '/' + str(Path(color_output).name)
                print('Moving ' + color_output + ' to ' + output_file)
                shutil.move(color_output, output_file)
                output_files.append(output_file)
        # Remove unneeded aux files
        color_auxs = glob.glob(input_file + '.aux.xml', recursive=True)
        for color_aux in color_auxs:
            print('Removing ' + color_aux)
            os.remove(color_aux)

    return output_files


def create_tiles(input_files, output_dir):
    output_dirs = []
    for tiff in input_files:
        print('\nTiling: ' + tiff)
        output_subdir = output_dir + '/' + Path(tiff).stem.split('_colormap')[0]
        output_dirs.append(output_subdir)
        print('Output directory: ' + output_subdir)
        rasterstotiles = str(Path(os.path.dirname(os.path.realpath(__file__)) + '/../rasterstotiles/rasterstotiles.py')
                             .absolute())
        tile_tiff = ['python', rasterstotiles, '-o', output_subdir, tiff]
        print("Running:", " ".join(tile_tiff))
        process = subprocess.Popen(tile_tiff, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        process.wait()
        for output in process.stdout:
            print(output.decode())
        for error in process.stderr:
            print(error.decode())
        # Remove processed files
        processed_files = glob.glob(os.path.splitext(tiff)[0] + '_*', recursive=True)
        for processed_file in processed_files:
            print('Removing ' + processed_file)
            os.remove(processed_file)
    return output_dirs


def create_configs(output_dirs, json_config, prefix):
    layers = {}
    sublayers = []
    if prefix != '':
        layers['name'] = prefix
        layers['type'] = 'header'
        layers['tileformat'] = 'tms'
        layers['initialOpacity'] = 1
    for output_dir in output_dirs:
        sublayer = {}
        layer = Path(output_dir).stem
        print('Creating layer config: ' + layer)
        xml = etree.parse(output_dir + "/tilemapresource.xml")
        doc = xml.getroot()
        BoundingBox = doc.findall('./BoundingBox')[0]
        minx = BoundingBox.attrib['minx']
        miny = BoundingBox.attrib['miny']
        maxx = BoundingBox.attrib['maxx']
        maxy = BoundingBox.attrib['maxy']
        TileSets = doc.findall('./TileSets/TileSet')
        minZoom = TileSets[0].attrib['order']
        maxNativeZoom = TileSets[-1].attrib['order']

        sublayer['name'] = layer
        sublayer['type'] = 'tile'
        sublayer['url'] = 'Layers/' + layer + '/{z}/{x}/{y}.png'
        sublayer['legend'] = 'Legends/' + layer + '.csv'
        sublayer['tileformat'] = 'tms'
        sublayer['visibility'] = False
        sublayer['initialOpacity'] = 1
        sublayer['togglesWithHeader'] = False
        sublayer['minZoom'] = int(minZoom)
        sublayer['maxNativeZoom'] = int(maxNativeZoom)
        sublayer['maxZoom'] = 10
        sublayer['boundingBox'] = [minx, miny, maxx, maxy]

        sublayers.append(sublayer)
    layers['sublayers'] = sublayers
    with open(json_config, 'w', encoding='utf-8') as f:
        json.dump(layers, f, ensure_ascii=False, indent=4)
    print('Generated ' + json_config)


parser = argparse.ArgumentParser(description='Bulk process raster tiles.')
parser.add_argument(
    '-c',
    '--colormap_dir',
    default='Colormaps/',
    dest='colormap_dir',
    help='Directory containing colormaps',
    action='store')
parser.add_argument(
    '-i',
    '--input_dir',
    default='Raw/',
    dest='input_dir',
    help='Directory containing raw input TIFF files',
    action='store')
parser.add_argument(
    '-j',
    '--json_config',
    dest='json_config',
    help='If specified, outputs JSON layer configurations that can be copied into MMGIS config',
    action='store')
parser.add_argument(
    '-l',
    '--legends_dir',
    default='Legends/',
    dest='legends_dir',
    help='Directory on file system to store legend CSV files',
    action='store')
parser.add_argument(
    '-o',
    '--output_dir',
    default='Layers/',
    dest='output_dir',
    help='Directory on file system to store output files',
    action='store')
parser.add_argument(
    '-p',
    '--process_dir',
    default='Processed/',
    dest='process_dir',
    help='Directory containing processed files',
    action='store')
parser.add_argument(
    '--prefix',
    default='',
    dest='prefix',
    help='Process only files beginning with prefix string',
    action='store')

args = parser.parse_args()

output_dirs = glob.glob(args.output_dir + '/*', recursive=True)
output_tiffs = process_tiffs(args.input_dir, args.process_dir, args.colormap_dir, args.legends_dir, args.prefix)
output_dirs = create_tiles(output_tiffs, args.output_dir)

# Generate JSON layer configurations if specified
if args.json_config is not None:
    if args.prefix != '':
        json_config = args.json_config.replace('.json', '_' + args.prefix + '.json')
    else:
        json_config = args.json_config
    create_configs(output_dirs, json_config, args.prefix)

sys.exit()
