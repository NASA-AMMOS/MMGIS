import React, { useCallback, useEffect, useMemo, useState } from 'react'
import Login from '../Basics/UserInterface_/components/Login/Login'
import Button from '../../design-system/components/Button/Button'
import Toggle from '../../design-system/components/Toggle/Toggle'

const MMGIS_LOGO_URL = 'public/images/logos/mmgis.png'

const DEFAULT_HEADING = 'Mapping *Any World*'
const DEFAULT_SUBHEADING = 'Select a mission to start exploring geospatial data'
const DEFAULT_CREDIT_TEXT = 'NASA-AMMOS'
const DEFAULT_CREDIT_URL = 'https://github.com/NASA-AMMOS/MMGIS'

// Renders *text* segments of the heading as the accent color
function Heading({ text }) {
    const parts = text.split(/\*([^*]+)\*/)
    return (
        <h1 className="unselectable">
            {parts.map((p, i) =>
                i % 2 === 1 ? <span key={i}>{p}</span> : p
            )}
        </h1>
    )
}

const MAX_TILT = 22

// Admin-selectable preset colors for the card body dot
export const DOT_COLORS = {
    red: '#e5484d',
    orange: '#f0883e',
    yellow: '#e2b53e',
    green: '#3fb27f',
    teal: '#2aa8a0',
    blue: '#4a8fe7',
    purple: '#9b6be8',
    gray: '#8b9299',
}

export function getCardFields(missionName, missionsMeta) {
    const meta = missionsMeta[missionName]
    const config = (meta && meta.config) || {}
    const look = config.look || {}
    const card = look.card || {}
    const str = (v) => (typeof v === 'string' && v.trim() ? v : null)
    const folder = str(config.msv && config.msv.missionFolderName) || missionName
    return {
        title: str(look.missionname) || missionName,
        color: str(card.color),
        imageurl: str(card.imageurl)
            ? resolveImageUrl(card.imageurl, folder)
            : null,
        subtext: str(card.subtext),
        description: str(card.description),
        body: str(card.body),
        dotColor: DOT_COLORS[card.dotColor] || null,
        archived: card.status === 'archived' || (card.status == null && card.archived === true),
        hidden: card.status === 'hidden',
    }
}

