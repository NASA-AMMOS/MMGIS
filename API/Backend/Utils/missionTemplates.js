const fs = require('fs').promises;
const path = require('path');
const logger = require('../../logger');
const { v4: uuidv4 } = require('uuid');
const { Geodatasets, makeNewGeodatasetTable } = require('../Geodatasets/models/geodatasets');
const { sequelize } = require('../../connection');
const Utils = require('../../utils.js');

/**
 * Registry of Reference Mission variants.
 * Each key is a variant identifier; "default" is the original Earth demo.
 */
const REFERENCE_MISSION_VARIANTS = {
    default: {
        missionName: 'Reference-Mission',
        blueprintDir: 'Reference-Mission',
        configFile: 'config.reference-mission.json',
        label: 'Earth (Default)',
        description: 'Comprehensive Earth demo with 20+ layers and 14 tools',
    },
    'Lunar-SouthPole': {
        missionName: 'Reference-Mission-Lunar-SouthPole',
        blueprintDir: 'Reference-Mission-Lunar-SouthPole',
        configFile: 'config.reference-mission-lunar-southpole.json',
        label: 'Lunar South Pole',
        description: 'South polar stereographic mission (IAU2000:30120)',
    },
    Mars: {
        missionName: 'Reference-Mission-Mars',
        blueprintDir: 'Reference-Mission-Mars',
        configFile: 'config.reference-mission-mars.json',
        label: 'Mars',
        description: 'Mars mission stub with SightlineTool (Sol observers)',
    },
};

/**
 * Resolve a variant key to its blueprint source path and mission name.
 * @param {string} variantKey - Key from REFERENCE_MISSION_VARIANTS (e.g. "default", "Lunar-SouthPole")
 * @returns {{ sourcePath: string, missionName: string, configFile: string } | null}
 */
function resolveVariantBlueprintPath(variantKey) {
    const variant = REFERENCE_MISSION_VARIANTS[variantKey];
    if (!variant) return null;
    return {
        sourcePath: path.resolve('./blueprints/Missions', variant.blueprintDir),
        missionName: variant.missionName,
        configFile: variant.configFile,
    };
}

/**
 * Create a complete Reference Mission copy
 * @param {string} missionName - Mission name
 * @param {string} [variantKey='default'] - Variant key from REFERENCE_MISSION_VARIANTS
 * @returns {Promise<Object>} Reference Mission config with updated mission fields
 */
