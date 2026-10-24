import { useEffect, useState } from "react"
import {
  ArrowUpRight,
  Bell,
  Check,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Plug,
  RefreshCw,
  Settings2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Trash2,
  User,
  Users,
  Building2,
  Cpu,
} from "lucide-react"
import { Avatar, Badge, Button, Field, Input, Menu, MenuItem, Modal, Segmented, Spinner, Toggle } from "../../components/ui"
import { useStore } from "../../lib/store"
import { navigate } from "../../lib/router"
import { planById, priceLabel } from "../../lib/plans"
import { MODELS } from "../../lib/models"
import { resolveMode, serverAI, testConnection, type AIMode, type ServerAI } from "../../lib/ai"
import { localModel, useLocalStatus } from "../../lib/local"
import { LocalModelSettings } from "../../components/LocalAI"
import type { Member, Theme } from "../../lib/types"
import { cx, download, isEmail, sha256, slugify, uid } from "../../lib/utils"
import { toast } from "../../components/toast"
import { storageLimitBytes, storageUsed } from "../../lib/upload"
import { bytes } from "../../lib/utils"
import GoogleConnect from "../../components/GoogleConnect"
import { useGoogle } from "../../components/GoogleProvider"
import { desktopPermission, requestDesktop, showDesktop } from "../../lib/notify"

const NAV = [
  { group: "Personal", items: [["account", "Account & usage", User], ["preferences", "Preferences", SlidersHorizontal], ["notifications", "Notifications", Bell], ["privacy", "Privacy & security", Shield]] },
  { group: "Workspace", items: [["workspace", "General", Building2], ["members", "Members", Users], ["billing", "Plans & billing", CreditCard], ["integrations", "Integrations", Plug], ["ai", "AI models", Cpu]] },
] as const

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rise">
      <h1 className="display text-[30px] font-semibold md:text-[34px]">{title}</h1>
      {sub && <p className="mt-2 text-[15px] text-muted">{sub}</p>}
      <div className="mt-8 space-y-6">{children}</div>
    </div>
  )
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cx("rounded-2xl border border-line bg-surface p-5 md:p-6", className)}>{children}</div>
}

