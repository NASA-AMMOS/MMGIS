# Remote Virtual Layers

A remote virtual layer can be supported via various GDAL drivers. The most common is the [GDAL WMS Driver](https://gdal.org/drivers/raster/wms.html). This allows MMGIS to treat remote datasets as if they were local.

## GDAL XML Desciption File Template

Here is a template of a GDAL XML Description file that may be used to access a remote DEM for the [Measure Tool](?page=Measure).

```xml
<GDAL_WMS>
    <Service name="WMS">
        <!-- recommend Version 1.1.1; Version 1.3 uses different bounding box definition -->
        <Version>1.1.1</Version> 
        <!-- root URL of WMS service -->
        <ServerUrl>http://localhost/map/?</ServerUrl>
        <!-- projection of the source dataset -->
        <SRS>IAU2000%3A30166%2C31.1492746341015%2C-85.391176037601</SRS>
        <ImageFormat>image/tiff</ImageFormat>
         <!-- name of one or more WMS layers-->
        <Layers>some_dem_layer</Layers>
    </Service>
    <DataWindow>
        <!-- the values below should match the full bounds of the dataset -->
        <UpperLeftX>-2091.701</UpperLeftX>
        <UpperLeftY>3505.141</UpperLeftY>
        <LowerRightX>6119.299</LowerRightX>
        <LowerRightY>-3638.859</LowerRightY>
        <!-- recommend native sizes of the dataset, but may be reduced if full resolution is not needed (results in faster queries, but lower data precision) -->
        <SizeX>8211</SizeX>
        <SizeY>7144</SizeY>
    </DataWindow>
    <!-- the desired output project, which should match the MMGIS map -->
    <Projection>+proj=stere +lat_0=-85.391176037601 +lon_0=31.1492746341015 +k=1 +x_0=0 +y_0=0 +a=1737400 +b=1737400 +units=m +no_defs</Projection>
    <BandsCount>1</BandsCount>
    <!-- *Important* to ensure that DataType matches the source data -->
    <DataType>Float32</DataType>
    <!-- GDAL creates a local cache for faster access; highly recommend to include -->
    <Cache>
        <!-- set an expiration value to prevent the cached data from filling up local storage -->
        <Expires>604800</Expires>
        <!-- a directory with write permissions to store cached data; defaults to ./gdalwmscache if not provided -->
        <Path>./gdalwmscache</Path>
    </Cache>
</GDAL_WMS>
```

## GDAL Local Caching

If the `<Cache>` tag is included in the XML description file, GDAL will by default create a directory named `gdalwmscache` at the root location of MMGIS (directory must have write permissions for this to work). It is highly recommended to include this capability to significantly improve performance. Initial queries to a remote dataset may take several seconds, but subsequent queries that hit the cache are just as fast as accessing a local file.

## Remote XML Description File

Typically, an XML description file is generated locally for any dataset that is to be accessed remotely. This file can be place in the mission's Data/ directly for easy access by MMGIS.

However, it is also possible to access a remote XML description file on another server. This can enable more control for dynamic access. This is accomplished via GDAL's `/vsicurl/` prefix to access network locations. For example, instead of specifying a local XML description file for a DEM like so:

```javascript
{
    "dem": "data/description.xml"
}
```

A remote XML description file can be specified like this:

```javascript
{
    "dem": "/vsicurl/http://localhost/description.xml"
}
```

Other `vsi*` options exist for commercial cloud storage such as S3: `/vsis3/`

Note: for directly accessing cloud-optimized GeoTIFFs, the XML description file is unnecessary and can be bypassed altogether by using the `/vsis3/` prefix and referencing the remote file path.

See GDAL documentation for more information about virtual file systems: https://gdal.org/user/virtual_file_systems.html#network-based-file-systems

## More Information

For more details about the XML description file, see the official GDAL documentation here: https://gdal.org/drivers/raster/wms.html#xml-description-file
