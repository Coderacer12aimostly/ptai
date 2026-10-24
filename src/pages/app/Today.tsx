import { useEffect, useState } from "react"
import { ArrowUpRight, BellRing, CalendarDays, FolderOpen, Mail, MapPin, PenLine, Plus, RefreshCw, Sparkles, Users, Video } from "lucide-react"
import { Badge, Button, Spinner } from "../../components/ui"
import { GoogleG } from "../../components/icons"
import { useGoogle } from "../../components/GoogleProvider"
import GoogleConnect from "../../components/GoogleConnect"
import DriveImport from "../../components/DriveImport"
import { TopbarActions } from "../../components/AppShell"
import { useStore } from "../../lib/store"
import { navigate } from "../../lib/router"
import { useNewConversation } from "../../lib/chat"
import { driveLabel, eventTime, startsIn, type GEvent, type GMail } from "../../lib/google"
import { desktopPermission, requestDesktop } from "../../lib/notify"
import { cx, timeAgo } from "../../lib/utils"
import { toast } from "../../components/toast"

function Panel({ icon, title, action, children }: { icon: React.ReactNode; title: React.ReactNode; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl border border-line bg-surface">
      <header className="flex items-center justify-between gap-3 border-b border-line-soft px-5 py-4">
        <h2 className="flex items-center gap-2 text-[14.5px] font-medium [&_svg]:size-4 [&_svg]:text-muted">
          {icon}
          {title}
        </h2>
        {action}
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  )
}

