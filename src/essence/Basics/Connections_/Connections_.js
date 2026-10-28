// Service connections on the main site: the Services part of the account
// menu, the "connect first" card a tool shows, and the API tools use.
// A connection adds an external service credential; it never signs anyone
// in to MMGIS (that's Login).
import $ from 'jquery'
import { toolConfigs } from '../../../pre/tools'
import './Connections_.css'

const API = 'api/connections'
const listeners = []
let services = []
let loaded = null
// False until the first list arrives; tools opened before then wait for it
let hasLoaded = false
let gate = null
// Connect cards in separated tools, by tool name
const separatedGates = new Map()
// Separated tools opened before the list arrived, by tool name
const pendingSeparated = new Map()
let menuOpen = false
let missionTools = []

const esc = (s) =>
    $('<div>')
        .text(s == null ? '' : String(s))
        .html()

function login() {
    return import('../UserInterface_/components/Login/Login').then(
        (m) => m.default
    )
}

function find(ref) {
    if (ref == null) return null
    const key = typeof ref === 'string' ? ref : ref.plugin || ref.id
    if (typeof key !== 'string') return null
    const k = key.toLowerCase()
    return (
        services.find((s) => s.id === k || s.plugin.toLowerCase() === k) || null
    )
}

// The connections a tool's plugin.json lists
function requirementsOf(toolName) {
    const conf = toolConfigs[toolName]
    if (!conf || !Array.isArray(conf.connections)) return []
    return conf.connections
        .map((r) => (typeof r === 'string' ? { plugin: r } : r))
        .filter((r) => r && (r.plugin || r.id))
}

function toolsUsing(service) {
    return missionTools.filter((t) =>
        requirementsOf(t).some((r) => find(r) === service)
    )
}

// Services worth showing: used by this mission's tools, or already connected
function relevant() {
    return services.filter(
        (s) => s.connected || (s.configured && toolsUsing(s).length > 0)
    )
}

function emit() {
    listeners.forEach((fn) => {
        try {
            fn(services)
        } catch (err) {
            console.error(err)
        }
    })
}

let loadError = false
function refresh() {
    const ctl =
        typeof AbortController === 'function' ? new AbortController() : null
    const timer = ctl && setTimeout(() => ctl.abort(), 15000)
    loaded = fetch(API, {
        credentials: 'same-origin',
        signal: ctl && ctl.signal,
    })
        .then((r) => r.json())
        .then((d) => {
            clearTimeout(timer)
            hasLoaded = true
            loadError = d.status !== 'success'
            if (d.status !== 'success') return services
            services = d.connections || []
            renderButton()
            if (menuOpen) renderMenu()
            if (gate) gate.render()
            Array.from(separatedGates.values()).forEach((g) => g.render())
            emit()
            return services
        })
        .catch(() => {
            clearTimeout(timer)
            hasLoaded = true
            loadError = true
            if (gate) gate.render()
            Array.from(separatedGates.values()).forEach((g) => g.render())
            return services
        })
    return loaded
}

function connectUrl(service, mode) {
    const back = window.location.pathname + window.location.search
    return `${API}/${encodeURIComponent(service.id)}/connect?${
        mode ? `mode=${mode}&` : ''
    }returnTo=${encodeURIComponent(back)}`
}

// Must run from a click so the browser allows the new tab
function connect(ref) {
    const service = find(ref)
    if (!service) return false
    // Open a blank same-origin tab first so we can sever `opener` before the
    // outside service's page loads. `window.open(url, '_blank', 'noopener')`
    // would return null, which we cannot tell apart from a blocked popup.
    const tab = window.open('', '_blank')
    if (!tab) {
        window.location.href = connectUrl(service, 'page')
        return true
    }
    try {
        tab.opener = null
    } catch (err) {}
    tab.location = connectUrl(service)
    ;[gate, ...separatedGates.values()].forEach((g) => {
        if (g && g.service === service) {
            g.waiting = true
            g.render()
        }
    })
    return true
}

function disconnect(ref) {
    const service = find(ref)
    if (!service) return Promise.resolve()
    return fetch(`${API}/${encodeURIComponent(service.id)}/disconnect`, {
        method: 'POST',
        credentials: 'same-origin',
    })
        .then(refresh)
        .then((list) => {
            try {
                if ('BroadcastChannel' in window)
                    new BroadcastChannel('mmgis-connections').postMessage({
                        type: 'changed',
                        id: service.id,
                    })
            } catch (err) {}
            return list
        })
}

