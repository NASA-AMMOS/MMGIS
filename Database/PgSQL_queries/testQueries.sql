-- A query to create TARGETS_test table
CREATE TABLE TARGETS_test
(
    geom geometry(PointZ,4326),
    TARGET_PLAN character varying NOT NULL,
    CONSTRAINT "TARGETS_test_pkey" PRIMARY KEY (TARGET_PLAN)
);
-- Set the ownership of table TARGETS_test
ALTER TABLE TARGETS_test
    OWNER to postgres;

-- Copy values from a csv file into the TARGETS_test table	
COPY TARGETS_test(geom, TARGET_PLAN) 
FROM '/Users/bsamani/Documents/Targets_export_test.csv' DELIMITER ',' CSV HEADER;

-- Getting geometry from TARGETS_test table as GeoJSON objects 
SELECT ST_AsGeoJSON(TT.geom)::json As geometry, target_plan FROM TARGETS_test AS TT WHERE target_plan='test';
SELECT ST_AsGeoJSON(TT.geom)::json As geometry, target_plan FROM TARGETS_test AS TT;

-- Delete query
DELETE FROM TARGETS_test WHERE target_plan='test';

-- Insert geometry into the TARGETS_test as a hex value
INSERT INTO TARGETS_test(geom, target_plan) VALUES ('01010000A0E610000081237CC8C32D6140C26084B4156812C0CB139B6C3697B1C0', 'test');

-- Select query
SELECT 
	public."MSLICE"."TARGET_PLA", 
	public."MSLICE"."SOL", 
	public."MSLICE"."RMC" 
FROM public."MSLICE" 
WHERE public."MSLICE"."TARGET_PLA"='Jake_Matijevic';

-- Repeated records on TARGETS table
SELECT * FROM public."TARGETS" AS T1
WHERE (SELECT COUNT(T2."TARGET_PLAN") FROM public."TARGETS" AS T2  WHERE T1."TARGET_PLAN"=T2."TARGET_PLAN") > 1;

SELECT 
	* 
FROM public."TARGETS", public."CHEMCAM_Chemistry"
WHERE public."TARGETS"."TARGET_PLAN" = public."CHEMCAM_Chemistry"."TARGET_PLAN" AND public."TARGETS"."TARGET_PLAN"='Oneida';

INSERT INTO TARGETS(geom,TARGET_PLAN,SOL,RMC,EASTING_M,NORTHING_M,ELEV_M,LON_DD,LAT_DD,X,Y,Z,U,V,W,IMAGEID,I,J,COMMENTS) 
VALUES ('01010000A0E610000081237CC8C32D6140C26084B4156812C0CB139B6C3697B1C0',
		'Cliffside_bridge',0.0,'',0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,0.0,'',0.0,0.0,'');

-- Create view for dublicated recoreds in the instruments table
CREATE VIEW Repeated_Instruments AS SELECT I1.sclk, I1.inst_type, I1.target_plan FROM Instruments AS I1
WHERE (SELECT COUNT(I2.inst_type) FROM Instruments AS I2  WHERE I1.TARGET_PLAN = I2.TARGET_PLAN AND I1.inst_type = I2.inst_type) > 1 ;

-- Delete repeated records from instruments table
DELETE FROM Instruments
WHERE sclk IN
(SELECT I1.sclk FROM Instruments AS I1
WHERE (SELECT COUNT(I2.inst_type) FROM Instruments AS I2  WHERE I1.TARGET_PLAN = I2.TARGET_PLAN AND I1.inst_type = I2.inst_type) > 1);

-- Finding the matched records in table Instruments and Observations for a specific target_plan name
SELECT O.target_plan, O.id AS OID, I.inst_type, I.sclk
FROM Instruments AS I, Observations AS O 
WHERE O.target_plan = I.target_plan AND O.inst_type = I.inst_type AND O.target_plan = 'Bero'
ORDER BY O.target_plan ASC;

-- Export values from result of a query into a CSV file
COPY (SELECT Tar.target_plan, I.sclk, I.inst_type
FROM Instruments AS I, Targets AS Tar WHERE Tar.target_plan = I.target_plan ORDER BY target_plan ASC) 
TO '/Users/bsamani/Desktop/Inserting_Data_into_Database_python_CSV/Targets_Instruments.csv' DELIMITER ',' CSV HEADER;

-- Copy values from a csv file into the Targets_Instruments table
COPY Targets_Instruments(target_plan, SCLK, INST_TYPE)
FROM '/Users/bsamani/Desktop/Inserting_Data_into_Database_python_CSV/Final_Database_MarsDB/Targets_Instruments.csv' DELIMITER ',' CSV HEADER;

-- Select query
SELECT O.target_plan, O.id AS OID, I.inst_type, I.sclk
FROM Instruments AS I, Observations AS O WHERE O.target_plan = I.target_plan AND O.inst_type = I.inst_type;

-- A query to find the repeated target_plan names
SELECT I1.sclk, I1.Target_plan, I1.inst_type FROM Instruments AS I1
WHERE (SELECT COUNT(I2.inst_type) FROM Instruments AS I2  WHERE I1.TARGET_PLAN = I2.TARGET_PLAN AND I1.inst_type = I2.inst_type) > 1;

