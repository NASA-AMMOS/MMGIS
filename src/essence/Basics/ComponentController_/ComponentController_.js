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

        // Check if configuration exists and has components
        if (!config) {
            return
        }

        // Get components configuration (defaults to empty array if not present)
        const configuredComponents = config.components || []

        if (configuredComponents.length === 0) {
            return
        }

        // Filter to only enabled components
        const enabledComponents = configuredComponents.filter(
            (component) => component.on === true
        )

        if (enabledComponents.length === 0) {
            return
        }

        // Track initialization statistics
        let successCount = 0
        let errorCount = 0

        // Initialize each enabled component
        enabledComponents.forEach((component, index) => {
            const componentName = component.name
            const componentVars = component.variables || {}

            try {
                // Get the component module from the imported modules
                const componentModule = componentModules[component.js]

                if (!componentModule) {
                    throw new Error(
                        `Component module "${component.js}" not found in componentModules. ` +
                            `Available modules: ${Object.keys(
                                componentModules
                            ).join(', ')}`
                    )
                }

                // Verify the component has an init method
                if (typeof componentModule.init !== 'function') {
                    throw new Error(
                        `Component "${componentName}" does not have an init() method`
                    )
                }

                // Call the component's init() method with its configured variables
                componentModule.init(componentVars)

                successCount++
            } catch (err) {
                // Catch and log errors but continue to next component
                // This ensures one broken component doesn't break the entire page
                console.error(
                    `[ComponentController] ✗ Error initializing component "${componentName}"):`,
                    err
                )
                errorCount++
            }
        })
    },
}

export default ComponentController_
