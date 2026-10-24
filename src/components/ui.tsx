import { forwardRef, useEffect, useId, useRef, useState } from "react"
import { Check, Loader2, X } from "lucide-react"
import { cx, initials } from "../lib/utils"

/** Pinwheel mark: four quarter-circles with the orange-to-blue brand gradient. */
export function PaperMark({ className = "size-7", mono }: { className?: string; mono?: boolean }) {
  const id = useId().replace(/:/g, "")
  return (
    <svg viewBox="0 0 2 2" className={className} aria-hidden="true">
      {!mono && (
        <defs>
          <linearGradient id={`pm${id}`} x1="0" y1="0" x2="2.41" y2="1.13" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#ee8433" />
            <stop offset="1" stopColor="#2415ef" />
          </linearGradient>
        </defs>
      )}
      <path d={PINWHEEL} fill={mono ? "currentColor" : `url(#pm${id})`} />
    </svg>
  )
}
export const PINWHEEL = "M0 0A1 1 0 0 1 1 1H0ZM1 0H2A1 1 0 0 1 1 1ZM1 1H2V2A1 1 0 0 1 1 1ZM1 1V2H0A1 1 0 0 1 1 1Z"

/** Line wordmark that comes with the pinwheel (drawn in the current text colour). */
export function Wordmark({ className = "h-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 338 132" className={className} fill="currentColor" aria-hidden="true">
      <rect x="0" y="0" width="164" height="8" rx="1.5" />
      <rect x="156" y="0" width="8" height="52" rx="1.5" />
      <rect x="0" y="44" width="164" height="8" rx="1.5" />
      <rect x="174" y="0" width="164" height="8" rx="1.5" />
      <rect x="252" y="0" width="8" height="54" rx="1.5" />
      <path d="M3.8 124.2 154.8 77.2 157.2 84.8 6.2 131.8Z" />
      <rect x="152" y="77" width="8" height="53" rx="1.5" />
      <rect x="174" y="76" width="164" height="8" rx="1.5" />
      <rect x="246" y="80" width="8" height="46" rx="1.5" />
      <rect x="168" y="122" width="164" height="8" rx="1.5" />
    </svg>
  )
}

export function Logo({ size = "md", href }: { size?: "sm" | "md" | "lg"; href?: string }) {
  const s = { sm: ["size-6", "h-[19px]"], md: ["size-7", "h-[22px]"], lg: ["size-9", "h-[28px]"] }[size]
  const inner = (
    <span className="inline-flex items-center gap-2.5 text-ink">
      <PaperMark className={s[0]} />
      <Wordmark className={s[1]} />
      <span className="sr-only">Paper Tech AI</span>
    </span>
  )
  return href ? (
    <a href={href} aria-label="Paper Tech AI home">
      {inner}
    </a>
  ) : (
    inner
  )
}

type BtnVariant = "primary" | "secondary" | "ghost" | "danger" | "dark" | "link"
type BtnSize = "sm" | "md" | "lg"

