const fs = require('fs').promises;
const path = require('path');
const logger = require('../../logger');
const { v4: uuidv4 } = require('uuid');
const { Geodatasets, makeNewGeodatasetTable } = require('../Geodatasets/models/geodatasets');
const { sequelize } = require('../../connection');
const Utils = require('../../utils.js');

/**
 * Create a complete Reference Mission copy
 * @param {string} missionName - Mission name (always "Reference-Mission")
 * @returns {Promise<Object>} Reference Mission config with updated mission fields
 */
async function createReferenceMission(missionName) {
    const sourcePath = path.resolve('./blueprints/Missions/Reference-Mission');
    const destPath = path.resolve('./Missions', missionName);

    try {
        // 1. Check if destination directory exists and remove it
        let wasUpdated = false;
        try {
            await fs.access(destPath);
            // Directory exists, remove it completely to ensure clean state
            await fs.rm(destPath, { recursive: true, force: true });
            wasUpdated = true;
            logger('info', `Removed existing Reference Mission directory for clean reinstall`, null, null);
        } catch (err) {
            // Directory doesn't exist, we'll create it fresh
        }

        // 2. Always copy directory from blueprint to ensure latest data
        await copyDirectoryRecursive(sourcePath, destPath);
        logger('info', `Copied Reference Mission blueprint to ${destPath}`, null, null);

        // 3. Always read config from template source
        const templateConfigPath = path.join(sourcePath, 'config.reference-mission.json');
        const configData = await fs.readFile(templateConfigPath, 'utf8');
        const referenceMissionConfig = JSON.parse(configData);

        // 4. Customize config with mission name
        const customConfig = customizeReferenceMissionConfig(referenceMissionConfig, missionName);

        // 5. Set up geodatasets from blueprint Geodatasets/ directory
        const geodatasetResult = await setupReferenceGeodatasets(missionName);
        logger('info', `Reference Mission geodatasets: ${geodatasetResult.created} created, ${geodatasetResult.errors} errors`, null, null);

        return {
            success: true,
            config: customConfig,
            message: wasUpdated
                ? 'Reference Mission demo updated successfully (directory overwritten with latest blueprint)'
                : 'Reference Mission demo created successfully',
        };
    } catch (err) {
        logger('error', `Failed to create Reference Mission: ${err.message}`, null, null);
        throw new Error(`Reference Mission creation failed: ${err.message}`);
    }
}

/**
 * Recursively copy directory contents
 */
