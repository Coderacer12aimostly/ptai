import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import { useStore } from "../lib/store"
import * as g from "../lib/google"
import type { GEvent, GFile, GMail, GOpts, GStatus } from "../lib/google"
import { inQuietHours, showDesktop } from "../lib/notify"
import { uid } from "../lib/utils"
import { toast } from "./toast"

interface GoogleCtx {
  status: GStatus | null
  opts: GOpts
  events: GEvent[]
  mail: { unread: number; messages: GMail[] }
  files: GFile[]
  loading: boolean
  error: string | null
  lastSync: number | null
  refresh: () => Promise<void>
  has: (s: g.GService) => boolean
  startSample: () => void
  stopSample: () => void
  disconnect: () => Promise<void>
}

const Ctx = createContext<GoogleCtx | null>(null)
export const useGoogle = () => {
  const c = useContext(Ctx)
  if (!c) throw new Error("useGoogle outside GoogleProvider")
  return c
}

interface Seen {
  init: boolean
  events: string[]
  mail: string[]
  drive: Record<string, string>
}

const seenKey = (sample: boolean) => `papertech:gseen:${sample ? "sample" : "live"}`
function loadSeen(sample: boolean): Seen {
  try {
    return { init: false, events: [], mail: [], drive: {}, ...JSON.parse(localStorage.getItem(seenKey(sample)) ?? "{}") }
  } catch {
    return { init: false, events: [], mail: [], drive: {} }
  }
}
function saveSeen(sample: boolean, s: Seen) {
  try {
    localStorage.setItem(seenKey(sample), JSON.stringify({ ...s, events: s.events.slice(-200), mail: s.mail.slice(-300) }))
  } catch {
    /* ignore */
  }
}