export const Button = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: BtnSize; loading?: boolean; icon?: React.ReactNode; iconRight?: React.ReactNode }
>(function Button({ variant = "primary", size = "md", loading, icon, iconRight, className, children, disabled, ...rest }, ref) {
  const v: Record<BtnVariant, string> = {
    primary: "bg-accent text-on-accent hover:bg-accent-hover shadow-[0_1px_0_rgb(0_0_0/8%)]",
    secondary: "bg-surface text-ink border border-line hover:border-faint/60 hover:bg-sunken",
    ghost: "text-ink hover:bg-sunken",
    danger: "bg-danger text-white hover:opacity-90",
    dark: "bg-ink text-canvas hover:opacity-90",
    link: "text-accent hover:underline underline-offset-2 px-0! h-auto!",
  }
  const s: Record<BtnSize, string> = {
    sm: "h-8 px-3 text-[12.5px] gap-1.5 rounded-md",
    md: "h-10 px-4 text-[13.5px] gap-2 rounded-lg",
    lg: "h-12 px-5 text-[15px] gap-2.5 rounded-lg",
  }
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cx("inline-flex shrink-0 items-center justify-center font-medium whitespace-nowrap transition-colors disabled:opacity-50", v[variant], s[size], className)}
      {...rest}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : icon}
      {children}
      {iconRight}
    </button>
  )
})

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean; valid?: boolean; leading?: React.ReactNode; trailing?: React.ReactNode }>(
  function Input({ className, invalid, valid, leading, trailing, ...rest }, ref) {
    return (
      <div
        className={cx(
          "flex h-11 items-center gap-2 rounded-lg border bg-surface px-3 transition-colors focus-within:border-accent focus-within:ring-3 focus-within:ring-accent/12",
          invalid ? "border-danger" : "border-line",
          className,
        )}
      >
        {leading}
        <input ref={ref} className="h-full min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-faint" aria-invalid={invalid || undefined} {...rest} />
        {valid && <Check className="size-4 text-success" />}
        {trailing}
      </div>
    )
  },
)

export function Textarea({ className, ...rest }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "w-full resize-y rounded-lg border border-line bg-surface px-3 py-2.5 text-[14px] leading-relaxed text-ink outline-none placeholder:text-faint focus:border-accent focus:ring-3 focus:ring-accent/12",
        className,
      )}
      {...rest}
    />
  )
}

export function Field({ label, hint, error, children, htmlFor, aside }: { label: string; hint?: React.ReactNode; error?: string; children: React.ReactNode; htmlFor?: string; aside?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
          {label}
        </label>
        {aside}
      </div>
      {children}
      {error ? <p className="text-[12px] text-danger">{error}</p> : hint ? <p className="text-[12px] text-muted">{hint}</p> : null}
    </div>
  )
}

const avatarTones = ["bg-[#e4e4e7] text-[#3a3a40]", "bg-[#dcdce0] text-[#2d2d32]", "bg-[#ebebee] text-[#4a4a50]", "bg-[#d4d4d9] text-[#26262a]", "bg-[#e8e8eb] text-[#55555c]"]

export function Avatar({ name, size = 32, className }: { name: string; size?: number; className?: string }) {
  const tone = avatarTones[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % avatarTones.length]
  return (
    <span
      className={cx("inline-grid shrink-0 place-items-center rounded-full font-semibold ring-2 ring-canvas dark:brightness-90", tone, className)}
      style={{ width: size, height: size, fontSize: Math.max(9, size * 0.34) }}
      title={name}
    >
      {initials(name)}
    </span>
  )
}

export function Badge({ tone = "neutral", children, className }: { tone?: "neutral" | "accent" | "success" | "warn" | "danger"; children: React.ReactNode; className?: string }) {
  const t = {
    neutral: "bg-sunken text-muted border-line-soft",
    accent: "bg-accent-soft text-accent border-accent-line/60",
    success: "bg-success-soft text-success border-transparent",
    warn: "bg-warn-soft text-warn border-transparent",
    danger: "bg-danger-soft text-danger border-transparent",
  }[tone]
  return <span className={cx("inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11.5px] font-medium whitespace-nowrap", t, className)}>{children}</span>
}

export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cx("relative h-[22px] w-[38px] shrink-0 rounded-full transition-colors disabled:opacity-40", checked ? "bg-accent" : "bg-line")}
    >
      <span className={cx("absolute top-[3px] size-4 rounded-full shadow transition-all", checked ? "bg-on-accent" : "bg-white", checked ? "left-[19px]" : "left-[3px]")} />
    </button>
  )
}