function Agenda({ events, onAsk }: { events: GEvent[]; onAsk: (q: string) => void }) {
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])
  const now = Date.now()
  const upcoming = events.filter((e) => Date.parse(e.end) >= now)
  const days = new Map<string, GEvent[]>()
  for (const e of upcoming) {
    const d = new Date(e.start)
    const label = d.toDateString() === new Date().toDateString() ? "Today" : d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
    days.set(label, [...(days.get(label) ?? []), e])
  }
  if (!upcoming.length) return <p className="px-5 py-10 text-center text-[13px] text-muted">Nothing else on your calendar. Enjoy the space.</p>
  return (
    <div className="px-5 py-3">
      {[...days.entries()].map(([label, list]) => (
        <div key={label} className="py-2">
          <p className="mb-2 font-mono text-[10.5px] tracking-wide text-faint uppercase">{label}</p>
          <ul className="space-y-2">
            {list.map((e) => {
              const live = Date.parse(e.start) <= now && Date.parse(e.end) >= now
              const soon = !live && Date.parse(e.start) - now < 15 * 60_000
              return (
                <li key={e.id} className={cx("group rounded-xl border p-3.5", live ? "border-success/40 bg-success-soft" : soon ? "border-accent-line bg-accent-soft" : "border-line-soft")}>
                  <div className="flex items-start gap-3">
                    <span className="w-[64px] shrink-0 pt-px font-mono text-[11.5px] text-muted">{eventTime(e)}</span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-medium">{e.title}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted">
                        {!e.allDay && <span>{new Date(e.end).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} end</span>}
                        {e.attendees > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Users className="size-3" /> {e.attendees}
                          </span>
                        )}
                        {e.location && (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="size-3" /> {e.location}
                          </span>
                        )}
                      </p>
                    </div>
                    {live ? <Badge tone="success">Now</Badge> : startsIn(e) && <span className="shrink-0 text-[11.5px] text-accent">{startsIn(e)}</span>}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-2 pl-[76px]">
                    {e.meetLink && (
                      <a href={e.meetLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-md bg-accent px-2.5 py-1 text-[12px] text-on-accent hover:bg-accent-hover">
                        <Video className="size-3.5" /> Join
                      </a>
                    )}
                    <button onClick={() => onAsk(`Help me prepare for "${e.title}" at ${eventTime(e)}. What should I know going in, and what are good questions to ask?`)} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[12px] text-muted hover:text-ink">
                      <Sparkles className="size-3.5" /> Prep with Paper Tech
                    </button>
                    {e.url && (
                      <a href={e.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-faint hover:text-ink">
                        Calendar <ArrowUpRight className="size-3" />
                      </a>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

function Inbox({ messages, onAsk }: { messages: GMail[]; onAsk: (q: string) => void }) {
  if (!messages.length) return <p className="px-5 py-10 text-center text-[13px] text-muted">No unread email. Inbox zero.</p>
  return (
    <ul className="divide-y divide-line-soft">
      {messages.map((m) => (
        <li key={m.id} className="group px-5 py-3.5 hover:bg-sunken/60">
          <div className="flex items-baseline gap-2">
            <p className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{m.from}</p>
            {m.important && <span className="size-1.5 shrink-0 rounded-full bg-warn" title="Important" />}
            <span className="shrink-0 text-[11px] text-faint">{timeAgo(m.at)}</span>
          </div>
          <p className="truncate text-[13px]">{m.subject}</p>
          <p className="mt-0.5 line-clamp-2 text-[12px] text-muted">{m.snippet}</p>
          <div className="mt-2 flex gap-2">
            <button onClick={() => onAsk(`Help me reply to this email from ${m.from} (${m.fromEmail}). Subject: "${m.subject}". It says: "${m.snippet}". Draft a short, friendly reply.`)} className="inline-flex items-center gap-1.5 rounded-md border border-line px-2.5 py-1 text-[12px] text-muted hover:text-ink">
              <PenLine className="size-3.5" /> Draft a reply
            </button>
            <a href={m.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-faint hover:text-ink">
              Open in Gmail <ArrowUpRight className="size-3" />
            </a>
          </div>
        </li>
      ))}
    </ul>
  )
}

export default function Today() {
  const { state, update } = useStore()
  const google = useGoogle()
  const newConversation = useNewConversation()
  const [drive, setDrive] = useState(false)
  const [perm, setPerm] = useState(desktopPermission())
  const st = google.status

  function ask(q: string, title?: string) {
    const id = newConversation({ google: true, title: title ?? "New conversation" })
    navigate(`/app/chat/${id}?q=${encodeURIComponent(q)}`)
  }

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-8 md:px-10 md:py-12">
      {st?.connected && (
        <TopbarActions>
          <button onClick={google.refresh} className="hidden items-center gap-1.5 rounded-md px-2 py-1 text-[12px] text-muted hover:bg-sunken hover:text-ink sm:inline-flex" title="Sync now">
            {google.loading ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
            {google.lastSync ? `Synced ${timeAgo(google.lastSync)}` : "Syncing"}
          </button>
        </TopbarActions>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="display mt-3 text-[32px] font-semibold md:text-[38px]">Your day, in one place.</h1>
          <p className="mt-2 text-[15px] text-muted">Calendar, inbox and Drive from your Google Workspace, with Paper Tech keeping watch.</p>
        </div>
        {st?.connected && (
          <Button size="lg" icon={<Sparkles className="size-4" />} onClick={() => ask("Brief me on my day: what's on my calendar, which emails need a reply, and what should I focus on first?", "Daily briefing")}>
            Brief me on my day
          </Button>
        )}
      </div>

      {!st ? (
        <div className="mt-10 grid h-40 place-items-center">
          <Spinner />
        </div>
      ) : !st.connected ? (
        <div className="mt-9 max-w-2xl">
          <GoogleConnect />
        </div>
      ) : (
        <>
          {st.sample && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-warn/30 bg-warn-soft px-4 py-3 text-[13px] text-warn">
              <span>You're looking at sample data. Connect a real Google account in Settings → Integrations.</span>
              <button className="font-medium underline-offset-2 hover:underline" onClick={() => navigate("/app/settings/integrations")}>
                Set up Google
              </button>
            </div>
          )}
          {google.error && <p className="mt-6 rounded-xl bg-danger-soft px-4 py-3 text-[13px] text-danger">{google.error}</p>}
          {!state.prefs.gAlerts.desktop && perm !== "unsupported" && perm !== "denied" && (
            <div className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-accent-line bg-accent-soft px-4 py-3">
              <BellRing className="size-4 text-accent" />
              <span className="flex-1 text-[13px]">Get desktop notifications for meetings, new email and Drive edits, even when Paper Tech is in the background.</span>
              <Button
                size="sm"
                onClick={async () => {
                  const p = await requestDesktop()
                  setPerm(p)
                  if (p === "granted") {
                    update((d) => void (d.prefs.gAlerts.desktop = true))
                    toast("Desktop notifications are on")
                  } else toast("Notifications are blocked in this browser. You can allow them in site settings.", "error")
                }}
              >
                Turn on
              </Button>
            </div>
          )}

          <div className="mt-8 grid gap-5 lg:grid-cols-[1.15fr_1fr]">
            {google.has("calendar") ? (
              <Panel icon={<CalendarDays />} title="Agenda" action={<span className="text-[12px] text-muted">Next 36 hours</span>}>
                <Agenda events={google.events} onAsk={(q) => ask(q)} />
              </Panel>
            ) : (
              <Missing icon={<CalendarDays />} name="Google Calendar" />
            )}
            <div className="grid min-w-0 gap-5">
              {google.has("gmail") ? (
                <Panel icon={<Mail />} title={<>Inbox <span className="text-muted">{google.mail.unread} unread</span></>} action={<a href="https://mail.google.com/" target="_blank" rel="noreferrer" className="text-[12px] text-accent hover:underline">Gmail ↗</a>}>
                  <Inbox messages={google.mail.messages.slice(0, 6)} onAsk={(q) => ask(q, "Email reply")} />
                </Panel>
              ) : (
                <Missing icon={<Mail />} name="Gmail" />
              )}
              {google.has("drive") ? (
                <Panel
                  icon={<FolderOpen />}
                  title="Recently changed in Drive"
                  action={
                    <Button variant="secondary" size="sm" icon={<Plus className="size-3.5" />} onClick={() => setDrive(true)}>
                      Add to project
                    </Button>
                  }
                >
                  <ul className="divide-y divide-line-soft">
                    {google.files.slice(0, 5).map((f) => (
                      <li key={f.id} className="flex items-center gap-3 px-5 py-3">
                        <GoogleG className="size-3.5 shrink-0 opacity-70" />
                        <span className="min-w-0 flex-1">
                          <a href={f.url} target="_blank" rel="noreferrer" className="block truncate text-[13.5px] hover:text-accent">
                            {f.name}
                          </a>
                          <span className="block text-[11.5px] text-muted">
                            {driveLabel(f.mimeType)} · {f.modifiedByMe ? "You" : f.modifiedBy || "Someone"} edited {timeAgo(Date.parse(f.modifiedTime))}
                          </span>
                        </span>
                      </li>
                    ))}
                    {google.files.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-muted">No recent files.</li>}
                  </ul>
                </Panel>
              ) : (
                <Missing icon={<FolderOpen />} name="Google Drive" />
              )}
            </div>
          </div>
          <p className="mt-6 text-[12px] text-faint">
            Paper Tech checks for changes every {st.sample ? "15 seconds" : "2 minutes"} while it's open.{" "}
            <a href="#/app/settings/notifications" className="text-accent hover:underline">
              Notification settings
            </a>
          </p>
        </>
      )}
      <DriveImport open={drive} onClose={() => setDrive(false)} />
    </div>
  )
}

function Missing({ icon, name }: { icon: React.ReactNode; name: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line px-6 py-10 text-center [&_svg]:size-5 [&_svg]:text-muted">
      {icon}
      <p className="mt-2 text-[13.5px] font-medium">{name} isn't connected</p>
      <a href="#/app/settings/integrations" className="mt-1 text-[12.5px] text-accent hover:underline">
        Add it in Integrations →
      </a>
    </div>
  )
}