function resolveImageUrl(url, missionFolder) {
    if (/^(https?:)?\/\//i.test(url) || url.startsWith('data:')) return url
    if (url.startsWith('public/') || url.startsWith('/')) return url
    return 'Missions/' + missionFolder + '/' + url
}

// Missions shown as cards: never hidden, and not archived when Hide Archived is on
export function isListedMission(missionName, missionsMeta, opts) {
    const f = getCardFields(missionName, missionsMeta)
    return !f.hidden && !(opts.hideArchived && f.archived)
}

function cssUrl(url) {
    return 'url("' + url.replace(/["\\\n\r]/g, '') + '")'
}

export function getLandingOptions() {
    const o =
        (window.mmgisglobal.options &&
            window.mmgisglobal.options.landingPage) ||
        {}
    const bg = typeof o.backgroundImageUrl === 'string' ? o.backgroundImageUrl.trim() : ''
    const str = (v, d) => (typeof v === 'string' && v.trim() ? v : d)
    return {
        heading: str(o.heading, DEFAULT_HEADING),
        subheading: str(o.subheading, DEFAULT_SUBHEADING),
        theme: o.theme === 'dark' ? 'dark' : 'light',
        backgroundImageUrl: bg || null,
        hideArchived: o.hideArchived === true || o.hideArchived === 'true',
        hideSearch: o.hideSearch === true || o.hideSearch === 'true',
        creditText: str(o.creditText, DEFAULT_CREDIT_TEXT),
        creditUrl: str(o.creditUrl, DEFAULT_CREDIT_URL),
    }
}

// [dark, base, light] palettes used when a card has no image or admin color
export const DEFAULT_GRADIENTS = [
    ['#0a5c7a', '#08aeea', '#8fe3ff'],
    ['#0b2a4a', '#1f6fb2', '#6fc3ff'],
    ['#0d6e57', '#3ec99a', '#9fe6c9'],
    ['#5a1f14', '#c2552e', '#f2a266'],
    ['#2e2a26', '#6b5f52', '#b8a894'],
    ['#1a1f24', '#3c4652', '#7f8c99'],
    ['#1e2a44', '#3f5a8a', '#8aa6d6'],
    ['#3a5a7a', '#8fb8d8', '#e6f3fb'],
    ['#6a4a12', '#c9962b', '#f4d98a'],
    ['#0f2f3f', '#1fa38a', '#a8f0c8'],
    ['#2a1a4a', '#6b3fa8', '#c99af0'],
    ['#7a2a3a', '#e0605a', '#ffc27a'],
    ['#4a4f55', '#9aa2aa', '#e2e6ea'],
    ['#5a3a2a', '#b87a4a', '#f0c9a0'],
    ['#05070d', '#1b2540', '#4a5f8a'],
    ['#5f9c8a', '#a6d8c8', '#eef8f4'],
]

function hashString(s) {
    let h = 5381
    for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0
    return Math.abs(h)
}

const SHEEN =
    'linear-gradient(160deg, rgba(255,255,255,0.35) 0%, rgba(255,255,255,0.05) 45%, rgba(255,255,255,0) 60%)'

// Glassy banner: base color with opposing dark/light radial highlights
function gradientFor(dark, base, light) {
    return [
        SHEEN,
        'radial-gradient(circle at 100% 0%, ' + light + ' 0%, transparent 55%)',
        'radial-gradient(circle at 0% 100%, ' + dark + ' 0%, transparent 65%)',
        'linear-gradient(135deg, ' + dark + ' 0%, ' + base + ' 100%)',
    ].join(', ')
}

function gradientForColor(color) {
    return gradientFor(
        'color-mix(in srgb, ' + color + ' 70%, #000000)',
        color,
        'color-mix(in srgb, ' + color + ' 45%, #ffffff)'
    )
}

// Fallback order: admin card color, dot color, then a name-hashed default palette
export function bannerStyleFor(missionName, fields) {
    if (fields.imageurl) return undefined
    if (fields.color) {
        return {
            backgroundColor: fields.color,
            backgroundImage: gradientForColor(fields.color),
        }
    }
    if (fields.dotColor) {
        return {
            backgroundColor: fields.dotColor,
            backgroundImage: gradientForColor(fields.dotColor),
        }
    }
    const g = DEFAULT_GRADIENTS[hashString(missionName) % DEFAULT_GRADIENTS.length]
    return { backgroundColor: g[1], backgroundImage: gradientFor(...g) }
}

function useCurrentUser() {
    const read = () => {
        const u = window.mmgisglobal.user
        return u != null && u !== 'guest' && u !== '' ? String(u) : null
    }
    const [user, setUser] = useState(read)
    useEffect(() => {
        const update = () => setUser(read())
        document.addEventListener('mmgis:loginchange', update)
        return () => document.removeEventListener('mmgis:loginchange', update)
    }, [])
    return [user, () => setUser(read())]
}

function UserArea() {
    const [user, refresh] = useCurrentUser()
    if (user) {
        return (
            <div className="user">
                <div className="avatar" title={user}>
                    {user[0]}
                </div>
                <div className="username">{user}</div>
                <Button
                    variant="ghost"
                    className="logout"
                    title="Logout"
                    onClick={() => Login.logout(refresh)}
                >
                    <i className="mdi mdi-logout mdi-18px" />
                    <span>Logout</span>
                </Button>
            </div>
        )
    }
    return (
        <div className="user">
            <Button
                variant="primary"
                className="signin"
                onClick={() => {
                    Login.signUp = false
                    Login.openModal()
                }}
            >
                Sign In
            </Button>
        </div>
    )
}

function Nav() {
    return (
        <div className="nav">
            <div className="logo">
                <img src={MMGIS_LOGO_URL} alt="MMGIS logo" />
            </div>
            <div className="links">
                {window.mmgisglobal.AUTH !== 'off' && <UserArea />}
            </div>
        </div>
    )
}

function MissionCard({ missionName, fields, onOpen }) {
    const bannerStyle = useMemo(
        () => bannerStyleFor(missionName, fields),
        [missionName, fields.imageurl, fields.color, fields.dotColor]
    )

    // Subtle 3D tilt toward the cursor; reset on leave
    const tilt = (e) => {
        const r = e.currentTarget.getBoundingClientRect()
        const x = (e.clientX - r.left) / r.width - 0.5
        const y = (e.clientY - r.top) / r.height - 0.5
        e.currentTarget.style.setProperty('--rx', -y * MAX_TILT + 'deg')
        e.currentTarget.style.setProperty('--ry', x * MAX_TILT + 'deg')
    }
    const untilt = (e) => {
        e.currentTarget.style.removeProperty('--rx')
        e.currentTarget.style.removeProperty('--ry')
    }

    return (
        <div
            className="card"
            data-mission={missionName}
            title={fields.title}
            tabIndex={0}
            role="button"
            onMouseMove={tilt}
            onMouseLeave={untilt}
            onClick={() => onOpen(missionName)}
            onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onOpen(missionName)
                }
            }}
        >
            <div
                className={'banner' + (bannerStyle ? ' glass' : '')}
                style={bannerStyle}
            >
                {fields.imageurl && (
                    <img src={fields.imageurl} alt={fields.title} />
                )}
            </div>
            <div className="body">
                <div className="titlerow">
                    <h3>{fields.title}</h3>
                    {(fields.dotColor || fields.body) && (
                        <div className="meta">
                            {fields.dotColor && (
                                <span
                                    className="dot"
                                    style={{ '--dot': fields.dotColor }}
                                />
                            )}
                            {fields.body && (
                                <span className="bodyname">
                                    {fields.body}
                                </span>
                            )}
                        </div>
                    )}
                </div>
                {fields.subtext && <p>{fields.subtext}</p>}
                {fields.description && (
                    <p className="description">{fields.description}</p>
                )}
            </div>
        </div>
    )
}