function signIn() {
    closeMenu()
    login().then((Login) => {
        if (Login.loggedIn) return
        const button = document.getElementById('loginoutButton')
        if (button) button.click()
    })
}

////// Account menu

let menuAnchor = null

// The top bar's account button (React) follows this state
const uiListeners = []
function uiState() {
    return {
        hasMenu: relevant().length > 0,
        menuOpen,
        needsConnection: [gate, ...separatedGates.values()].some(
            (g) => g != null && !g.service.connected
        ),
    }
}
function renderButton() {
    const state = uiState()
    uiListeners.forEach((fn) => fn(state))
}

function serviceRow(s) {
    const used = toolsUsing(s)
    let detail = ''
    let action = ''
    if (!s.configured) detail = 'Not set up on this site'
    else if (s.connected) {
        detail = s.account ? `Connected as ${esc(s.account)}` : 'Connected'
        if (s.storage === 'session') detail += ' · this browser session'
        action = `<button class="connectionsMenuAction" data-disconnect="${esc(s.id)}">Disconnect</button>`
    } else if (s.canConnect) {
        detail = used.length
            ? `Needed by ${used.map(esc).join(', ')}`
            : 'Not connected'
        action = `<button class="connectionsMenuAction primary" data-connect="${esc(s.id)}">Connect</button>`
    } else {
        detail = 'Sign in to MMGIS first'
    }
    return `<div class="connectionsMenuRow${s.connected ? ' connected' : ''}${!s.canConnect && !s.connected ? ' unavailable' : ''}" data-service="${esc(s.id)}">
        <span class="connectionsMenuDot"></span>
        <div class="connectionsMenuText"><div class="connectionsMenuName">${esc(s.label)}</div><div class="connectionsMenuDetail">${detail}</div></div>
        ${action}</div>`
}

function renderMenu() {
    $('#connectionsMenu').remove()
    login().then((Login) => {
        if (!menuOpen) return
        const loggedIn = Login.loggedIn === true
        const hasLogin = window.mmgisglobal.SITE_ACCESS !== 'public'
        let html = ''
        if (loggedIn || hasLogin) {
            const name = loggedIn ? String(Login.username || '') : ''
            const avatar = loggedIn
                ? esc(name.charAt(0).toUpperCase())
                : '<i class="mdi mdi-account mdi-18px"></i>'
            html += `<div class="connectionsMenuSection connectionsMenuMmgis">
                <div class="connectionsMenuLabel">MMGIS</div>
                <div class="connectionsMenuAccount">
                    <div class="connectionsMenuAvatar${loggedIn ? '' : ' guest'}"${loggedIn ? ` style="background:${avatarColor(name)}"` : ''}>${avatar}</div>
                    <div class="connectionsMenuText">
                        <div class="connectionsMenuUser">${loggedIn ? esc(name) : 'Guest'}</div>
                        <div class="connectionsMenuDetail">${loggedIn ? 'Signed in to MMGIS' : 'Not signed in to MMGIS'}</div>
                    </div>
                    ${
                        loggedIn
                            ? '<button id="connectionsMenuSignOut" class="connectionsMenuAction">Sign out</button>'
                            : '<button id="connectionsMenuSignIn" class="connectionsMenuAction primary">Sign in</button>'
                    }
                </div>
            </div>`
        }
        if (relevant().length)
            html += `<div class="connectionsMenuSection"><div class="connectionsMenuLabel">Services</div>${relevant()
                .map(serviceRow)
                .join('')}</div>`
        const menu = $('<div>').attr('id', 'connectionsMenu').html(html)
        $('body').append(menu)
        const rect = menuAnchor
            ? menuAnchor.getBoundingClientRect()
            : { bottom: 40, right: window.innerWidth - 8 }
        menu.css({
            top: rect.bottom + 6,
            right: Math.max(8, window.innerWidth - rect.right),
        })
        menu.on('click', '[data-connect]', function () {
            connect($(this).attr('data-connect'))
        })
        menu.on('click', '[data-disconnect]', function () {
            disconnect($(this).attr('data-disconnect'))
        })
        menu.on('click', '#connectionsMenuSignIn', signIn)
        menu.on('click', '#connectionsMenuSignOut', () => {
            closeMenu()
            Login.logout()
        })
    })
}

function openMenu(anchorEl) {
    menuAnchor = anchorEl || menuAnchor
    menuOpen = true
    renderMenu()
    renderButton()
}

