-- SELECT * from data_ccam as dc, inst_ccam as ic where ic.SCLK = dc.SCLK;
-- SELECT * FROM new_targets_table WHERE target_plan = 'Voyageurs_2'; -- Badger_Mine
-- CREATE TABLE new_targets_table AS
-- (SELECT * FROM targets
-- UNION
-- SELECT * FROM public."New_targets");

-- SELECT
-- 	target_plan
-- FROM new_targets_table_1
-- GROUP BY
--     target_plan
-- HAVING count(target_plan) > 1;

-- DELETE FROM new_targets_table;

-- DELETE FROM new_targets_table WHERE new_targets_table.target_plan NOT IN 
-- (SELECT traget_plan FROM (SELECT DISTINCT ON (target_plan, sol, rmc) * FROM new_targets_table)));

-- CREATE TABLE new_targets_table_1 AS (SELECT DISTINCT ON (target_plan, sol, rmc) * FROM new_targets_table);


-- COPY new_targets_table(geom,TARGET_PLAN,SOL,RMC,EASTING_M,NORTHING_M,ELEV_M,LON_DD,LAT_DD,X,Y,Z,U,V,W,I,J,IMAGE_ID,NOTES)
-- FROM '/tmp/new_data_for_targets.csv' DELIMITER ',' CSV HEADER;
-- ALTER TABLE Observations ENABLE TRIGGER ALL;
-- COPY Observations(Target_Plan, Sequence, INST_TYPE, Notes) 
-- FROM '/Users/bsamani/Desktop/Final_data_for_database/new_data_for_observations.csv' DELIMITER ',' CSV HEADER;


-- ALTER TABLE Targets ENABLE TRIGGER ALL;
-- DELETE FROM Targets;
COPY targets(geom,TARGET_PLAN,SOL,RMC,EASTING_M,NORTHING_M,ELEV_M,LON_DD,LAT_DD,X,Y,Z,U,V,W,I,J,IMAGE_ID,NOTES)
FROM '/tmp/new_data_for_targets.csv' DELIMITER ',' CSV HEADER;

-- SELECT * FROM targets as tar, Observations AS obs 
-- WHERE tar.target_plan = obs.target_plan 
-- AND tar.target_plan ='Badger_Mine';

-- CREATE TABLE science_sroducts_table_forJoin AS (SELECT sc.sclk, sc.inst_type, 
-- sc.sequence, sc.target_plan as sctar, 
-- tar.target_plan as tartar, 
-- sc.sol as scs, 
-- tar.sol as tars, 
-- sc.File_Name, tar.geom , sc.notes 
-- FROM Targets as tar, science_products_test as sc 
-- WHERE tar.target_plan = sc.target_plan);

-- CREATE TABLE science_products_test(
-- 	SCLK bigint NOT NULL,  -- Primary key
--  	Inst_Type character varying(50) NOT NULL, -- Primary key
--   	Sequence character varying(25) NOT NULL, -- Foreign key
-- 	Target_Plan character varying(255) NOT NULL, -- Foreign key
--   	Sol integer NOT NULL,
--   	File_Name character varying NOT NULL,
--   	Geom geometry(PointZ,4326),
--   	Notes character varying
-- )
-- WITH (
--       OIDS = FALSE
-- )
-- TABLESPACE pg_default;

-- ALTER TABLE Science_Products_test
-- OWNER to bsamani;

-- COPY Science_Products_test(SCLK, Inst_Type, Sequence, Target_Plan, Sol, File_Name, Geom, Notes) 
-- FROM '/Users/bsamani/Desktop/Final_data_for_database/new_data_for_science_products.csv' DELIMITER ',' CSV HEADER;

-- SELECT * FROM Science_Products_test WHERE target_plan = 'Mesabi'; -- Badger_Mine, Voyageurs_2

-- ALTER TABLE science_products ENABLE TRIGGER ALL;
-- DELETE FROM science_products;
-- SELECT * FROM science_products;
-- SELECT * FROM Science_Products WHERE target_plan = 'Mesabi'; -- Badger_Mine, Voyageurs_2
COPY Science_Products(SCLK, Inst_Type, Sequence, Target_Plan, Sol, File_Name, Geom, Notes) 
FROM '/tmp/new_data_for_science_products.csv' DELIMITER ',' CSV HEADER;


-- ALTER TABLE inst_ccam DISABLE TRIGGER ALL;
-- DELETE FROM inst_ccam;
COPY Inst_CCAM(SCLK, Inst_Type, Type_of_Product, EDR_Type, Autofocus, Distance_m, RSM_Az_rad, RSM_El_rad, Nbr_of_Shots, Shots_Ignored, Shots_Averaged, LIBS_Exposure_ms, RMI_Exposure_Seed_ms, RMI_Exposure_Real_ms, Laser_Energy, Temperature, LMST, Laplacian_score, Mean_Total_Vnir, Flight_Version, RMC_Site, RMC_Drive, RMC_POSE, Type_of_Observation, Notes) 
FROM '/tmp/new_data_for_inst_ccam.csv' DELIMITER ',' CSV HEADER; 

-- ALTER TABLE inst_ccam ENABLE TRIGGER ALL;



-- ALTER TABLE data_ccam DISABLE TRIGGER ALL;
-- DELETE FROM data_ccam;
COPY Data_CCAM(SCLK, File_name, Target_plan, SiO2, SiO2_RMSEP, SiO2_shots_stdev, TiO2, TiO2_RMSEP, TiO2_shots_stdev, Al2O3, Al2O3_RMSEP, Al2O3_shots_stdev, FeOT, FeOT_RMSEP, FeOT_shots_stdev, MgO, MgO_RMSEP, MgO_shots_stdev, CaO, CaO_RMSEP, CaO_shots_stdev, Na2O, Na2O_RMSEP, Na2O_shots_stdev, K2O, K2O_RMSEP, K2O_shots_stdev, Sum_of_Oxides, Spectrum_Total) FROM '/tmp/new_data_for_data_ccam.csv' DELIMITER ',' CSV HEADER;
-- ALTER TABLE data_ccam ENABLE TRIGGER ALL;


