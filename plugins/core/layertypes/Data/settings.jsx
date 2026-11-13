import React, { useEffect, useRef } from 'react'
import { Select } from '@design/components'
import L_ from '@basics/Layers_/Layers_'
import DataShaders from '@essence/services/DataShaders'

const shaderDefaults = new WeakMap()

function ShaderSettings({ layer, api, resetToken }) {
    const host = useRef(null)
    const lastReset = useRef(resetToken)
    const shader = layer.variables?.shader || {}
    const module = DataShaders[shader.type]
    if (!shaderDefaults.has(layer))
        shaderDefaults.set(
            layer,
            JSON.parse(JSON.stringify(layer.variables?.shader || {}))
        )
    useEffect(() => {
        if (lastReset.current !== resetToken) {
            lastReset.current = resetToken
            layer.variables.shader = JSON.parse(
                JSON.stringify(shaderDefaults.get(layer))
            )
            api.reload()
            return
        }
        if (!host.current || !module?.getHTML) return
        const generated = module.getHTML(layer.name, shader)
        host.current.innerHTML = `<ul>${generated}</ul>`
        host.current.querySelectorAll('input, select').forEach((control, index) => {
            if (control.getAttribute('aria-label') || control.labels?.length)
                return
            const row = control.closest('li')
            const label =
                row?.querySelector(':scope > div > div:first-child')
                    ?.textContent?.trim() || `Shader setting ${index + 1}`
            control.setAttribute('aria-label', label)
        })
        module.attachEvents?.(layer.name, shader)
        module.attachImmediateEvents?.(layer.name, shader)
    }, [layer.name, module, shader, api, resetToken])
    return module?.getHTML ? (
        <div className="lt2-dataShaderSettings" ref={host} />
    ) : (
        <div>Shader settings are not available for this layer.</div>
    )
}

function DataDisplaySettings({ layer, api }) {
    const currentBlend = L_.layers.filters?.[layer.name]?.['mix-blend-mode']
    const blend =
        currentBlend == null || currentBlend === 'none'
            ? 'unset'
            : currentBlend
    return (
        <div className="lt2-typeSettingsField">
            <span>Blend</span>
            <Select
                aria-label="Blend mode"
                value={blend}
                options={[
                    { value: 'unset', label: 'None' },
                    { value: 'color', label: 'Color' },
                    { value: 'overlay', label: 'Overlay' },
                ]}
                onValueChange={(value) => api.setBlend(value)}
            />
        </div>
    )
}

export default {
    sections() {
        return [
            {
                id: 'data-display',
                label: 'Display',
                order: 5,
                Component: DataDisplaySettings,
            },
            {
                id: 'data-shader',
                label: 'Data shader',
                order: 10,
                Component: ShaderSettings,
            },
        ]
    },
    actions: () => [],
    status: (layer) =>
        layer._loading
            ? { kind: 'loading', message: 'Loading data layer' }
            : null,
}