function closeMenu() {
    if (!menuOpen) return
    menuOpen = false
    $('#connectionsMenu').remove()
    renderButton()
}

function onOutsideClick(e) {
    if (!menuOpen) return
    if (e.target.closest('#connectionsMenu')) return
    if (menuAnchor && menuAnchor.contains(e.target)) return
    closeMenu()
}

////// "Connect first" card inside a tool

function cardHtml(g) {
    const s = g.service
    const tool = esc(g.toolName)
    const label = esc(s.label)
    g.loadError = s.missing && loadError
    if (g.loadError)
        return `<div class="connectionsCardTitle">Couldn't check ${label}</div>
            <p>MMGIS couldn't load your connections, so ${tool} can't open yet.</p>
            <button class="connectionsCardButton" data-card="retry">Try again</button>`
    if (!s.configured)
        return `<div class="connectionsCardTitle">${label} isn't set up</div>
            <p>${tool} needs ${label}, which isn't set up on this site yet. Ask a site admin.</p>`
    if (g.reason === 'unavailable')
        return `<div class="connectionsCardTitle">${label} isn't responding</div>
            <p>${tool} couldn't reach ${label}. You're still connected.</p>
            <button class="connectionsCardButton" data-card="retry">Try again</button>`
    if (g.waiting)
        return `<div class="connectionsCardTitle">Waiting for ${label}…</div>
            <p>Finish signing in on the ${label} tab, then come back here.</p>
            <button class="connectionsCardLink" data-card="connect">Open ${label} again</button>
            <button class="connectionsCardLink" data-card="cancel">Cancel</button>`
    if (!s.canConnect && window.mmgisglobal.SITE_ACCESS === 'public')
        return `<div class="connectionsCardTitle">${label} needs an MMGIS account</div>
            <p>${tool} uses ${label}, which only signed-in MMGIS users can connect, and this site has no sign-in. Ask a site admin.</p>`
    if (!s.canConnect)
        return `<div class="connectionsCardTitle">Sign in to use ${tool}</div>
            <p>${tool} uses ${label}. Sign in to MMGIS first, then connect ${label}.</p>
            <button class="connectionsCardButton" data-card="signin">Sign in</button>`
    const again = g.reason === 'expired' || g.reason === 'rejected'
    const title =
        g.reason === 'expired'
            ? `Your ${label} connection expired`
            : g.reason === 'rejected'
              ? `${label} no longer accepts your connection`
              : `Connect ${label} to use this tool`
    let html = `<div class="connectionsCardTitle">${title}</div>
        <p>${tool} gets data from ${label} with your ${label} account. You'll sign in on ${label}'s own site in a new tab.</p>
        <button class="connectionsCardButton" data-card="connect">${again ? 'Reconnect' : 'Connect'} ${label}</button>`
    if (s.storage === 'session' && window.mmgisglobal.SITE_ACCESS !== 'public')
        html += `<div class="connectionsCardNote">Connects for this browser session only, or <button class="connectionsCardLink" data-card="signin">sign in to MMGIS</button> to keep it.</div>`
    return html
}

function containerFor(tool) {
    return (
        document.getElementById(
            tool && tool.height > 0 ? 'tools' : 'toolPanel'
        ) || document.getElementById('tools')
    )
}

function makeGate(toolName, tool, service, make, reason) {
    const g = {
        toolName,
        tool,
        service,
        make,
        reason,
        waiting: false,
        el: $('<div>')
            .addClass('connectionsCard')
            .attr('id', 'connectionsCard'),
        render() {
            // A stand-in from a failed list load: look again now that the list may have arrived
            if (g.service.missing && !loadError) {
                const next = missingFor(g.toolName)
                if (!next) return g.resume()
                g.service = next
            }
            if (!g.service.missing) g.service = find(g.service.id) || g.service
            if (
                g.service.connected &&
                !g.hold &&
                !['expired', 'rejected', 'unavailable'].includes(g.reason)
            )
                return g.resume()
            g.el.html(cardHtml(g))
            renderButton()
        },
        resume() {
            // A tool needing several services waits for all of them
            const next = missingFor(g.toolName)
            if (next && next.id !== g.service.id) {
                g.service = next
                g.reason = null
                g.waiting = false
                return g.render()
            }
            g.remove()
            g.make()
        },
        remove() {
            g.el.remove()
            if (gate === g) gate = null
            renderButton()
        },
    }
    g.el.on('click', '[data-card="connect"]', () => {
        g.reason = null
        g.hold = false
        connect(g.service)
    })
    g.el.on('click', '[data-card="signin"]', signIn)
    g.el.on('click', '[data-card="cancel"]', () => {
        g.waiting = false
        g.render()
    })
    g.el.on('click', '[data-card="retry"]', () => {
        g.reason = null
        if (g.loadError) return refresh()
        g.resume()
    })
    return g
}

