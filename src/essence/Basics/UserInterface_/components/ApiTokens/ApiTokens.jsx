/**
 * ApiTokens — the main site's own API (long-term) tokens: a summary for the
 * account menu and a modal to create, copy, replace and revoke them.
 *   ApiTokens.summary() -> Promise<null | { tokens, limits }>
 *   ApiTokens.open(view)  view: 'manage' | 'create'
 */
import React, { useCallback, useEffect, useState } from 'react'
import {
    Button,
    Checkbox,
    Radio,
    RadioGroup,
    TextInput,
} from '../../../../../design-system/components'
import IconButton from '../../../../../design-system/components/IconButton/IconButton'
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

function cardExpiryText(t) {
    const e = expiresAt(t)
    if (e == null) return 'Never'
    const left = e - Date.now()
    if (left <= 0) return `Expired ${when(e)}`
    const days = Math.ceil(left / DAY)
    return `${when(e)} · in ${days} ${days === 1 ? 'day' : 'days'}`
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

function TokenDetails({ token, canReplace, onReplace, onRevoke }) {
    const live = isLive(token)
    const expires = expiresAt(token)
    const now = Date.now()
    const expiresSoon = live && expires != null && expires - now <= 7 * DAY
    const created = new Date(token.createdAt).getTime()
    const duration = expires - created
    const progress =
        live &&
        expires != null &&
        Number.isFinite(created) &&
        duration > 0
            ? Math.min(100, Math.max(0, ((now - created) / duration) * 100))
            : null
    const statusClass = !live
        ? styles.statusExpired
        : expiresSoon
          ? styles.statusSoon
          : styles.statusActive

    return (
        <div className={`${styles.card} ${live ? '' : styles.expired}`}>
            <div className={styles.cardTop}>
                <div className={styles.cardIdentity}>
                    <div
                        className={styles.cardName}
                        title={token.name || 'Unnamed token'}
                    >
                        {token.name || 'Unnamed token'}
                    </div>
                    <div
                        className={`${styles.prefix} ${styles.mono}`}
                        title={token.token}
                    >
                        {token.token}
                    </div>
                </div>
                <span className={`${styles.status} ${statusClass}`}>
                    <span className={styles.statusDot} />
                    {!live ? 'Expired' : expiresSoon ? 'Expires soon' : 'Active'}
                </span>
            </div>
            <div className={styles.facts}>
                <div className={styles.fact}>
                    <div className={styles.factLabel}>Access</div>
                    <div className={styles.factValue}>{accessText(token)}</div>
                </div>
                <div className={styles.fact}>
                    <div className={styles.factLabel}>Missions</div>
                    <div className={styles.factValue}>
                        {Array.isArray(token.missions)
                            ? token.missions.join(', ') || 'None'
                            : 'All you can view'}
                    </div>
                </div>
                <div className={styles.fact}>
                    <div className={styles.factLabel}>Created</div>
                    <div className={styles.factValue}>
                        {when(new Date(token.createdAt).getTime())}
                    </div>
                </div>
                <div className={styles.fact}>
                    <div className={styles.factLabel}>Last used</div>
                    <div className={styles.factValue}>
                        {token.last_used_at
                            ? when(new Date(token.last_used_at).getTime())
                            : 'Never'}
                    </div>
                </div>
                <div className={`${styles.fact} ${styles.factFull}`}>
                    <div className={styles.factLabel}>Expires</div>
                    <div className={styles.factValue}>{cardExpiryText(token)}</div>
                </div>
            </div>
            {progress != null && (
                <div
                    className={styles.progress}
                    role="progressbar"
                    aria-label="Token lifetime elapsed"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.round(progress)}
                >
                    <span style={{ width: `${progress}%` }} />
                </div>
            )}
            <div className={styles.cardActions}>
                {canReplace && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={onReplace}
                    >
                        <i
                            className="mdi mdi-swap-horizontal mdi-14px"
                            aria-hidden="true"
                        />
                        Replace
                    </Button>
                )}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={styles.danger}
                    onClick={onRevoke}
                >
                    <i
                        className="mdi mdi-delete-outline mdi-14px"
                        aria-hidden="true"
                    />
                    {live ? 'Revoke' : 'Remove'}
                </Button>
            </div>
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
    const [access, setAccess] = useState(
        replacing && replacing.scopes == null && data.canWrite ? 'full' : 'read'
    )
    const [missionMode, setMissionMode] = useState(
        Array.isArray(replacing?.missions) ? 'some' : 'all'
    )
    const [missions, setMissions] = useState(
        Array.isArray(replacing?.missions) ? replacing.missions : []
    )
    const [available, setAvailable] = useState(null)
    const [error, setError] = useState(null)
    const [busy, setBusy] = useState(false)

    const loadMissions = useCallback(() => {
        request('GET', 'api/configure/missions')
            .then((r) => setAvailable(r.missions || []))
            .catch((err) => setError(err.message))
    }, [])

    useEffect(() => {
        if (Array.isArray(replacing?.missions)) loadMissions()
    }, [replacing, loadMissions])

    const pickMissions = () => {
        setMissionMode('some')
        if (available !== null) return
        loadMissions()
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
        <form className={styles.view} onSubmit={submit}>
            <div className={styles.body}>
                <label className={styles.field}>
                    <span className={styles.label}>Name</span>
                    <TextInput
                        className={styles.textField}
                        type="text"
                        value={name}
                        maxLength={64}
                        placeholder="e.g. analysis-scripts"
                        onChange={(e) => setName(e.target.value)}
                    />
                    <div className={styles.help}>
                        Helps you recognise it later.
                    </div>
                </label>
                <div className={styles.field}>
                    <div className={styles.labelRow}>
                        <span className={styles.label}>Expires after</span>
                        {limits.max_period != null && (
                            <span className={styles.periodLimit}>
                                Up to {Math.round(limits.max_period / DAY)} days
                            </span>
                        )}
                    </div>
                    <RadioGroup
                        aria-label="Expires after"
                        variant="segmented"
                        size="md"
                        className={styles.periods}
                        value={period}
                        onValueChange={setPeriod}
                        options={periods}
                    />
                    <div className={styles.help}>
                        {period === 'never'
                            ? 'Never expires.'
                            : `Expires on ${when(Date.now() + Number(period))}.`}
                    </div>
                </div>
                <div className={styles.field}>
                    <span className={styles.label}>Missions</span>
                    <Radio
                        aria-label="Missions"
                        value={missionMode}
                        onValueChange={(v) =>
                            v === 'some'
                                ? pickMissions()
                                : setMissionMode('all')
                        }
                        options={[
                            { value: 'all', label: 'All missions you can view' },
                            { value: 'some', label: 'Only these missions' },
                        ]}
                    />
                    {missionMode === 'some' && (
                        <div className={styles.missions}>
                            {available == null
                                ? 'Loading…'
                                : available.length === 0
                                  ? 'No missions'
                                  : available.map((m) => (
                                        <div
                                            key={m}
                                            className={styles.missionOption}
                                            title={m}
                                        >
                                            <Checkbox
                                                checked={missions.includes(m)}
                                                onCheckedChange={() => toggle(m)}
                                                showCheck
                                            >
                                                {m}
                                            </Checkbox>
                                        </div>
                                    ))}
                        </div>
                    )}
                </div>
                <div className={styles.field}>
                    <span className={styles.label}>Access</span>
                    {data.canWrite ? (
                        <Radio
                            aria-label="Access"
                            value={access}
                            onValueChange={setAccess}
                            options={[
                                { value: 'read', label: 'Read-only' },
                                {
                                    value: 'full',
                                    label: 'Everything you can do',
                                },
                            ]}
                        />
                    ) : (
                        <div className={styles.readOnlyAccess}>
                            <i
                                className="mdi mdi-eye-outline mdi-14px"
                                aria-hidden="true"
                            />
                            <span>Read-only</span>
                        </div>
                    )}
                    <div className={styles.hint}>
                        A token never has more access than your account does.
                    </div>
                </div>
                {error && <div className={styles.error}>{error}</div>}
            </div>
            <div className={styles.footer}>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={onCancel}
                >
                    Cancel
                </Button>
                <Button
                    type="submit"
                    variant="primary"
                    disabled={busy}
                >
                    {replacing ? 'Replace token' : 'Create token'}
                </Button>
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
        <div className={styles.view}>
            <div className={styles.body}>
                <div className={styles.tokenBox}>
                    <TextInput
                        id="apiTokensValue"
                        render={<textarea rows={2} />}
                        className={`${styles.mono} ${styles.tokenValue}`}
                        readOnly
                        value={created.token}
                        onFocus={(e) => e.target.select()}
                    />
                    <Button
                        type="button"
                        variant="primary"
                        onClick={copy}
                    >
                        <i
                            className={`mdi mdi-${copied ? 'check' : 'content-copy'} mdi-14px`}
                            aria-hidden="true"
                        />
                        {copied ? 'Copied' : 'Copy'}
                    </Button>
                </div>
                <div className={styles.warning}>
                    <i
                        className="mdi mdi-alert-outline mdi-18px"
                        aria-hidden="true"
                    />
                    <span>
                        <b>Copy it now.</b> This is the only time it's shown. If
                        you lose it, replace the token to get a new one.
                    </span>
                </div>
                <div className={styles.field}>
                    <span className={styles.label}>Try it</span>
                    <pre className={styles.code}>
                        {`curl -H "Authorization: Bearer <token>" \\\n  ${url}`}
                    </pre>
                </div>
            </div>
            <div className={styles.footer}>
                <span className={styles.footerSpacer} />
                <Button
                    type="button"
                    variant="primary"
                    onClick={onDone}
                >
                    Done
                </Button>
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
    const close = useCallback(() => Modal.remove(false, MODAL_ID), [])

    useEffect(() => {
        const handleKeyDown = (event) => {
            if (event.key === 'Escape' && Modal.top() === MODAL_ID) close()
        }
        document.addEventListener('keydown', handleKeyDown)
        return () => document.removeEventListener('keydown', handleKeyDown)
    }, [close])

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

    const title =
        view === 'reveal'
            ? 'Token created'
            : view === 'create'
              ? replacing
                  ? 'Replace API token'
                  : 'New API token'
              : limits.unlimited
                ? `Your API tokens (${live.length})`
                : 'Your API token'
    const icon =
        view === 'reveal'
            ? 'check'
            : view === 'create'
              ? replacing
                  ? 'swap-horizontal'
                  : 'key-plus'
              : 'key-variant'
    const subtitle =
        view === 'reveal'
            ? ''
            : view === 'create'
              ? replacing
                  ? `Replaces ${replacing.name || replacing.token}. It stops working as soon as the new one is created.`
                  : "You'll see the token once, right after you create it."
              : `Lets scripts call MMGIS's APIs as you.${!limits.unlimited && limits.max_period != null ? ` One token at a time, up to ${Math.round(limits.max_period / DAY)} days.` : ''}`

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
            <div className={styles.view}>
                <div className={styles.body}>
                    {tokens.length === 0 && (
                        <div className={styles.empty}>
                            You have no API tokens.
                        </div>
                    )}
                    {tokens.map((t) => (
                        <div key={t.id} className={styles.item}>
                            <TokenDetails
                                token={t}
                                canReplace={!limits.unlimited && isLive(t)}
                                onReplace={() => {
                                    setReplacing(t)
                                    setView('create')
                                }}
                                onRevoke={() => revoke(t)}
                            />
                            {!limits.unlimited && isLive(t) && (
                                <div className={styles.note}>
                                    <i
                                        className="mdi mdi-information-outline mdi-16px"
                                        aria-hidden="true"
                                    />
                                    <span>
                                        Replace makes a new token and removes
                                        this one in one step, so your scripts
                                        only need the new value.
                                    </span>
                                </div>
                            )}
                        </div>
                    ))}
                    {error && <div className={styles.error}>{error}</div>}
                </div>
                <div className={styles.footer}>
                    <Button
                        type="button"
                        variant="secondary"
                        onClick={close}
                    >
                        Close
                    </Button>
                    {!atLimit && (
                        <Button
                            type="button"
                            variant="primary"
                            onClick={() => setView('create')}
                        >
                            {tokens.length ? 'New token' : 'Create token'}
                        </Button>
                    )}
                </div>
            </div>
        )

    return (
        <div className={styles.root} id="apiTokensModal">
            <div className={styles.header}>
                <div
                    className={`${styles.iconTile} ${view === 'reveal' ? styles.successTile : ''}`}
                >
                    <i
                        className={`mdi mdi-${icon} mdi-18px`}
                        aria-hidden="true"
                    />
                </div>
                <div className={styles.headerText}>
                    <div className={styles.title}>{title}</div>
                    <div
                        className={`${styles.subtitle} ${view === 'reveal' ? styles.revealSubtitle : ''}`}
                    >
                        {view === 'reveal' && created ? (
                            <>
                                <span className={styles.subtitleName}>
                                    {created.name || 'Unnamed token'}
                                </span>
                                <span className={styles.subtitleDetails}>
                                    {' · '}
                                    {accessText(created)} · {expiryText(created)}
                                </span>
                            </>
                        ) : (
                            subtitle
                        )}
                    </div>
                </div>
                <IconButton
                    type="button"
                    size="md"
                    className={styles.close}
                    aria-label="Close"
                    onClick={close}
                >
                    <i className="mdi mdi-close mdi-18px" aria-hidden="true" />
                </IconButton>
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