function CardGrid({ names, missionsMeta, onOpen }) {
    return (
        <div className={names.length <= 2 ? 'cards few' : 'cards'}>
            {names.map((name) => (
                <MissionCard
                    key={name}
                    missionName={name}
                    fields={getCardFields(name, missionsMeta)}
                    onOpen={onOpen}
                />
            ))}
        </div>
    )
}

function Toolbar({ query, onQuery, groupBy, onGroupBy }) {
    return (
        <div className="toolbar">
            <div className="search">
                <i className="mdi mdi-magnify mdi-18px" />
                <input
                    type="search"
                    placeholder="Search missions"
                    aria-label="Search missions"
                    value={query}
                    onChange={(e) => onQuery(e.target.value)}
                />
            </div>
            <Toggle.Group aria-label="Group missions">
                <Toggle
                    pressed={groupBy === 'alpha'}
                    onPressedChange={() => onGroupBy('alpha')}
                    title="Alphabetical"
                >
                    A–Z
                </Toggle>
                <Toggle
                    pressed={groupBy === 'planet'}
                    onPressedChange={() => onGroupBy('planet')}
                    title="Group by planet / moon"
                >
                    Planet
                </Toggle>
            </Toggle.Group>
        </div>
    )
}

const byTitle = (missionsMeta) => (a, b) =>
    getCardFields(a, missionsMeta).title.localeCompare(
        getCardFields(b, missionsMeta).title,
        undefined,
        { sensitivity: 'base' }
    )

function Missions({ missions, missionsMeta, onOpen, hideArchived, query, groupBy }) {
    missions = missions.filter((m) =>
        isListedMission(m, missionsMeta, { hideArchived })
    )
    if (missions.length === 0) {
        return (
            <div id="landingNoMissions">
                {window.mmgisglobal.AUTH === 'local'
                    ? 'You do not have access to any missions. Please contact an administrator.'
                    : 'No missions are available.'}
            </div>
        )
    }
    const q = query.trim().toLowerCase()
    if (q) {
        missions = missions.filter(
            (m) =>
                m.toLowerCase().includes(q) ||
                getCardFields(m, missionsMeta).title.toLowerCase().includes(q)
        )
        if (missions.length === 0)
            return (
                <div id="landingNoMissions">
                    No missions match &ldquo;{query.trim()}&rdquo;.
                </div>
            )
    }
    missions = [...missions].sort(byTitle(missionsMeta))

    const hasMeta = missions.some((m) => missionsMeta[m] != null)
    const archived = hasMeta
        ? missions.filter((m) => getCardFields(m, missionsMeta).archived)
        : []
    const active = missions.filter((m) => !archived.includes(m))

    let sections = []
    if (groupBy === 'planet' && hasMeta) {
        const groups = new Map()
        active.forEach((m) => {
            const body = getCardFields(m, missionsMeta).body || 'Other'
            if (!groups.has(body)) groups.set(body, [])
            groups.get(body).push(m)
        })
        sections = [...groups.keys()]
            .sort((a, b) =>
                a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)
            )
            .map((body) => ({ title: body, names: groups.get(body) }))
    } else if (archived.length > 0) {
        sections = [{ title: 'Active Missions', names: active }]
    } else {
        return (
            <CardGrid names={missions} missionsMeta={missionsMeta} onOpen={onOpen} />
        )
    }
    return (
        <div className="sections">
            {sections
                .filter((s) => s.names.length > 0)
                .map((s) => (
                    <div className="section" key={s.title}>
                        <h2>{s.title}</h2>
                        <CardGrid names={s.names} missionsMeta={missionsMeta} onOpen={onOpen} />
                    </div>
                ))}
            {archived.length > 0 && (
                <div className="section archived">
                    <h2>Archived Missions</h2>
                    <CardGrid names={archived} missionsMeta={missionsMeta} onOpen={onOpen} />
                </div>
            )}
        </div>
    )
}

