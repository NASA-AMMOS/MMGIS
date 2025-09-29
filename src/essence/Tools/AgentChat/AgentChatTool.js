import $ from 'jquery'
import L_ from '../../Basics/Layers_/Layers_'
import * as d3 from 'd3'

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

    function listLayersLine() {
        const items = buildCatalog()
        if (items.length === 0) return 'Layers: (none)'
        const parts = items.map(
            (i) => `${i.displayName} (${i.visible ? 'on' : 'off'})`
        )
        return 'Layers: ' + parts.join(', ')
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
        const performed = []
        for (const a of actions) {
            if (!a || typeof a !== 'object') continue
            if (a.tool === 'list_layers') {
                addLine(listLayersLine())
                performed.push('listed')
            } else if (a.tool === 'toggle_layer') {
                const dn = a.args && a.args.name
                const id = resolveDisplayNameToId(dn)
                if (!id) {
                    addLine(
                        `Couldn't find layer "${dn}". Try "list layers" first.`
                    )
                    continue
                }
                const wasVisible = !!(window.mmgisAPI.getVisibleLayers() || {})[
                    id
                ]
                pushUndo({
                    tool: 'toggle_layer',
                    target: dn,
                    previous: { visible: wasVisible },
                })
                await window.mmgisAPI.toggleLayer(
                    id,
                    !!(a.args && a.args.visible)
                )
                performed.push(
                    'toggled ' +
                        dn +
                        ' ' +
                        (a.args && a.args.visible ? 'on' : 'off')
                )
            } else if (a.tool === 'set_layer_opacity') {
                const dn = a.args && a.args.name
                const o = a.args && a.args.opacity
                const id = resolveDisplayNameToId(dn)
                if (!id) {
                    addLine(
                        `Couldn't find layer "${dn}". Try "list layers" first.`
                    )
                    continue
                }
                // best-effort previous opacity (if tracked by L_)
                const prev =
                    L_.layers && L_.layers.opacity && L_.layers.opacity[id]
                if (typeof prev === 'number')
                    pushUndo({
                        tool: 'set_layer_opacity',
                        target: dn,
                        previous: { opacity: prev },
                    })
                L_.setLayerOpacity(id, o)
                performed.push(`opacity ${dn} ${o}`)
            } else if (a.tool === 'zoom_to') {
                const m = window.mmgisAPI.map
                if (!m) continue
                const prevCenter = m.getCenter && m.getCenter()
                const prevZoom = m.getZoom && m.getZoom()
                const c = a.args && a.args.center
                const b = a.args && a.args.bbox
                if (
                    Array.isArray(c) &&
                    typeof (a.args && a.args.zoom) === 'number'
                ) {
                    const lon = c[0],
                        lat = c[1]
                    if (prevCenter && typeof prevZoom === 'number') {
                        pushUndo({
                            tool: 'zoom_to',
                            target: 'map',
                            previous: {
                                center: [prevCenter.lng, prevCenter.lat],
                                zoom: prevZoom,
                            },
                        })
                    }
                    m.setView([lat, lon], a.args && a.args.zoom)
                    performed.push(
                        'zoom ' +
                            lat +
                            ',' +
                            lon +
                            '@' +
                            (a.args && a.args.zoom)
                    )
                } else if (Array.isArray(b)) {
                    if (prevCenter && typeof prevZoom === 'number') {
                        pushUndo({
                            tool: 'zoom_to',
                            target: 'map',
                            previous: {
                                center: [prevCenter.lng, prevCenter.lat],
                                zoom: prevZoom,
                            },
                        })
                    }
                    const bounds = [
                        [b[1], b[0]],
                        [b[3], b[2]],
                    ]
                    m.fitBounds(bounds)
                    performed.push('zoom bbox')
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
        if (entry.tool === 'toggle_layer') {
            const id = resolveDisplayNameToId(entry.target)
            if (id != null && typeof entry.previous?.visible === 'boolean') {
                await window.mmgisAPI.toggleLayer(id, entry.previous?.visible)
                addLine(
                    `Undid: toggle_layer ${entry.target} (now ${entry.previous.visible ? 'on' : 'off'}).`
                )
            }
        } else if (entry.tool === 'set_layer_opacity') {
            const id = resolveDisplayNameToId(entry.target)
            if (id != null && typeof entry.previous?.opacity === 'number') {
                L_.setLayerOpacity(id, entry.previous?.opacity)
                addLine(
                    `Undid: set_layer_opacity ${entry.target} (now ${entry.previous?.opacity}).`
                )
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
