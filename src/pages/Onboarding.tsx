import { useState } from "react"
import { ArrowLeft, ArrowRight, Check, CircleCheck, Copy, Lightbulb, PenLine, ScanSearch, X } from "lucide-react"
import { AuthAside, FlowSteps } from "./Auth"
import { Avatar, Button, Field, Input, Logo, Toggle } from "../components/ui"
import { pendingPlan, useStore } from "../lib/store"
import { navigate } from "../lib/router"
import { cx, isEmail, slugify } from "../lib/utils"
import { planById } from "../lib/plans"
import { toast } from "../components/toast"
import type { PlanId } from "../lib/types"

const USES = [
  { id: "Research", icon: ScanSearch, blurb: "Find the signal in interviews, docs and the web" },
  { id: "Writing", icon: PenLine, blurb: "Turn research into briefs, posts and narratives" },
  { id: "Ideation", icon: Lightbulb, blurb: "Think out loud with a sparring partner" },
]
const SIZES = ["Just me", "2–10 people", "11–50 people", "51–200 people", "200+ people"]

export default function Onboarding() {
  const { user, createWorkspace, signOut } = useStore()
  const first = user?.name.split(" ")[0] ?? "there"
  const [step, setStep] = useState<1 | 2>(1)
  const [name, setName] = useState(user ? `${first}'s workspace` : "")
  const [uses, setUses] = useState<string[]>(["Research", "Writing"])
  const [size, setSize] = useState("2–10 people")
  const [sample, setSample] = useState(true)
  const [invite, setInvite] = useState("")
  const [invites, setInvites] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const pending = pendingPlan() as { plan: PlanId } | null
  const plan = planById(pending?.plan ?? "free")
  const nameOk = name.trim().length >= 2

  function addInvite() {
    const list = invite
      .split(/[,\s]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    const bad = list.filter((e) => !isEmail(e))
    if (bad.length) return toast(`"${bad[0]}" doesn't look like an email`, "error")
    setInvites((cur) => Array.from(new Set([...cur, ...list.filter((e) => e !== user?.email)])))
    setInvite("")
  }

  async function finish() {
    setBusy(true)
    await createWorkspace({ name, uses, teamSize: size, sample, invites })
    toast(`${name.trim()} is ready.${invites.length ? ` Invites sent to ${invites.length} ${invites.length === 1 ? "person" : "people"}.` : ""}`)
    navigate("/app")
  }

  return (
    <div className="flex min-h-dvh bg-canvas">
      <AuthAside />
      <main className="flex flex-1 flex-col px-5 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="lg:hidden">
              <Logo size="sm" />
            </div>
            <div className="hidden items-center gap-2.5 sm:flex">
              <Avatar name={user?.name ?? "?"} size={28} />
              <span className="text-[13px] text-muted">{user?.email}</span>
            </div>
          </div>
          <button
            className="text-[13px] text-muted hover:text-ink"
            onClick={() => {
              signOut()
              navigate("/")
            }}
          >
            Sign out ↗
          </button>
        </div>
        <div className="mt-8">
          <FlowSteps step={3} />
        </div>

        <div className="mx-auto w-full max-w-[640px] flex-1 py-10 lg:mx-0">
          {step === 1 ? (
            <div className="rise">
              <h1 className="display text-[34px] font-semibold md:text-[40px]">Make room for your best work.</h1>
              <p className="mt-2 text-[15px] text-muted">Welcome, {first}. Let's create a home for your team's ideas.</p>

              <div className="mt-9 space-y-7">
                <Field label="Workspace name" htmlFor="ws" hint={<span className="font-mono">papertech.ai / {slugify(name) || "your-workspace"}</span>}>
                  <Input id="ws" value={name} onChange={(e) => setName(e.target.value)} valid={nameOk} placeholder="Studio North" className={nameOk ? "border-accent" : ""} />
                </Field>

                <div>
                  <p className="mb-2 text-[13px] font-medium">What will you use Paper Tech for?</p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {USES.map((u) => {
                      const on = uses.includes(u.id)
                      return (
                        <button
                          key={u.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => setUses((cur) => (on ? cur.filter((x) => x !== u.id) : [...cur, u.id]))}
                          className={cx("relative rounded-xl border p-4 text-left transition-colors", on ? "border-accent-line bg-accent-soft" : "border-line bg-surface hover:border-faint/50")}
                        >
                          <u.icon className={cx("size-5", on ? "text-accent" : "text-muted")} strokeWidth={1.7} />
                          {on && <CircleCheck className="absolute top-3.5 right-3.5 size-4 text-accent" />}
                          <p className="mt-5 text-[14px] font-medium">{u.id}</p>
                          <p className="mt-1 text-[12px] leading-snug text-muted">{u.blurb}</p>
                        </button>
                      )
                    })}
                  </div>
                  <p className="mt-2 text-[12px] text-muted">Choose a few. You can always change this later.</p>
                </div>

                <Field label="How big is your team?" htmlFor="size">
                  <select id="size" value={size} onChange={(e) => setSize(e.target.value)} className="h-11 rounded-lg border border-line bg-surface px-3 text-[14px] text-ink outline-none focus:border-accent">
                    {SIZES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>

                <div className="flex items-start justify-between gap-4 rounded-xl border border-line bg-surface p-4">
                  <div>
                    <p className="text-[14px] font-medium">Start with a sample project</p>
                    <p className="mt-0.5 text-[12.5px] text-muted">Adds “Daybreak launch” with interviews, a brief and a draft, so you can try everything right away.</p>
                  </div>
                  <Toggle checked={sample} onChange={setSample} label="Include sample project" />
                </div>
              </div>

              <Button size="lg" className="mt-9 w-full" disabled={!nameOk} onClick={() => setStep(2)} iconRight={<ArrowRight className="size-4" />}>
                Continue
              </Button>
              <p className="mt-3 text-center text-[12.5px] text-muted">
                {plan.id === "free" ? "You're on the Free plan. Upgrade anytime from Settings." : `Start with 14 days of Paper Tech ${plan.name}. No credit card needed.`}{" "}
                <a href="#/plans" className="text-accent hover:underline">
                  Change plan
                </a>
              </p>
            </div>
          ) : (
            <div className="rise">
              <button onClick={() => setStep(1)} className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
                <ArrowLeft className="size-4" /> Back
              </button>
              <h1 className="display text-[34px] font-semibold md:text-[40px]">Bring your team along.</h1>
              <p className="mt-2 text-[15px] text-muted">Paper Tech is better with the people you think with. You can always do this later.</p>

              <div className="mt-9">
                <Field label="Invite by email" htmlFor="invite" hint="Separate several addresses with commas.">
                  <div className="flex gap-2">
                    <Input
                      id="invite"
                      className="flex-1"
                      value={invite}
                      onChange={(e) => setInvite(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault()
                          addInvite()
                        }
                      }}
                      placeholder="jonah@studionorth.design"
                    />
                    <Button variant="secondary" size="lg" onClick={addInvite} disabled={!invite.trim()}>
                      Add
                    </Button>
                  </div>
                </Field>
                {invites.length > 0 && (
                  <ul className="mt-4 divide-y divide-line-soft rounded-xl border border-line bg-surface">
                    {invites.map((e) => (
                      <li key={e} className="flex items-center gap-3 px-4 py-3">
                        <Avatar name={e} size={28} />
                        <span className="flex-1 text-[13.5px]">{e}</span>
                        <span className="text-[12px] text-muted">Member</span>
                        <button className="text-faint hover:text-danger" onClick={() => setInvites((c) => c.filter((x) => x !== e))} aria-label={`Remove ${e}`}>
                          <X className="size-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <div className="mt-6 flex items-center justify-between gap-3 rounded-xl bg-sunken p-4">
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium">Or share an invite link</p>
                    <p className="truncate font-mono text-[12px] text-muted">papertech.ai/join/{slugify(name)}-{(user?.id ?? "").slice(-4)}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<Copy className="size-3.5" />}
                    onClick={() => {
                      navigator.clipboard?.writeText(`https://papertech.ai/join/${slugify(name)}-${(user?.id ?? "").slice(-4)}`)
                      toast("Invite link copied")
                    }}
                  >
                    Copy
                  </Button>
                </div>
              </div>

              <Button size="lg" className="mt-9 w-full" loading={busy} onClick={finish} iconRight={<ArrowRight className="size-4" />}>
                Create workspace
              </Button>
              <button className="mt-3 w-full text-center text-[13px] text-muted hover:text-ink" onClick={finish} disabled={busy}>
                Skip for now
              </button>
              <ul className="mt-8 space-y-2 text-[12.5px] text-muted">
                {["Private by default", "Your content is never used to train AI models", "Invite or remove people anytime"].map((t) => (
                  <li key={t} className="flex items-center gap-2">
                    <Check className="size-3.5 text-success" /> {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex justify-between text-[12px] text-faint">
          <span>By continuing, you agree to our Terms & Privacy Policy.</span>
          <span className="font-mono">0{step + 1} / 03</span>
        </div>
      </main>
    </div>
  )
}