async function createReferenceMission(missionName, variantKey) {
    const resolved = resolveVariantBlueprintPath(variantKey || 'default');
    if (!resolved) {
        throw new Error(`Unknown reference mission variant: ${variantKey}`);
    }
    const sourcePath = resolved.sourcePath;
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
        const templateConfigPath = path.join(sourcePath, resolved.configFile);
        const configData = await fs.readFile(templateConfigPath, 'utf8');
        const referenceMissionConfig = JSON.parse(configData);

        // 4. Customize config with mission name
        const customConfig = customizeReferenceMissionConfig(referenceMissionConfig, missionName);

        // 5. Set up geodatasets from blueprint Geodatasets/ directory
        const geodatasetResult = await setupReferenceGeodatasets(missionName, sourcePath);
        logger('info', `Reference Mission geodatasets: ${geodatasetResult.created} created, ${geodatasetResult.errors} errors`, null, null);

        // 6. Set up STAC collections and items from blueprint STAC/ directory (if WITH_STAC=true)
        const stacResult = await setupReferenceSTAC(missionName, sourcePath);
        if (process.env.WITH_STAC === 'true') {
            logger('info', `Reference Mission STAC: ${stacResult.created} items upserted, ${stacResult.errors} errors`, null, null);
        }

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
 * @param {string} missionName - Mission name (e.g. "Reference-Mission", "Reference-Mission-Lunar-SouthPole")
 * @param {string} [blueprintSourcePath] - Blueprint source directory path
 * @returns {Promise<{created: number, errors: number}>}
 */
async function setupReferenceGeodatasets(missionName, blueprintSourcePath) {
    const geodatasetsDir = blueprintSourcePath
        ? path.join(blueprintSourcePath, 'Geodatasets')
        : path.resolve('./blueprints/Missions/Reference-Mission/Geodatasets');
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

/**
 * Create or upsert all STAC collections and items for a Reference Mission from blueprint COG files.
 * Each subdirectory in blueprints/Missions/Reference-Mission/STAC/ becomes a STAC collection
 * named "{missionSlug}_{dirName_with_underscores}". Only runs when WITH_STAC=true.
 * @param {string} missionName - Mission name (e.g. "Reference-Mission")
 * @param {string} [blueprintSourcePath] - Blueprint source directory path
 * @returns {Promise<{created: number, errors: number}>}
 */
async function setupReferenceSTAC(missionName, blueprintSourcePath) {
    if (process.env.WITH_STAC !== 'true') {
        logger('info', 'WITH_STAC not enabled, skipping STAC setup for Reference Mission', null, null);
        return { created: 0, errors: 0 };
    }

    const stacBlueprintDir = blueprintSourcePath
        ? path.join(blueprintSourcePath, 'STAC')
        : path.resolve('./blueprints/Missions/Reference-Mission/STAC');
    const missionSlug = missionName.toLowerCase().replace(/-/g, '_');
    const stacUrl = `http://${process.env.IS_DOCKER === 'true' ? 'stac-fastapi' : 'localhost'}:${process.env.STAC_PORT || 8881}`;

    try {
        await fs.access(stacBlueprintDir);
    } catch {
        logger('info', 'No STAC directory in Reference-Mission blueprint, skipping STAC setup', null, null);
        return { created: 0, errors: 0 };
    }

    // Lazy-require to avoid loading these modules unless STAC is enabled
    const fetch = require('node-fetch');
    const GeoTIFF = require('geotiff');

    const entries = await fs.readdir(stacBlueprintDir, { withFileTypes: true });
    const collectionDirs = entries.filter(e => e.isDirectory());

    let created = 0, errors = 0;

    for (const dir of collectionDirs) {
        const dirName = dir.name;
        const collectionId = `${missionSlug}_${dirName.replace(/\s+/g, '_')}`;
        const dirPath = path.join(stacBlueprintDir, dirName);

        try {
            // Create or update collection via stac-fastapi HTTP API
            const collectionBody = {
                id: collectionId,
                type: 'Collection',
                stac_version: '1.0.0',
                description: dirName,
                title: dirName,
                links: [],
                extent: {
                    spatial: { bbox: [[-180, -90, 180, 90]] },
                    temporal: { interval: [['1970-01-01T00:00:00Z', null]] },
                },
                license: 'proprietary',
            };

            const createResp = await fetch(`${stacUrl}/collections`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(collectionBody),
            });

            if (createResp.status === 409) {
                // Collection already exists — update it via PUT
                const putResp = await fetch(`${stacUrl}/collections/${collectionId}`, {
                    method: 'PUT',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify(collectionBody),
                });
                if (!putResp.ok) {
                    const text = await putResp.text();
                    throw new Error(`Failed to update STAC collection: ${putResp.status} ${text}`);
                }
            } else if (!createResp.ok) {
                const text = await createResp.text();
                throw new Error(`Failed to create STAC collection: ${createResp.status} ${text}`);
            }
            logger('info', `Upserted STAC collection '${collectionId}'`, null, null);

            // Build STAC items from .tif files
            const files = (await fs.readdir(dirPath)).filter(f => f.toLowerCase().endsWith('.tif'));
            const items = {};

            for (const filename of files) {
                try {
                    const filePath = path.join(dirPath, filename);
                    const itemId = path.basename(filename, path.extname(filename));

                    // Read bbox from GeoTIFF (assumed EPSG:4326 for Reference Mission COGs)
                    const tiff = await GeoTIFF.fromFile(filePath);
                    const image = await tiff.getImage();
                    const [west, south, east, north] = image.getBoundingBox();

                    // Parse datetime from filename: try YYYYMMDDTHHmmss first, then YYYYMMDD
                    let datetime = '1970-01-01T00:00:00Z';
                    const dtMatch = filename.match(/(\d{8}T\d{6})/);
                    const dateMatch = !dtMatch && filename.match(/(\d{8})/);
                    if (dtMatch) {
                        const raw = dtMatch[1];
                        datetime = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T${raw.slice(9, 11)}:${raw.slice(11, 13)}:${raw.slice(13, 15)}Z`;
                    } else if (dateMatch) {
                        const raw = dateMatch[1];
                        datetime = `${raw.slice(0, 4)}-${raw.slice(4, 6)}-${raw.slice(6, 8)}T00:00:00Z`;
                    }

                    // Asset href as seen by TiTiler:
                    // - In Docker: /Missions is mounted directly, so use absolute path
                    // - Outside Docker: titiler-pgstac runs locally and needs ../../ to reach Missions/
                    const assetHref = process.env.IS_DOCKER === 'true'
                        ? `/Missions/${missionName}/STAC/${dirName}/${filename}`
                        : `../../Missions/${missionName}/STAC/${dirName}/${filename}`;

                    items[itemId] = {
                        type: 'Feature',
                        stac_version: '1.0.0',
                        id: itemId,
                        collection: collectionId,
                        geometry: {
                            type: 'Polygon',
                            coordinates: [[
                                [west, south],
                                [east, south],
                                [east, north],
                                [west, north],
                                [west, south],
                            ]],
                        },
                        bbox: [west, south, east, north],
                        properties: { datetime },
                        assets: {
                            asset: {
                                href: assetHref,
                                type: 'image/tiff; application=geotiff; profile=cloud-optimized',
                                roles: ['data'],
                            },
                        },
                        links: [],
                    };
                } catch (err) {
                    logger('error', `Failed to create STAC item for '${filename}': ${err.message}`, null, null);
                    errors++;
                }
            }

            if (Object.keys(items).length > 0) {
                const bulkResp = await fetch(`${stacUrl}/collections/${collectionId}/bulk_items`, {
                    method: 'POST',
                    headers: { 'content-type': 'application/json' },
                    body: JSON.stringify({ items, method: 'upsert' }),
                });

                if (!bulkResp.ok) {
                    const text = await bulkResp.text();
                    throw new Error(`Bulk items upsert failed: ${bulkResp.status} ${text}`);
                }

                logger('info', `Upserted ${Object.keys(items).length} STAC items into collection '${collectionId}'`, null, null);
                created += Object.keys(items).length;
            }
        } catch (err) {
            logger('error', `Failed to setup STAC collection '${collectionId}': ${err.message}`, null, null);
            errors++;
        }
    }

    return { created, errors };
}

module.exports = {
    createReferenceMission,
    REFERENCE_MISSION_VARIANTS,
    resolveVariantBlueprintPath,
};
