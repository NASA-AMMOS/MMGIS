 The following note explains the using of this API and how to pass variables through the links 

REST API

REST (representational state transfer) is an easy approach to run web service and the common-joe likes to see the results immediately diplayed on a user's browser. The common choice for data transfer in mobile development is the AJAX call to some REST interface. This REST API will provide support for researchers and developers to access data, query and display it in GeoJSON format.

The current API is divided into two major sections, URIs and download. The first is used to query the data, while the second to download specific tiles of data in GeoJSON or CSV format. The Description section contains information about this API and how to use this API. 

For now, the first section of this API is implemented and the download section of this API will be implemented in the future with more options.


REST API Query Resources:


  - Get all the data for a layer, in this case the layer name is `waypoints`.
  Available layers in the database for are, `waypoints`, `traverse`, `terrain`
  Test link: ```http://localhost:3000/apis/layer=waypoints```
 

 
  - Get the elevation of all targets form `targets` table in ascending order.
  Test link: ```http://localhost:3000/apis/all_targets_elev```
 

 
  - Retrieve all layers from `layers` table.
  Test link: ```http://localhost:3000/apis/all_layers```
 

 
  - This call to the API will retrieve all the targets from `targets` table.
  Test link: ```http://localhost:3000/apis/all_targets```
 

 
  - This call to the API will retrieve all the targets name from `targets` tables.
  Test link: ```http://localhost:3000/apis/uid=53647281/tkn=Bu&dT!r76@324$/all_targets_name```
 

 
  - Get all the targets that are within the bounding box `bbox`.
  Test link: ```http://localhost:3000/apis/uid=53647281/tkn=Bu&dT!r76@324$/bbox=137.3423,-4.5956,137.5508,-4.7469```
 

 
  - An API to get all targets that have certain amount of a material observed by Chemcam instrument.
  For this call the following parameters are sent to the API service:
  1- bbox; rectangle coordinates of a bounding box that we want to limit our search. Coordinates of `NW` and `SE`.
  2- inst; the instrument type which in this case is `ccam`.
  3- mat; chemical material name, here is `sio2`.
  4- op; operation which can be `geq` for `>=` or `leq` for `<=`.
  5- amont; amount of the material that should be a number like `40.0` in this case.

  Test link: ```http://localhost:3000/apis/uid=53647281/tkn=Bu&dT!r76@324$/bbox=137.3423,-4.5956,137.5508,-4.7469/inst=ccam&mat=sio2&op=geq&amont=40.0```
 

 
  - A call to the API to get the name of all instruments from `Instruments` table.
  Test link: ```http://localhost:3000/apis/instList```
 

 
  - An API call to get the name of all columns in a table. In this case we are passing table name `ccam`.
  Test link: Test link: ```http://localhost:3000/apis/inst=ccam/```
 


  - An API router to calculate the statistical information like, minimum, maximum, 
  average and etc. for a parameter, `SiO2` from `data_<instType>` table, which in this case is `ccam`.
  Test link: ```http://localhost:3000/apis/inst=ccam/data_min_avg_max&mat=sio2```
 
 

