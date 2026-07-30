import { test, expect } from '@playwright/test';

const fs = require('fs');
const path = require('path');

const {
    getApplicableInteractions,
    getKindOptions,
    getKindPipeline,
    getSuppressionSources,
    withClickPipeline,
} = require('../../configure/src/components/Tabs/Layers/Interactions/interactionUtils');

const INTERACTION_CONFIGS = {
    Select: {
        name: 'Select',
        interactionId: 'select',
        phase: 'preamble',
        order: 0,
        applicableEvents: ['click'],
        applicableLayerTypes: ['vector', 'query'],
    },
    WaypointImage: {
        name: 'WaypointImage',
        interactionId: 'waypoint:image',
        phase: 'main',
        order: 0,
        kindAlias: ['waypoint'],
        applicableEvents: ['click'],
        applicableLayerTypes: ['vector', 'query'],
    },
    WaypointModel: {
        name: 'WaypointModel',
        interactionId: 'waypoint:model',
        phase: 'main',
        order: 1,
        kindAlias: ['waypoint'],
        applicableEvents: ['click'],
        applicableLayerTypes: ['vector', 'query'],
    },
    VesselTrack: {
        name: 'VesselTrack',
        interactionId: 'vessel:track',
        phase: 'main',
        kindAlias: ['vessel'],
        applicableEvents: ['click'],
        applicableLayerTypes: ['vector'],
    },
    InfoOpen: {
        name: 'InfoOpen',
        interactionId: 'info:open',
        phase: 'main',
        kindAlias: ['info'],
        suppresses: ['info:silent'],
        applicableEvents: ['click'],
        applicableLayerTypes: ['vector', 'query'],
    },
    InfoSilent: {
        name: 'InfoSilent',
        interactionId: 'info:silent',
        phase: 'postamble',
        order: 0,
        applicableEvents: ['click'],
        applicableLayerTypes: ['vector', 'query'],
    },
};

test.describe('Configure interaction pipeline helpers', () => {
    test('filters interactions by layer, event, and phase', () => {
        expect(
            getApplicableInteractions(
                INTERACTION_CONFIGS,
                'query',
                'click',
                'main'
            ).map((interaction) => interaction.interactionId)
        ).toEqual(['waypoint:image', 'waypoint:model', 'info:open']);
    });

    test('derives dynamic Kind options including external plugins', () => {
        expect(getKindOptions(INTERACTION_CONFIGS, 'vector')).toEqual([
            'none',
            'info',
            'vessel',
            'waypoint',
        ]);
        expect(getKindOptions(INTERACTION_CONFIGS, 'query')).toEqual([
            'none',
            'info',
            'waypoint',
        ]);
    });

    test('orders every interaction sharing a Kind alias', () => {
        expect(
            getKindPipeline(INTERACTION_CONFIGS, 'vector', 'waypoint')
        ).toEqual(['waypoint:image', 'waypoint:model']);
    });

    test('reports postamble suppression sources', () => {
        expect(
            getSuppressionSources(INTERACTION_CONFIGS, [
                'info:open',
                'vessel:track',
            ])
        ).toEqual({ 'info:silent': 'InfoOpen' });
    });

    test('updates only click while preserving pointer pipelines', () => {
        const interactions = { hover: ['feature:hover'] };

        expect(withClickPipeline(interactions, ['info:open'])).toEqual({
            hover: ['feature:hover'],
            click: ['info:open'],
        });
        expect(withClickPipeline(interactions, [])).toEqual({
            hover: ['feature:hover'],
            click: [],
        });
        expect(withClickPipeline(interactions, null)).toEqual(interactions);
        expect(withClickPipeline({ click: ['info:open'] }, null)).toBeNull();
    });
});

test('core manifests drive the Configure Kind pipeline', () => {
    const repositoryRoot = path.resolve(__dirname, '../..');
    const interactionsDirectory = path.join(
        repositoryRoot,
        'plugins/core/interactions'
    );
    const interactionConfigs = fs
        .readdirSync(interactionsDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map((entry) =>
            JSON.parse(
                fs.readFileSync(
                    path.join(interactionsDirectory, entry.name, 'plugin.json'),
                    'utf8'
                )
            )
        )
        .filter((interaction) =>
            (interaction.pluginDependencies || []).every((dependency) =>
                fs.existsSync(path.join(repositoryRoot, 'plugins', dependency))
            )
        )
        .reduce((configs, interaction) => {
            configs[interaction.name] = interaction;
            return configs;
        }, {});

    expect(getKindOptions(interactionConfigs, 'vector')).toEqual([
        'none',
        'draw_tool',
        'info',
        'viewer_open',
        'waypoint',
    ]);
    expect(getKindPipeline(interactionConfigs, 'vector', 'waypoint')).toEqual([
        'waypoint:image',
        'waypoint:model',
    ]);
});

test('applicable layer metaconfigs expose the Interactions editor', () => {
    const layerTypePluginDirs = {
        vector: 'Vector',
        vectortile: 'VectorTile',
        query: 'Query',
    };
    for (const layerType of ['vector', 'vectortile', 'query']) {
        const metaconfig = JSON.parse(
            fs.readFileSync(
                path.resolve(
                    __dirname,
                    `../../plugins/core/layertypes/${layerTypePluginDirs[layerType]}/metaconfig.json`
                ),
                'utf8'
            )
        );
        const tab = metaconfig.tabs.find(
            (candidate) => candidate.name === 'Interactions'
        );
        const component = tab?.rows?.[0]?.components?.[0];
        const tabNames = metaconfig.tabs.map((candidate) => candidate.name);
        const interactionsIndex = tabNames.indexOf('Interactions');
        const legendIndex = tabNames.indexOf('Legend');
        const filterIndex = tabNames.indexOf('Filter');

        expect(tab).toBeDefined();
        expect(interactionsIndex).toBe(legendIndex + 1);
        if (filterIndex >= 0) expect(interactionsIndex).toBe(filterIndex - 1);
        expect(component?.type).toBe('interactions');
        expect(component?.fields).toEqual(['kind', 'interactions']);
    }
});