const requiredOf = (toolName) =>
    requirementsOf(toolName).filter((r) => r.required !== false)

// True when the tool needs a connection but the list hasn't arrived yet
const mustWait = (toolName) => !hasLoaded && requiredOf(toolName).length > 0

// The first required connection the user hasn't made, or null
function missingFor(toolName) {
    const needs = requiredOf(toolName)
    if (needs.length === 0) return null
    const missing = needs.map(find).find((s) => s == null || !s.connected)
    if (missing === undefined) return null
    if (missing === null) {
        const ref = needs.find((r) => find(r) == null)
        console.warn(`${toolName}: a required connection isn't installed.`, ref)
        // Fail closed: show "isn't set up" instead of a tool that can't work
        const name = String(ref.plugin || ref.id)
            .split('/')
            .pop()
        // Its own ID, so it can't be mistaken for an installed service with the same name
        return {
            id: `missing:${String(ref.plugin || ref.id).toLowerCase()}`,
            label: name,
            configured: false,
            connected: false,
            missing: true,
        }
    }
    return missing
}

// Separated tools: true when the card is shown in place of the tool, which
// make() replaces once connected
function openSeparated(toolName, containerId, make) {
    if (separatedGates.has(toolName) || pendingSeparated.has(toolName))
        return true
    if (mustWait(toolName)) {
        const token = {}
        pendingSeparated.set(toolName, token)
        ;(loaded || refresh()).then(() => {
            if (pendingSeparated.get(toolName) !== token) return
            pendingSeparated.delete(toolName)
            if (!openSeparated(toolName, containerId, make)) make()
        })
        return true
    }
    const missing = missingFor(toolName)
    if (!missing) return false
    const g = makeGate(toolName, null, missing, make)
    g.el.removeAttr('id').addClass('separated')
    const remove = g.remove
    g.remove = () => {
        if (separatedGates.get(toolName) === g) separatedGates.delete(toolName)
        remove()
    }
    separatedGates.set(toolName, g)
    $(document.getElementById(containerId)).append(g.el)
    g.render()
    return true
}

function closeSeparated(toolName) {
    if (pendingSeparated.delete(toolName)) return true
    const g = separatedGates.get(toolName)
    if (g) g.remove()
    return g != null
}

// Called by ToolController_ in place of tool.make(); returns a stand-in for the
// active tool while the user still has to connect
const activeTool = { name: null, tool: null }
function openTool(toolName, tool, make) {
    activeTool.name = toolName
    activeTool.tool = tool
    if (mustWait(toolName)) {
        let closed = false
        ;(loaded || refresh()).then(() => {
            if (closed || activeTool.name !== toolName) return
            standIn.inner = openTool(toolName, tool, make)
            if (!standIn.inner) make()
        })
        const standIn = {
            height: tool.height,
            width: tool.width,
            inner: null,
            destroy() {
                closed = true
                if (standIn.inner) standIn.inner.destroy()
            },
            connectionsGate: true,
        }
        return standIn
    }
    const missing = missingFor(toolName)
    if (!missing) return null
    if (gate) gate.remove()
    gate = makeGate(toolName, tool, missing, make)
    const container = containerFor(tool)
    if (container) $(container).append(gate.el)
    gate.render()
    const g = gate
    return {
        height: tool.height,
        width: tool.width,
        destroy() {
            g.remove()
        },
        connectionsGate: true,
    }
}

// A card over a tool that's already open, when its service needs connecting again
function runRetry(retry) {
    if (typeof retry !== 'function') return
    try {
        const out = retry()
        if (out && typeof out.catch === 'function')
            out.catch((err) => console.error('A connection retry failed.', err))
    } catch (err) {
        console.error('A connection retry failed.', err)
    }
}