SELECT O1.Target_plan FROM Observations AS O1
WHERE (SELECT COUNT(O2.Target_plan) FROM Observations AS O2  WHERE O1.TARGET_PLAN = O2.TARGET_PLAN) > 1;

-- Export into a CSV file
COPY (SELECT chc.* FROM public."CHEMCAM_Chemistry" AS chc, targets AS tar WHERE tar.target_plan = chc."TARGET_PLAN") 
TO '/Users/bsamani/Desktop/Inserting_Data_into_Database_python_CSV/Final_Database_MarsDB/chemcam_chemistry_export.csv' DELIMITER ',' CSV HEADER;

-- Import from a CSV file
COPY CHEMCAM_Chemistry(file_name, Target_Plan, shotnumber, sio2, tio2, al2o3, feot, mgo, cao, na2o, k2o, total) 
FROM '/Users/bsamani/Desktop/Inserting_Data_into_Database_python_CSV/Final_Database_MarsDB/CHEMCAM_Chemistry_export.csv' DELIMITER ',' CSV HEADER;

-- Import
COPY APXS_Chemistry(sol,Target_Plan, fit_type, start_time, gnorm, sh_tavg, lifetime, fe_fwhm, na2o, na2o_err, mgo, mgo_err, al2o3, al2o3_err, sio2, sio2_err, p2o5, p2o5_err, so3, so3_err, cl, cl_err, k2o, k2o_err, cao, cao_err, tio2, tio2_err, cr2o3, cr2o3_err, mno, mno_err, feo, feo_err, ni, ni_err, zn, zn_err, br, br_err) 
FROM '/Users/bsamani/Desktop/Inserting_Data_into_Database_python_CSV/Final_Database_MarsDB/APXS_Chemistry_export.csv' DELIMITER ',' CSV HEADER;

-- Export
COPY (SELECT apct.* FROM APXS_Chemistry_test AS apct, targets AS tar WHERE tar.target_plan = apct.TARGET_PLAN) 
TO '/Users/bsamani/Desktop/Inserting_Data_into_Database_python_CSV/Final_Database_MarsDB/APXS_chemistry_export.csv' DELIMITER ',' CSV HEADER;

-- Delete repeated records
DELETE FROM Instruments
WHERE sclk IN
(SELECT I1.sclk FROM Instruments AS I1
WHERE (SELECT COUNT(I2.inst_type) FROM Instruments AS I2  WHERE I1.TARGET_PLAN = I2.TARGET_PLAN AND I1.inst_type = I2.inst_type) > 1);


select id, ST_AsGeoJSON(ST_Centroid(Geom)) AS center from public."mars_mro_ctx_edr_c0a";

-- Test query for ST_intersects and polygons in the mars_mro_ctx_edr_c0a table (file)
SELECT id, ST_AsGeoJSON(geom) 
FROM mars_mro_ctx_edr_c0a
WHERE ST_Intersects(ST_GeomFromText('SRID=4326;POLYGON ((-100.556 35.952, -90.985 35.952, -90.985 30.079, -100.556 30.079, -100.556 35.952))'), geom);


-- Test query for finding targets for a range of SiO2
SELECT tar.target_plan, tar.geom, tar.sol, chc.file_name, chc.sio2, chc.tio2
FROM targets AS tar
INNER JOIN chemcam_chemistry AS chc
ON tar.target_plan = chc.target_plan AND sio2 > 75.0 ORDER BY tar.sol ASC;


-- Test query for finding targets for a range of SiO2 and not repeated records
SELECT tar.target_plan, tar.geom, chc.sio2
FROM targets AS tar, chemcam_chemistry AS chc 
WHERE tar.target_plan = chc.target_plan AND sio2 > 75.0
GROUP BY tar.target_plan, chc.sio2
HAVING COUNT(tar.target_plan) > 1;

-- ===========================================================================================================================
-- ================================================= Spatial queries =========================================================
-- ===========================================================================================================================
select id, CenterLat, CenterLon, MaxLat, MinLat, EastLon, WestLon, SolLong 
from mars_mro_ctx_edr_c0a_added_Z0 
where CenterLat > 40 and CenterLon < 340 and SolLong =115.0;

-- A query for calculating the area of each polygons in the table “mars_mro_ctx_edr_c0a_added_Z0”:
SELECT PK_UID, AsGeoJSON (ST_Centroid (Geometry)) AS center 
FROM mars_mro_ctx_edr_c0a_added_Z0;

-- A query for finding the intersection of given polygon with all the polygons that we have in the table “mars_mro_ctx_edr_c0a_added_Z0”:
SELECT Target, ST_AsText (Geometry) 
FROM mars_mro_ctx_edr_c0a_added_Z0 
WHERE ST_Intersects (ST_GeomFromText ('POLYGON ((-100.556 35.952, -90.985 35.952, -90.985 30.079, -100.556 30.079, -100.556 35.952))'), Geometry);

