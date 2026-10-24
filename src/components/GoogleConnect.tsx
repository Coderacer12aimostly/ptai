import { useState } from "react"
import { ArrowRight, CalendarDays, Check, FolderOpen, Mail, Plus, RefreshCw } from "lucide-react"
import { Avatar, Badge, Button, Spinner } from "./ui"
import { GoogleG } from "./icons"
import { useGoogle } from "./GoogleProvider"
import { connectUrl, type GService } from "../lib/google"
import { navigate } from "../lib/router"
import { cx, timeAgo } from "../lib/utils"

export const SERVICES: Array<{ id: GService; name: string; blurb: string; icon: typeof Mail }> = [
  { id: "calendar", name: "Google Calendar", blurb: "Meeting reminders and your agenda on the Today page", icon: CalendarDays },
  { id: "gmail", name: "Gmail", blurb: "Alerts for new email and help drafting replies", icon: Mail },
  { id: "drive", name: "Google Drive", blurb: "Import Docs, Sheets and PDFs as project knowledge", icon: FolderOpen },
]

export default function GoogleConnect({ ret = "/app/today", compact = false }: { ret?: string; compact?: boolean }) {
  const google = useGoogle()
  const st = google.status
  const [picked, setPicked] = useState<GService[]>(["calendar", "gmail", "drive"])

  if (!st)
    return (
      <div className="grid h-32 place-items-center rounded-2xl border border-line bg-surface">
        <Spinner />
      </div>
    )

  if (st.connected) {
    const missing = SERVICES.filter((s) => !st.services?.includes(s.id))
    return (
      <div className="rounded-2xl border border-line bg-surface p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-11 place-items-center rounded-xl border border-line bg-canvas">
            <GoogleG className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex flex-wrap items-center gap-2 text-[15px] font-medium">
              Google Workspace {st.sample ? <Badge tone="warn">Sample data</Badge> : <Badge tone="success">Connected</Badge>}
            </p>
            <p className="mt-0.5 flex items-center gap-2 text-[12.5px] text-muted">
              <Avatar name={st.name || st.email || "G"} size={18} />
              {st.sample ? "Using built-in sample calendar, inbox and Drive" : st.email}
            </p>
          </div>
          {!compact && (
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => navigate("/app/today")} iconRight={<ArrowRight className="size-3.5" />}>
                Open Today
              </Button>
              <Button variant="ghost" size="sm" className="text-danger!" onClick={google.disconnect}>
                {st.sample ? "Turn off sample data" : "Disconnect"}
              </Button>
            </div>
          )}
        </div>
        {!compact && (
          <>
            <ul className="mt-5 grid gap-2 sm:grid-cols-3">
              {SERVICES.map((s) => {
                const on = st.services?.includes(s.id)
                return (
                  <li key={s.id} className={cx("flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-[13px]", on ? "border-line bg-canvas" : "border-dashed border-line text-muted")}>
                    <s.icon className="size-4 text-muted" />
                    <span className="flex-1">{s.name}</span>
                    {on ? <Check className="size-4 text-success" /> : <Plus className="size-4" />}
                  </li>
                )
              })}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
              <span className="flex items-center gap-1.5">
                {google.loading ? <Spinner className="size-3.5" /> : <RefreshCw className="size-3.5" />}
                {google.error ? <span className="text-danger">{google.error}</span> : google.lastSync ? `Synced ${timeAgo(google.lastSync)}` : "Syncing…"}
                <button className="ml-1 text-accent hover:underline" onClick={google.refresh}>
                  Sync now
                </button>
              </span>
              {missing.length > 0 && !st.sample && (
                <a className="text-accent hover:underline" href={connectUrl(["calendar", "gmail", "drive"], ret)}>
                  Add {missing.map((m) => m.name.replace("Google ", "")).join(" & ")} →
                </a>
              )}
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-5 md:p-6">
      <div className="flex items-start gap-3">
        <span className="grid size-11 shrink-0 place-items-center rounded-xl border border-line bg-canvas">
          <GoogleG className="size-5" />
        </span>
        <div>
          <p className="text-[15px] font-medium">Link your Google Workspace</p>
          <p className="mt-0.5 text-[13px] text-muted">Paper Tech reminds you before meetings, flags new email, tells you when teammates edit your Drive files, and can brief you on your day.</p>
        </div>
      </div>

      {st.configured ? (
        <>
          <div className="mt-5 space-y-2">
            {SERVICES.map((s) => {
              const on = picked.includes(s.id)
              return (
                <label key={s.id} className={cx("flex cursor-pointer items-center gap-3 rounded-lg border px-3.5 py-3", on ? "border-accent-line bg-accent-soft/50" : "border-line")}>
                  <input type="checkbox" checked={on} onChange={() => setPicked((p) => (on ? p.filter((x) => x !== s.id) : [...p, s.id]))} className="size-4 accent-[var(--accent)]" />
                  <s.icon className="size-4 text-muted" />
                  <span className="flex-1">
                    <span className="block text-[13.5px]">{s.name}</span>
                    <span className="block text-[12px] text-muted">{s.blurb}</span>
                  </span>
                </label>
              )
            })}
          </div>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button disabled={!picked.length} icon={<GoogleG />} variant="secondary" onClick={() => (window.location.href = connectUrl(picked, ret))}>
              Connect with Google
            </Button>
            <button className="text-[12.5px] text-muted hover:text-ink" onClick={google.startSample}>
              or try with sample data
            </button>
          </div>
          <p className="mt-3 text-[11.5px] text-faint">Read-only. Paper Tech never sends email, edits your calendar or changes your files. You can disconnect anytime.</p>
        </>
      ) : (
        <div className="mt-5 rounded-xl bg-sunken p-4">
          <p className="text-[13px] font-medium">Google isn't set up on this server yet</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
            The site owner needs to add a Google OAuth client (<code className="font-mono text-[11.5px]">GOOGLE_CLIENT_ID</code> and <code className="font-mono text-[11.5px]">GOOGLE_CLIENT_SECRET</code>) and run Paper Tech's server. The README walks through it in about 10 minutes.
          </p>
          <Button size="sm" className="mt-4" onClick={google.startSample}>
            Try with sample data
          </Button>
        </div>
      )}
    </div>
  )
}
