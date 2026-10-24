// Google Workspace connection for Paper Tech — zero dependencies.
//
// OAuth 2.0 authorization-code flow. Tokens never reach the browser: they're
// kept in an AES-256-GCM encrypted, HttpOnly cookie, so no database is needed.
//
// Env:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   from Google Cloud Console (OAuth client, type "Web application")
//   APP_URL            public URL of the app, e.g. https://paper-tech-ai.onrender.com (used for the redirect URI)
//   SESSION_SECRET     any long random string (encrypts the cookie)
//   GOOGLE_MOCK_BASE   tests only — send every Google request to a mock server

import crypto from "node:crypto"

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ""
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ""
const SECRET = process.env.SESSION_SECRET || CLIENT_SECRET
const MOCK = (process.env.GOOGLE_MOCK_BASE || "").replace(/\/$/, "")
export const googleConfigured = Boolean(CLIENT_ID && CLIENT_SECRET)

const EP = {
  auth: `${MOCK || "https://accounts.google.com"}/o/oauth2/v2/auth`,
  token: `${MOCK || "https://oauth2.googleapis.com"}/token`,
  revoke: `${MOCK || "https://oauth2.googleapis.com"}/revoke`,
  userinfo: `${MOCK || "https://openidconnect.googleapis.com"}/v1/userinfo`,
  calendar: `${MOCK || "https://www.googleapis.com"}/calendar/v3`,
  drive: `${MOCK || "https://www.googleapis.com"}/drive/v3`,
  gmail: `${MOCK || "https://gmail.googleapis.com"}/gmail/v1`,
}

const SCOPES = {
  calendar: "https://www.googleapis.com/auth/calendar.readonly",
  gmail: "https://www.googleapis.com/auth/gmail.readonly",
  drive: "https://www.googleapis.com/auth/drive.readonly",
}
const BASE_SCOPES = ["openid", "email", "profile"]
const COOKIE = "papertech_google"
const STATE_COOKIE = "papertech_google_state"

/* ---------------- cookie helpers ---------------- */

const key = crypto.createHash("sha256").update(`papertech-google:${SECRET}`).digest()

function seal(obj) {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv("aes-256-gcm", key, iv)
  const enc = Buffer.concat([c.update(JSON.stringify(obj), "utf8"), c.final()])
  return Buffer.concat([iv, c.getAuthTag(), enc]).toString("base64url")
}

function unseal(token) {
  try {
    const buf = Buffer.from(token, "base64url")
    const d = crypto.createDecipheriv("aes-256-gcm", key, buf.subarray(0, 12))
    d.setAuthTag(buf.subarray(12, 28))
    return JSON.parse(Buffer.concat([d.update(buf.subarray(28)), d.final()]).toString("utf8"))
  } catch {
    return null
  }
}

function cookies(req) {
  const out = {}
  for (const part of (req.headers.cookie || "").split(";")) {
    const i = part.indexOf("=")
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function appUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, "")
  const proto = (req.headers["x-forwarded-proto"] || "http").toString().split(",")[0]
  const host = (req.headers["x-forwarded-host"] || req.headers.host || "localhost").toString().split(",")[0]
  return `${proto}://${host}`
}

