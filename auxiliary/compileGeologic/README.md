`node compileGeologic.js`

compileGeologic processes all png and svg files in /patterns, /linework and /symbols

- It outputs a geologic.json reference file that should be included in the DrawTool's scripts
- It outputs all processed files to the /public/images/geologic folder
- Files are named according to `FGDC-{P|L|S}-{code}-{color}`
- svgs get converted to pngs
- If the source file has a {filename}.desc ascii file, its description will be populated in the outputted json

Assets from:

- https://github.com/davenquinn/geologic-patterns
- https://github.com/rodreras/geologic_icons
