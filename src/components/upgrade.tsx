import { useEffect, useState } from "react"
import { ArrowRight, Check } from "lucide-react"
import { Button, Modal } from "./ui"
import { PLANS } from "../lib/plans"
import { useStore } from "../lib/store"
import { navigate } from "../lib/router"
import { toast } from "./toast"
import { cx } from "../lib/utils"

const listeners = new Set<(reason: string) => void>()
export function openUpgrade(reason = "Unlock more of Paper Tech.") {
  listeners.forEach((l) => l(reason))
}

export function UpgradeModal() {
  const { state, choosePlan, usedThisMonth, limit } = useStore()
  const [reason, setReason] = useState<string | null>(null)
  useEffect(() => {
    const on = (r: string) => setReason(r)
    listeners.add(on)
    return () => void listeners.delete(on)
  }, [])
  const current = state.workspace?.plan ?? "free"
  const options = PLANS.filter((p) => p.id === "pro" || p.id === "team")
  return (
    <Modal open={reason !== null} onClose={() => setReason(null)} title="Room to keep thinking" description={reason} width={620}>
      <p className="mb-4 text-[13px] text-muted">
        You've used <strong className="text-ink">{usedThisMonth.toLocaleString()}</strong> of {limit.toLocaleString()} messages this month.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {options.map((p) => (
          <div key={p.id} className={cx("flex flex-col rounded-xl border p-4", p.highlight ? "border-accent bg-accent-soft/50" : "border-line bg-surface")}>
            <div className="flex items-baseline justify-between">
              <h3 className="font-semibold">{p.name}</h3>
              <span className="text-[13px] text-muted">
                <strong className="text-[18px] text-ink">${p.monthly}</strong>
                {p.perSeat ? " / member" : ""} / mo
              </span>
            </div>
            <ul className="my-3 space-y-1.5 text-[13px]">
              {p.features.slice(0, 4).map((f) => (
                <li key={f} className="flex gap-2">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-accent" />
                  {f}
                </li>
              ))}
            </ul>
            <Button
              className="mt-auto"
              variant={p.highlight ? "primary" : "secondary"}
              disabled={current === p.id}
              onClick={() => {
                choosePlan(p.id, state.workspace?.billing ?? "monthly")
                toast(`You're on ${p.name} now — 14 days free, then $${p.monthly}${p.perSeat ? "/member" : ""}/mo.`)
                setReason(null)
              }}
            >
              {current === p.id ? "Current plan" : `Switch to ${p.name}`}
            </Button>
          </div>
        ))}
      </div>
      <button
        className="mt-4 inline-flex items-center gap-1 text-[13px] text-accent hover:underline"
        onClick={() => {
          setReason(null)
          navigate("/app/plans")
        }}
      >
        Compare all plans <ArrowRight className="size-3.5" />
      </button>
    </Modal>
  )
}
