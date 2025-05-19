"""
Merge colormaps from Python / matplotlib and titiler to JavaScript.
"""

import json
import requests

import numpy as np
np.set_printoptions(legacy='1.25')


if __name__ == "__main__":
        # This should be a fresh copy from https://github.com/timothygebhard/js-colormaps
    file = 'js-colormaps.js'
    with open(file, 'r') as file:
        content = file.readlines()
        for line in content:
            if 'const data' in line:
                data = line
                break
    js_colormaps = json.loads((data.replace('export const data =', '').strip())[:len(data.replace('export const data =', '').strip()) -1])
    js_colormaps_keys = [ x.lower() for x in js_colormaps.keys()]
    # Must have an instance of titler running
    url = 'http://localhost:8888/titiler/colorMaps'
    response = requests.get(url)
    data = response.json()
    colormaps = {}
    for color in sorted(data['colorMaps']):
        if color.endswith('_r'):
            continue
        using_js_colormap = False
        if color.lower() in js_colormaps_keys:
            index = js_colormaps_keys.index(color)
            color = list(js_colormaps.keys())[index]
            colors = js_colormaps[color]['colors']
            using_js_colormap = True
            interpolate = js_colormaps[color]['interpolate']
        else:
            response = requests.get('{url}/{color}'.format(url=url, color=color))
            colors = []
            for index, cmap in response.json().items():
                colors.append([np.around(x / 255, 4) for x  in cmap][0:3])
            interpolate = len(colors) >= 256
        # From js-colormaps/create-colormaps.py
        # Store relevant colormap information
        colormaps[color] = {
            "interpolate": interpolate,
            "colors": colors,
        }

    # Sort
    colormaps = dict(sorted(colormaps.items()))

    # From js-colormaps/create-colormaps.py
    # Save colormap data and shortcuts to data.js. The contents of this file
    # need to be copied manually to js-colormaps.js.
    with open("data.js", "w") as json_file:

        # Write the data dictionary to data.js
        json_file.write(f"const data = {json.dumps(colormaps)};")
        json_file.write('\n\n')

        # Write partial function applications to data.js so that we can use
        # a colormap by its name --- e.g., call viridis(0.5) to evaluate the
        # viridis colormap at a value of 0.5.
        for name in colormaps.keys():
            json_file.write(f"const {name} = partial('{name}');\n")
            json_file.write(f"const {name}_r = partial('{name}_r');\n")

    # Final words
    print("\nExported data to data.js, please copy to js-colormaps.js!\n")
