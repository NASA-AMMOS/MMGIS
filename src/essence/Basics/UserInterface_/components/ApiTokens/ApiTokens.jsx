/**
 * ApiTokens — the main site's own API (long-term) tokens: a summary for the
 * account menu and a modal to create, copy, replace and revoke them.
 *   ApiTokens.summary() -> Promise<null | { tokens, limits }>
 *   ApiTokens.open(view)  view: 'manage' | 'create'
 */
import React, { useState } from 'react'
import Modal from '../Modal/Modal'
import ConfirmationModal from '../ConfirmationModal/ConfirmationModal'

import styles from './ApiTokens.module.css'

const MODAL_ID = 'apiTokens'
const DAY = 24 * 60 * 60 * 1000
const PERIODS = [
    { label: '1 day', value: String(DAY) },
    { label: '30 days', value: String(30 * DAY) },
    { label: '90 days', value: String(90 * DAY) },
    { label: '1 year', value: String(365 * DAY) },
    { label: 'Never', value: 'never' },
]

const base = () =>
    window.mmgisglobal && window.mmgisglobal.ROOT_PATH
        ? window.mmgisglobal.ROOT_PATH + '/'
        : ''

async function request(method, url, body) {
    const res = await fetch(base() + url, {
        method,
        credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined,
    })
    const json = await res.json().catch(() => null)
    if (!json || json.status !== 'success')
        throw new Error(
            (json && json.message) || `Request failed (${res.status})`
        )
    return json
}

export function expiresAt(t) {
    if (t.expires_at) return new Date(t.expires_at).getTime()
    if (t.period == null || t.period === 'never') return null
    const p = parseInt(t.period)
    return isNaN(p) ? 0 : new Date(t.createdAt).getTime() + p
}
export const isLive = (t) => {
    const e = expiresAt(t)
    return e == null || e > Date.now()
}

function when(ms) {
    if (ms == null) return 'Never'
    return new Date(ms).toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    })
}

export function expiryText(t) {
    const e = expiresAt(t)
    if (e == null) return 'Never expires'
    const left = e - Date.now()
    if (left <= 0) return `Expired ${when(e)}`
    const days = Math.ceil(left / DAY)
    return days <= 1 ? 'Expires within a day' : `Expires in ${days} days`
}

const accessText = (t) =>
    t.scopes == null
        ? 'Everything you can do'
        : t.scopes.every((s) => /\.(view|read)$/.test(s))
          ? 'Read-only'
          : `${t.scopes.length} permissions`

// The caller's own tokens and limits, or null when they may not create tokens
export async function summary() {
    const me = (await request('GET', 'api/access/me')).body || {}
    const caps = me.capabilities || []
    if (!me.authenticated || !caps.includes('tokens.create')) return null
    const list = await request('GET', 'api/longtermtoken/get')
    return {
        // Token managers are sent everyone's tokens; this menu is only about one's own
        tokens: (list.tokens || []).filter(
            (t) => t.created_by_user_id === list.user_id
        ),
        limits: list.limits || { unlimited: false, max_tokens: 1 },
        username: me.username,
    }
}

function TokenDetails({ token }) {
    const live = isLive(token)
    return (
        <div className={`${styles.card} ${live ? '' : styles.expired}`}>
            <div className={styles.cardHead}>
                <div className={styles.cardName}>
                    {token.name || 'Unnamed token'}
                </div>
                {!live && <span className={styles.tag}>Expired</span>}
            </div>
            <dl className={styles.facts}>
                <dt>Token</dt>
                <dd className={styles.mono}>{token.token}</dd>
                <dt>Access</dt>
                <dd>{accessText(token)}</dd>
                <dt>Missions</dt>
                <dd>
                    {Array.isArray(token.missions)
                        ? token.missions.join(', ') || 'None'
                        : 'All you can view'}
                </dd>
                <dt>Created</dt>
                <dd>{when(new Date(token.createdAt).getTime())}</dd>
                <dt>Expiry</dt>
                <dd>{expiryText(token)}</dd>
                <dt>Last used</dt>
                <dd>
                    {token.last_used_at
                        ? when(new Date(token.last_used_at).getTime())
                        : 'Never'}
                </dd>
            </dl>
        </div>
    )
}

