/**
 * ComponentController_ - Manages initialization of Plugin-Components
 *
 * This controller is responsible for:
 * - Reading component configuration from mission config
 * - Filtering enabled components (on: true)
 * - Initializing each component's init() method
 * - Handling errors gracefully so one component doesn't break others
 * - Logging initialization progress and timing
 *
 * Components are lightweight, one-time initialization plugins that run
 * after the UI is finalized (after fina()). They're ideal for:
 * - Analytics integrations
 * - Global keyboard shortcuts
 * - Custom page-level enhancements
 * - Background services
 */

import L_ from '../Layers_/Layers_'
import { componentModules, componentConfigs } from '../../../pre/components'

const ComponentController_ = {
    /**
     * Initialize all enabled components
     *
     * This function is called once after the MMGIS UI is finalized (after fina())
     * It reads the mission configuration, filters enabled components, and calls
     * each component's init() method with error handling.
     *
     * Components initialize in discovery order (not guaranteed stable between builds)
     * Component initialization errors are caught and logged but don't prevent
     * other components from initializing or break the page.
     */
    initializeComponents: function () {
        // Get mission configuration
        // L_.configData contains the full mission configuration loaded from the API
        const config = L_.configData

        // Track which components were explicitly configured
        const initializedModules = new Set()

        // Initialize mission-configured components
        if (config) {
            const configuredComponents = config.components || []
            const enabledComponents = configuredComponents.filter(
                (component) => component.on === true
            )

            enabledComponents.forEach((component) => {
                const componentName = component.name
                const componentVars = component.variables || {}

                try {
                    const componentModule = componentModules[component.js]

                    if (!componentModule) {
                        throw new Error(
                            `Component module "${component.js}" not found in componentModules. ` +
                                `Available modules: ${Object.keys(
                                    componentModules
                                ).join(', ')}`
                        )
                    }

                    if (typeof componentModule.init !== 'function') {
                        throw new Error(
                            `Component "${componentName}" does not have an init() method`
                        )
                    }

                    componentModule.init(componentVars)
                    initializedModules.add(component.js)
                } catch (err) {
                    console.error(
                        `[ComponentController] ✗ Error initializing component "${componentName}"):`,
                        err
                    )
                }
            })
        }

        // Auto-init core components not explicitly configured in the mission
        for (const moduleName in componentConfigs) {
            if (initializedModules.has(moduleName)) continue
            const cfg = componentConfigs[moduleName]
            if (cfg.tier !== 'core' || cfg.hasVars) continue

            const componentModule = componentModules[moduleName]
            if (!componentModule || typeof componentModule.init !== 'function')
                continue

            try {
                componentModule.init({})
            } catch (err) {
                console.error(
                    `[ComponentController] ✗ Error auto-initializing core component "${moduleName}"):`,
                    err
                )
            }
        }
    },
}

export default ComponentController_