function Footer({ creditText, creditUrl }) {
    const version = window.mmgisglobal.version
    const clearance = window.mmgisglobal.CLEARANCE_NUMBER
    return (
        <div className="foot">
            <span
                className="version"
                title="Release notes"
                onClick={() => {
                    window.location.href = `https://github.com/NASA-AMMOS/MMGIS/releases/tag/${version}`
                }}
            >
                v{version}
            </span>
            <a
                className="imagecredit"
                target="_blank"
                rel="noreferrer"
                href={creditUrl}
            >
                {creditText}
            </a>
            {clearance && clearance !== 'undefined' && (
                <span className="clearance">{clearance}</span>
            )}
        </div>
    )
}

// `onSelectMission(name)` is called after the page has faded out
export default function LandingPage({ missions, missionsMeta, onSelectMission }) {
    const opts = useMemo(getLandingOptions, [])
    const [visible, setVisible] = useState(false)
    const [leaving, setLeaving] = useState(false)
    const [query, setQuery] = useState('')
    const [groupBy, setGroupBy] = useState('alpha')

    useEffect(() => {
        const id = requestAnimationFrame(() => setVisible(true))
        return () => cancelAnimationFrame(id)
    }, [])

    const open = useCallback(
        (name) => {
            if (leaving) return
            setLeaving(true)
            setTimeout(() => onSelectMission(name), 1000)
        },
        [leaving, onSelectMission]
    )

    const classes = ['landingPage', opts.theme]
    if (opts.backgroundImageUrl) classes.push('hasBackgroundImage')
    if (visible && !leaving) classes.push('visible')

    return (
        <div className={classes.join(' ')}>
            {opts.backgroundImageUrl ? (
                <div
                    className="bgimage"
                    style={{ backgroundImage: cssUrl(opts.backgroundImageUrl) }}
                />
            ) : (
                <div className="topo" />
            )}
            <div className="pg">
                <Nav />
                <div className="main">
                    <div className="hero">
                        <Heading text={opts.heading} />
                        <div className="sub">{opts.subheading}</div>
                        {missions.length > 0 && !opts.hideSearch && (
                            <Toolbar
                                query={query}
                                onQuery={setQuery}
                                groupBy={groupBy}
                                onGroupBy={setGroupBy}
                            />
                        )}
                    </div>
                    <Missions
                        missions={missions}
                        missionsMeta={missionsMeta}
                        onOpen={open}
                        hideArchived={opts.hideArchived}
                        query={query}
                        groupBy={groupBy}
                    />
                    <Footer
                        creditText={opts.creditText}
                        creditUrl={opts.creditUrl}
                    />
                </div>
            </div>
        </div>
    )
}

export function MissionNotFound() {
    const [visible, setVisible] = useState(false)
    useEffect(() => {
        const id = requestAnimationFrame(() => setVisible(true))
        return () => cancelAnimationFrame(id)
    }, [])
    return (
        <div
            id="notfound"
            className={visible ? 'visible' : ''}
            onClick={() => {
                document.location.href = window.location.href.split('?')[0]
            }}
        >
            <p id="mnfmmgis">{window.mmgisglobal.name || 'MMGIS'}</p>
            <p id="returnmmgis">Click anywhere to return home...</p>
            <div id="nf404">404</div>
        </div>
    )
}