function cookieAttrs(req, maxAge) {
  const secure = appUrl(req).startsWith("https://") ? "; Secure" : ""
  return `; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

function setSession(req, res, session) {
  const prev = res.getHeader("Set-Cookie")
  const list = Array.isArray(prev) ? prev : prev ? [String(prev)] : []
  const value = session ? `${COOKIE}=${seal(session)}${cookieAttrs(req, 60 * 60 * 24 * 180)}` : `${COOKIE}=${cookieAttrs(req, 0)}`
  res.setHeader("Set-Cookie", [...list.filter((c) => !c.startsWith(`${COOKIE}=`)), value])
}

function json(res, code, body) {
  if (res.headersSent) return
  res.writeHead(code, { "content-type": "application/json", "cache-control": "no-store" })
  res.end(JSON.stringify(body))
}

function redirect(res, to) {
  res.writeHead(302, { location: to, "cache-control": "no-store" })
  res.end()
}

const servicesFrom = (scope = "") => Object.entries(SCOPES).filter(([, s]) => scope.includes(s)).map(([k]) => k)

/* ---------------- token handling ---------------- */

async function tokenRequest(params) {
  const r = await fetch(EP.token, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, ...params }),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw Object.assign(new Error(j.error_description || j.error || "Token request failed"), { status: r.status })
  return j
}

async function session(req, res) {
  const s = unseal(cookies(req)[COOKIE] || "")
  if (!s?.refresh_token && !s?.access_token) return null
  if (s.access_token && s.expiry > Date.now() + 60_000) return s
  if (!s.refresh_token) return null
  try {
    const t = await tokenRequest({ grant_type: "refresh_token", refresh_token: s.refresh_token })
    const next = { ...s, access_token: t.access_token, expiry: Date.now() + (t.expires_in || 3600) * 1000 }
    setSession(req, res, next)
    return next
  } catch {
    setSession(req, res, null)
    return null
  }
}

class GoogleError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

async function gapi(s, url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { authorization: `Bearer ${s.access_token}`, ...(opts.headers || {}) } })
  if (!r.ok) {
    const j = await r.json().catch(() => ({}))
    throw new GoogleError(r.status, j.error?.message || r.statusText)
  }
  return opts.raw ? r : r.json()
}

/* ---------------- data shaping ---------------- */

async function calendar(s, url) {
  const hours = Math.min(Number(url.searchParams.get("hours")) || 36, 24 * 14)
  const q = new URLSearchParams({
    timeMin: new Date(Date.now() - 30 * 60_000).toISOString(),
    timeMax: new Date(Date.now() + hours * 3600_000).toISOString(),
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "25",
  })
  const j = await gapi(s, `${EP.calendar}/calendars/primary/events?${q}`)
  return (j.items || [])
    .filter((e) => e.status !== "cancelled")
    .filter((e) => (e.attendees || []).find((a) => a.self)?.responseStatus !== "declined")
    .map((e) => ({
      id: e.id,
      title: e.summary || "(No title)",
      start: e.start?.dateTime || e.start?.date,
      end: e.end?.dateTime || e.end?.date,
      allDay: Boolean(e.start?.date && !e.start?.dateTime),
      location: e.location || "",
      meetLink: e.hangoutLink || e.conferenceData?.entryPoints?.find((p) => p.entryPointType === "video")?.uri || "",
      url: e.htmlLink || "",
      attendees: (e.attendees || []).length,
      organizer: e.organizer?.displayName || e.organizer?.email || "",
      description: (e.description || "").replace(/<[^>]+>/g, " ").slice(0, 400),
    }))
}

async function gmail(s, url) {
  const important = url.searchParams.get("important") === "1"
  const q = important ? "is:unread in:inbox is:important" : "is:unread in:inbox category:primary"
  const max = Math.min(Number(url.searchParams.get("max")) || 12, 25)
  const [list, inbox] = await Promise.all([
    gapi(s, `${EP.gmail}/users/me/messages?${new URLSearchParams({ q, maxResults: String(max) })}`),
    gapi(s, `${EP.gmail}/users/me/labels/INBOX`).catch(() => ({})),
  ])
  const msgs = await Promise.all(
    (list.messages || []).map((m) =>
      gapi(s, `${EP.gmail}/users/me/messages/${m.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`).catch(() => null),
    ),
  )
  const header = (m, n) => m.payload?.headers?.find((h) => h.name.toLowerCase() === n)?.value || ""
  return {
    unread: inbox.messagesUnread ?? (list.resultSizeEstimate || 0),
    messages: msgs.filter(Boolean).map((m) => {
      const from = header(m, "from")
      const name = from.replace(/<.*>/, "").replace(/"/g, "").trim() || from
      return {
        id: m.id,
        threadId: m.threadId,
        from: name,
        fromEmail: (from.match(/<([^>]+)>/) || [, from])[1],
        subject: header(m, "subject") || "(No subject)",
        snippet: (m.snippet || "").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&"),
        at: Number(m.internalDate) || Date.parse(header(m, "date")) || Date.now(),
        important: (m.labelIds || []).includes("IMPORTANT"),
        url: `https://mail.google.com/mail/u/0/#inbox/${m.threadId}`,
      }
    }),
  }
}

const FILE_FIELDS = "files(id,name,mimeType,modifiedTime,webViewLink,size,owners(displayName,me),lastModifyingUser(displayName,me))"

