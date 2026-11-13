import React, { useEffect, useRef } from 'react'
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
        module.attachEvents?.(layer.name, shader)
        module.attachImmediateEvents?.(layer.name, shader)
    }, [layer.name, module, shader, api, resetToken])
    return module?.getHTML ? (
        <div className="lt2-dataShaderSettings" ref={host} />
    ) : (
        <div>Shader settings are not available for this layer.</div>
    )
}

export default {
    sections() {
        return [
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
