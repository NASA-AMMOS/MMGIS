const fs = require('fs').promises;
const path = require('path');
const logger = require('../../logger');
const { v4: uuidv4 } = require('uuid');

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


module.exports = {
    createReferenceMission,
};