async function copyDirectoryRecursive(src, dest) {
    await fs.mkdir(dest, { recursive: true });

    const entries = await fs.readdir(src, { withFileTypes: true });

    for (const entry of entries) {
        const srcPath = path.join(src, entry.name);
        const destPath = path.join(dest, entry.name);

        if (entry.isDirectory()) {
            await copyDirectoryRecursive(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}

/**
 * Customize Reference Mission config for new mission
 */
function customizeReferenceMissionConfig(referenceMissionConfig, missionName) {
    // Deep clone Reference-Mission config to avoid modifying original
    const config = JSON.parse(JSON.stringify(referenceMissionConfig));

    // Update mission-specific fields
    config.msv.mission = missionName;
    config.msv.missionFolderName = missionName;

    // Keep display name as "Reference Mission"
    config.look.pagename = 'MMGIS Reference Mission';
    config.look.missionname = 'Reference Mission';
    config.look.missionsubtitle = 'Reference Mission Demo';

    // Add required fields to all layers for Configure Page compatibility
    addRequiredLayerFields(config.layers);

    return config;
}

/**
 * Recursively add required fields to all layers
 */
function addRequiredLayerFields(layers) {
    if (!layers) return;

    for (const layer of layers) {
        // Add UUID using the same method as MMGIS (uuidv4 from uuid package)
        // UUIDs must be unique so they're generated programmatically
        if (layer.uuid === undefined) {
            layer.uuid = uuidv4();
        }

        // Recursively process sublayers
        if (layer.sublayers) {
            addRequiredLayerFields(layer.sublayers);
        }
    }
}


/**
 * Delete and recreate all geodatasets for a Reference Mission from blueprint GeoJSON files.
 * Each .geojson file in blueprints/Missions/Reference-Mission/Geodatasets/ becomes a
 * geodataset named "{missionSlug}-{filename_without_ext}".
 * Only geodatasets for this specific mission (by slug) are deleted/recreated.
 * @param {string} missionName - Mission name (e.g. "Reference-Mission", "Reference-Mission-Moon")
 * @returns {Promise<{created: number, errors: number}>}
 */
async function setupReferenceGeodatasets(missionName) {
    const geodatasetsDir = path.resolve('./blueprints/Missions/Reference-Mission/Geodatasets');
    const missionSlug = missionName.toLowerCase();

    try {
        await fs.access(geodatasetsDir);
    } catch {
        logger('info', 'No Geodatasets directory in Reference-Mission blueprint, skipping geodataset setup', null, null);
        return { created: 0, errors: 0 };
    }

    const allFiles = await fs.readdir(geodatasetsDir);
    const files = allFiles.filter(f => f.endsWith('.geojson'));

    // Lazily require populateGeodatasetTable to avoid circular dependency issues at module load
    const { populateGeodatasetTable } = require('../Geodatasets/routes/geodatasets');

    let created = 0, errors = 0;
    for (const file of files) {
        const baseName = path.basename(file, '.geojson');
        // Use underscores: hyphens are stripped by makeNewGeodatasetTable's sanitizer but underscores are preserved
        // e.g. mission "Reference-Mission" + "basic.geojson" -> "reference_mission_basic"
        const geodatasetName = `${missionSlug.replace(/-/g, '_')}_${baseName.replace(/-/g, '_')}`;
        const filePath = path.join(geodatasetsDir, file);

        try {
            // Delete existing geodataset for this mission if present
            const existing = await Geodatasets.findOne({ where: { name: geodatasetName } });
            if (existing) {
                await sequelize.query(
                    `DROP TABLE IF EXISTS ${Utils.forceAlphaNumUnder(existing.dataValues.table)};`,
                    { replacements: {} }
                );
                await Geodatasets.destroy({ where: { name: geodatasetName } });
                logger('info', `Deleted existing geodataset '${geodatasetName}'`, null, null);
            }

            // Parse GeoJSON
            const raw = await fs.readFile(filePath, 'utf8');
            const geojson = JSON.parse(raw);
            const features = geojson.features || [];

            // Optional time/group/feature property configs from GeoJSON root
            const startProp = geojson.startProp || null;
            const endProp = geojson.endProp || null;
            const groupIdProp = geojson.groupIdProp || null;
            const featureIdProp = geojson.featureIdProp || null;

            // Create geodataset table (callback-based, wrapped in Promise)
            const tableResult = await new Promise((resolve, reject) => {
                makeNewGeodatasetTable(
                    geodatasetName,
                    file,
                    features.length,
                    startProp, endProp, groupIdProp, featureIdProp,
                    null,
                    resolve,
                    reject
                );
            });

            // Truncate then populate
            await sequelize.query(
                `TRUNCATE TABLE ${Utils.forceAlphaNumUnder(tableResult.table)} RESTART IDENTITY`,
                { replacements: {} }
            );
            await new Promise((resolve, reject) => {
                populateGeodatasetTable(
                    tableResult.tableObj,
                    features,
                    startProp, endProp, groupIdProp, featureIdProp,
                    (success) => success
                        ? resolve()
                        : reject(new Error('populateGeodatasetTable failed'))
                );
            });

            logger('info', `Created geodataset '${geodatasetName}' with ${features.length} features`, null, null);
            created++;
        } catch (err) {
            logger('error', `Failed to setup geodataset '${geodatasetName}': ${err.message}`, null, null);
            errors++;
        }
    }

    return { created, errors };
}

module.exports = {
    createReferenceMission,
};
