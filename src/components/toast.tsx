import { useEffect, useState } from "react"
import { CircleAlert, CircleCheck, Info, X } from "lucide-react"

type Kind = "success" | "error" | "info"
interface T {
  id: number
  text: string
  kind: Kind
}

const listeners = new Set<(t: T) => void>()
let n = 0

export function toast(text: string, kind: Kind = "success") {
  const t = { id: ++n, text, kind }
  listeners.forEach((l) => l(t))
}

export function Toaster() {
  const [items, setItems] = useState<T[]>([])
  useEffect(() => {
    const on = (t: T) => {
      setItems((s) => [...s.slice(-3), t])
      setTimeout(() => setItems((s) => s.filter((x) => x.id !== t.id)), 3800)
    }
    listeners.add(on)
    return () => void listeners.delete(on)
  }, [])
  return (
    <div className="pointer-events-none fixed bottom-4 left-1/2 z-[100] flex w-[min(92vw,420px)] -translate-x-1/2 flex-col gap-2" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className="rise pointer-events-auto flex items-start gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-[13px] text-ink shadow-pop">
          {t.kind === "success" && <CircleCheck className="mt-px size-4 shrink-0 text-success" />}
          {t.kind === "error" && <CircleAlert className="mt-px size-4 shrink-0 text-danger" />}
          {t.kind === "info" && <Info className="mt-px size-4 shrink-0 text-accent" />}
          <span className="flex-1 leading-snug">{t.text}</span>
          <button onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} className="text-faint hover:text-ink" aria-label="Dismiss">
            <X className="size-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}