function overlayGate(s, reason, retry, toolName) {
    const separated =
        toolName && document.getElementById(`toolContentSeparated_${toolName}`)
    if (separated) {
        const old = separatedGates.get(toolName)
        if (old) old.remove()
        const g = makeGate(toolName, null, s, () => {}, reason)
        g.hold = s.connected
        g.el.removeAttr('id').addClass('separated overlay')
        const remove = g.remove
        g.remove = () => {
            if (separatedGates.get(toolName) === g)
                separatedGates.delete(toolName)
            remove()
        }
        g.resume = () => {
            g.remove()
            if (typeof retry === 'function') retry()
        }
        separatedGates.set(toolName, g)
        $(separated).prepend(g.el)
        g.render()
        return
    }
    if (gate) gate.remove()
    const g = makeGate(
        activeTool.name || 'This tool',
        null,
        s,
        () => {},
        reason
    )
    g.hold = s.connected
    gate = g
    g.el.addClass('overlay')
    const container = containerFor(activeTool.tool)
    if (container) $(container).prepend(g.el)
    g.resume = () => {
        g.remove()
        runRetry(retry)
    }
    g.render()
}

// Stable color per username, dark enough for white text
function avatarColor(name) {
    let h = 0
    for (const c of String(name || ''))
        h = (c.charCodeAt(0) + ((h << 5) - h)) | 0
    return `hsl(${Math.abs(h) % 360}, 55%, 40%)`
}

const Connections_ = {
    avatarColor,
    init(tools) {
        missionTools = (tools || []).map((t) => t.name)
        document.addEventListener('click', onOutsideClick, true)
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeMenu()
        })
        window.addEventListener('focus', refresh)
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') refresh()
        })
        document.addEventListener('mmgis:loginchange', refresh)
        if ('BroadcastChannel' in window) {
            try {
                new BroadcastChannel('mmgis-connections').onmessage = (e) => {
                    // A cancelled or failed sign-in: offer Connect again
                    if (e && e.data && e.data.type === 'failed') {
                        ;[gate, ...separatedGates.values()].forEach((g) => {
                            if (g && g.service && g.service.id === e.data.id)
                                g.waiting = false
                        })
                    }
                    refresh()
                }
            } catch (err) {}
        }
        return refresh()
    },
    refresh,
    uiState,
    onUI(fn) {
        if (typeof fn !== 'function') return () => {}
        uiListeners.push(fn)
        fn(uiState())
        return () => {
            const i = uiListeners.indexOf(fn)
            if (i >= 0) uiListeners.splice(i, 1)
        }
    },
    toggleMenu(anchorEl) {
        if (menuOpen) closeMenu()
        else openMenu(anchorEl)
    },
    closeMenu,
    ready: () => loaded || refresh(),
    list: () => services.slice(),
    status: (ref) => find(ref),
    isConnected: (ref) => {
        const s = find(ref)
        return !!(s && s.connected)
    },
    connect,
    disconnect,
    requirementsOf,
    openTool,
    openSeparated,
    closeSeparated,
    on(event, fn) {
        if (event === 'change' && typeof fn === 'function') listeners.push(fn)
    },
    off(event, fn) {
        const i = listeners.indexOf(fn)
        if (i >= 0) listeners.splice(i, 1)
    },
    // The standard Connect button, for tools that place it themselves
    button(ref, options = {}) {
        const s = find(ref)
        const b = $('<button>').addClass('connectionsCardButton')
        if (!s) return b.text('Unavailable').prop('disabled', true)[0]
        let attached = false
        const label = () => {
            if (b[0].isConnected) attached = true
            else if (attached) {
                const i = listeners.indexOf(label)
                if (i >= 0) listeners.splice(i, 1)
                return
            }
            const cur = find(s.id) || s
            b.text(
                cur.connected
                    ? `${cur.label} connected`
                    : `Connect ${cur.label}`
            )
            b.prop('disabled', cur.connected || !cur.canConnect)
        }
        label()
        listeners.push(label)
        b.on('click', () => connect(s.id))
        if (options.container) $(options.container).append(b)
        return b[0]
    },
    // For a tool's own API calls: true when the reply means "connect first",
    // in which case the active tool shows the reconnect card. `retry` runs once
    // the user has reconnected (or clicks Try again).
    // toolName puts the card on that separated tool, not the open panel tool
    handleResponse(body, retry, toolName) {
        if (!body || body.code !== 'connection_required') return false
        if (hasLoaded && !loadError && !find(body.service)) return false
        refresh().then(() => {
            const s = find(body.service)
            if (s) overlayGate(s, body.reason, retry, toolName)
            else runRetry(retry)
        })
        return true
    },
}

window.mmgisConnections = Connections_

export default Connections_
