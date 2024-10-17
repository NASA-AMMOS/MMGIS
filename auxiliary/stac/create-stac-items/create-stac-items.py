# Developed on python 3.11.4
# python create-stac-items.py [mmgis_url] [mmgis_token] [collection_id] [file_or_folder_path] [--regex]


import requests
import json
import os
from rio_stac import create_stac_item
from argparse import ArgumentParser, ArgumentDefaultsHelpFormatter

def parse_args():
    # Parse input arguments
    parser = ArgumentParser(description=__doc__, formatter_class=ArgumentDefaultsHelpFormatter)
    parser.add_argument('mmgis_url', help='Input file')
    parser.add_argument('mmgis_token', help='Input file')
    parser.add_argument('collection_id', help='Input file')
    parser.add_argument('file_or_folder_path', help='Input file')
    parser.add_argument('-u', '--upsert', help='If folder, only create stac items for files that match this regex', action='store_true')
    parser.add_argument('-r', '--regex', help='If folder, only create stac items for files that match this regex')

    args = parser.parse_args()
    return args

def create_stac_items(mmgis_url, mmgis_token, collection_id, file_or_folder_path, upsert=False, regex=None):

    isDir = os.path.isdir(file_or_folder_path)
    

    print('Finding files...')

    files = []
    if isDir:
        print('    Note: regexing in folders is not implemented.')
        filelist = os.listdir(file_or_folder_path)
        for file in filelist[:]: # filelist[:] makes a copy of filelist.
            if file.lower().endswith(".tif"):
                files.append(os.path.join(file_or_folder_path, file))
    else:
        filename, file_extension = os.path.splitext(file_or_folder_path)
        if file_extension.lower() == '.tif':
            files.append(file_or_folder_path)
    
    items = {}

    url = f'{mmgis_url}/stac/collections/{collection_id}/bulk_items'


    for idx, file in enumerate(files, start=1):
        print(f'Gathering metadata {idx}/{len(files)}...', end='\r', flush=True)
        item = create_stac_item(
            file,
            #input_datetime=input_datetime,
            #extensions=extensions,
            #collection=collection,
            #collection_url=collection_url,
            #properties=property,
            #id=id,
            #asset_name=asset_name,
            #asset_href=asset_href,
            #asset_media_type=asset_mediatype,
            with_proj=True,
            with_raster=True,
            with_eo=True,
            #raster_max_size=max_raster_size,
            #geom_densify_pts=densify_geom,
            #geom_precision=geom_precision,
        )
        item_dict = item.to_dict()

        items[item_dict.get('id')] = item_dict

    print(f'Gathering metadata {len(files)}/{len(files)}...')

    
    print('Sending bulk item creation request...')

    method = 'insert'
    if upsert == True:
        method = 'upsert'
        print(f'Using method: {method}.')
    else:
        print(f'Using method: {method}.')
        print('    Note: The bulk insert may fail with a ConflictError if any item already exists. Consider using the --upsert flag if such replacement is intentional.')

    req = requests.post(url, json = { "items": items, "method": method }, headers = { "Authorization": f'Bearer {mmgis_token}', "content-type": "application/json" } )
    print(json.loads(req.text))

    print('Done!')
    return

if __name__ == '__main__':
    args = parse_args()
    create_stac_items(args.mmgis_url, args.mmgis_token, args.collection_id, args.file_or_folder_path, args.upsert, args.regex)
    exit()
