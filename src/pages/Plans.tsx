import { useState } from "react"
import { ArrowLeft, ArrowRight, Check, Minus, Sparkles } from "lucide-react"
import { Badge, Button, Logo, Modal, Segmented, Field, Input, Textarea } from "../components/ui"
import { COMPARISON, PLANS, priceLabel, type Plan } from "../lib/plans"
import type { Billing, PlanId } from "../lib/types"
import { useStore } from "../lib/store"
import { navigate } from "../lib/router"
import { cx, isEmail } from "../lib/utils"
import { toast } from "../components/toast"
import { FlowSteps } from "./Auth"

export function BillingToggle({ billing, onChange }: { billing: Billing; onChange: (b: Billing) => void }) {
  return (
    <Segmented
      value={billing}
      onChange={onChange}
      options={[
        { value: "monthly", label: "Monthly" },
        {
          value: "yearly",
          label: (
            <span className="inline-flex items-center gap-1.5">
              Yearly <span className="rounded bg-success-soft px-1 text-[10.5px] font-semibold text-success">−15%</span>
            </span>
          ),
        },
      ]}
    />
  )
}

export function PlanCard({ plan, billing, current, selected, onSelect, ctaLabel }: { plan: Plan; billing: Billing; current?: boolean; selected?: boolean; onSelect: () => void; ctaLabel?: string }) {
  const price = priceLabel(plan, billing)
  return (
    <div
      className={cx(
        "relative flex flex-col rounded-2xl border p-6 transition-all",
        plan.highlight ? "border-accent bg-surface shadow-[0_18px_50px_-20px_color-mix(in_oklab,var(--accent)_45%,transparent)]" : "border-line bg-surface",
        selected && "ring-3 ring-accent/25",
      )}
    >
      {plan.highlight && (
        <span className="absolute -top-3 left-6 inline-flex items-center gap-1 rounded-full bg-accent px-2.5 py-1 text-[11px] font-semibold text-on-accent">
          <Sparkles className="size-3" /> Most popular
        </span>
      )}
      <div className="flex items-center justify-between">
        <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{plan.name}</h3>
        {current && <Badge tone="success">Current plan</Badge>}
      </div>
      <p className="mt-1 min-h-[40px] text-[13px] leading-snug text-muted">{plan.tagline}</p>
      <div className="mt-5 flex items-baseline gap-1.5">
        <span className="display text-[40px] font-semibold">{price}</span>
        {plan.monthly !== null && plan.monthly > 0 && (
          <span className="text-[13px] text-muted">
            {plan.perSeat ? "/ member " : ""}/ month
          </span>
        )}
      </div>
      <p className="mt-1 h-4 text-[12px] text-faint">
        {plan.monthly === null ? "Annual agreement" : plan.monthly === 0 ? "Free forever" : billing === "yearly" ? `Billed yearly · $${(plan.yearly ?? 0) * 12}${plan.perSeat ? " per member" : ""}` : "Billed monthly · cancel anytime"}
      </p>
      <Button className="mt-5 w-full" variant={plan.highlight ? "primary" : "secondary"} onClick={onSelect} disabled={current} iconRight={!current ? <ArrowRight className="size-4" /> : undefined}>
        {current ? "Your plan" : (ctaLabel ?? plan.cta)}
      </Button>
      <ul className="mt-6 space-y-2.5 border-t border-line-soft pt-5 text-[13.5px]">
        {plan.features.map((f) => (
          <li key={f} className="flex gap-2.5">
            <Check className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function ComparisonTable() {
  return (
    <div className="scroll-thin overflow-x-auto rounded-2xl border border-line bg-surface">
      <table className="w-full min-w-[640px] text-[13.5px]">
        <thead>
          <tr className="border-b border-line">
            <th className="px-5 py-4 text-left font-medium text-muted">Compare plans</th>
            {PLANS.map((p) => (
              <th key={p.id} className={cx("px-4 py-4 text-left font-semibold", p.highlight && "text-accent")}>
                {p.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {COMPARISON.map((row) => (
            <tr key={row.label} className="border-b border-line-soft last:border-0">
              <td className="px-5 py-3 text-muted">{row.label}</td>
              {PLANS.map((p) => {
                const v = row.values[p.id]
                return (
                  <td key={p.id} className="px-4 py-3">
                    {v === true ? <Check className="size-4 text-accent" /> : v === false ? <Minus className="size-4 text-faint" /> : v}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function ContactSales({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useStore()
  const [email, setEmail] = useState(user?.email ?? "")
  const [size, setSize] = useState("")
  const [msg, setMsg] = useState("")
  const [sent, setSent] = useState(false)
  return (
    <Modal open={open} onClose={onClose} title="Talk to us about Enterprise" description="Tell us a little about your team and we'll be in touch within one business day.">
      {sent ? (
        <div className="py-6 text-center">
          <div className="mx-auto mb-3 grid size-11 place-items-center rounded-full bg-success-soft text-success">
            <Check className="size-5" />
          </div>
          <p className="font-medium">Thanks — we've got it.</p>
          <p className="mt-1 text-[13px] text-muted">We'll reply to {email}.</p>
          <Button className="mt-5" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            if (!isEmail(email)) return toast("Add a valid work email", "error")
            try {
              const leads = JSON.parse(localStorage.getItem("papertech:leads") ?? "[]")
              leads.push({ email, size, msg, at: Date.now() })
              localStorage.setItem("papertech:leads", JSON.stringify(leads))
            } catch {
              /* ignore */
            }
            setSent(true)
          }}
        >
          <Field label="Work email" htmlFor="cs-email">
            <Input id="cs-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
          </Field>
          <Field label="Team size" htmlFor="cs-size">
            <Input id="cs-size" value={size} onChange={(e) => setSize(e.target.value)} placeholder="e.g. 120 people" />
          </Field>
          <Field label="What are you hoping Paper Tech can help with?" htmlFor="cs-msg">
            <Textarea id="cs-msg" rows={3} value={msg} onChange={(e) => setMsg(e.target.value)} />
          </Field>
          <Button type="submit" className="w-full">
            Send
          </Button>
        </form>
      )}
    </Modal>
  )
}

export default function Plans({ mode }: { mode: "public" | "signup" | "app" }) {
  const { state, choosePlan } = useStore()
  const [billing, setBilling] = useState<Billing>(state.workspace?.billing ?? "yearly")
  const [contact, setContact] = useState(false)
  const [confirm, setConfirm] = useState<Plan | null>(null)
  const current = mode === "app" ? state.workspace?.plan : undefined

  function select(plan: Plan) {
    if (plan.id === "enterprise") return setContact(true)
    if (mode === "public") return navigate(`/signup?plan=${plan.id}&billing=${billing}`)
    if (mode === "signup") {
      choosePlan(plan.id, billing)
      return navigate("/onboarding")
    }
    setConfirm(plan)
  }

  const grid = (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
      {PLANS.map((p) => (
        <PlanCard key={p.id} plan={p} billing={billing} current={current === p.id} onSelect={() => select(p)} ctaLabel={mode === "app" ? (p.id === "enterprise" ? "Talk to us" : "Switch plan") : undefined} />
      ))}
    </div>
  )

  if (mode === "app") {
    return (
      <div className="mx-auto max-w-[1180px] px-5 py-8 md:px-10 md:py-10">
        <button onClick={() => navigate("/app/settings/billing")} className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink">
          <ArrowLeft className="size-4" /> Plans & billing
        </button>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-[34px] font-semibold">Choose the right amount of room.</h1>
            <p className="mt-2 text-muted">Change plans anytime. Upgrades take effect immediately.</p>
          </div>
          <BillingToggle billing={billing} onChange={setBilling} />
        </div>
        {grid}
        <div className="mt-10">
          <ComparisonTable />
        </div>
        <ContactSales open={contact} onClose={() => setContact(false)} />
        <Modal
          open={!!confirm}
          onClose={() => setConfirm(null)}
          title={confirm ? `Switch to ${confirm.name}?` : ""}
          footer={
            <>
              <Button variant="secondary" onClick={() => setConfirm(null)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  if (!confirm) return
                  choosePlan(confirm.id as PlanId, billing)
                  toast(`You're now on ${confirm.name}.`)
                  setConfirm(null)
                  navigate("/app/settings/billing")
                }}
              >
                Confirm
              </Button>
            </>
          }
        >
          {confirm && (
            <p className="text-[14px] leading-relaxed text-muted">
              {confirm.monthly === 0
                ? "You'll move to the Free plan at the end of this billing period. Your projects stay, but limits will apply."
                : `${confirm.name} is ${priceLabel(confirm, billing)}${confirm.perSeat ? " per member" : ""} per month, billed ${billing}. ${state.workspace?.trialEndsAt && state.workspace.trialEndsAt > Date.now() ? "You're still in your free trial, so nothing is charged today." : "Your first 14 days are free."}`}
            </p>
          )}
        </Modal>
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-canvas">
      <header className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 md:px-8">
        <Logo href="#/" />
        {mode === "signup" ? (
          <FlowSteps step={2} />
        ) : (
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => navigate("/signin")}>
              Sign in
            </Button>
            <Button size="sm" onClick={() => navigate("/signup")}>
              Get started
            </Button>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-[1240px] px-5 pt-6 pb-20 md:px-8 md:pt-10">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <p className="eyebrow mb-3 text-accent!">{mode === "signup" ? "Step 2 of 3 · Choose a plan" : "Pricing"}</p>
          <h1 className="display text-[36px] font-semibold md:text-[48px]">Pick the room you need.</h1>
          <p className="mt-3 text-[16px] text-muted">Start free, or try Pro or Team for 14 days. No credit card needed — you can change plans anytime.</p>
          <div className="mt-6 flex justify-center">
            <BillingToggle billing={billing} onChange={setBilling} />
          </div>
        </div>
        {grid}
        {mode === "signup" && (
          <p className="mt-6 text-center text-[13px] text-muted">
            Not sure yet?{" "}
            <button className="text-accent hover:underline" onClick={() => select(PLANS[0])}>
              Continue with Free
            </button>{" "}
            — you can upgrade from Settings whenever you're ready.
          </p>
        )}
        <div className="mt-14">
          <ComparisonTable />
        </div>
      </main>
      <ContactSales open={contact} onClose={() => setContact(false)} />
    </div>
  )
}
