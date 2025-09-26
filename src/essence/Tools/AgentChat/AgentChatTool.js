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

    function listLayers() {
        const confs = window.mmgisAPI.getLayerConfigs()
        const names = Object.keys(confs || {})
        return names
    }

    async function exec(actions) {
        const performed = []
        for (const a of actions) {
            if (!a || typeof a !== 'object') continue
            if (a.tool === 'list_layers') {
                const names = listLayers()
                addLine('Layers: ' + (names.join(', ') || '(none)'))
                performed.push('listed')
            } else if (a.tool === 'toggle_layer') {
                const n = a.args && a.args.name
                const names = listLayers()
                if (!names.includes(n)) {
                    addLine(
                        `Couldn't find layer "${n}". Try "List layers" first.`
                    )
                    continue
                }
                await window.mmgisAPI.toggleLayer(
                    n,
                    !!(a.args && a.args.visible)
                )
                performed.push(
                    'toggled ' +
                        n +
                        ' ' +
                        (a.args && a.args.visible ? 'on' : 'off')
                )
            } else if (a.tool === 'set_layer_opacity') {
                const n = a.args && a.args.name
                const o = Math.max(
                    0,
                    Math.min(1, parseFloat((a.args && a.args.opacity) || 0))
                )
                const names = listLayers()
                if (!names.includes(n)) {
                    addLine(
                        `Couldn't find layer "${n}". Try "List layers" first.`
                    )
                    continue
                }
                L_.setLayerOpacity(n, o)
                performed.push(`opacity ${n} ${o}`)
            } else if (a.tool === 'zoom_to') {
                const m = window.mmgisAPI.map
                if (!m) continue
                const c = a.args && a.args.center
                const b = a.args && a.args.bbox
                if (
                    Array.isArray(c) &&
                    typeof (a.args && a.args.zoom) === 'number'
                ) {
                    const lon = c[0],
                        lat = c[1]
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

    $btn.on('click', async () => {
        const msg = ($in.val() || '').toString().trim()
        if (!msg) return
        addLine('You: ' + msg)
        $in.val('')
        const r = await callAgent(msg)
        if (r && r.text) addLine(r.text)
        if (r && Array.isArray(r.actions)) await exec(r.actions)
    })
    $in.on('keydown', (e) => {
        if (e.key === 'Enter') $btn.click()
    })

    function separateFromMMGIS() {}
    // TODO(undo): Keep a local stack of last actions to support "Undo last" (client-only)
}

export default AgentChatTool
