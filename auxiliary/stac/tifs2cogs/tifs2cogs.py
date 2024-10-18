# Developed on python 3.12
# python tifs2cogs.py [input_folder] [output_folder]

import json
import os
import re
from rio_cogeo.cogeo import cog_translate
from rio_cogeo.profiles import cog_profiles
from argparse import ArgumentParser, ArgumentDefaultsHelpFormatter

def parse_args():
    # Parse input arguments
    parser = ArgumentParser(description=__doc__, formatter_class=ArgumentDefaultsHelpFormatter)
    parser.add_argument('input_folder', help='Input folder of tifs to turn to cogs')
    parser.add_argument('output_folder', help='Output folder for created cogs')

    args = parser.parse_args()
    return args



def tif2cog(src_path, dst_path, profile="deflate", profile_options={}, **options):
    """Convert image to COG."""
    # Format creation option (see gdalwarp `-co` option)
    output_profile = cog_profiles.get(profile)
    output_profile.update(dict(BIGTIFF="IF_SAFER"))
    output_profile.update(profile_options)

    # Dataset Open option (see gdalwarp `-oo` option)
    config = dict(
        GDAL_NUM_THREADS="ALL_CPUS",
        GDAL_TIFF_INTERNAL_MASK=True,
        GDAL_TIFF_OVR_BLOCKSIZE="128",
    )
    
    # make output dirs if missing
    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
    
    cog_translate(
        src_path,
        dst_path,
        output_profile,
        config=config,
        in_memory=False,
        quiet=True,
        **options,
    )
    return True

def tifs2cogs(input_folder, output_folder):
    print('Finding tifs...')

    files = []
    print('    Note: regexing in folders is not implemented.')
    filelist = os.listdir(input_folder)
    for file in filelist[:]: # filelist[:] makes a copy of filelist.
        if file.lower().endswith(".tif"):
            files.append(file)

    for idx, file in enumerate(files, start=1):
        print(f'Making cogs with -cog.tif endings for {idx}/{len(files)}...', end='\r', flush=True)
        tif2cog(os.path.join(input_folder, file), re.sub('.tif', '-cog.tif', os.path.join(output_folder, file), flags=re.IGNORECASE))

    print(f'Making cogs with -cog.tif endings for {len(files)}/{len(files)}...')

    print(f'Done! Output is in {output_folder}')
    return

if __name__ == '__main__':
    args = parse_args()
    tifs2cogs(args.input_folder, args.output_folder)
    exit()