export function GoogleProvider({ children }: { children: React.ReactNode }) {
  const { state, update, user } = useStore()
  const sample = state.prefs.googleSample
  const opts = useMemo<GOpts>(() => ({ sample, anchor: state.prefs.googleSampleSince || Date.now() }), [sample, state.prefs.googleSampleSince])
  const [status, setStatus] = useState<GStatus | null>(null)
  const [events, setEvents] = useState<GEvent[]>([])
  const [mail, setMail] = useState<{ unread: number; messages: GMail[] }>({ unread: 0, messages: [] })
  const [files, setFiles] = useState<GFile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lastSync, setLastSync] = useState<number | null>(null)
  const alerts = state.prefs.gAlerts
  const alertsRef = useRef(alerts)
  alertsRef.current = alerts
  const busy = useRef(false)
  // depend on stable values, not the user object (it gets a new identity on every state update)
  const email = user?.email
  const name = user?.name

  const notify = useCallback(
    (n: { text: string; sub?: string; url?: string; href?: string; kind: "calendar" | "gmail" | "drive"; who?: string; tag: string }) => {
      update((d) => void d.notifications.unshift({ id: uid("n-"), text: n.text, sub: n.sub, url: n.url, href: n.href, kind: n.kind, who: n.who ?? "Google", at: Date.now(), read: false }))
      if (alertsRef.current.quiet && inQuietHours()) return
      const away = document.hidden || !document.hasFocus()
      if (alertsRef.current.desktop && away) showDesktop(n.text, n.sub ?? "", { url: n.url, href: n.href, tag: n.tag })
      else toast(n.sub ? `${n.text} — ${n.sub}` : n.text, "info")
    },
    [update],
  )

  const refresh = useCallback(async () => {
    if (busy.current) return
    busy.current = true
    setLoading(true)
    try {
      const st = await g.getStatus(opts, email ? { email, name: name ?? "" } : undefined)
      setStatus(st)
      if (!st.connected) return
      const svc = st.services ?? []
      const a = alertsRef.current
      const [ev, ml, fl] = await Promise.all([
        svc.includes("calendar") ? g.getEvents(opts) : Promise.resolve([] as GEvent[]),
        svc.includes("gmail") ? g.getMail(opts, a.importantOnly) : Promise.resolve({ unread: 0, messages: [] as GMail[] }),
        svc.includes("drive") ? g.getFiles(opts) : Promise.resolve([] as GFile[]),
      ])
      setEvents(ev)
      setMail(ml)
      setFiles(fl)
      setError(null)
      setLastSync(Date.now())

      // ---- alerts ----
      const seen = loadSeen(opts.sample)
      const now = Date.now()
      if (a.meetings) {
        for (const e of ev) {
          if (e.allDay) continue
          const start = Date.parse(e.start)
          const key = `${e.id}@${Math.round(start / 60_000)}`
          if (start - now <= a.lead * 60_000 && start > now - 60_000 && !seen.events.includes(key)) {
            seen.events.push(key)
            const mins = Math.max(0, Math.round((start - now) / 60_000))
            notify({ kind: "calendar", tag: key, text: mins ? `Starts in ${mins} min: ${e.title}` : `Starting now: ${e.title}`, sub: e.meetLink ? "Join with Google Meet" : e.location || g.eventTime(e), url: e.meetLink || e.url, who: "Calendar" })
          }
        }
      }
      const fresh = ml.messages.filter((m) => !seen.mail.includes(m.id))
      if (seen.init && a.email && fresh.length) {
        if (fresh.length > 3) notify({ kind: "gmail", tag: "mail-batch", text: `${fresh.length} new emails`, sub: fresh.slice(0, 3).map((m) => m.from).join(", "), href: "#/app/today", who: "Gmail" })
        else fresh.forEach((m) => notify({ kind: "gmail", tag: m.id, text: `New email from ${m.from}`, sub: m.subject, url: m.url, who: m.from }))
      }
      seen.mail.push(...fresh.map((m) => m.id))
      for (const f of fl) {
        const prev = seen.drive[f.id]
        if (seen.init && a.drive && prev && prev !== f.modifiedTime && !f.modifiedByMe) {
          notify({ kind: "drive", tag: `${f.id}@${f.modifiedTime}`, text: `${f.modifiedBy || "Someone"} edited ${f.name}`, sub: g.driveLabel(f.mimeType), url: f.url, who: f.modifiedBy || "Drive" })
        }
        seen.drive[f.id] = f.modifiedTime
      }
      seen.init = true
      saveSeen(opts.sample, seen)
    } catch (e) {
      setError((e as Error).message)
      if (e instanceof g.GoogleApiError && e.status === 401) setStatus((s) => (s ? { ...s, connected: false } : s))
    } finally {
      busy.current = false
      setLoading(false)
    }
  }, [opts, email, name, notify])

  // Keep sample data fresh: re-anchor once the sample day is over.
  useEffect(() => {
    if (sample && Date.now() - state.prefs.googleSampleSince > 6 * 3600_000) update((d) => void (d.prefs.googleSampleSince = Date.now()))
  }, [sample, state.prefs.googleSampleSince, update])

  useEffect(() => {
    refresh()
    const every = sample ? 15_000 : 120_000
    const t = window.setInterval(refresh, every)
    const onFocus = () => document.visibilityState === "visible" && refresh()
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onFocus)
    return () => {
      window.clearInterval(t)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onFocus)
    }
  }, [refresh, sample])

  const value: GoogleCtx = {
    status,
    opts,
    events,
    mail,
    files,
    loading,
    error,
    lastSync,
    refresh,
    has: (s) => Boolean(status?.connected && status.services?.includes(s)),
    startSample: () => {
      try {
        localStorage.removeItem(seenKey(true))
      } catch {
        /* ignore */
      }
      update((d) => {
        d.prefs.googleSample = true
        d.prefs.googleSampleSince = Date.now()
      })
      toast("Sample Google data is on. Watch for a meeting reminder and a new email in the next minute.", "info")
    },
    stopSample: () => {
      update((d) => void (d.prefs.googleSample = false))
      setEvents([])
      setMail({ unread: 0, messages: [] })
      setFiles([])
    },
    disconnect: async () => {
      if (sample) update((d) => void (d.prefs.googleSample = false))
      else await g.disconnect()
      setStatus((s) => (s ? { ...s, connected: false, sample: false } : s))
      setEvents([])
      setMail({ unread: 0, messages: [] })
      setFiles([])
      toast("Google Workspace disconnected")
    },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
