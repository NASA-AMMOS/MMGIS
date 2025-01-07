# Developed on python 3.11.4
# python create-stac-items.py [mmgis_url] [mmgis_token] [collection_id] [file_or_folder_path] [--regex]
# ex: python create-stac-items.py "http://localhost:8888" stac-201fb492061f9fe3575e18f76d8d3823 myCollection C:\Users\Documents\Projects\MMGIS\Missions\Earth\COGs --upsert --path_remove /var/www/html/mmgis/MMGIS/ --path_replace_with /


import requests
import json
import os
from datetime import datetime 
from rio_stac import create_stac_item
from argparse import ArgumentParser, ArgumentDefaultsHelpFormatter

def parse_args():
    # Parse input arguments
    parser = ArgumentParser(description=__doc__, formatter_class=ArgumentDefaultsHelpFormatter)
    parser.add_argument('mmgis_url', help='URL to MMGIS')
    parser.add_argument('mmgis_token', help='MMGIS API Token')
    parser.add_argument('collection_id', help='Pre-existing STAC collection id')
    parser.add_argument('file_or_folder_path', help='Input file or folder path')
    parser.add_argument('-rm', '--path_remove', help='Portion of internal file path to remove. Useful if the current filepath differs from what titiler should hit internally.')
    parser.add_argument('-rp', '--path_replace_with', help='If --path_remove, instead of setting that portion of the internal path to "", replaces it with this value.')
    parser.add_argument('-u', '--upsert', help='Allow overwriting existing STAC items', action='store_true')
    parser.add_argument('-r', '--regex', help='If folder, only create stac items for files that match this regex')
    parser.add_argument('-t', '--time_from_fn', help='time format to read from filename', type=str, default=None)

    args = parser.parse_args()
    return args

def create_stac_items(mmgis_url, mmgis_token, collection_id, file_or_folder_path, path_remove, path_replace_with, upsert=False, regex=None, time_from_fn=False):

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
        asset_href = file
        if path_remove is not None:
            if path_replace_with is not None:
                asset_href = file.replace(path_remove, path_replace_with)
            else:
                asset_href = file.replace(path_remove, "")

        input_datetime = None
        if args.time_from_fn is not None:
            input_datetime = datetime.strptime(os.path.basename(file),args.time_from_fn) 
        item = create_stac_item(
            file,
            input_datetime=input_datetime,
            #extensions=extensions,
            #collection=collection,
            #collection_url=collection_url,
            #properties=property,
            #id=id,
            #asset_name=asset_name,
            asset_href=asset_href,
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
    create_stac_items(args.mmgis_url, args.mmgis_token, args.collection_id, args.file_or_folder_path, args.path_remove, args.path_replace_with, args.upsert, args.regex, args.time_from_fn)
    exit()
