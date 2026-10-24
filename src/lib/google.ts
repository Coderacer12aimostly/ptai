/**
 * Google Workspace client. Talks to /api/google/* on Paper Tech's own server
 * (tokens stay server-side), or serves built-in sample data when the user
 * turns on "Try with sample data".
 */

export type GService = "calendar" | "gmail" | "drive"

export interface GStatus {
  configured: boolean
  connected: boolean
  email?: string
  name?: string
  picture?: string
  services?: GService[]
  sample?: boolean
}

export interface GEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  location: string
  meetLink: string
  url: string
  attendees: number
  organizer: string
  description: string
}

export interface GMail {
  id: string
  threadId: string
  from: string
  fromEmail: string
  subject: string
  snippet: string
  at: number
  important: boolean
  url: string
}

export interface GFile {
  id: string
  name: string
  mimeType: string
  modifiedTime: string
  url: string
  size: number
  owner: string
  modifiedBy: string
  modifiedByMe: boolean
}

export class GoogleApiError extends Error {
  constructor(
    public status: number,
    public code: string,
  ) {
    super(code === "reconnect" ? "Your Google connection expired. Reconnect to keep syncing." : code === "scope" ? "Paper Tech doesn't have access to that Google service yet." : code)
  }
}

async function api<T>(path: string): Promise<T> {
  const r = await fetch(path, { headers: { accept: "application/json" }, credentials: "same-origin" })
  const type = r.headers.get("content-type") || ""
  if (!type.includes("json")) throw new GoogleApiError(r.status || 404, "Paper Tech's server isn't running, so Google can't connect here.")
  const j = await r.json()
  if (!r.ok) throw new GoogleApiError(r.status, j.error || "Google request failed")
  return j as T
}

/* ------------------------------ sample data ------------------------------ */

const MIN = 60_000
const HOUR = 60 * MIN

function at(base: number, mins: number) {
  return new Date(base + mins * MIN).toISOString()
}

function sampleEvents(anchor: number): GEvent[] {
  const day = new Date(anchor)
  day.setHours(0, 0, 0, 0)
  const tomorrow = day.getTime() + 24 * HOUR
  const ev = (id: string, title: string, start: string, mins: number, extra: Partial<GEvent> = {}): GEvent => ({
    id,
    title,
    start,
    end: new Date(Date.parse(start) + mins * MIN).toISOString(),
    allDay: false,
    location: "",
    meetLink: "",
    url: "https://calendar.google.com/",
    attendees: 0,
    organizer: "",
    description: "",
    ...extra,
  })
  return [
    ev("s-e1", "Daybreak launch sync", at(anchor, 9), 30, { meetLink: "https://meet.google.com/", attendees: 5, organizer: "Alex Kim", description: "Agenda: audience, launch narrative v2, next steps." }),
    ev("s-e2", "Design review — onboarding", at(anchor, 95), 45, { location: "Studio, room 2", attendees: 4, organizer: "You" }),
    ev("s-e3", "Customer call: Northwind", at(anchor, 200), 30, { meetLink: "https://meet.google.com/", attendees: 3, organizer: "Jonah Lee" }),
    ev("s-e4", "1:1 with Alex", new Date(tomorrow + 10 * HOUR).toISOString(), 30, { attendees: 2 }),
    ev("s-e5", "Weekly planning", new Date(tomorrow + 14 * HOUR).toISOString(), 60, { meetLink: "https://meet.google.com/", attendees: 6 }),
  ]
}