-- A query for finding all polygons that completely exist in a defined bounding box from table “mars_mro_ctx_edr_c0a_added_Z0”:
SELECT PK_UID, AsText(Geometry) 
FROM mars_mro_ctx_edr_c0a_added_Z0 
WHERE MBRContains (BuildMBR (-100.556,35.952, -90.985,30.079), Geometry);

-- A query to create bounding box around polygons that are in the table “mars_mro_ctx_edr_c0a_added_Z0”:
SELECT PK_UID, ASGeoJSON (ST_Envelope(Geometry)) FROM mars_mro_ctx_edr_c0a_added_Z0;

-- A query to find polygons from table “mars_mro_ctx_edr_c0a_added_Z0” that the distance of center point of those polygons from a defined point/location is more than 300 kilometers: 
SELECT PK_UID, ODEId, ST_Distance(ST_Centroid(Geometry), ST_GeomFromText ('POINT (-100.556 35.952)')) AS Distance 
FROM mars_mro_ctx_edr_c0a_added_Z0
WHERE ST_Distance (ST_Centroid (Geometry), ST_GeomFromText ('POINT (-100.556 35.952)')) > 300;


---------------------------------------------------------------------
-- Test queries on this database (mmgisdb)
---------------------------------------------------------------------

SELECT sp.sclk, sp.target_plan, sp.file_name, dch.file_name 
FROM science_products AS sp, Data_chemcam AS dch 
WHERE sp.sclk = dch.sclk;

-- Test query for ST_Z function which is for checking elevation
SELECT target_plan, sol, rmc, ST_AsGeoJSON(geom), ST_Z(geom) AS elevation 
FROM targets WHERE ST_Z(geom) <= -4521 
ORDER BY target_plan ASC LIMIT 1000;


---------------------------------------------------------------------
-- Calculate min, avg, max and median of a parameter in a table
---------------------------------------------------------------------
-- SELECT sio2 FROM data_ccam ORDER BY sio2 ASC;
-- Calculate min, avg and max
SELECT min(sio2) AS min_sio2, avg(sio2) AS avg_sio2, max(sio2) AS max_sio2 FROM data_ccam;
-- Calculate median
-- Source: https://www.compose.com/articles/metrics-maven-meet-in-the-middle-median-in-postgresql/
SELECT ROUND(CAST(AVG(sio2) AS numeric),2) AS median_sio2  
 FROM (  
   SELECT sio2
   FROM (
     SELECT sio2,
            COUNT(*) OVER() AS row_count,
            ROW_NUMBER() OVER(ORDER BY sio2) AS row_number
     FROM data_ccam
     WHERE sio2 <> 0
   ) x
 WHERE row_number IN ((row_count + 1)/2, (row_count + 2)/2)
) y;

---------------------------------------------------------------------
-- Indexing the tables on the id
---------------------------------------------------------------------

-- CREATE INDEX MSL_03 ON public."MSL_CHEMCAM_Targets_sol" (id);
-- CREATE INDEX MSL_04 ON public."MSL_DRT_Targets_sol" (id);
-- CREATE INDEX MSL_05 ON public."MSL_MASTCAM_Targets_sol" (id);
-- CREATE INDEX MSL_06 ON public."MSL_MSLICE_Targets_sol" (id);
-- CREATE INDEX MSL_07 ON public."MSL_waypoints_sol" (id);
CREATE INDEX MSL_08 ON public."mars_mro_ctx_edr_c0a_added_z0" (id);


-- Get all the polygons that exist in within a bounding box
SELECT row_to_json(fc) FROM(
 	SELECT 'FeatureCollection' As type, array_to_json(array_agg(f)) As features FROM (
 		SELECT 'Feature' As type, ST_AsGeoJSON(lg.geom)::json As geometry, row_to_json(lp) As properties FROM 
 		public."mars_mro_ctx_edr_c0a_added_Z0" As lg INNER JOIN ( 
 			SELECT 
			 	public."mars_mro_ctx_edr_c0a_added_Z0"."id", 
			 	public."mars_mro_ctx_edr_c0a_added_Z0"."CenterLat",
				public."mars_mro_ctx_edr_c0a_added_Z0"."CenterLon",
				public."mars_mro_ctx_edr_c0a_added_Z0"."CenterLat"
			FROM public."mars_mro_ctx_edr_c0a_added_Z0" 
 			WHERE public."mars_mro_ctx_edr_c0a_added_Z0".geom && ST_MakeEnvelope(-59.0,-14.1,-45.3,-25.2,4326)) As lp ON lg.id = lp.id ) As f)  As fc;


select 
	public."mars_mro_ctx_edr_c0a_added_Z0"."id", 
	public."mars_mro_ctx_edr_c0a_added_Z0"."SolLong", 
	ST_AsGeoJSON(public."mars_mro_ctx_edr_c0a_added_Z0"."geom", 4) as geojson 
from 
	public."mars_mro_ctx_edr_c0a_added_Z0" 
where public."mars_mro_ctx_edr_c0a_added_Z0"."SolLong" = 120;






