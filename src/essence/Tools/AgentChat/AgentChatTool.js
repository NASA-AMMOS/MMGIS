import $ from 'jquery'
import L_ from '../../Basics/Layers_/Layers_'
import * as d3 from 'd3'
import RENDERERS from './renderers'

const markup = [
    `<div id='agentChat' style='display:flex;flex-direction:column;height:100%'>`,
    `  <div id='agentChatTranscript' style='flex:1;overflow:auto;padding:8px'></div>`,
    `  <div style='display:flex;gap:6px;padding:8px;border-top:1px solid var(--color-h)'>`,
    `    <input id='agentChatInput' type='text' placeholder='Ask: "List layers"' style='flex:1;padding:6px;background:var(--color-j);color:var(--color-b);border:1px solid var(--color-h);border-radius:4px'/>`,
    `    <button id='agentChatSend' class='mmgis-button'>Send</button>`,
    `  </div>`,
    `</div>`,
].join('\n')

const AgentChatTool = {
    height: 220,
    width: 360,
    MMGISInterface: null,
    make: function () {
        this.MMGISInterface = new interfaceWithMMGIS()
    },
    destroy: function () {
        this.MMGISInterface.separateFromMMGIS()
    },
    getUrlString: function () {
        return ''
    },
}

function interfaceWithMMGIS() {
    this.separateFromMMGIS = function () {
        separateFromMMGIS()
    }

    let tools = d3.select('#tools')
    tools.selectAll('*').remove()
    tools = tools.append('div').style('height', '100%')
    tools.html(markup)

    const $tx = $('#agentChatTranscript')
    const $in = $('#agentChatInput')
    const $btn = $('#agentChatSend')
    let toolRegistry = null

    function addLine(text, cls = '') {
        const div = $(
            `<div class='${cls}' style='margin:4px 0;white-space:pre-wrap'></div>`
        ).text(text)
        $tx.append(div)
        $tx.scrollTop($tx[0].scrollHeight)
    }

    // Dynamic input contrast: ensure readable text against background
    ;(function ensureInputContrast() {
        const el = $in[0]
        if (!el) return
        const cs = getComputedStyle(el)
        const bg = cs.backgroundColor

        function parseRGB(s) {
            const m = s.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i)
            if (!m) return [255, 255, 255]
            return [parseInt(m[1], 10), parseInt(m[2], 10), parseInt(m[3], 10)]
        }

        function luminance([r, g, b]) {
            const a = [r, g, b].map((v) => {
                v /= 255
                return v <= 0.03928
                    ? v / 12.92
                    : Math.pow((v + 0.055) / 1.055, 2.4)
            })
            return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]
        }
        const Lbg = luminance(parseRGB(bg))
        const light = '#ffffff'
        const dark = '#111111'
        // pick higher contrast vs background
        // contrast ratio (L1+0.05)/(L2+0.05)
        function contrast(hex) {
            function hexToRgb(h) {
                const x = h.replace('#', '')
                const n = parseInt(
                    x.length === 3
                        ? x
                              .split('')
                              .map((c) => c + c)
                              .join('')
                        : x,
                    16
                )
                return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
            }
            const L = luminance(hexToRgb(hex))
            const L1 = Math.max(L, Lbg)
            const L2 = Math.min(L, Lbg)
            return (L1 + 0.05) / (L2 + 0.05)
        }
        const cand = contrast(dark) >= contrast(light) ? dark : light
        $in.css('color', cand)
    })()

    async function callAgent(message) {
        try {
            const res = await fetch(
                window.mmgisglobal.ROOT_PATH + '/api/agent',
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message }),
                }
            )
            if (!res.ok) throw new Error('Request failed')
            return await res.json()
        } catch (e) {
            return { text: 'Error contacting agent.', actions: [] }
        }
    }

    async function loadRegistry() {
        if (toolRegistry) return toolRegistry
        try {
            const res = await fetch(
                window.mmgisglobal.ROOT_PATH + '/api/agent/tools',
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                }
            )
            if (res.ok) {
                toolRegistry = await res.json()
                return toolRegistry
            }
        } catch (e) {}
        toolRegistry = { tools: [] }
        return toolRegistry
    }

    function buildCatalog() {
        const confs = window.mmgisAPI.getLayerConfigs() || {}
        const visibles = window.mmgisAPI.getVisibleLayers() || {}
        const items = []
        for (const k of Object.keys(confs)) {
            const c = confs[k] || {}
            const displayName =
                c.display_name || c.displayName || c.name || c.title || k
            items.push({
                id: k,
                name: c.name || k,
                displayName,
                visible: !!visibles[k],
            })
        }
        return items
    }

    function resolveDisplayNameToId(displayName) {
        const items = buildCatalog()
        const exact = items.find((i) => i.displayName === displayName)
        return exact ? exact.name : null
    }

    const undoStack = []

    function pushUndo(entry) {
        undoStack.push({ ...entry, timestamp: Date.now() })
        if (undoStack.length > 25) undoStack.shift()
    }

    async function exec(actions) {
        const registry = await loadRegistry()
        const toolsByName = {}
        ;(registry.tools || []).forEach((t) => (toolsByName[t.name] = t))
        const kindOf = (uiType) => {
            const map = (registry.uiProfiles && registry.uiProfiles[uiType]) || null
            if (map && map.kind) return map.kind
            const fallback = {
                layers_line: 'render_layers_line',
                mmgis_overview: 'render_text_with_citation',
                layer_summary: 'render_layer_summary',
                web_search_suggest: 'render_links_summary',
                opacity: 'set_opacity',
                zoom_view: 'zoom_view',
                toggle: 'toggle_visibility',
            }
            return fallback[uiType]
        }
        const performed = []
        for (const a of actions) {
            if (!a || typeof a !== 'object') continue
            const spec = toolsByName[a.tool]
            if (!spec || !spec.execution) continue
            const x = spec.execution
            if (x.adapter === 'mmgisAPI') {
                const dn = a.args && a.args.name
                const method = x.method
                const argOrder = x.argOrder || []
                let args = []
                for (const k of argOrder) {
                    if (
                        k === 'name' &&
                        x.nameResolution === 'displayNameToInternalId'
                    ) {
                        const id = resolveDisplayNameToId(dn)
                        if (!id) {
                            addLine(`Couldn't find layer "${dn}".`)
                            args = null
                            break
                        }
                        args.push(id)
                    } else {
                        args.push(a.args ? a.args[k] : undefined)
                    }
                }
                if (args == null) continue
                const wasVisible = (() => {
                    if (method === 'toggleLayer') {
                        const id = resolveDisplayNameToId(dn)
                        return !!(window.mmgisAPI.getVisibleLayers() || {})[id]
                    }
                    return undefined
                })()
                if (typeof wasVisible === 'boolean') {
                    pushUndo({
                        method,
                        target: dn,
                        previous: { visible: wasVisible },
                    })
                }
                const fn = window.mmgisAPI && window.mmgisAPI[method]
                if (typeof fn === 'function') await fn.apply(window.mmgisAPI, args)
                performed.push(method)
            } else if (x.adapter === 'openapi') {
                try {
                    const r = await fetch(
                        window.mmgisglobal.ROOT_PATH + '/api/agent/exec',
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ action: a }),
                        }
                    )
                    if (r.ok) {
                        const j = await r.json()
                        const uiType = x.ui && x.ui.type
                        const kind = kindOf(uiType)
                        if (kind && typeof RENDERERS[kind] === 'function') {
                            await RENDERERS[kind]({}, j.result)
                        }
                        performed.push('exec')
                    }
                } catch (_) {}
            } else if (x.adapter === 'custom') {
                const uiType = x.ui && x.ui.type
                const kind = kindOf(uiType)
                if (kind && typeof RENDERERS[kind] === 'function') {
                    await RENDERERS[kind]({}, a.args || {})
                    performed.push(kind)
                }
            }
        }
        if (performed.length) addLine('Performed: ' + performed.join('; '))
    }

    async function undoLast() {
        const entry = undoStack.pop()
        if (!entry) {
            addLine('Nothing to undo.')
            return
        }
        const m = window.mmgisAPI.map
        if (entry.method === 'toggleLayer') {
            const id = resolveDisplayNameToId(entry.target)
            if (id != null && typeof entry.previous?.visible === 'boolean') {
                await window.mmgisAPI.toggleLayer(id, entry.previous?.visible)
                addLine(`Undid: visibility for ${entry.target}.`)
            }
        } else if (entry.method === 'setLayerOpacity') {
            const id = resolveDisplayNameToId(entry.target)
            if (id != null && typeof entry.previous?.opacity === 'number') {
                L_.setLayerOpacity(id, entry.previous?.opacity)
                addLine(`Undid: opacity for ${entry.target}.`)
            }
        } else if (entry.tool === 'zoom_to') {
            if (
                m &&
                entry.previous?.center &&
                typeof entry.previous?.zoom === 'number'
            ) {
                const [lon, lat] = entry.previous?.center
                m.setView([lat, lon], entry.previous?.zoom)
                addLine('Undid: zoom_to (restored previous view).')
            }
        }
    }

    $btn.on('click', async () => {
        const msg = ($in.val() || '').toString().trim()
        if (!msg) return
        if (/^undo\s+last$/i.test(msg)) {
            addLine('You: ' + msg)
            $in.val('')
            await undoLast()
            return
        }
        addLine('You: ' + msg)
        $in.val('')
        const originalBtnText = $btn.text()
        $btn.prop('disabled', true).text('Sending...')
        $in.prop('disabled', true)
        const r = await callAgent(msg)
        if (r && r.text) addLine(r.text)
        if (r && Array.isArray(r.actions)) await exec(r.actions)
        $btn.prop('disabled', false).text(originalBtnText)
        $in.prop('disabled', false)
        $in.focus()
    })
    $in.on('keydown', (e) => {
        if (e.key === 'Enter') $btn.click()
    })

    function separateFromMMGIS() {}
    // TODO(undo): Keep a local stack of last actions to support "Undo last" (client-only)
}

export default AgentChatTool