function sampleMail(anchor: number): GMail[] {
  const m = (id: string, from: string, email: string, subject: string, snippet: string, when: number, important = true): GMail => ({
    id,
    threadId: id,
    from,
    fromEmail: email,
    subject,
    snippet,
    at: when,
    important,
    url: "https://mail.google.com/",
  })
  const list = [
    m("s-m1", "Jonah Lee", "jonah@example.com", "Interview notes are in", "I uploaded the last three interviews. Biggest surprise: two teams already use a paper planner every morning.", anchor - 40 * MIN),
    m("s-m2", "Alex Kim", "alex@example.com", "Launch narrative — quick feedback", "Love the 9:04 opening. Can we cut the second section by half and end on the tagline?", anchor - 2 * HOUR),
    m("s-m3", "Northwind Studio", "hello@northwind.example", "Re: Pilot timing", "We'd like to start the pilot next Monday if that still works for your team.", anchor - 5 * HOUR),
    m("s-m4", "Calendar digest", "digest@example.com", "Your week at a glance", "You have 9 meetings this week, 3 more than last week.", anchor - 9 * HOUR, false),
  ]
  // One email "arrives" shortly after connecting, so you can see an alert.
  if (Date.now() >= anchor + 45_000) list.unshift(m("s-m5", "Sam Rivera", "sam@example.com", "Pricing question before Friday", "Quick one — does the Team plan include guests? We'd like to invite two contractors.", anchor + 45_000))
  return list
}

function sampleFiles(anchor: number): GFile[] {
  const edited = Date.now() >= anchor + 90_000
  const f = (id: string, name: string, mimeType: string, mins: number, owner: string, modifiedBy: string, me = false): GFile => ({
    id,
    name,
    mimeType,
    modifiedTime: at(anchor, mins),
    url: "https://drive.google.com/",
    size: 0,
    owner,
    modifiedBy,
    modifiedByMe: me,
  })
  return [
    edited ? f("s-d1", "Q4 roadmap", "application/vnd.google-apps.document", 1.5, "Alex Kim", "Alex Kim") : f("s-d1", "Q4 roadmap", "application/vnd.google-apps.document", -2 * 24 * 60, "Alex Kim", "Alex Kim"),
    f("s-d2", "Survey results — October", "application/vnd.google-apps.spreadsheet", -3 * 60, "Jonah Lee", "Jonah Lee"),
    f("s-d3", "Launch plan", "application/vnd.google-apps.document", -26 * 60, "You", "You", true),
    f("s-d4", "Pricing research.pdf", "application/pdf", -4 * 24 * 60, "Alex Kim", "Alex Kim"),
  ].sort((a, b) => Date.parse(b.modifiedTime) - Date.parse(a.modifiedTime))
}

const SAMPLE_DOCS: Record<string, string> = {
  "s-d1": "Q4 roadmap\n\nGoal: launch Daybreak to small teams by mid-November.\n\nWe will ship the weekly summary email in November because three teams asked for it in interviews.\n\nPricing stays the same for small teams. Team plan includes up to 5 seats.\n\nRisks: onboarding still takes too long for new members; we need a guided first plan.",
  "s-d2": "question,answer,count\nHow do you plan your morning?,Notebook or sticky notes,18\nHow do you plan your morning?,A pinned doc,11\nHow do you plan your morning?,I don't,9\nWhat slows you down?,Checking too many tools,24\nWhat slows you down?,Unclear priorities,17",
  "s-d3": "Launch plan\n\nWeek 1: private beta with 12 teams. Week 2: launch post and narrative. Week 3: pricing page and Team plan trial.\n\nOwner for the launch post: Alex. Owner for onboarding: Jonah.",
  "s-d4": "Pricing research\n\nMost small-team tools charge between $8 and $20 per seat per month. Teams said a free plan matters for trying the product with one project first.",
}

export function sampleStatus(email?: string, name?: string): GStatus {
  return { configured: true, connected: true, email: email ?? "you@example.com", name, services: ["calendar", "gmail", "drive"], sample: true }
}

/* ------------------------------ public API ------------------------------ */

export interface GOpts {
  sample: boolean
  anchor: number
}

export async function getStatus(o: GOpts, me?: { email: string; name: string }): Promise<GStatus> {
  if (o.sample) return sampleStatus(me?.email, me?.name)
  try {
    return await api<GStatus>("/api/google/status")
  } catch {
    return { configured: false, connected: false }
  }
}

export async function getEvents(o: GOpts): Promise<GEvent[]> {
  if (o.sample) return sampleEvents(o.anchor)
  return api<GEvent[]>("/api/google/calendar?hours=36")
}

