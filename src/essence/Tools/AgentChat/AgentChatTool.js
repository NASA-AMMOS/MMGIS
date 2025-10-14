/* MMGIS Copilot - Floating Chat Tool (plain HTML)
   - Resizable, draggable, closable overlay that never blocks MMGIS UI.
   - No external UI libraries or asset loading.
   - Citations and trace use <details> only.
   - Same backend contract (/api/agent, /api/agent/tools).
*/

import L_ from '../../Basics/Layers_/Layers_'
import * as d3 from 'd3'
import RENDERERS from './renderers'
const HISTORY_KEY = 'mmgis.agent.chat.history.v1'
const OVERLAY_ID = 'mmgis-agentchat-overlay'
const PANEL_ID = 'mmgis-agentchat-panel'

// IMPORTANT: declare before any reference (avoid TDZ)

const AgentChatTool = {
    height: 0,
    width: 'full',
    MMGISInterface: null,
    make() {
        this.MMGISInterface = new interfaceWithMMGIS()
    },
    destroy() {
        this.MMGISInterface.separateFromMMGIS()
    },
    getUrlString() {
        return ''
    },
}

function interfaceWithMMGIS() {
    this.separateFromMMGIS = function () {
        cleanup()
    }

    // Keep #tools minimized so we don’t fight its panel.
    try {
        d3.select('#tools').selectAll('*').remove()
        if (window.ToolController_) {
            window.ToolController_.setToolHeight(0)
            window.ToolController_.setToolWidth('full')
            const ui = window.ToolController_.UserInterface
            if (ui && typeof ui.closeToolPanel === 'function')
                ui.closeToolPanel()
        }
    } catch (_) {}

    const state = {
        toolRegistry: null,
        history: loadHistory(),
        transcriptEl: null,
        inputEl: null,
        sendBtn: null,
        minimized: false,
        keyHandlersAttached: false,
        lastFocusedEl: null,
    }
    const undoStack = []

    // Initialize UI only (no external assets/styles)
    initUI()

    function initUI() {
        removeExistingOverlay()

        // Overlay doesn’t intercept input outside the panel.
        const overlay = document.createElement('div')
        overlay.id = OVERLAY_ID
        overlay.style.position = 'fixed'
        overlay.style.zIndex = '2000'
        overlay.style.pointerEvents = 'none'
        const startW = 440
        const startH = 560
        const topPad = 72
        const rightPad = 24
        overlay.style.left = `${Math.max(8, window.innerWidth - startW - rightPad)}px`
        overlay.style.top = `${Math.max(8, topPad)}px`
        overlay.style.width = `${startW}px`
        overlay.style.height = `${startH}px`
        overlay.setAttribute('data-agentchat-root', 'true')

        state.lastFocusedEl = document.activeElement || null

        overlay.innerHTML = renderOverlayInner()
        document.body.appendChild(overlay)

        const panel = document.getElementById(PANEL_ID)
        state.transcriptEl = panel.querySelector('#agentChatTranscript')
        state.inputEl = panel.querySelector('#agentChatInput')
        state.sendBtn = panel.querySelector('#agentChatSend')

        wireHeaderControls(panel)
        wireComposer(panel)

        renderMessages()
        scrollTranscript()
        initDragAndResize(overlay, panel)
        attachGlobalKeys()

        setTimeout(() => state.inputEl?.focus(), 0)
    }

    function renderOverlayInner() {
        return `
      <div
        id="${PANEL_ID}"
        class="ac-panel"
        role="dialog"
        aria-modal="false"
        aria-labelledby="agentchat-title"
        style="pointer-events: auto; width: 100%; height: 100%; display: flex; flex-direction: column; overflow: hidden; background: rgba(17,17,17,0.84); color:#e7e7e7; border:1px solid rgba(255,255,255,0.12); border-radius:10px; box-shadow:0 20px 60px rgba(0,0,0,0.45);"
      >
        <header class="ac-header" style="display:flex; align-items:center; justify-content:space-between; padding: 10px; background: rgba(20,20,20,0.88); border-bottom: 1px solid rgba(255,255,255,0.08); user-select:none; cursor:move;">
          <div class="ac-header-left" style="display:flex; align-items:center; gap:10px; min-width:0;">
            <div class="ac-avatar" style="width: 28px; height: 28px; border-radius: 999px; background:#0ea5e9; color:#001018; font-weight:700; font-size: 12px; display:flex; align-items:center; justify-content:center;">AI</div>
            <div class="ac-title-wrap" style="line-height:1.1; min-width:0;">
              <div id="agentchat-title" class="ac-title" style="font-size:13px; font-weight:700; color:#f3f3f3;">MMGIS Copilot</div>
              <div class="ac-subtitle" style="font-size:11px; color:#bdbdbd;">Ask questions, control layers, explore docs.</div>
            </div>
          </div>
          <div class="ac-header-actions" style="display:flex; gap:6px;">
            <button id="agentChatMin" class="ac-icon-btn" title="Minimize" aria-label="Minimize" style="min-width:32px; min-height:32px; padding:0 6px; border:1px solid rgba(255,255,255,0.2); background:#1b1b1b; color:#ddd; border-radius:8px; cursor:pointer;">–</button>
            <button id="agentChatClose" class="ac-icon-btn" title="Close" aria-label="Close" style="min-width:32px; min-height:32px; padding:0 6px; border:1px solid rgba(255,255,255,0.2); background:#1b1b1b; color:#ddd; border-radius:8px; cursor:pointer;">×</button>
          </div>
        </header>

        <div id="agentChatTranscript" class="ac-scroll" style="flex:1; overflow:auto; padding:16px;"></div>

        <div class="ac-composer" style="border-top:1px solid rgba(255,255,255,0.10); padding:10px; background: rgba(18,18,18,0.88);">
          <form id="agentChatComposer" class="ac-composer-row" style="display:flex; align-items:center; gap:8px;">
            <input id="agentChatInput" type="text" autocomplete="off" placeholder='Ask: "List layers"' class="ac-input" style="background:#1a1a1a; color:#f2f2f2; border:1px solid #333; border-radius:999px; padding:10px 12px; outline:none; width:100%;" />
            <button id="agentChatSend" type="submit" class="ac-btn-primary" style="background:#0ea5e9; color:#001018; border:none; border-radius:999px; padding:10px 14px; font-weight:600; cursor:pointer;">Send</button>
            <button id="agentChatClear" type="button" class="ac-btn" title="Clear conversation" style="background:#1f1f1f; color:#ddd; border:1px solid #333; border-radius:999px; padding:10px 12px; cursor:pointer;">Clear</button>
          </form>
        </div>

        <!-- Resize handles placed inside to avoid corner artifacts -->
        <div data-agentchat-resize="top" class="ac-handle-top" style="position:absolute; left:0; right:0; top:0; height:14px; cursor:ns-resize;"></div>
        <div data-agentchat-resize="right" class="ac-handle-right" style="position:absolute; top:38px; bottom:42px; right:0; width:14px; cursor:ew-resize;"></div>
        <div data-agentchat-resize="corner" class="ac-handle-corner" style="position:absolute; bottom:0; right:0; width:22px; height:22px; cursor:nesw-resize;"></div>
      </div>
    `
    }

    function wireHeaderControls(panel) {
        panel
            .querySelector('#agentChatClose')
            ?.addEventListener('click', () => {
                const toRestore = state.lastFocusedEl
                cleanup()
                try {
                    window.ToolController_?.closeActiveTool?.()
                } catch (_) {}
                setTimeout(() => {
                    if (toRestore && typeof toRestore.focus === 'function')
                        toRestore.focus()
                }, 0)
            })
        panel.querySelector('#agentChatMin')?.addEventListener('click', () => {
            state.minimized = !state.minimized
            applyMinimized(panel)
            if (!state.minimized) scrollTranscript()
        })
    }

    function applyMinimized(panel) {
        const minimized = !!state.minimized
        const transcript = panel.querySelector('#agentChatTranscript')
        const composer = panel.querySelector('.ac-composer')
        const handles = panel.querySelectorAll(
            '.ac-handle-right, .ac-handle-top, .ac-handle-corner'
        )
        if (transcript) transcript.style.display = minimized ? 'none' : ''
        if (composer) composer.style.display = minimized ? 'none' : ''
        handles.forEach((h) => {
            h.style.display = minimized ? 'none' : ''
        })
        panel.style.height = minimized ? '48px' : '100%'
    }

    function wireComposer(panel) {
        const form = panel.querySelector('#agentChatComposer')
        form?.addEventListener('submit', onSend)
        panel
            .querySelector('#agentChatClear')
            ?.addEventListener('click', clearConversation)

        window.__mmgisAgentChatAppend = (text) => {
            if (!text) return
            pushSystem(text)
            scrollTranscript()
        }
    }

    function attachGlobalKeys() {
        if (state.keyHandlersAttached) return
        const onKey = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'm') {
                const panel = document.getElementById(PANEL_ID)
                if (panel) {
                    state.minimized = !state.minimized
                    applyMinimized(panel)
                }
            }
            if (e.key === 'Escape') {
                const toRestore = state.lastFocusedEl
                cleanup()
                try {
                    window.ToolController_?.closeActiveTool?.()
                } catch (_) {}
                setTimeout(() => {
                    if (toRestore && typeof toRestore.focus === 'function')
                        toRestore.focus()
                }, 0)
            }
        }
        window.addEventListener('keydown', onKey)
        state.keyHandlersAttached = true
        window.__agentChatKeyHandler = onKey
    }

    // ————— Conversations ————————————————————————————————————————————————

    async function onSend(e) {
        e.preventDefault()
        const input = state.inputEl
        if (!input) return
        const msg = (input.value || '').toString().trim()
        if (!msg) return

        pushMessage({
            id: uid(),
            role: 'user',
            text: msg,
            timestamp: new Date().toISOString(),
        })
        if (/^undo\s+last$/i.test(msg)) {
            input.value = ''
            await undoLast()
            scrollTranscript()
            return
        }

        input.value = ''
        state.sendBtn?.setAttribute('data-loading', 'true')
        input.setAttribute('disabled', '')

        const res = await callAgent(msg)
        const entry = {
            id: uid(),
            role: 'assistant',
            text: res?.text || '',
            reply: res?.reply || res?.text || '',
            citations: Array.isArray(res?.citations) ? res.citations : [],
            actions: Array.isArray(res?.actions) ? res.actions : [],
            debug: res?.debug || {},
            timestamp: new Date().toISOString(),
            notes: [], // inline “system” notes are folded here
        }
        pushMessage(entry)
        scrollTranscript()

        if (entry.actions?.length) {
            const performed = await exec(entry.actions, entry)
            if (performed.length) {
                entry.performed = performed
                saveHistory()
                renderMessages()
                scrollTranscript()
            }
        }

        state.sendBtn?.removeAttribute('data-loading')
        input.removeAttribute('disabled')
        input.focus()
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
            const payload = await res.json().catch(() => null)
            if (!res.ok) {
                const errorMsg =
                    (payload && (payload.error || payload.message)) ||
                    `Request failed with status ${res.status}`
                const debug = {
                    reason: 'server_error',
                    status: res.status,
                    serverError: payload && (payload.error || payload.message),
                    serverStack: Array.isArray(payload?.stack)
                        ? payload.stack
                        : undefined,
                    validationErrors: Array.isArray(payload?.validationErrors)
                        ? payload.validationErrors
                        : undefined,
                }
                return {
                    text: `Agent failed: ${errorMsg}`,
                    reply: `Agent failed: ${errorMsg}`,
                    actions: [],
                    debug,
                }
            }
            if (payload?.debug?.azure?.reason)
                pushSystem(`Provider note: ${payload.debug.azure.reason}`)
            return payload
        } catch (err) {
            const messageText =
                err && err.message ? err.message : 'Unknown error'
            pushSystem(
                'Error contacting the copilot service. Check your network or server logs.'
            )
            return {
                text: 'Agent is unavailable.',
                reply: `Agent is unavailable: ${messageText}`,
                actions: [],
                debug: {
                    reason: 'client_error',
                    clientError: messageText,
                    clientStack:
                        typeof err?.stack === 'string'
                            ? err.stack.split(/\r?\n/)
                            : undefined,
                },
            }
        }
    }

    function renderMessages() {
        if (!state.transcriptEl) return
        const html = state.history.length
            ? state.history.map(renderMessage).join('')
            : renderEmptyState()
        state.transcriptEl.innerHTML = html
    }

    function renderEmptyState() {
        return `
      <div class="ac-card ac-muted" style="border:1px dashed rgba(255,255,255,0.15); background:#171717; border-radius:12px; padding:12px; color:#cfcfcf;">
        Ask the Copilot about MMGIS, list layers, toggle data, or explore documentation.
      </div>
    `
    }

    function renderMessage(entry) {
        const t = stamp(entry.timestamp)
        const isA = entry.role === 'assistant'
        const isU = entry.role === 'user'
        const roleLabel = isA ? 'Copilot' : isU ? 'You' : 'System'
        const bubbleClass = isA
            ? 'ac-bubble-a'
            : isU
              ? 'ac-bubble-u'
              : 'ac-bubble-s'
        const content = isA
            ? renderContent(entry.reply || entry.text || '')
            : renderContent(entry.text || '')
        const cites = isA ? renderCitations(entry.citations) : ''
        const trace = isA ? renderTrace(entry) : ''
        const notes =
            isA && Array.isArray(entry.notes) && entry.notes.length
                ? `<div class="ac-notes" style="margin-top:8px; display:grid; gap:6px;">${entry.notes.map((n) => `<div class="ac-note" style="background:#2b2403; border:1px solid #6a5803; color:#ffe9a8; border-radius: 10px; padding:8px 10px; font-size:12.5px;">${renderContent(n)}</div>`).join('')}</div>`
                : ''

        return `
      <article class="ac-msg" style="display:flex; flex-direction:column; gap:6px; margin: 10px 2px;">
        <div class="ac-meta" style="color:#a7a7a7; font-size:11px; display:flex; gap:8px; padding: 0 4px;">
          <span class="ac-role" style="color:#d6d6d6; font-weight:600;">${roleLabel}</span>
          <span class="ac-time" aria-label="time ${t}" style="opacity:0.85;">${t}</span>
        </div>
        <div class="${bubbleClass}" aria-live="${isA ? 'polite' : 'off'}" style="border-radius: 12px; padding:12px 14px; border:1px solid rgba(255,255,255,0.08); ${isA ? 'background:#171a1c;' : isU ? 'background:#0b3a55; border-color: rgba(255,255,255,0.15);' : 'background:#332a00; border-color:#5b4a00; color:#ffedb3;'}">
          <div class="ac-prose" style="font-size: 13px; line-height: 1.45;">${content}</div>
          ${notes}
          ${cites}
        </div>
        ${trace}
      </article>
    `
    }

    function renderCitations(list) {
        if (!Array.isArray(list) || !list.length) return ''
        const chips = list
            .map((c, i) => {
                const title =
                    (c && typeof c.title === 'string' && c.title) ||
                    `Source ${i + 1}`
                const url = c && typeof c.url === 'string' ? attr(c.url) : null
                const snippet =
                    (c && typeof c.snippet === 'string' && c.snippet) || ''
                return `
          <span class="ac-cite" style="display:inline-block;">
            <details class="ac-cite"><summary class="ac-chip" style="background:#0b2740; color:#bfe6ff; border:1px solid #15466f; border-radius:999px; padding:4px 10px; cursor:pointer; font-size:12px;">[${i + 1}]</summary>
              <div class="ac-cite-card" style="max-width: 280px; background:#101010; border:1px solid #333; border-radius:12px; padding:10px 12px; color:#ddd; box-shadow: 0 8px 28px rgba(0,0,0,0.45);">
                <div class="ac-cite-title" style="font-weight:600; margin-bottom:6px;">${html(title)}</div>
                ${snippet ? `<p class="ac-cite-snippet" style="font-size:12px; color:#bdbdbd;">${html(snippet)}</p>` : ''}
                ${url ? `<a class="ac-link" href="${url}" target="_blank" rel="noopener" style="color:#7dd3fc; text-decoration: underline; text-underline-offset: 2px;">Open source</a>` : ''}
              </div>
            </details>
          </span>
        `
            })
            .join('')
        return `<div class="ac-cites" style="display:flex; gap:8px; margin-top:10px; flex-wrap: wrap;">${chips}</div>`
    }

    function renderTrace(entry) {
        const blocks = []
        if (entry.actions?.length) {
            blocks.push(
                section(
                    'Planned actions',
                    code(JSON.stringify(entry.actions, null, 2))
                )
            )
        }
        if (entry.performed?.length) {
            blocks.push(
                section(
                    'Performed',
                    code(JSON.stringify(entry.performed, null, 2))
                )
            )
        }
        if (entry.debug && typeof entry.debug === 'object') {
            const az = entry.debug.azure || {}
            const diag = {
                reason: entry.debug.reason,
                azureStatus: az?.response?.status,
                azureMessage: az?.message || az?.reason,
                run: entry.debug.run,
            }
            if (
                diag.reason ||
                diag.azureStatus ||
                diag.azureMessage ||
                diag.run
            ) {
                blocks.push(
                    section('Diagnostics', code(JSON.stringify(diag, null, 2)))
                )
            }
            if (entry.debug.serverError) {
                blocks.push(
                    section(
                        'Server error',
                        code(String(entry.debug.serverError))
                    )
                )
            }
            if (
                Array.isArray(entry.debug.serverStack) &&
                entry.debug.serverStack.length
            ) {
                blocks.push(
                    section(
                        'Server stacktrace',
                        code(entry.debug.serverStack.join('\n'))
                    )
                )
            }
            if (
                Array.isArray(entry.debug.clientFailures) &&
                entry.debug.clientFailures.length
            ) {
                blocks.push(
                    section(
                        'Client failures',
                        code(
                            JSON.stringify(entry.debug.clientFailures, null, 2)
                        )
                    )
                )
            }
            if (
                Array.isArray(entry.debug.validationErrors) &&
                entry.debug.validationErrors.length
            ) {
                blocks.push(
                    section(
                        'Validation errors',
                        code(
                            JSON.stringify(
                                entry.debug.validationErrors,
                                null,
                                2
                            )
                        )
                    )
                )
            }
        }
        if (!blocks.length) return ''
        return `
      <details class="ac-trace"><summary>Show trace</summary>
        <div class="ac-trace-body">${blocks.join('')}</div>
      </details>
    `
    }

    function section(title, body) {
        return `
      <section class="ac-trace-section" style="border-left:3px solid #2a2a2a; padding-left:10px; margin:8px 0;">
        <div class="ac-trace-title" style="font-size:11px; letter-spacing:0.06em; text-transform:uppercase; color:#bfbfbf; margin:6px 0;">${html(title)}</div>
        ${body}
      </section>
    `
    }
    function code(s) {
        return `<pre class="ac-pre" style="background:#0e0e0e; color:#eaeaea; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace; font-size:11.5px; line-height:1.35; padding:10px; border-radius:8px; border:1px solid #222; overflow:auto;">${html(s)}</pre>`
    }

    function stamp(v) {
        if (!v) return ''
        try {
            const d = new Date(v)
            return d.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
            })
        } catch {
            return ''
        }
    }
    function scrollTranscript() {
        if (!state.transcriptEl) return
        state.transcriptEl.scrollTop = state.transcriptEl.scrollHeight
    }

    // ————— Drag & Resize ————————————————————————————————————————————————

    function initDragAndResize(overlay, panel) {
        const header = panel.querySelector('.ac-header')
        const topHandle = panel.querySelector('[data-agentchat-resize="top"]')
        const rightHandle = panel.querySelector(
            '[data-agentchat-resize="right"]'
        )
        const cornerHandle = panel.querySelector(
            '[data-agentchat-resize="corner"]'
        )

        let drag = null
        let rs = null

        const clamp = (v, a, b) => Math.min(b, Math.max(a, v))

        function onDragStart(e) {
            if (e.button !== 0) return
            if (
                e.target?.closest(
                    '.ac-icon-btn, .ac-chip, details, button, input, a'
                )
            )
                return
            const r = overlay.getBoundingClientRect()
            drag = {
                dx: e.clientX - r.left,
                dy: e.clientY - r.top,
                w: r.width,
                h: r.height,
            }
            window.addEventListener('pointermove', onDragMove)
            window.addEventListener('pointerup', onDragEnd, { once: true })
            e.preventDefault()
        }
        function onDragMove(e) {
            if (!drag) return
            const l = clamp(
                e.clientX - drag.dx,
                8 - drag.w * 0.5,
                window.innerWidth - drag.w * 0.2
            )
            const t = clamp(
                e.clientY - drag.dy,
                8,
                window.innerHeight - drag.h - 56
            )
            overlay.style.left = `${Math.round(l)}px`
            overlay.style.top = `${Math.round(t)}px`
        }
        function onDragEnd() {
            drag = null
            window.removeEventListener('pointermove', onDragMove)
        }

        function onResizeStart(dir, e) {
            if (e.button !== 0) return
            e.preventDefault()
            e.stopPropagation()
            const r = overlay.getBoundingClientRect()
            rs = {
                dir,
                w: r.width,
                h: r.height,
                l: r.left,
                t: r.top,
                x: e.clientX,
                y: e.clientY,
            }
            window.addEventListener('pointermove', onResizeMove)
            window.addEventListener('pointerup', onResizeEnd, { once: true })
        }
        function onResizeMove(e) {
            if (!rs) return
            const minW = 360,
                minH = 320
            const maxW = Math.min(window.innerWidth - 40, 900)
            const maxH = Math.min(window.innerHeight - 40, 900)

            let w = rs.w,
                h = rs.h,
                top = rs.t

            if (rs.dir === 'right' || rs.dir === 'corner') {
                const dx = e.clientX - rs.x
                w = clamp(rs.w + dx, minW, maxW)
            }
            if (rs.dir === 'top' || rs.dir === 'corner') {
                const dy = e.clientY - rs.y
                if (rs.dir === 'top') {
                    h = clamp(rs.h - dy, minH, maxH)
                    top = clamp(rs.t + dy, 8, window.innerHeight - h - 56)
                } else {
                    h = clamp(rs.h + dy, minH, maxH)
                }
            }

            overlay.style.width = `${Math.round(w)}px`
            overlay.style.height = `${Math.round(h)}px`
            if (rs.dir === 'top') overlay.style.top = `${Math.round(top)}px`
        }
        function onResizeEnd() {
            rs = null
            window.removeEventListener('pointermove', onResizeMove)
        }

        header?.addEventListener('pointerdown', onDragStart)
        topHandle?.addEventListener('pointerdown', (e) =>
            onResizeStart('top', e)
        )
        rightHandle?.addEventListener('pointerdown', (e) =>
            onResizeStart('right', e)
        )
        cornerHandle?.addEventListener('pointerdown', (e) =>
            onResizeStart('corner', e)
        )
    }

    // ————— Tool registry + execution ————————————————————————————————————

    async function ensureRegistry() {
        if (state.toolRegistry) return state.toolRegistry
        try {
            const res = await fetch(
                window.mmgisglobal.ROOT_PATH + '/api/agent/tools',
                {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                }
            )
            if (!res.ok) throw new Error('Failed to load tool registry')
            state.toolRegistry = await res.json()
        } catch {
            pushSystem(
                'Unable to load the tool registry. Some actions may be unavailable.'
            )
            state.toolRegistry = { tools: [] }
        }
        return state.toolRegistry
    }

    async function exec(actions, entry) {
        await ensureRegistry()
        const map = new Map(
            (state.toolRegistry?.tools || []).map((t) => [t.name, t])
        )
        const performed = []

        for (const a of actions || []) {
            if (!a || typeof a !== 'object') continue
            const spec = map.get(a.tool)
            if (!spec) {
                const available = Array.from(map.keys())
                const err = new Error(
                    `Tool "${a.tool}" is not registered in the current tool registry.`
                )
                addFailure(
                    entry,
                    `Cannot execute tool "${a.tool}": not registered. Available: ${available.length ? available.join(', ') : '(none)'}.`,
                    err,
                    { tool: a.tool, stage: 'registry_lookup' }
                )
                continue
            }
            const x = spec.execution || {}

            if (x.adapter === 'mmgisAPI') {
                const r = await execMmgisApi(x, a, entry)
                if (r) performed.push(r)
            } else if (x.adapter === 'custom') {
                let pendingZoomUndo = null
                if (a.tool === 'zoom_to' && window.mmgisAPI?.map) {
                    const c = window.mmgisAPI.map.getCenter()
                    pendingZoomUndo = {
                        tool: 'zoom_to',
                        previous: {
                            center: [c.lng, c.lat],
                            zoom: window.mmgisAPI.map.getZoom(),
                        },
                    }
                }
                const kind = x.ui?.type || null
                if (kind && typeof RENDERERS[kind] === 'function') {
                    try {
                        await RENDERERS[kind]({}, a.args || {})
                        if (pendingZoomUndo) pushUndo(pendingZoomUndo)
                        performed.push({
                            tool: a.tool,
                            adapter: 'custom',
                            renderer: kind,
                        })
                    } catch (e) {
                        addFailure(
                            entry,
                            `Tool "${a.tool}" renderer "${kind}" failed: ${e?.message || 'Unknown error'}.`,
                            e,
                            { tool: a.tool, renderer: kind, args: a.args }
                        )
                    }
                } else {
                    const msg = kind
                        ? `Renderer "${kind}" not available.`
                        : `Tool "${a.tool}" missing UI renderer type.`
                    addFailure(
                        entry,
                        `Cannot execute tool "${a.tool}": ${msg}`,
                        null,
                        { tool: a.tool, renderer: kind }
                    )
                }
            }
        }
        return performed
    }

    async function execMmgisApi(desc, action, entry) {
        const displayName = action.args?.name
        const method = desc.method
        const order = desc.argOrder || []
        const args = []

        for (const k of order) {
            if (
                k === 'name' &&
                desc.nameResolution === 'displayNameToInternalId'
            ) {
                const id = resolveDisplayNameToId(displayName)
                if (!id) {
                    addFailure(
                        entry,
                        `Cannot execute tool "${action.tool}": layer "${displayName}" not found.`,
                        null,
                        {
                            tool: action.tool,
                            method,
                            name: displayName,
                            reason: 'layer_not_found',
                        }
                    )
                    return null
                }
                args.push(id)
            } else {
                args.push(action.args ? action.args[k] : undefined)
            }
        }

        let pendingUndo = null
        if (method === 'toggleLayer') {
            const id = resolveDisplayNameToId(displayName)
            const wasVisible = !!(window.mmgisAPI?.getVisibleLayers?.() || {})[
                id
            ]
            pendingUndo = {
                method,
                target: displayName,
                previous: { visible: wasVisible },
            }
        }
        if (method === 'setLayerOpacity') {
            const id = resolveDisplayNameToId(displayName)
            const prev =
                L_?.layers?.opacity && typeof L_.layers.opacity[id] === 'number'
                    ? L_.layers.opacity[id]
                    : undefined
            if (typeof prev === 'number')
                pendingUndo = {
                    method,
                    target: displayName,
                    previous: { opacity: prev },
                }
        }

        const fn = window.mmgisAPI?.[method]
        if (typeof fn === 'function') {
            try {
                await fn.apply(window.mmgisAPI, args)
                if (pendingUndo) pushUndo(pendingUndo)
            } catch (e) {
                addFailure(
                    entry,
                    `API method "${method}" threw an error: ${e?.message || 'Unknown error'}.`,
                    e,
                    { tool: action.tool, method, args }
                )
                return null
            }
        } else {
            addFailure(entry, `API method "${method}" not available.`, null, {
                tool: action.tool,
                method,
                args,
                reason: 'missing_api_method',
            })
            return null
        }

        return { tool: action.tool, adapter: 'mmgisAPI', method, args }
    }

    // ————— Layer helpers (robust name/id resolution) —————————————————————

    function collectLayers() {
        try {
            const cfg = window.mmgisAPI?.getLayerConfigs?.() || {}
            const out = []
            for (const c of Object.values(cfg)) {
                const id = String(c?.uuid || c?.name || '')
                if (!id) continue
                const display = String(c?.display_name || c?.name || id)
                const name = String(c?.name || c?.display_name || id)
                out.push({ id, display, name })
            }
            return out
        } catch {
            return []
        }
    }

    function resolveDisplayNameToId(v) {
        if (!v) return null
        return window.mmgisAPI?.asLayerUUID?.(String(v)) || null
    }

    function resolveIdToDisplayName(id) {
        const list = collectLayers()
        const found = list.find((x) => String(x.id) === String(id))
        return found ? found.display : String(id)
    }

    // (Fallback removed intentionally. Tools must be explicitly registered and executed.)

    function addNoteToAssistant(entry, text) {
        // Prefer adding notes to the most recent assistant message to reduce bubble count.
        let target = entry
        if (!target) {
            for (let i = state.history.length - 1; i >= 0; i--) {
                if (state.history[i]?.role === 'assistant') {
                    target = state.history[i]
                    break
                }
            }
        }
        if (target && target.role === 'assistant') {
            target.notes = target.notes || []
            target.notes.push(text)
            saveHistory()
            renderMessages()
        } else {
            // Fallback to a small system line if no assistant message exists yet
            pushMessage({
                id: uid(),
                role: 'system',
                text,
                timestamp: new Date().toISOString(),
            })
        }
    }

    // ————— Failure reporting helper ——————————————————————————————————————
    function addFailure(entry, noteText, error, meta) {
        const message =
            noteText || (error && error.message) || 'Unknown failure.'
        addNoteToAssistant(entry, message)
        try {
            entry.debug =
                entry.debug && typeof entry.debug === 'object'
                    ? entry.debug
                    : {}
            entry.debug.clientFailures = Array.isArray(
                entry.debug.clientFailures
            )
                ? entry.debug.clientFailures
                : []
            entry.debug.clientFailures.push({
                message,
                stack:
                    typeof error?.stack === 'string'
                        ? error.stack.split(/\r?\n/)
                        : undefined,
                meta,
            })
            saveHistory()
            renderMessages()
        } catch (_) {}
    }

    // ————— Undo, persistence, utilities ————————————————————————————————

    function pushUndo(entry) {
        undoStack.push({ ...entry, ts: Date.now() })
        if (undoStack.length > 25) undoStack.shift()
    }

    async function undoLast() {
        const e = undoStack.pop()
        if (!e) return pushSystem('Nothing to undo.')
        const map = window.mmgisAPI?.map

        if (e.method === 'toggleLayer') {
            const id = resolveDisplayNameToId(e.target)
            if (id != null && typeof e.previous?.visible === 'boolean') {
                await window.mmgisAPI.toggleLayer(id, e.previous.visible)
                pushSystem(
                    `Restored visibility for ${resolveIdToDisplayName(id)}.`
                )
            }
            return
        }
        if (e.method === 'setLayerOpacity') {
            const id = resolveDisplayNameToId(e.target)
            if (id != null && typeof e.previous?.opacity === 'number') {
                L_?.setLayerOpacity?.(id, e.previous.opacity)
                pushSystem(
                    `Restored opacity for ${resolveIdToDisplayName(id)}.`
                )
            }
            return
        }
        if (
            e.tool === 'zoom_to' &&
            map &&
            e.previous?.center &&
            typeof e.previous?.zoom === 'number'
        ) {
            const [lon, lat] = e.previous.center
            map.setView([lat, lon], e.previous.zoom)
            pushSystem('Restored previous view.')
        }
    }

    function loadHistory() {
        try {
            const raw = localStorage.getItem(HISTORY_KEY)
            const parsed = raw ? JSON.parse(raw) : []
            return Array.isArray(parsed) ? parsed.slice(-200) : []
        } catch {
            return []
        }
    }
    function saveHistory() {
        try {
            localStorage.setItem(
                HISTORY_KEY,
                JSON.stringify(state.history.slice(-200))
            )
        } catch {}
    }
    function clearConversation() {
        state.history = []
        saveHistory()
        renderMessages()
    }
    function pushMessage(entry, { persist = true } = {}) {
        state.history.push(entry)
        if (persist) saveHistory()
        renderMessages()
    }
    function pushSystem(text) {
        // Prefer folding into latest assistant bubble to simplify the thread.
        addNoteToAssistant(null, text)
    }

    function uid() {
        return (
            (typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : Math.random().toString(36).slice(2)) + Date.now().toString(36)
        )
    }
    function html(s) {
        if (s == null) return ''
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
    }
    function attr(s) {
        return html(s).replace(/"/g, '%22')
    }

    function renderContent(text) {
        if (!text) return ''
        const escaped = html(text)
        const withLinks = escaped.replace(
            /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
            (_m, label, href) =>
                `<a class="ac-link" href="${attr(href)}" target="_blank" rel="noopener" style="color:#7dd3fc; text-decoration: underline; text-underline-offset: 2px;">${html(label)}</a>`
        )
        const withUrls = withLinks.replace(
            /(https?:\/\/[^\s<]+)/g,
            (url) =>
                `<a class="ac-link" href="${attr(url)}" target="_blank" rel="noopener" style="color:#7dd3fc; text-decoration: underline; text-underline-offset: 2px;">${html(url)}</a>`
        )
        return withUrls.replace(/\n/g, '<br>')
    }

    // ————— Assets/Styles removed ————————————————————————————————————————

    function removeExistingOverlay() {
        const el = document.getElementById(OVERLAY_ID)
        if (el) el.remove()
    }

    // ————— Teardown ————————————————————————————————————————————————

    function cleanup() {
        try {
            document.getElementById(OVERLAY_ID)?.remove()
            delete window.__mmgisAgentChatAppend
            if (window.__agentChatKeyHandler) {
                window.removeEventListener(
                    'keydown',
                    window.__agentChatKeyHandler
                )
                delete window.__agentChatKeyHandler
            }
        } catch {}
    }
}

export default AgentChatTool