function Row({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-[14px]">{title}</p>
        {sub && <p className="mt-0.5 text-[12.5px] text-muted">{sub}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function UsageChart() {
  const { state } = useStore()
  const now = new Date()
  const days = now.getDate()
  const vals = Array.from({ length: days }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), i + 1).toLocaleDateString("en-CA")
    return state.usage[d] ?? 0
  })
  const max = Math.max(4, ...vals)
  return (
    <div>
      <div className="flex h-[84px] items-end gap-[3px]">
        {vals.map((v, i) => (
          <div key={i} className="group relative flex-1">
            <div className={cx("w-full rounded-t-[3px] transition-colors", i === days - 1 ? "bg-accent" : "bg-accent/25 group-hover:bg-accent/50")} style={{ height: `${Math.max(3, (v / max) * 84)}px` }} />
            <span className="pointer-events-none absolute -top-7 left-1/2 hidden -translate-x-1/2 rounded bg-ink px-1.5 py-0.5 text-[10.5px] whitespace-nowrap text-canvas group-hover:block">
              {v} msg{v === 1 ? "" : "s"}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] text-faint uppercase">
        <span>{new Date(now.getFullYear(), now.getMonth(), 1).toLocaleDateString(undefined, { month: "short", day: "2-digit" })}</span>
        <span>Today</span>
      </div>
    </div>
  )
}

function Account() {
  const { state, update, user, usedThisMonth, limit, signOut } = useStore()
  const ws = state.workspace!
  const plan = planById(ws.plan)
  const [edit, setEdit] = useState(false)
  const [name, setName] = useState(user?.name ?? "")
  const [email, setEmail] = useState(user?.email ?? "")
  const me = ws.members.find((m) => m.id === user?.id)
  const pct = Math.min(100, (usedThisMonth / limit) * 100)
  const seats = ws.members.length
  const resets = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1)
  const price = plan.monthly === null ? null : ws.billing === "yearly" ? plan.yearly : plan.monthly
  const invoice = price ? price * (plan.perSeat ? seats : 1) : 0

  return (
    <Section title="Account & usage" sub="Your profile, your plan, and room to keep thinking.">
      <Panel>
        <div className="flex flex-wrap items-center gap-4">
          <Avatar name={user!.name} size={52} />
          <div className="min-w-0 flex-1">
            <p className="text-[17px] font-medium">{user!.name}</p>
            <p className="text-[13px] text-muted">
              Workspace {me?.role.toLowerCase() ?? "member"} · {ws.name}
            </p>
          </div>
          <Button variant="secondary" onClick={() => (setName(user!.name), setEmail(user!.email), setEdit(true))}>
            Edit profile
          </Button>
        </div>
        <div className="mt-5 grid gap-4 border-t border-line-soft pt-5 sm:grid-cols-2">
          <div>
            <p className="text-[12px] text-muted">Email address</p>
            <p className="mt-1 flex items-center gap-2 text-[14px]">
              {user!.email} <Badge tone="success">Primary</Badge>
            </p>
          </div>
          <div>
            <p className="text-[12px] text-muted">Sign-in method</p>
            <p className="mt-1 text-[14px]">Email & password</p>
          </div>
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Panel>
          <div className="flex items-center justify-between">
            <p className="text-[15px] font-medium">Your usage</p>
            <span className="text-[12px] text-muted">{new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" })}</span>
          </div>
          <div className="mt-4 flex flex-wrap items-end justify-between gap-3">
            <div>
              <p>
                <span className="display text-[34px] font-semibold">{usedThisMonth.toLocaleString()}</span>
                <span className="ml-1 text-[13px] text-muted">/ {limit.toLocaleString()} messages</span>
              </p>
              <p className="text-[12.5px] text-muted">{Math.round(pct)}% of your monthly allowance</p>
            </div>
            <Badge tone={pct > 85 ? "warn" : "success"}>{pct > 85 ? "Running low" : "Plenty of room"}</Badge>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-line-soft">
            <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(1, pct)}%` }} />
          </div>
          <div className="mt-6">
            <UsageChart />
          </div>
          <p className="mt-4 flex items-center gap-2 text-[12px] text-muted">
            <RefreshCw className="size-3.5" /> Resets {resets.toLocaleDateString(undefined, { month: "long", day: "numeric" })} · {bytes(storageUsed(state.files))} of {plan.storage} storage used
          </p>
        </Panel>

        <div className="flex flex-col rounded-2xl bg-navy p-6 text-white">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10.5px] tracking-wide text-white/60 uppercase">Your plan</span>
            <span className="flex items-center gap-1.5 text-[11.5px] text-white/80">
              <span className="size-1.5 rounded-full bg-[#7cc4a0]" />
              {ws.trialEndsAt && ws.trialEndsAt > Date.now() ? "Trial" : "Active"}
            </span>
          </div>
          <p className="mt-4 text-[26px] font-semibold tracking-[-0.02em]">Paper Tech {plan.name}</p>
          <p className="text-[13px] text-white/70">
            {price === null ? "Custom pricing" : price === 0 ? "Free forever" : `$${price}${plan.perSeat ? " / member" : ""} / month`}
          </p>
          <ul className="mt-5 space-y-2.5 text-[13px] text-white/90">
            {plan.perSeat && (
              <li className="flex gap-2">
                <Check className="size-4 text-white/60" /> {seats} of {plan.seats >= 999 ? "unlimited" : plan.seats} seats in use
              </li>
            )}
            {plan.features.slice(plan.perSeat ? 1 : 0, 4).map((f) => (
              <li key={f} className="flex gap-2">
                <Check className="size-4 text-white/60" /> {f}
              </li>
            ))}
          </ul>
          <Button variant="secondary" className="mt-6 self-start border-0 bg-white! text-[#242723]!" icon={<ArrowUpRight className="size-4" />} onClick={() => navigate("/app/plans")}>
            Manage plan
          </Button>
          <p className="mt-4 text-[12px] text-white/60">
            {invoice > 0
              ? ws.trialEndsAt && ws.trialEndsAt > Date.now()
                ? `Trial ends ${new Date(ws.trialEndsAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · then $${invoice.toFixed(2)}/mo`
                : `Next invoice: $${invoice.toFixed(2)} on ${resets.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
              : "No payment needed."}
          </p>
        </div>
      </div>

      <Panel>
        <p className="text-[15px] font-medium">Make yourself at home</p>
        <div className="mt-5 grid gap-6 md:grid-cols-2">
          <div>
            <p className="mb-2 text-[12.5px] text-muted">Appearance</p>
            <Segmented
              className="w-full"
              value={state.prefs.theme}
              onChange={(v: Theme) => update((d) => void (d.prefs.theme = v))}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
            />
          </div>
          <Row title="Weekly workspace digest" sub="A little perspective on what your team has been creating.">
            <Toggle checked={state.prefs.digest} onChange={(v) => update((d) => void (d.prefs.digest = v))} label="Weekly digest" />
          </Row>
        </div>
      </Panel>

      <div className="flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-muted">
        <span className="flex items-center gap-2">
          <ShieldCheck className="size-4" /> Your content is never used to train AI models.
        </span>
        <button
          className="hover:text-ink"
          onClick={() => {
            signOut()
            navigate("/")
          }}
        >
          Sign out ↗
        </button>
      </div>

      <Modal
        open={edit}
        onClose={() => setEdit(false)}
        title="Edit profile"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEdit(false)}>
              Cancel
            </Button>
            <Button
              disabled={name.trim().length < 2 || !isEmail(email)}
              onClick={() => {
                const e = email.trim().toLowerCase()
                if (e !== user!.email && state.accounts.some((a) => a.email === e)) return toast("That email is already in use", "error")
                update((d) => {
                  const a = d.accounts.find((x) => x.id === user!.id)!
                  a.name = name.trim()
                  a.email = e
                  const m = d.workspace?.members.find((x) => x.id === user!.id)
                  if (m) Object.assign(m, { name: name.trim(), email: e })
                })
                setEdit(false)
                toast("Profile updated")
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Field label="Full name" htmlFor="pn">
            <Input id="pn" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Email" htmlFor="pe" hint="Changing your email also changes how you sign in.">
            <Input id="pe" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
        </div>
      </Modal>
    </Section>
  )
}

function Preferences() {
  const { state, update } = useStore()
  return (
    <Section title="Preferences" sub="How Paper Tech looks and behaves for you.">
      <Panel>
        <div className="divide-y divide-line-soft">
          <Row title="Appearance" sub="Light, dark, or follow your system.">
            <Segmented
              value={state.prefs.theme}
              onChange={(v: Theme) => update((d) => void (d.prefs.theme = v))}
              options={[
                { value: "light", label: "Light" },
                { value: "dark", label: "Dark" },
                { value: "system", label: "System" },
              ]}
            />
          </Row>
          <Row title="Default Claude model" sub="Used when Claude answers (your own key or a Claude server key).">
            <select value={state.prefs.defaultModel} onChange={(e) => update((d) => void (d.prefs.defaultModel = e.target.value))} className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px]">
              {MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </Row>
          <Row title="Press Enter to send" sub="When off, use ⌘/Ctrl + Enter to send and Enter for a new line.">
            <Toggle checked={state.prefs.enterToSend} onChange={(v) => update((d) => void (d.prefs.enterToSend = v))} label="Enter to send" />
          </Row>
        </div>
      </Panel>
    </Section>
  )
}

function Notifications() {
  const { state, update } = useStore()
  const items = [
    ["notifyMentions", "Mentions & replies", "When someone mentions you or replies to your conversation."],
    ["notifyUploads", "New knowledge", "When teammates add sources to projects you follow."],
    ["digest", "Weekly digest", "A summary of your workspace every Monday."],
    ["notifyProduct", "Product news", "Occasional updates about new Paper Tech features."],
  ] as const
  const google = useGoogle()
  const a = state.prefs.gAlerts
  const [perm, setPerm] = useState(desktopPermission())
  const setA = <K extends keyof typeof a>(k: K, v: (typeof a)[K]) => update((d) => void (d.prefs.gAlerts[k] = v))
  return (
    <Section title="Notifications" sub="Choose what's worth your attention.">
      <Panel>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[15px] font-medium">Google Workspace alerts</p>
            <p className="mt-0.5 text-[12.5px] text-muted">
              {google.status?.connected ? (google.status.sample ? "Using sample data." : `Watching ${google.status.email}.`) : "Connect Google to get meeting, email and Drive alerts."}
            </p>
          </div>
          {!google.status?.connected && (
            <Button size="sm" variant="secondary" onClick={() => navigate("/app/settings/integrations")}>
              Connect Google
            </Button>
          )}
        </div>
        <div className={cx("mt-4 divide-y divide-line-soft border-t border-line-soft pt-4", !google.status?.connected && "pointer-events-none opacity-50")}>
          <Row title="Meeting reminders" sub="A heads-up before each event on your Google Calendar.">
            <div className="flex items-center gap-3">
              <select value={a.lead} onChange={(e) => setA("lead", Number(e.target.value))} className="h-8 rounded-md border border-line bg-surface px-2 text-[12.5px]" aria-label="Reminder lead time">
                {[1, 5, 10, 15, 30].map((m) => (
                  <option key={m} value={m}>
                    {m} min before
                  </option>
                ))}
              </select>
              <Toggle checked={a.meetings} onChange={(v) => setA("meetings", v)} label="Meeting reminders" />
            </div>
          </Row>
          <Row title="New email" sub={a.importantOnly ? "Only email Gmail marks as important." : "Unread email in your Primary inbox."}>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-[12px] text-muted">
                <input type="checkbox" checked={a.importantOnly} onChange={(e) => setA("importantOnly", e.target.checked)} className="accent-[var(--accent)]" /> Important only
              </label>
              <Toggle checked={a.email} onChange={(v) => setA("email", v)} label="New email alerts" />
            </div>
          </Row>
          <Row title="Drive edits" sub="When someone else edits a file you have access to.">
            <Toggle checked={a.drive} onChange={(v) => setA("drive", v)} label="Drive edit alerts" />
          </Row>
          <Row title="Quiet hours" sub="No pop-ups between 10 pm and 8 am. Alerts still collect in the bell.">
            <Toggle checked={a.quiet} onChange={(v) => setA("quiet", v)} label="Quiet hours" />
          </Row>
        </div>
      </Panel>

      <Panel>
        <Row
          title="Desktop notifications"
          sub={
            perm === "unsupported"
              ? "This browser doesn't support system notifications. On iPhone, add Paper Tech to your Home Screen first."
              : perm === "denied"
                ? "Blocked by your browser. Allow notifications for this site in your browser's site settings."
                : "Show alerts as system notifications when Paper Tech is in the background. Install Paper Tech as an app for the best experience."
          }
        >
          <div className="flex items-center gap-2">
            {a.desktop && perm === "granted" && (
              <Button variant="ghost" size="sm" onClick={async () => (await showDesktop("Paper Tech test notification", "Notifications are working.", { href: "#/app/today" })) || toast("Couldn't show a notification here.", "error")}>
                Send test
              </Button>
            )}
            <Toggle
              checked={a.desktop && perm === "granted"}
              disabled={perm === "unsupported" || perm === "denied"}
              label="Desktop notifications"
              onChange={async (v) => {
                if (!v) return setA("desktop", false)
                const p = await requestDesktop()
                setPerm(p)
                if (p === "granted") {
                  setA("desktop", true)
                  toast("Desktop notifications are on")
                } else toast("Notifications weren't allowed.", "error")
              }}
            />
          </div>
        </Row>
      </Panel>

      <Panel>
        <p className="mb-2 text-[15px] font-medium">Workspace & email</p>
        <div className="divide-y divide-line-soft">
          {items.map(([k, t, s]) => (
            <Row key={k} title={t} sub={s}>
              <Toggle checked={state.prefs[k]} onChange={(v) => update((d) => void (d.prefs[k] = v))} label={t} />
            </Row>
          ))}
        </div>
      </Panel>
    </Section>
  )
}

function Privacy() {
  const { state, update, user, resetAll } = useStore()
  const [pw, setPw] = useState({ open: false, cur: "", next: "" })
  const [wipe, setWipe] = useState(false)
  return (
    <Section title="Privacy & security" sub="You're in control of your data.">
      <Panel>
        <div className="divide-y divide-line-soft">
          <Row title="Password" sub="Change the password you use to sign in.">
            <Button variant="secondary" size="sm" icon={<KeyRound className="size-4" />} onClick={() => setPw({ open: true, cur: "", next: "" })}>
              Change password
            </Button>
          </Row>
          <Row title="Export your data" sub="Download everything in your workspace as JSON.">
            <Button
              variant="secondary"
              size="sm"
              icon={<Download className="size-4" />}
              onClick={() => {
                const { accounts, ...rest } = state
                download(`papertech-export-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify({ ...rest, accounts: accounts.map(({ passwordHash, ...a }) => (void passwordHash, a)), prefs: { ...rest.prefs, apiKey: rest.prefs.apiKey ? "•••" : "" } }, null, 2), "application/json")
                toast("Export downloaded")
              }}
            >
              Export
            </Button>
          </Row>
          <Row title="Model training" sub="Your content is never used to train AI models. This can't be turned on.">
            <Badge tone="success">
              <ShieldCheck className="size-3" /> Protected
            </Badge>
          </Row>
        </div>
      </Panel>
      <Panel className="border-danger/30">
        <Row title="Delete all data on this device" sub="Removes accounts, workspace, files and conversations stored in this browser.">
          <Button variant="danger" size="sm" icon={<Trash2 className="size-4" />} onClick={() => setWipe(true)}>
            Delete everything
          </Button>
        </Row>
      </Panel>
      <Modal
        open={pw.open}
        onClose={() => setPw((p) => ({ ...p, open: false }))}
        title="Change password"
        footer={
          <Button
            disabled={pw.next.length < 8}
            onClick={async () => {
              if ((await sha256(user!.email + ":" + pw.cur)) !== user!.passwordHash) return toast("Current password is incorrect", "error")
              const h = await sha256(user!.email + ":" + pw.next)
              update((d) => void (d.accounts.find((a) => a.id === user!.id)!.passwordHash = h))
              setPw({ open: false, cur: "", next: "" })
              toast("Password changed")
            }}
          >
            Update password
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Current password" htmlFor="cp">
            <Input id="cp" type="password" value={pw.cur} onChange={(e) => setPw((p) => ({ ...p, cur: e.target.value }))} />
          </Field>
          <Field label="New password" htmlFor="np" hint="At least 8 characters.">
            <Input id="np" type="password" value={pw.next} onChange={(e) => setPw((p) => ({ ...p, next: e.target.value }))} />
          </Field>
        </div>
      </Modal>
      <Modal
        open={wipe}
        onClose={() => setWipe(false)}
        title="Delete everything?"
        description="This permanently removes all Paper Tech data from this browser."
        footer={
          <>
            <Button variant="secondary" onClick={() => setWipe(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                resetAll()
                navigate("/")
                toast("All data deleted")
              }}
            >
              Delete everything
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-muted">Consider exporting first. This can't be undone.</p>
      </Modal>
    </Section>
  )
}

function Workspace() {
  const { state, update } = useStore()
  const ws = state.workspace!
  const [name, setName] = useState(ws.name)
  return (
    <Section title="Workspace" sub="The basics of your shared space.">
      <Panel>
        <div className="space-y-5">
          <Field label="Workspace name" htmlFor="wn" hint={<span className="font-mono">papertech.ai / {slugify(name)}</span>}>
            <Input id="wn" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Team size" htmlFor="wsz">
            <select id="wsz" value={ws.teamSize} onChange={(e) => update((d) => void (d.workspace!.teamSize = e.target.value))} className="h-11 rounded-lg border border-line bg-surface px-3 text-[14px]">
              {["Just me", "2–10 people", "11–50 people", "51–200 people", "200+ people"].map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <div>
            <p className="mb-2 text-[13px] font-medium">Used for</p>
            <div className="flex flex-wrap gap-2">
              {["Research", "Writing", "Ideation"].map((u) => {
                const on = ws.uses.includes(u)
                return (
                  <button key={u} onClick={() => update((d) => void (d.workspace!.uses = on ? d.workspace!.uses.filter((x) => x !== u) : [...d.workspace!.uses, u]))} className={cx("rounded-lg border px-3 py-1.5 text-[13px]", on ? "border-accent-line bg-accent-soft text-accent" : "border-line text-muted")}>
                    {on && "✓ "}
                    {u}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              disabled={name.trim().length < 2 || name === ws.name}
              onClick={() => {
                update((d) => void Object.assign(d.workspace!, { name: name.trim(), slug: slugify(name) }))
                toast("Workspace updated")
              }}
            >
              Save changes
            </Button>
          </div>
        </div>
      </Panel>
    </Section>
  )
}

function Members() {
  const { state, update, user } = useStore()
  const ws = state.workspace!
  const plan = planById(ws.plan)
  const [invite, setInvite] = useState(false)
  const [emails, setEmails] = useState("")
  const [role, setRole] = useState<Member["role"]>("Member")
  const meOwner = ws.members.find((m) => m.id === user?.id)?.role !== "Member"
  const seatLimit = plan.id === "free" || plan.id === "pro" ? 1 : plan.seats
  return (
    <Section title="Members" sub={`${ws.members.length} ${ws.members.length === 1 ? "person" : "people"} in ${ws.name}.`}>
      {seatLimit === 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-accent-line bg-accent-soft px-5 py-4 text-[13.5px]">
          <span>Shared workspaces are part of the Team plan.</span>
          <Button size="sm" onClick={() => navigate("/app/plans")}>
            See Team
          </Button>
        </div>
      )}
      <Panel className="p-0! md:p-0!">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-4 md:px-6">
          <p className="text-[13px] text-muted">
            {ws.members.length} of {seatLimit >= 999 ? "unlimited" : seatLimit} seats
          </p>
          <Button size="sm" icon={<Users className="size-4" />} onClick={() => setInvite(true)} disabled={!meOwner}>
            Invite people
          </Button>
        </div>
        <ul className="divide-y divide-line-soft">
          {ws.members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center gap-3 px-5 py-3.5 md:px-6">
              <Avatar name={m.name} size={34} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px]">
                  {m.name} {m.id === user?.id && <span className="text-muted">(you)</span>}
                </p>
                <p className="truncate text-[12px] text-muted">{m.email}</p>
              </div>
              {m.status === "invited" && <Badge tone="accent">Invited</Badge>}
              {m.role === "Owner" ? (
                <span className="w-[110px] text-right text-[13px] text-muted">Owner</span>
              ) : (
                <Menu
                  width={180}
                  trigger={() => (
                    <button className="w-[110px] rounded-md px-2 py-1 text-right text-[13px] text-muted hover:bg-sunken hover:text-ink" disabled={!meOwner}>
                      {m.role} ▾
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      {(["Admin", "Member"] as const).map((r) => (
                        <MenuItem key={r} active={m.role === r} onClick={() => (close(), update((d) => void (d.workspace!.members.find((x) => x.id === m.id)!.role = r)))}>
                          {r}
                        </MenuItem>
                      ))}
                      {m.status === "invited" && (
                        <MenuItem onClick={() => (close(), toast(`Invite re-sent to ${m.email}`))}>Resend invite</MenuItem>
                      )}
                      <div className="my-1 h-px bg-line-soft" />
                      <MenuItem danger onClick={() => (close(), update((d) => void (d.workspace!.members = d.workspace!.members.filter((x) => x.id !== m.id))), toast(`Removed ${m.name}`))}>
                        Remove from workspace
                      </MenuItem>
                    </>
                  )}
                </Menu>
              )}
            </li>
          ))}
        </ul>
      </Panel>
      <Modal
        open={invite}
        onClose={() => setInvite(false)}
        title="Invite people"
        description="They'll get an email with a link to join."
        footer={
          <Button
            onClick={() => {
              const list = emails.split(/[,\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)
              const bad = list.find((e) => !isEmail(e))
              if (!list.length || bad) return toast(bad ? `"${bad}" isn't a valid email` : "Add at least one email", "error")
              const fresh = list.filter((e) => !ws.members.some((m) => m.email === e))
              if (ws.members.length + fresh.length > seatLimit) return toast(`Your plan includes ${seatLimit} seat${seatLimit === 1 ? "" : "s"}. Upgrade to add more.`, "error")
              update((d) => void d.workspace!.members.push(...fresh.map((e) => ({ id: uid("m-"), name: e.split("@")[0], email: e, role, status: "invited" as const }))))
              setInvite(false)
              setEmails("")
              toast(`Invited ${fresh.length} ${fresh.length === 1 ? "person" : "people"}`)
            }}
          >
            Send invites
          </Button>
        }
      >
        <div className="space-y-4">
          <Field label="Emails" htmlFor="ie" hint="Separate several with commas.">
            <Input id="ie" value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="jonah@studionorth.design, alex@…" />
          </Field>
          <Field label="Role" htmlFor="ir">
            <Segmented value={role} onChange={setRole} options={[{ value: "Member", label: "Member" }, { value: "Admin", label: "Admin" }]} />
          </Field>
        </div>
      </Modal>
    </Section>
  )
}

function Billing() {
  const { state, update, choosePlan } = useStore()
  const ws = state.workspace!
  const plan = planById(ws.plan)
  const seats = ws.members.length
  const trial = ws.trialEndsAt && ws.trialEndsAt > Date.now()
  const price = ws.billing === "yearly" ? plan.yearly : plan.monthly
  const total = (price ?? 0) * (plan.perSeat ? seats : 1)
  const [cancel, setCancel] = useState(false)
  return (
    <Section title="Plans & billing" sub="Your plan, payment details and invoices.">
      <Panel>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[12px] text-muted">Current plan</p>
            <p className="mt-1 flex items-center gap-2 text-[22px] font-semibold tracking-[-0.02em]">
              Paper Tech {plan.name} {trial && <Badge tone="accent">Trial · {Math.ceil((ws.trialEndsAt! - Date.now()) / 864e5)} days left</Badge>}
            </p>
            <p className="mt-1 text-[13.5px] text-muted">
              {plan.monthly === 0 ? "Free forever." : plan.monthly === null ? "Custom agreement." : `${priceLabel(plan, ws.billing)}${plan.perSeat ? ` × ${seats} member${seats === 1 ? "" : "s"}` : ""} = $${total}/month, billed ${ws.billing}.`}
            </p>
          </div>
          <div className="flex gap-2">
            {plan.id !== "free" && (
              <Button variant="secondary" onClick={() => setCancel(true)}>
                Cancel plan
              </Button>
            )}
            <Button onClick={() => navigate("/app/plans")}>{plan.id === "free" ? "Upgrade" : "Change plan"}</Button>
          </div>
        </div>
        {plan.monthly !== 0 && plan.monthly !== null && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-line-soft pt-5">
            <p className="text-[13.5px]">Billing cycle</p>
            <Segmented
              value={ws.billing}
              onChange={(b) => {
                update((d) => void (d.workspace!.billing = b))
                toast(b === "yearly" ? "Switched to yearly billing — you save about 15%." : "Switched to monthly billing.")
              }}
              options={[
                { value: "monthly", label: "Monthly" },
                { value: "yearly", label: "Yearly · save 15%" },
              ]}
            />
          </div>
        )}
      </Panel>
      <Panel>
        <Row title="Payment method" sub={plan.monthly ? "Add a card before your trial ends to keep your plan." : "No payment needed on the Free plan."}>
          <Button variant="secondary" size="sm" icon={<CreditCard className="size-4" />} onClick={() => toast("Payments aren't connected yet. Add your Stripe keys to switch on checkout — see the README.", "info")}>
            Add payment method
          </Button>
        </Row>
      </Panel>
      <Panel>
        <p className="text-[15px] font-medium">Invoices</p>
        <p className="mt-3 rounded-lg bg-sunken px-4 py-6 text-center text-[13px] text-muted">
          {trial ? `No invoices yet. Your first one is due ${new Date(ws.trialEndsAt!).toLocaleDateString(undefined, { month: "long", day: "numeric" })}.` : "No invoices yet."}
        </p>
      </Panel>
      <Panel>
        <p className="text-[15px] font-medium">Storage</p>
        <div className="mt-3 flex justify-between text-[13px] text-muted">
          <span>{bytes(storageUsed(state.files))} used</span>
          <span>{plan.storage}</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft">
          <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (storageUsed(state.files) / storageLimitBytes(ws.plan)) * 100) || 1}%` }} />
        </div>
      </Panel>
      <Modal
        open={cancel}
        onClose={() => setCancel(false)}
        title={`Cancel Paper Tech ${plan.name}?`}
        description="You'll move to the Free plan. Your projects and conversations stay."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCancel(false)}>
              Keep {plan.name}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                choosePlan("free", ws.billing)
                update((d) => void (d.workspace!.trialEndsAt = undefined))
                setCancel(false)
                toast("You're on the Free plan now.")
              }}
            >
              Move to Free
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-muted">Free includes 100 messages a month, 2 projects and 500 MB of storage.</p>
      </Modal>
    </Section>
  )
}

function Integrations() {
  const { state, update } = useStore()
  const list = [
    ["notion", "Notion", "Bring pages and databases into projects."],
    ["slack", "Slack", "Ask Paper Tech from any channel and share answers."],
    ["github", "GitHub", "Ground answers in issues and READMEs."],
    ["confluence", "Confluence", "Search your team's wiki."],
    ["dropbox", "Dropbox", "Keep folders in sync with a project."],
  ]
  return (
    <Section title="Integrations" sub="Give Paper Tech the full picture.">
      <GoogleConnect ret="/app/settings/integrations" />
      <p className="pt-2 text-[13px] font-medium text-muted">More connectors are on the way</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {list.map(([k, n, d]) => {
          const on = Boolean(state.prefs.integrations[k])
          return (
            <Panel key={k} className="flex flex-col">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-lg bg-sunken text-[15px] font-semibold text-muted">{n[0]}</span>
                <div className="flex-1">
                  <p className="text-[14px] font-medium">{n}</p>
                  <Badge>Coming soon</Badge>
                </div>
              </div>
              <p className="mt-3 flex-1 text-[13px] text-muted">{d}</p>
              <Button
                variant={on ? "secondary" : "ghost"}
                size="sm"
                className="mt-4 self-start border border-line"
                icon={on ? <Check className="size-4 text-success" /> : <Bell className="size-4" />}
                onClick={() => {
                  update((dd) => void (dd.prefs.integrations[k] = !on))
                  toast(on ? `You won't be notified about ${n}` : `We'll let you know when ${n} is ready`)
                }}
              >
                {on ? "You'll be notified" : "Notify me"}
              </Button>
            </Panel>
          )
        })}
      </div>
    </Section>
  )
}

function AIConnection() {
  const { state, update } = useStore()
  const [mode, setMode] = useState<AIMode | null>(null)
  const [server, setServer] = useState<ServerAI | null>(null)
  const [key, setKey] = useState(state.prefs.apiKey)
  const [show, setShow] = useState(false)
  const [testing, setTesting] = useState(false)
  const local = useLocalStatus()
  useEffect(() => {
    resolveMode(state.prefs.apiKey).then(setMode)
    serverAI(true).then(setServer)
  }, [state.prefs.apiKey, state.prefs.localAI, state.prefs.localModel, local.phase])

  async function test() {
    setTesting(true)
    try {
      const r = await testConnection(key || undefined, "claude-haiku-5-5")
      toast(r.mode === "demo" ? "No AI found — running in demo mode." : `Connected via ${r.mode === "device" ? "on-device AI" : r.mode === "server" ? "your server" : "your API key"}: “${r.text}”`, r.mode === "demo" ? "info" : "success")
    } catch (e) {
      toast(`Connection failed: ${(e as Error).message}`, "error")
    }
    setTesting(false)
  }

  return (
    <Section title="AI" sub="Paper Tech AI runs an open model right on your device. Cloud AI is an optional backup.">
      <Panel>
        <div className="flex items-center gap-4">
          <span className={cx("grid size-11 place-items-center rounded-xl", mode === "demo" ? "bg-warn-soft text-warn" : "bg-success-soft text-success")}>{mode === null ? <Spinner /> : <Cpu className="size-5" />}</span>
          <div>
            <p className="text-[15px] font-medium">
              {mode === "device"
                ? `On-device · ${localModel(state.prefs.localModel).name}`
                : mode === "server"
                  ? `Cloud backup through your server${server?.label ? ` · ${server.label}` : ""}`
                  : mode === "browser"
                    ? "Claude with your API key"
                    : mode === "demo"
                      ? "Demo mode"
                      : "Checking…"}
            </p>
            <p className="text-[13px] text-muted">
              {mode === "device"
                ? "Answers are generated on this computer. Nothing you type is sent anywhere."
                : mode === "server"
                  ? "Requests go through /api/chat. Your key stays on the server."
                  : mode === "browser"
                    ? "Requests go straight from this browser to Anthropic."
                    : "Answers come from a built-in demo engine that reads your files but isn't a real model."}
            </p>
          </div>
        </div>
      </Panel>

      <Panel>
        <LocalModelSettings />
      </Panel>

      <Panel>
        <p className="text-[15px] font-medium">Cloud backup (optional)</p>
        <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
          Used only on devices that can't run AI locally. Set <code className="rounded bg-sunken px-1 font-mono text-[12px]">LLM_API_KEY</code> on your host to a free Groq key (console.groq.com) for Meta's Llama 3.3 70B, or <code className="rounded bg-sunken px-1 font-mono text-[12px]">ANTHROPIC_API_KEY</code> for Claude. Nobody using the app sees the key.
        </p>
        <p className="mt-3 text-[13px]">
          Server status: {server === null ? "checking…" : server.ai ? <span className="text-success">✓ connected{server.label ? ` · ${server.label}` : ""}</span> : <span className="text-muted">not configured (or the app is running without its server)</span>}
        </p>
      </Panel>

      <Panel>
        <p className="text-[15px] font-medium">Use Claude with your own API key</p>
        <p className="mt-2 text-[13.5px] text-muted">
          Overrides on-device AI. The key is stored only in this browser. Get one at{" "}
          <a className="text-accent hover:underline" href="https://console.anthropic.com/" target="_blank" rel="noreferrer">
            console.anthropic.com
          </a>
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Input
            className="min-w-[240px] flex-1"
            type={show ? "text" : "password"}
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-…"
            leading={<KeyRound className="size-4 text-faint" />}
            trailing={
              <button type="button" onClick={() => setShow((s) => !s)} className="text-faint hover:text-ink" aria-label={show ? "Hide key" : "Show key"}>
                {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            }
          />
          <Button
            disabled={key === state.prefs.apiKey}
            onClick={() => {
              update((d) => void (d.prefs.apiKey = key.trim()))
              toast(key.trim() ? "API key saved on this device" : "API key removed")
            }}
          >
            Save
          </Button>
          <Button variant="secondary" loading={testing} onClick={test}>
            Test connection
          </Button>
        </div>
        {state.prefs.apiKey && (
          <button className="mt-3 text-[12.5px] text-danger hover:underline" onClick={() => (setKey(""), update((d) => void (d.prefs.apiKey = "")), toast("API key removed"))}>
            Remove saved key
          </button>
        )}
      </Panel>

      <Panel>
        <Row title="Default Claude model" sub="Used when Claude answers (your own key or a Claude server key).">
          <select value={state.prefs.defaultModel} onChange={(e) => update((d) => void (d.prefs.defaultModel = e.target.value))} className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px]">
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </Row>
      </Panel>
    </Section>
  )
}

export default function Settings({ section }: { section: string }) {
  const { state } = useStore()
  const body: Record<string, React.ReactNode> = {
    account: <Account />,
    preferences: <Preferences />,
    notifications: <Notifications />,
    privacy: <Privacy />,
    workspace: <Workspace />,
    members: <Members />,
    billing: <Billing />,
    integrations: <Integrations />,
    ai: <AIConnection />,
  }
  return (
    <div className="mx-auto grid max-w-[1180px] gap-8 px-5 py-8 md:px-10 md:py-12 lg:grid-cols-[200px_1fr]">
      <nav className="lg:sticky lg:top-0 lg:self-start">
        <h2 className="mb-6 hidden items-center gap-2 text-[22px] font-semibold tracking-[-0.02em] lg:flex">
          <Settings2 className="size-5 text-muted" /> Settings
        </h2>
        <div className="flex gap-6 overflow-x-auto pb-2 lg:block lg:space-y-6 lg:overflow-visible">
          {NAV.map((g) => (
            <div key={g.group} className="flex shrink-0 gap-1 lg:block">
              <p className="mb-2 hidden font-mono text-[10.5px] tracking-wide text-faint uppercase lg:block">{g.group === "Workspace" ? state.workspace?.name : g.group}</p>
              {g.items.map(([k, l, I]) => (
                <a
                  key={k}
                  href={`#/app/settings/${k}`}
                  className={cx("flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] whitespace-nowrap", section === k ? "bg-accent-soft text-accent" : "text-muted hover:bg-sunken hover:text-ink")}
                >
                  <I className="size-4" /> {l}
                </a>
              ))}
            </div>
          ))}
        </div>
        <p className="mt-6 hidden font-mono text-[10.5px] text-faint lg:block">Paper Tech web v1.0.0</p>
      </nav>
      <div className="min-w-0">{body[section] ?? body.account}</div>
    </div>
  )
}