function CreateForm({ data, replacing, onCreated, onCancel }) {
    const { limits } = data
    const periods = PERIODS.filter(
        (p) =>
            limits.max_period == null ||
            (p.value !== 'never' && Number(p.value) <= limits.max_period)
    )
    const [name, setName] = useState(replacing ? replacing.name || '' : '')
    const [period, setPeriod] = useState(String(30 * DAY))
    const [access, setAccess] = useState('read')
    const [missionMode, setMissionMode] = useState('all')
    const [missions, setMissions] = useState([])
    const [available, setAvailable] = useState(null)
    const [error, setError] = useState(null)
    const [busy, setBusy] = useState(false)

    const pickMissions = () => {
        setMissionMode('some')
        if (available) return
        request('GET', 'api/configure/missions')
            .then((r) => setAvailable(r.missions || []))
            .catch((err) => setError(err.message))
    }
    const toggle = (m) =>
        setMissions((cur) =>
            cur.includes(m) ? cur.filter((x) => x !== m) : cur.concat(m)
        )

    const submit = (e) => {
        e.preventDefault()
        if (missionMode === 'some' && missions.length === 0) {
            setError('Choose at least one mission.')
            return
        }
        setBusy(true)
        setError(null)
        request('POST', 'api/longtermtoken/generate', {
            name: name.trim() || null,
            period,
            scopes: access === 'read' ? 'read' : null,
            missions: missionMode === 'some' ? missions : null,
            ...(replacing ? { replace_id: replacing.id } : {}),
        })
            .then((r) => onCreated(r.body))
            .catch((err) => {
                setBusy(false)
                setError(err.message)
            })
    }

    return (
        <form className={styles.form} onSubmit={submit}>
            {replacing && (
                <div className={styles.note}>
                    Replacing <b>{replacing.name || replacing.token}</b>: it
                    stops working as soon as the new token is created.
                </div>
            )}
            <label className={styles.field}>
                <span>Name</span>
                <input
                    type="text"
                    value={name}
                    maxLength={64}
                    placeholder="e.g. analysis-scripts"
                    onChange={(e) => setName(e.target.value)}
                />
            </label>
            <div className={styles.field}>
                <span>Expires after</span>
                <div className={styles.segmented} role="radiogroup">
                    {periods.map((p) => (
                        <button
                            type="button"
                            key={p.value}
                            role="radio"
                            aria-checked={period === p.value}
                            className={period === p.value ? styles.on : ''}
                            onClick={() => setPeriod(p.value)}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                {limits.max_period != null && (
                    <div className={styles.hint}>
                        Tokens last at most{' '}
                        {Math.round(limits.max_period / DAY)} days.
                    </div>
                )}
            </div>
            <div className={styles.field}>
                <span>Access</span>
                <label className={styles.choice}>
                    <input
                        type="radio"
                        checked={access === 'read'}
                        onChange={() => setAccess('read')}
                    />
                    Read-only
                </label>
                {data.canWrite && (
                    <label className={styles.choice}>
                        <input
                            type="radio"
                            checked={access === 'full'}
                            onChange={() => setAccess('full')}
                        />
                        Everything you can do
                    </label>
                )}
                <div className={styles.hint}>
                    A token never has more access than your account does.
                </div>
            </div>
            <div className={styles.field}>
                <span>Missions</span>
                <label className={styles.choice}>
                    <input
                        type="radio"
                        checked={missionMode === 'all'}
                        onChange={() => setMissionMode('all')}
                    />
                    All missions you can view
                </label>
                <label className={styles.choice}>
                    <input
                        type="radio"
                        checked={missionMode === 'some'}
                        onChange={pickMissions}
                    />
                    Only these missions
                </label>
                {missionMode === 'some' && (
                    <div className={styles.missions}>
                        {available == null
                            ? 'Loading…'
                            : available.length === 0
                              ? 'No missions'
                              : available.map((m) => (
                                    <label key={m} className={styles.choice}>
                                        <input
                                            type="checkbox"
                                            checked={missions.includes(m)}
                                            onChange={() => toggle(m)}
                                        />
                                        {m}
                                    </label>
                                ))}
                    </div>
                )}
            </div>
            {error && <div className={styles.error}>{error}</div>}
            <div className={styles.footer}>
                <button type="button" className={styles.btn} onClick={onCancel}>
                    Cancel
                </button>
                <button
                    type="submit"
                    className={`${styles.btn} ${styles.primary}`}
                    disabled={busy}
                >
                    {replacing ? 'Replace token' : 'Create token'}
                </button>
            </div>
        </form>
    )
}

function Reveal({ created, onDone }) {
    const [copied, setCopied] = useState(false)
    const url = new URL(base() + 'api/access/me', window.location.href).href
    const copy = () => {
        const done = () => {
            setCopied(true)
            setTimeout(() => setCopied(false), 2000)
        }
        if (navigator.clipboard && window.isSecureContext)
            navigator.clipboard.writeText(created.token).then(done)
        else {
            const el = document.getElementById('apiTokensValue')
            el.select()
            document.execCommand('copy')
            done()
        }
    }
    return (
        <div className={styles.form}>
            <div className={styles.warn}>
                Copy your token now. It won't be shown again and can't be
                recovered; if you lose it, replace it.
            </div>
            <div className={styles.reveal}>
                <input
                    id="apiTokensValue"
                    className={styles.mono}
                    readOnly
                    value={created.token}
                    onFocus={(e) => e.target.select()}
                />
                <button
                    type="button"
                    className={`${styles.btn} ${styles.primary}`}
                    onClick={copy}
                >
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <div className={styles.field}>
                <span>Use it in an Authorization header</span>
                <pre className={styles.code}>
                    {`curl -H "Authorization: Bearer <token>" \\\n  ${url}`}
                </pre>
            </div>
            <div className={styles.footer}>
                <button
                    type="button"
                    className={`${styles.btn} ${styles.primary}`}
                    onClick={onDone}
                >
                    Done
                </button>
            </div>
        </div>
    )
}

function ApiTokensModal({ initial, initialView }) {
    const [data, setData] = useState(initial)
    const [view, setView] = useState(initialView)
    const [replacing, setReplacing] = useState(null)
    const [created, setCreated] = useState(null)
    const [error, setError] = useState(null)

    const { tokens, limits } = data
    const live = tokens.filter(isLive)
    const atLimit = limits.max_tokens != null && live.length >= limits.max_tokens

    const reload = () =>
        summary()
            .then((s) => (s ? setData({ ...data, ...s }) : Modal.remove(false, MODAL_ID)))
            .catch((err) => setError(err.message))

    const revoke = (t) =>
        ConfirmationModal.prompt(
            `Revoke ${t.name || t.token}? Anything using it stops working right away.`,
            (yes) => {
                if (!yes) return
                request('POST', 'api/longtermtoken/clear', { id: t.id })
                    .then(reload)
                    .catch((err) => setError(err.message))
            }
        )

    const close = () => Modal.remove(false, MODAL_ID)
    const title =
        view === 'reveal'
            ? 'Your new API token'
            : view === 'create'
              ? replacing
                  ? 'Replace API token'
                  : 'New API token'
              : limits.unlimited
                ? `Your API tokens (${live.length})`
                : 'Your API token'

    let content
    if (view === 'reveal')
        content = (
            <Reveal
                created={created}
                onDone={() => {
                    setCreated(null)
                    setView('manage')
                    reload()
                }}
            />
        )
    else if (view === 'create')
        content = (
            <CreateForm
                data={data}
                replacing={replacing}
                onCancel={() => {
                    setReplacing(null)
                    setView('manage')
                }}
                onCreated={(body) => {
                    setReplacing(null)
                    setCreated(body)
                    setView('reveal')
                }}
            />
        )
    else
        content = (
            <div className={styles.form}>
                <div className={styles.note}>
                    Scripts and other tools can call MMGIS's APIs as you with a
                    token, limited to the access and missions you give it.
                    {!limits.unlimited &&
                        ' You can have one token at a time, lasting up to 90 days.'}
                </div>
                {tokens.length === 0 && (
                    <div className={styles.empty}>You have no API tokens.</div>
                )}
                {tokens.map((t) => (
                    <div key={t.id} className={styles.item}>
                        <TokenDetails token={t} />
                        <div className={styles.itemActions}>
                            {!limits.unlimited && isLive(t) && (
                                <button
                                    type="button"
                                    className={styles.btn}
                                    onClick={() => {
                                        setReplacing(t)
                                        setView('create')
                                    }}
                                >
                                    Replace
                                </button>
                            )}
                            <button
                                type="button"
                                className={`${styles.btn} ${styles.danger}`}
                                onClick={() => revoke(t)}
                            >
                                {isLive(t) ? 'Revoke' : 'Remove'}
                            </button>
                        </div>
                    </div>
                ))}
                {error && <div className={styles.error}>{error}</div>}
                <div className={styles.footer}>
                    {limits.unlimited && (
                        <a className={styles.link} href={`${base()}configure`}>
                            Everyone's tokens in Configure
                        </a>
                    )}
                    <button type="button" className={styles.btn} onClick={close}>
                        Close
                    </button>
                    {!atLimit && (
                        <button
                            type="button"
                            className={`${styles.btn} ${styles.primary}`}
                            onClick={() => setView('create')}
                        >
                            {tokens.length ? 'New token' : 'Create token'}
                        </button>
                    )}
                </div>
            </div>
        )

    return (
        <div className={styles.root} id="apiTokensModal">
            <div className={styles.title}>
                <div className={styles.titleLeft}>
                    <i className="mdi mdi-key-variant mdi-18px" />
                    <div>{title}</div>
                </div>
                <i
                    className={`mdi mdi-close mdi-18px ${styles.close}`}
                    role="button"
                    aria-label="Close"
                    onClick={close}
                />
            </div>
            {content}
        </div>
    )
}

const ApiTokens = {
    summary,
    open(view = 'manage') {
        summary()
            .then((s) => {
                if (!s) return
                const initial = { ...s, canWrite: s.limits.unlimited }
                const live = s.tokens.filter(isLive)
                const start =
                    view === 'create' &&
                    (s.limits.max_tokens == null ||
                        live.length < s.limits.max_tokens)
                        ? 'create'
                        : 'manage'
                Modal.set(
                    <ApiTokensModal initial={initial} initialView={start} />,
                    null,
                    null,
                    MODAL_ID
                )
            })
            .catch((err) => console.error(err))
    },
}

export default ApiTokens