export async function getMail(o: GOpts, importantOnly = false): Promise<{ unread: number; messages: GMail[] }> {
  if (o.sample) {
    const messages = sampleMail(o.anchor).filter((m) => !importantOnly || m.important)
    return { unread: messages.length, messages }
  }
  return api(`/api/google/gmail${importantOnly ? "?important=1" : ""}`)
}

export async function getFiles(o: GOpts, q = ""): Promise<GFile[]> {
  if (o.sample) return sampleFiles(o.anchor).filter((f) => !q || f.name.toLowerCase().includes(q.toLowerCase()))
  return api<GFile[]>(`/api/google/drive${q ? `?q=${encodeURIComponent(q)}` : ""}`)
}

/** Download a Drive file (Google Docs are exported as text, Sheets as CSV). */
export async function fetchDriveFile(o: GOpts, f: GFile): Promise<{ file: File; label: string }> {
  const label = driveLabel(f.mimeType)
  if (o.sample) {
    const csv = f.mimeType.includes("spreadsheet")
    return { file: new File([SAMPLE_DOCS[f.id] ?? f.name], `${f.name}${csv ? ".csv" : ".txt"}`, { type: csv ? "text/csv" : "text/plain" }), label }
  }
  const r = await fetch(`/api/google/drive/file?id=${encodeURIComponent(f.id)}`, { credentials: "same-origin" })
  if (!r.ok) {
    const j = await r.json().catch(() => ({}))
    throw new GoogleApiError(r.status, j.error || "Couldn't download that file")
  }
  const blob = await r.blob()
  const type = r.headers.get("content-type") || blob.type
  const ext = type.includes("csv") ? ".csv" : type.includes("pdf") ? ".pdf" : type.includes("wordprocessingml") ? ".docx" : /\.[a-z0-9]{2,5}$/i.test(f.name) ? "" : ".txt"
  return { file: new File([blob], f.name + ext, { type }), label }
}

export function driveLabel(mime: string) {
  if (mime.includes("document")) return "Google Doc"
  if (mime.includes("spreadsheet")) return "Google Sheet"
  if (mime.includes("presentation")) return "Google Slides"
  if (mime.includes("pdf")) return "PDF"
  if (mime.startsWith("image/")) return "Image"
  return "File"
}

export function connectUrl(services: GService[], ret = "/app/today") {
  return `/api/google/connect?services=${services.join(",")}&return=${encodeURIComponent(ret)}`
}

export async function disconnect() {
  await fetch("/api/google/disconnect", { method: "POST", credentials: "same-origin" }).catch(() => {})
}

/* ------------------------------ formatting ------------------------------ */

export function eventTime(e: GEvent) {
  if (e.allDay) return "All day"
  const s = new Date(e.start)
  return s.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })
}

export function startsIn(e: GEvent, now = Date.now()) {
  const mins = Math.round((Date.parse(e.start) - now) / MIN)
  if (Date.parse(e.end) < now) return "Ended"
  if (mins <= 0) return "Now"
  if (mins < 60) return `in ${mins} min`
  const h = Math.round(mins / 60)
  return h < 24 ? `in ${h} h` : ""
}

export function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString()
}

/** Plain-text context block for the AI. */
export function contextBlock(events: GEvent[], mail: GMail[]) {
  const today = events.filter((e) => Date.parse(e.end) >= Date.now()).slice(0, 12)
  const lines = [
    `Calendar (next 36 hours, local time ${Intl.DateTimeFormat().resolvedOptions().timeZone}):`,
    ...(today.length
      ? today.map((e) => `- ${new Date(e.start).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}: ${e.title}${e.attendees ? ` (${e.attendees} people)` : ""}${e.location ? ` @ ${e.location}` : ""}${e.description ? ` — ${e.description.slice(0, 160)}` : ""}`)
      : ["- Nothing scheduled."]),
    "",
    "Unread email:",
    ...(mail.length ? mail.slice(0, 12).map((m) => `- From ${m.from}: "${m.subject}" — ${m.snippet.slice(0, 200)}`) : ["- Inbox zero."]),
  ]
  return lines.join("\n")
}
