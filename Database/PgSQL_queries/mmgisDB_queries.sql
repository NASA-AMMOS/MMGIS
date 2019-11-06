CREATE DATABASE "MMGISDB"
    WITH 
    OWNER = postgres
    ENCODING = 'UTF8'
    CONNECTION LIMIT = -1;


-- Enable PostGIS (includes raster)
CREATE EXTENSION postgis;
-- Enable Topology
CREATE EXTENSION postgis_topology;

-- Upgrade PostGIS (includes raster) to latest version
ALTER EXTENSION postgis UPDATE;
ALTER EXTENSION postgis_topology UPDATE;


---------------------------------------------------------------------
-- Set the schema
---------------------------------------------------------------------
SET search_path TO public;

---------------------------------------------------------------------
-- Creating TARGETS Table
---------------------------------------------------------------------
-- DROP TABLE TARGETS;

CREATE TABLE Targets
(
    geom geometry(PointZ,4326),
    Target_plan character varying NOT NULL,
    SOL double precision NOT NULL,
    RMC character varying, -- Rover motion counter
    EASTING_M double precision,
    NORTHING_M double precision,
    ELEV_M double precision,
    LON_DD double precision,
    LAT_DD double precision,
    X double precision,
    Y double precision,
    Z double precision,
    U double precision,
    V double precision,
    W double precision,
    I double precision,
    J double precision,
    Image_ID character varying,
    Notes character varying,
    CONSTRAINT "Targets_pkey" PRIMARY KEY (Target_plan)
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;


ALTER TABLE Targets
    OWNER to postgres;

---------------------------------------------------------------------
-- Index: sidx_TARGETS_geom
---------------------------------------------------------------------

-- DROP INDEX public."sidx_TARGETS_geom";

CREATE INDEX "sidx_Targets_geom"
    ON Targets USING gist(geom)
    TABLESPACE pg_default;

---------------------------------------------------------------------
-- Insert into the targets table from csv file
---------------------------------------------------------------------

COPY Targets(geom,TARGET_PLAN,SOL,RMC,EASTING_M,NORTHING_M,ELEV_M,LON_DD,LAT_DD,X,Y,Z,U,V,W,I,J,IMAGE_ID,NOTES)
FROM '/home/bsamani/Targets.csv' DELIMITER ',' CSV HEADER;

--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Creating Observations Table
---------------------------------------------------------------------
-- DROP TABLE Observations;

CREATE TABLE Observations
(
    Target_Plan character varying(255) NOT NULL,
    Sequence character varying(50) NOT NULL,
    Inst_Type character varying(50) NOT NULL,
    Notes character varying,
    CONSTRAINT "Observations_pkey" PRIMARY KEY (Target_Plan, Sequence),
    CONSTRAINT "Observations_target_plan_fkey" FOREIGN KEY (Target_Plan)
        REFERENCES Targets (Target_plan) MATCH SIMPLE
        ON UPDATE NO ACTION 
        ON DELETE NO ACTION
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE Observations
     OWNER to postgres;

---------------------------------------------------------------------
-- Insert into the Observations table from csv file
---------------------------------------------------------------------
ALTER TABLE Observations DISABLE TRIGGER ALL;
COPY Observations(Target_Plan, Sequence, INST_TYPE, Notes) 
FROM 'C:\MAMP\htdocs\MMGIS\Database\datasets\Final_data_for_database_07_18_2018\new_data_for_observations.csv' DELIMITER ',' CSV HEADER;
ALTER TABLE Observations ENABLE TRIGGER ALL;
--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Creating Science_Products Table
---------------------------------------------------------------------
-- DROP TABLE Science_Products;

CREATE TABLE Science_Products
(
 	SCLK bigint NOT NULL,  -- Primary key
 	Inst_Type character varying(50) NOT NULL, -- Primary key
  	Sequence character varying(25) NOT NULL, -- Foreign key
	Target_Plan character varying(255) NOT NULL, -- Foreign key
  	Sol integer NOT NULL,
  	File_Name character varying NOT NULL,
  	Geom geometry(PointZ,4326) NOT NULL,
  	Notes character varying,
  	CONSTRAINT "Science_Products_pkey" PRIMARY KEY (SCLK, Inst_Type),
  	CONSTRAINT "Science_Products_Observations_fkey" FOREIGN KEY (Target_plan, Sequence)
    	REFERENCES Observations (Target_plan, Sequence) MATCH SIMPLE
        ON UPDATE NO ACTION 
		ON DELETE NO ACTION
)
WITH (
      OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE Science_Products
     OWNER to postgres;

---------------------------------------------------------------------
-- Insert into the Science_Products table from csv file
---------------------------------------------------------------------
ALTER TABLE Science_Products DISABLE TRIGGER ALL;
COPY Science_Products(SCLK, Inst_Type, Sequence, Target_Plan, Sol, File_Name, Geom, Notes) 
FROM 'C:\MAMP\htdocs\MMGIS\Database\datasets\Final_data_for_database_07_18_2018\new_data_for_science_products.csv' DELIMITER ',' CSV HEADER;
ALTER TABLE Science_Products ENABLE TRIGGER ALL;
--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Creating Inst_CHEMCAM Table
---------------------------------------------------------------------
-- DROP TABLE Inst_CHEMCAM;

CREATE TABLE Inst_CCAM
(
	SCLK bigint PRIMARY KEY NOT NULL,
	Inst_Type character varying(50) NOT NULL,
	Type_of_Product character varying(255),
	EDR_Type character varying(5),
	Autofocus character varying(3),
	Distance_m double precision,
	RSM_Az_rad double precision,
	RSM_El_rad double precision,
	Nbr_of_Shots integer,
	Shots_Ignored integer,
	Shots_Averaged integer,
	LIBS_Exposure_ms integer,
	RMI_Exposure_Seed_ms integer,
	RMI_Exposure_Real_ms integer,
	Laser_Energy character varying(25),
	Temperature double precision,
	LMST character varying(15),
	Laplacian_score integer,
	Mean_Total_Vnir double precision,
	Flight_Version integer,
	RMC_Site integer,
	RMC_Drive integer,
	RMC_POSE integer,
	Type_of_Observation character varying(35),
	Notes character varying,
	CONSTRAINT "Inst_Chemcam_SCLK_fkey" FOREIGN KEY (SCLK, Inst_Type)
        REFERENCES Science_Products (SCLK, Inst_Type) MATCH SIMPLE
        ON UPDATE NO ACTION 
        ON DELETE NO ACTION
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE Inst_CCAM
     OWNER to postgres;

---------------------------------------------------------------------
-- Insert into the Inst_CHEMCAM table from csv file
---------------------------------------------------------------------
ALTER TABLE Inst_CCAM DISABLE TRIGGER ALL;
COPY Inst_CCAM(SCLK, Inst_Type, Type_of_Product, EDR_Type, Autofocus, Distance_m, RSM_Az_rad, RSM_El_rad, Nbr_of_Shots, Shots_Ignored, Shots_Averaged, 
	LIBS_Exposure_ms, RMI_Exposure_Seed_ms, RMI_Exposure_Real_ms, Laser_Energy, Temperature, LMST, Laplacian_score, Mean_Total_Vnir, Flight_Version, 
	RMC_Site, RMC_Drive, RMC_POSE, Type_of_Observation, Notes) 
FROM 'C:\MAMP\htdocs\MMGIS\Database\datasets\Final_data_for_database_07_18_2018\new_data_for_inst_ccam.csv' DELIMITER ',' CSV HEADER;
ALTER TABLE Inst_CCAM ENABLE TRIGGER ALL;
--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Creating Data_CHEMCAM Table
---------------------------------------------------------------------
-- DROP TABLE Data_CHEMCAM;
	
CREATE TABLE Data_CCAM
(
	SCLK bigint PRIMARY KEY NOT NULL,
	File_name character varying NOT NULL,
	Target_plan character varying(255) NOT NULL,
	SiO2 double precision,
	SiO2_RMSEP double precision,
	SiO2_shots_stdev double precision,
	TiO2 double precision,
	TiO2_RMSEP double precision,
	TiO2_shots_stdev double precision,
	Al2O3 double precision,
	Al2O3_RMSEP double precision,
	Al2O3_shots_stdev double precision,
	FeOT double precision,
	FeOT_RMSEP double precision,
	FeOT_shots_stdev double precision,
	MgO double precision,
	MgO_RMSEP double precision,
	MgO_shots_stdev double precision,
	CaO double precision,
	CaO_RMSEP double precision,
	CaO_shots_stdev double precision,
	Na2O double precision,
	Na2O_RMSEP double precision,
	Na2O_shots_stdev double precision,
	K2O double precision,
	K2O_RMSEP double precision,
	K2O_shots_stdev double precision,
	Sum_of_Oxides double precision,
	Spectrum_Total double precision,
	CONSTRAINT "Data_Chemcam_SCLK_fkey" FOREIGN KEY (SCLK)
        REFERENCES Inst_CCAM (SCLK) MATCH SIMPLE
        ON UPDATE NO ACTION 
        ON DELETE NO ACTION
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE Data_CCAM
     OWNER to postgres;

---------------------------------------------------------------------
-- Insert into the Data_CHEMCAM table from csv file
---------------------------------------------------------------------
ALTER TABLE Data_CCAM DISABLE TRIGGER ALL;
COPY Data_CCAM(SCLK, File_name, Target_plan, SiO2, SiO2_RMSEP, SiO2_shots_stdev, TiO2, TiO2_RMSEP, TiO2_shots_stdev, Al2O3, Al2O3_RMSEP, 
	Al2O3_shots_stdev, FeOT, FeOT_RMSEP, FeOT_shots_stdev, MgO, MgO_RMSEP, MgO_shots_stdev, CaO, CaO_RMSEP, CaO_shots_stdev, Na2O, Na2O_RMSEP, 
	Na2O_shots_stdev, K2O, K2O_RMSEP, K2O_shots_stdev, Sum_of_Oxides, Spectrum_Total) 
FROM 'C:\MAMP\htdocs\MMGIS\Database\datasets\Final_data_for_database_07_18_2018\new_data_for_data_ccam.csv' DELIMITER ',' CSV HEADER;
ALTER TABLE Data_CCAM ENABLE TRIGGER ALL;
--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Creating Instruments Table
---------------------------------------------------------------------
-- DROP TABLE Instruments;

CREATE TABLE Instruments
(
	Inst_Type character varying(10) PRIMARY KEY NOT NULL,
	Has_Data smallint NOT NULL DEFAULT 1,
	Definition character varying,
	Description character varying,
	Source_Link character varying
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE Instruments
     OWNER to postgres;

---------------------------------------------------------------------
-- Insert into the Instruments table.
---------------------------------------------------------------------

INSERT INTO Instruments(Inst_Type, Has_Data, Definition, Description, Source_Link) VALUES
 	('MCAM', 1, 'MasCam: Mast Camera', 'The Mast Camera, or Mastcam for short, takes color images and color video footage of the Martian terrain. The images can be stitched together to create panoramas of the landscape around the rover. Like the cameras on the Mars Exploration Rovers that landed on the red planet in 2004, the Mastcam design consists of two camera systems mounted on a mast extending upward from the Mars Science Laboratory rover deck (body). The Mastcam is used to study the Martian landscape, rocks, and soils; to view frost and weather phenomena; and to support the driving and sampling operations of the rover.', 'https://mars.nasa.gov/msl/mission/instruments/cameras/mastcam/'),
 	('CCAM', 1, 'ChemCam: Chemistry & Camera', 'Looking at rocks and soils from a distance, ChemCam fires a laser and analyzes the elemental composition of vaporized materials from areas smaller than 0.04 inch (1 millimeter) on the surface of Martian rocks and soils. An on-board spectrograph provides unprecedented detail about minerals and microstructures in rocks by measuring the composition of the resulting plasma -- an extremely hot gas made of free-floating ions and electrons', 'https://mars.nasa.gov/msl/mission/instruments/spectrometers/chemcam/'),
 	('MHLI', 1, 'MaHLI: Mars Hand Lens Imager', 'Second only to the rock hammer, the hand lens is an essential tool of human geologists. Usually carried on a string around the person`s neck, the hand lens helps a geologist in the field identify the minerals in a rock. The robotic geologist, Mars Science Laboratory, carries its own equivalent of the geologist`s hand lens, the Mars Hand Lens Imager (MAHLI).', 'https://mars.nasa.gov/msl/mission/instruments/cameras/mahli/'),
	('MRDI', 1, 'Mars Descent Imager', 'Knowing the location of loose debris, boulders, cliffs, and other features of the terrain is vital for planning the path of exploration now that the Mars Science Laboratory rover has landed on the red planet. The Mars Descent Imager took color video during the rover`s descent toward the surface, providing an astronaut`s view of the local environment.', 'https://mars.nasa.gov/msl/mission/instruments/cameras/mardi/'),
	('DAN', 1, 'Dynamic Albedo of Neutrons', 'One way to look for water on Mars is to look for neutrons escaping from the planet`s surface. Cosmic rays from space constantly bombard the surface of Mars, knocking neutrons in soils and rocks out of their atomic orbits. If liquid or frozen water happens to be present, hydrogen atoms slow the neutrons down. In this way, some of the neutrons escaping into space have less energy and move more slowly. These slower particles can be measured with a neutron detector.', 'https://mars.nasa.gov/msl/mission/instruments/radiationdetectors/dan/'),
	('DRT', 1, 'Dust Removal Tool', 'Not available', 'https://mars.nasa.gov/msl/mission/instruments/'),
	('DRL', 1, 'Drill', 'Not available', 'https://mars.nasa.gov/msl/mission/instruments/'),
	('SCP', 1, 'Scoop', 'Not available', 'https://mars.nasa.gov/msl/mission/instruments/'),
	('REMS', 1, 'REMS: Rover Environmental Monitoring Station', 'Two small booms on the rover mast record the horizontal and vertical components of wind speed to characterize air flow near the Martian surface from breezes, dust devils, and dust storms. A sensor inside the rover`s electronic box is exposed to the atmosphere through a small opening and measures changes in pressure caused by different meteorological events such as dust devils, atmospheric tides, and cold and warm fronts. A small filter shields the sensor against dust contamination.', 'https://mars.nasa.gov/msl/mission/instruments/environsensors/rems/'),
	('CMIN', 1, 'CheMin: Chemistry & Mineralogy X-Ray Diffraction', 'The Chemistry and Mineralogy instrument, or CheMin for short, identifies and measures the abundances of various minerals on Mars. Examples of minerals found on Mars so far are olivine, pyroxenes, hematite, goethite, and magnetite.Minerals are indicative of environmental conditions that existed when they formed. For example, olivine and pyroxene, two primary minerals in basalt, form when lava solidifies. Jarosite, found in sedimentary rocks by NASA`s Opportunity rover on Mars, precipitates out of water.', 'https://mars.nasa.gov/msl/mission/instruments/spectrometers/chemin/'),
	('SAM', 1, 'SAM: Sample Analysis at Mars (SAM) Instrument Suite', 'The Sample Analysis at Mars instrument suite takes up more than half the science payload on board the Mars Science Laboratory rover and features chemical equipment found in many scientific laboratories on Earth. Provided by NASA`s Goddard Space Flight Center, Sample Analysis at Mars searches for compounds of the element carbon, including methane, that are associated with life and explores ways in which they are generated and destroyed in the Martian ecosphere.', 'https://mars.nasa.gov/msl/mission/instruments/spectrometers/sam/'),
	('RAD', 1, 'RAD: Radiation Assessment Detector', 'The Radiation Assessment Detector (RAD) is one of the first instruments sent to Mars specifically to prepare for future human exploration. The size of a small toaster or six-pack of soda, RAD measures and identifies all high-energy radiation on the Martian surface, such as protons, energetic ions of various elements, neutrons, and gamma rays. That includes not only direct radiation from space, but also secondary radiation produced by the interaction of space radiation with the Martian atmosphere and surface rocks and soils.', 'https://mars.nasa.gov/msl/mission/instruments/radiationdetectors/rad/'),
	('APXS', 1, 'APSX: Alpha Particle X-Ray Spectrometer', 'The Alpha Particle X-Ray Spectrometer measurse the abundance of chemical elements in rocks and soils. Funded by the Canadian Space Agency, the APXS is placed in contact with rock and soil samples on Mars and exposes the material to alpha particles and X-rays emitted during the radioactive decay of the element curium. X-rays are a type of electromagnetic radiation, like light and microwaves.', 'https://mars.nasa.gov/msl/mission/instruments/spectrometers/apxs/'),
	('MEDLI', 1, 'Mars Science Laboratory Entry Descent and Landing Instrument', 'MEDLI collected engineering data during the spacecraft`s high-speed, extremely hot entry into the Martian atmosphere. MEDLI data will be invaluable to engineers when they design future Mars missions. The data will help them design systems for entry into the Martian atmosphere that are safer, more reliable, and lighter weight.', 'https://mars.nasa.gov/msl/mission/instruments/atmossensors/medli/');

--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Creating Waypoints Table
---------------------------------------------------------------------
-- DROP TABLE Waypoints;

CREATE TABLE Waypoints
(
    id serial PRIMARY KEY NOT NULL,
    geom geometry(PointZ,4326),
    SOL double precision,
    SITE double precision,
    POS double precision,
    Ls double precision,
    SCLK_START double precision,
    SCLK_END double precision,
    LAT_DD double precision,
    LON_DD double precision,
    easting_m double precision,
    northing_m double precision,
    elev_m double precision,
    straightli double precision,
    straight_1 double precision,
    traverse_d double precision,
    total_dist double precision,
    dist_bradb double precision,
    azimuth_br double precision,
    pitch_rad double precision,
    roll_rad double precision,
    tilt_rad double precision,
    yaw_rad double precision,
    pitch_deg double precision,
    roll_deg double precision,
    tilt_deg double precision,
    yaw_deg double precision,
    mobtrav_id double precision,
    mobtrav_to double precision,
    drive_type character varying,
    site_pos character varying,
    five_drive_av double precision,
    sol_site_p character varying,
    ORIG_FID integer
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE Waypoints
    OWNER to postgres;

---------------------------------------------------------------------
-- Insert into the Waypoints table from csv file
---------------------------------------------------------------------

COPY Waypoints(geom, SOL, SITE, POS, Ls, SCLK_START, SCLK_END, LAT_DD, LON_DD, easting_m, northing_m, elev_m, straightli, straight_1, traverse_d, 
	total_dist, dist_bradb, azimuth_br, pitch_rad, roll_rad, tilt_rad, yaw_rad, pitch_deg, roll_deg, tilt_deg, yaw_deg, mobtrav_id, mobtrav_to, 
	drive_type, site_pos, five_drive_av, sol_site_p, ORIG_FID) 
FROM 'C:\MAMP\htdocs\MMGIS\Database\datasets\Final_data_for_database_07_18_2018\Waypoints.csv' DELIMITER ',' CSV HEADER;

--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Creating Inst_DRT Table
---------------------------------------------------------------------
-- DROP TABLE Inst_DRT;


--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Creating Inst_MASTCAM Table
---------------------------------------------------------------------
-- DROP TABLE Inst_MASTCAM;


--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Creating Inst_APXS Table
---------------------------------------------------------------------
-- DROP TABLE Inst_APXS;

CREATE TABLE Inst_apxs
(
	SCLK bigint PRIMARY KEY NOT NULL,
	Inst_Type character varying(50) NOT NULL,
	Type_of_Product character varying(255),
	RMC character varying, -- Rover motion counter
	LON_DD double precision,
    LAT_DD double precision,
	Notes character varying,
	CONSTRAINT "Inst_Apxs_SCLK_fkey" FOREIGN KEY (SCLK, Inst_Type)
        REFERENCES Science_Products (SCLK, Inst_Type) MATCH SIMPLE
        ON UPDATE NO ACTION 
        ON DELETE NO ACTION
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE Inst_APXS
     OWNER to postgres;


--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Creating Inst_MAHLI Table
---------------------------------------------------------------------
-- DROP TABLE Inst_MAHLI;


--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Creating Data_APXS Table
---------------------------------------------------------------------
-- DROP TABLE Data_APXS;

CREATE TABLE Data_apxs
(
    SCLK bigint PRIMARY KEY NOT NULL,
    File_name character varying NOT NULL,
    target_plan character varying(255) NOT NULL,
    fit_type character varying(50),
    start_time character varying(50),
    g_norm double precision,
    sh_tavg double precision,
    life_time character varying(50),
    fe_fwhm double precision,
    na2o double precision,
    na2o_err double precision,
    mgo double precision,
    mgo_err double precision,
    al2o3 double precision,
    al2o3_err double precision,
    sio2 double precision,
    sio2_err double precision,
    p2o5 double precision,
    p2o5_err double precision,
    so3 double precision,
    so3_err double precision,
    cl double precision,
    cl_err double precision,
    k2o double precision,
    k2o_err double precision,
    cao double precision,
    cao_err double precision,
    tio2 double precision,
    tio2_err double precision,
    cr2o3 double precision,
    cr2o3_err double precision,
    mno double precision,
    mno_err double precision,
    feo double precision,
    feo_err double precision,
    ni double precision,
    ni_err double precision,
    zn double precision,
    zn_err double precision,
    br double precision,
    br_err double precision,
    CONSTRAINT "Data_Apxs_SCLK_fkey" FOREIGN KEY (SCLK)
        REFERENCES Inst_APXS (SCLK) MATCH SIMPLE
        ON UPDATE NO ACTION 
        ON DELETE NO ACTION
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE Data_APXS
    OWNER to postgres;


--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Create table Localization
---------------------------------------------------------------------
-- DROP TABLE Localization;

CREATE TABLE Localization (
	
	SCLK bigint PRIMARY KEY NOT NULL,
	Inst_Type character varying(50) NOT NULL,  -- ObsType, Instrument type
	Data_Product character varying(255), 
	Instrument character varying(255), 
	RMC character varying, -- Rover motion counter
	Mission character varying(255), 
	Site_Frame_Origin_Offset_Vector character varying,
	Spacecraft_Quaternion character varying(50), 
	SOL double precision,
	Sequence_ID character varying(50),
	Instrument_Azimuth_deg double precision,
	Instrument_Elevation_deg double precision,
	Stereo character varying(50),
	LocType character varying(50),
	Frame character varying(50),
	Method character varying(125), 
	APID character varying(50), 
	APID_Name character varying(50), 
	Local_True_Solar_Time character varying(50), 
	Local_Mean_Solar_Time character varying(50), 
	Planetary_Radius double precision, 
	Surface_Intersection_DEM character varying(50), 
	Rover_Global_Northing_m double precision, 
	Rover_Global_Easting_m double precision, 
	Rover_Global_Elevation_m double precision,
	CONSTRAINT "Localization_SCLK_fkey" FOREIGN KEY (SCLK, Inst_Type)
        REFERENCES Science_Products (SCLK, Inst_Type) MATCH SIMPLE
        ON UPDATE NO ACTION 
        ON DELETE NO ACTION
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE Localization
    OWNER to postgres;


--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Create table Users
---------------------------------------------------------------------
-- DROP TABLE Users;

CREATE TABLE Users(
    id SERIAL NOT NULL PRIMARY KEY,
    first_name VARCHAR(50) NOT NULL,
    last_name VARCHAR(50) NOT NULL,
    email VARCHAR(355) UNIQUE NOT NULL,
    password VARCHAR NOT NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'inactive',
    token VARCHAR NOT NULL,
    permission VARCHAR(3) NOT NULL DEFAULT '001',
    last_login TIMESTAMP,
    createdAt TIMESTAMP NOT NULL DEFAULT current_timestamp
)WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE Users
    OWNER to postgres;


INSERT INTO Users(first_name, last_name, email, password, status, token, permission, last_login, createdAt) 
VALUES ('test_1', 'test_2', 'test@example.com', '$2b$10$Zc5Ol6T/qgnCy2HHMl/5ce7O50xWNef0UUsHlpPRkoicqI/y0LFza', 'activated','4ed2d5a9d676c04b6cf24a8e44102c100409d5a0f672f77eac46c480ea693e32e0d456164d9c2437f4d03f311457f4ff5cf3e2ae9af918aeff84afbe69cb0b436fc2615dffc3fbbdbebde4d66352a1e7b8f35d1780c8c8c7541da09b032b6ca589d5dfd4539d32277bc3afff0ff2b3b785e266f7314e3b023d42e61062ec5f69', '001', '08-29-2018', '08-29-2018');

--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Create table User_queries
---------------------------------------------------------------------
-- DROP TABLE User_queries;

CREATE TABLE User_queries(
    id SERIAL NOT NULL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    name VARCHAR NOT NULL,
    description VARCHAR,
    query VARCHAR NOT NULL,
    executed_on TIMESTAMP NOT NULL DEFAULT current_timestamp
)WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE User_queries
    OWNER to postgres;


--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Create table layers
---------------------------------------------------------------------
-- DROP TABLE layers;

CREATE TABLE layers (
	id SERIAL NOT NULL PRIMARY KEY,
	layer_name VARCHAR NOT NULL,
	layer_type VARCHAR NOT NULL,
	table_name_refered VARCHAR NOT NULL,
	description VARCHAR,
    file_path VARCHAR NOT NULL,
    file_type VARCHAR NOT NULL,
	created_on TIMESTAMP NOT NULL DEFAULT current_timestamp
)WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE layers
    OWNER to postgres;

INSERT INTO layers(layer_name, layer_type, table_name_refered, description, file_path, file_type) VALUES 
                  ('waypoints', 'Points', 'Waypoints', 'None', '/var/www/html/API/layers','CSV'),
                  ('terrain', 'Polygon', 'Terrain', 'None', '/var/www/html/API/layers', 'json'),
                  ('traverse', 'LineString', 'Traverse', 'None', '/var/www/html/API/layers', 'json');



--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Create table traverse
---------------------------------------------------------------------
-- DROP TABLE traverse;


CREATE TABLE Traverse
(
    id SERIAL NOT NULL PRIMARY KEY,
    geom geometry(MultiLineStringZ,4326),
    From_SCLK double precision,
    To_SCLK double precision,
    Length_m double precision,
    SOL integer,
    Site integer,
    Position integer,
    COLOR integer,
    route integer,
    length double precision
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE Traverse
    OWNER to postgres;

CREATE INDEX traverse_gix ON Traverse USING GIST (geom);

COPY Traverse(geom, From_SCLK, To_SCLK, Length_m, SOL, Site, Position, COLOR, route, length) 
FROM 'C:\MAMP\htdocs\MMGIS\Database\datasets\Final_data_for_database_07_18_2018\traverse.csv' DELIMITER ',' CSV HEADER;

--*****************************************************************************************************************************************************
--*****************************************************************************************************************************************************

---------------------------------------------------------------------
-- Create table Terrian
---------------------------------------------------------------------
-- DROP TABLE Terrian;


CREATE TABLE Terrain
(
    id SERIAL NOT NULL PRIMARY KEY,
    geom geometry(Polygon,4326),
    name character varying COLLATE pg_catalog."default",
    TerrainMIN integer,
    TerrainMAX integer,
    Color integer
)
WITH (
    OIDS = FALSE
)
TABLESPACE pg_default;

ALTER TABLE Terrain
    OWNER to postgres;


CREATE INDEX terrain_gix ON Terrain USING GIST (geom);

COPY Terrain(geom, name, TerrainMIN, TerrainMAX, Color) 
FROM 'C:\MAMP\htdocs\MMGIS\Database\datasets\Final_data_for_database_07_18_2018\terrain.csv' DELIMITER ',' CSV HEADER;







---------------------------------------------------------------------
-- Test queries on this database (mmgisdb)
---------------------------------------------------------------------

SELECT sp.sclk, sp.target_plan, sp.file_name, dch.file_name 
FROM science_products AS sp, Data_chemcam AS dch 
WHERE sp.sclk = dch.sclk;


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


-- A sample query to get the coordinates of targets that have intersection with a line which is traverse path
SELECT ST_AsGeoJSON(tar.geom) 
FROM targets AS tar 
WHERE ST_Intersects( ST_GeographyFromText('SRID=4326;MULTILINESTRING((137.441632996891 -4.58946699631891,137.441647163973 -4.58947208386999,137.4417034152 -4.5894933448166,137.441734001203 -4.58946500558752,137.441685970591 -4.58940082980665,137.441699735457 -4.58934568773663,137.441892534277 -4.58940312420891),(137.441632996891 -4.58946699631891,137.441647163973 -4.58947208386999,137.4417034152 -4.5894933448166,137.441734001203 -4.58946500558752,137.441685970591 -4.58940082980665,137.441699735457 -4.58934568773663,137.441892534277 -4.58940312420891),(137.441632996891 -4.58946699631891,137.441647163973 -4.58947208386999,137.4417034152 -4.5894933448166,137.441734001203 -4.58946500558752,137.441685970591 -4.58940082980665,137.441699735457 -4.58934568773663,137.441892534277 -4.58940312420891))'), 
 									tar.geom) = true;



