export function Segmented<T extends string>({ value, options, onChange, className }: { value: T; options: Array<{ value: T; label: React.ReactNode }>; onChange: (v: T) => void; className?: string }) {
  return (
    <div className={cx("inline-flex rounded-lg border border-line-soft bg-sunken p-1", className)} role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={o.value === value}
          onClick={() => onChange(o.value)}
          className={cx(
            "flex-1 rounded-md px-3 py-1.5 text-[13px] transition-colors",
            o.value === value ? "bg-surface font-medium text-ink shadow-card" : "text-muted hover:text-ink",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal({ open, onClose, title, children, width = 480, footer, description }: { open: boolean; onClose: () => void; title?: React.ReactNode; description?: React.ReactNode; children: React.ReactNode; width?: number; footer?: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    window.addEventListener("keydown", onKey)
    const prev = document.activeElement as HTMLElement | null
    setTimeout(() => ref.current?.querySelector<HTMLElement>("input,textarea,button[data-autofocus]")?.focus(), 30)
    return () => {
      window.removeEventListener("keydown", onKey)
      prev?.focus?.()
    }
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fade fixed inset-0 z-[80] grid place-items-center bg-[rgb(20_22_20/38%)] p-4 backdrop-blur-[2px]" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} role="dialog" aria-modal="true" className="rise flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-2xl border border-line bg-canvas shadow-pop" style={{ maxWidth: width }}>
        {title && (
          <div className="flex items-start justify-between gap-4 border-b border-line-soft px-5 pt-5 pb-4">
            <div>
              <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h2>
              {description && <p className="mt-1 text-[13px] text-muted">{description}</p>}
            </div>
            <button onClick={onClose} className="rounded-md p-1 text-muted hover:bg-sunken hover:text-ink" aria-label="Close">
              <X className="size-4" />
            </button>
          </div>
        )}
        <div className="scroll-thin overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line-soft bg-sunken/60 px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  )
}

export function Menu({ trigger, children, align = "right", width = 220, side = "down" }: { trigger: (open: boolean) => React.ReactNode; children: (close: () => void) => React.ReactNode; align?: "left" | "right"; width?: number; side?: "up" | "down" }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const on = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false)
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false)
    document.addEventListener("mousedown", on)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", on)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div className={cx("fade absolute z-50 rounded-xl border border-line bg-surface p-1.5 shadow-pop", side === "up" ? "bottom-full mb-1.5" : "mt-1.5", align === "right" ? "right-0" : "left-0")} style={{ width }} role="menu">
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}

export function MenuItem({ icon, children, onClick, danger, active, hint }: { icon?: React.ReactNode; children: React.ReactNode; onClick?: () => void; danger?: boolean; active?: boolean; hint?: React.ReactNode }) {
  return (
    <button
      role="menuitem"
      onClick={onClick}
      className={cx(
        "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] transition-colors",
        danger ? "text-danger hover:bg-danger-soft" : active ? "bg-accent-soft text-accent" : "text-ink hover:bg-sunken",
      )}
    >
      {icon && <span className="grid size-4 place-items-center [&>svg]:size-4">{icon}</span>}
      <span className="flex-1">{children}</span>
      {hint && <span className="text-[11px] text-faint">{hint}</span>}
      {active && <Check className="size-3.5" />}
    </button>
  )
}

export function Spinner({ className = "size-4" }: { className?: string }) {
  return <Loader2 className={cx("animate-spin text-accent", className)} />
}

export function EmptyState({ icon, title, children, action }: { icon: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-line px-6 py-12 text-center">
      <div className="mb-3 grid size-11 place-items-center rounded-xl bg-accent-soft text-accent [&>svg]:size-5">{icon}</div>
      <h3 className="text-[15px] font-medium">{title}</h3>
      {children && <p className="mt-1 max-w-sm text-[13px] text-muted">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function Card({ className, children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cx("rounded-xl border border-line bg-surface", className)} {...rest}>
      {children}
    </div>
  )
}

export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="rounded border border-line bg-surface px-1.5 py-0.5 font-mono text-[10.5px] text-muted">{children}</kbd>
}