async function drive(s, url) {
  const search = (url.searchParams.get("q") || "").replace(/['\\]/g, "").slice(0, 80)
  const q = ["trashed = false", "mimeType != 'application/vnd.google-apps.folder'", search && `name contains '${search}'`].filter(Boolean).join(" and ")
  const j = await gapi(s, `${EP.drive}/files?${new URLSearchParams({ q, orderBy: "modifiedTime desc", pageSize: "20", fields: FILE_FIELDS })}`)
  return (j.files || []).map((f) => ({
    id: f.id,
    name: f.name,
    mimeType: f.mimeType,
    modifiedTime: f.modifiedTime,
    url: f.webViewLink,
    size: Number(f.size) || 0,
    owner: f.owners?.[0]?.displayName || "",
    modifiedBy: f.lastModifyingUser?.displayName || "",
    modifiedByMe: Boolean(f.lastModifyingUser?.me),
  }))
}

const EXPORTS = {
  "application/vnd.google-apps.document": ["text/plain", "Google Doc"],
  "application/vnd.google-apps.spreadsheet": ["text/csv", "Google Sheet"],
  "application/vnd.google-apps.presentation": ["text/plain", "Google Slides"],
}

async function driveFile(s, url, res) {
  const id = (url.searchParams.get("id") || "").replace(/[^\w-]/g, "")
  if (!id) return json(res, 400, { error: "Missing file id" })
  const meta = await gapi(s, `${EP.drive}/files/${id}?fields=id,name,mimeType,size,webViewLink`)
  const exp = EXPORTS[meta.mimeType]
  if (!exp && meta.mimeType?.startsWith("application/vnd.google-apps")) return json(res, 415, { error: "This kind of Google file can't be imported yet." })
  if (Number(meta.size) > 25 * 1024 * 1024) return json(res, 413, { error: "File is larger than 25 MB." })
  const r = exp
    ? await gapi(s, `${EP.drive}/files/${id}/export?mimeType=${encodeURIComponent(exp[0])}`, { raw: true })
    : await gapi(s, `${EP.drive}/files/${id}?alt=media`, { raw: true })
  const buf = Buffer.from(await r.arrayBuffer())
  res.writeHead(200, {
    "content-type": exp ? exp[0] : meta.mimeType || "application/octet-stream",
    "x-file-name": encodeURIComponent(meta.name),
    "x-file-label": exp ? exp[1] : "",
    "x-file-url": meta.webViewLink || "",
    "cache-control": "no-store",
  })
  res.end(buf)
}

/* ---------------- routes ---------------- */

export async function handleGoogle(req, res, url) {
  const p = url.pathname

  if (p === "/api/google/status") {
    if (!googleConfigured) return json(res, 200, { configured: false, connected: false })
    const s = await session(req, res)
    if (!s) return json(res, 200, { configured: true, connected: false })
    return json(res, 200, { configured: true, connected: true, email: s.email, name: s.name, picture: s.picture, services: s.services })
  }

  if (p === "/api/google/connect") {
    if (!googleConfigured) return json(res, 503, { error: "Google isn't configured on this server. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET." })
    const wanted = (url.searchParams.get("services") || "calendar,gmail,drive").split(",").filter((k) => SCOPES[k])
    const ret = (url.searchParams.get("return") || "/app/today").replace(/[^\w/?=&-]/g, "")
    const state = crypto.randomBytes(16).toString("hex")
    res.setHeader("Set-Cookie", `${STATE_COOKIE}=${seal({ state, ret: ret.startsWith("/app") ? ret : "/app/today" })}${cookieAttrs(req, 600)}`)
    const q = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: `${appUrl(req)}/api/google/callback`,
      response_type: "code",
      scope: [...BASE_SCOPES, ...wanted.map((k) => SCOPES[k])].join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
    })
    return redirect(res, `${EP.auth}?${q}`)
  }

  if (p === "/api/google/callback") {
    const st = unseal(cookies(req)[STATE_COOKIE] || "")
    res.setHeader("Set-Cookie", `${STATE_COOKIE}=${cookieAttrs(req, 0)}`)
    const back = (ret, flag) => redirect(res, `${appUrl(req)}/#${ret}${ret.includes("?") ? "&" : "?"}google=${flag}`)
    if (!st || st.state !== url.searchParams.get("state")) return back("/app/settings/integrations", "error")
    if (url.searchParams.get("error")) return back("/app/settings/integrations", "denied")
    try {
      const t = await tokenRequest({ grant_type: "authorization_code", code: url.searchParams.get("code") || "", redirect_uri: `${appUrl(req)}/api/google/callback` })
      const prev = unseal(cookies(req)[COOKIE] || "")
      const info = await fetch(EP.userinfo, { headers: { authorization: `Bearer ${t.access_token}` } }).then((r) => r.json()).catch(() => ({}))
      setSession(req, res, {
        access_token: t.access_token,
        refresh_token: t.refresh_token || prev?.refresh_token,
        expiry: Date.now() + (t.expires_in || 3600) * 1000,
        email: info.email || "",
        name: info.name || "",
        picture: info.picture || "",
        services: servicesFrom(t.scope),
      })
      return back(st.ret, "connected")
    } catch {
      return back("/app/settings/integrations", "error")
    }
  }

  if (p === "/api/google/disconnect" && req.method === "POST") {
    const s = unseal(cookies(req)[COOKIE] || "")
    if (s?.refresh_token || s?.access_token) {
      await fetch(`${EP.revoke}?token=${encodeURIComponent(s.refresh_token || s.access_token)}`, { method: "POST" }).catch(() => {})
    }
    setSession(req, res, null)
    return json(res, 200, { ok: true })
  }

  const routes = { "/api/google/calendar": ["calendar", calendar], "/api/google/gmail": ["gmail", gmail], "/api/google/drive": ["drive", drive], "/api/google/drive/file": ["drive", driveFile] }
  const route = routes[p]
  if (!route) return json(res, 404, { error: "Not found" })
  if (!googleConfigured) return json(res, 503, { error: "Google isn't configured on this server." })
  const s = await session(req, res)
  if (!s) return json(res, 401, { error: "reconnect" })
  if (!s.services?.includes(route[0])) return json(res, 403, { error: "scope", service: route[0] })
  try {
    const data = await route[1](s, url, res)
    if (data !== undefined) json(res, 200, data)
  } catch (e) {
    if (e.status === 401) {
      setSession(req, res, null)
      return json(res, 401, { error: "reconnect" })
    }
    if (e.status === 403) return json(res, 403, { error: "scope", service: route[0], message: e.message })
    return json(res, 502, { error: e.message || "Google request failed" })
  }
}
