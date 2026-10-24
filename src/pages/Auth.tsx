import { useMemo, useState } from "react"
import { ArrowRight, Check, Eye, EyeOff, Lock, Mail, PenLine, ScanSearch, ShieldCheck, Sparkles, User } from "lucide-react"
import { Button, Field, Input, Logo, PaperMark } from "../components/ui"
import { useStore } from "../lib/store"
import { navigate, useRoute } from "../lib/router"
import { cx, isEmail } from "../lib/utils"
import { toast } from "../components/toast"
import type { Billing, PlanId } from "../lib/types"

export function FlowSteps({ step }: { step: 1 | 2 | 3 }) {
  const steps = ["Your account", "Your plan", "Your workspace"]
  return (
    <ol className="flex items-center gap-2 text-[12.5px] sm:gap-5">
      {steps.map((s, i) => {
        const n = i + 1
        const done = n < step
        const active = n === step
        return (
          <li key={s} className="flex items-center gap-2">
            <span
              className={cx(
                "grid size-6 place-items-center rounded-full text-[11px] font-semibold",
                done ? "bg-success-soft text-success" : active ? "bg-accent text-on-accent" : "bg-sunken text-muted",
              )}
            >
              {done ? <Check className="size-3.5" /> : n}
            </span>
            <span className={cx("hidden sm:inline", active ? "font-medium text-ink" : "text-muted")}>{s}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function AuthAside() {
  return (
    <aside className="relative hidden overflow-hidden bg-panel lg:flex lg:w-[42%] lg:max-w-[600px] lg:flex-col lg:justify-between lg:p-12">
      <Logo href="#/" />
      <div>
        <p className="eyebrow mb-4">A little space for big ideas</p>
        <h2 className="display text-[46px] font-semibold">
          Less busywork.
          <br />
          More possibility.
        </h2>
        <p className="mt-4 max-w-sm text-[16px] leading-relaxed text-muted">A thinking partner for your team's research, writing, and everything in between.</p>
      </div>
      <div className="relative mx-auto h-[330px] w-full max-w-[480px]">
        <svg viewBox="0 0 480 330" className="absolute inset-0 size-full text-[#cdcdd2] dark:text-line" fill="none">
          <ellipse cx="240" cy="165" rx="225" ry="95" stroke="currentColor" transform="rotate(-12 240 165)" />
          <ellipse cx="250" cy="165" rx="170" ry="150" stroke="currentColor" transform="rotate(18 250 165)" />
          <circle cx="410" cy="62" r="5" fill="var(--brand-a)" />
          <circle cx="76" cy="248" r="4" fill="var(--brand-b)" />
        </svg>
        <div className="absolute top-1/2 left-1/2 grid size-[150px] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-[#e4e4e7] dark:bg-accent-soft">
          <div className="grid size-[74px] place-items-center rounded-[20px] bg-[#1f1f22] shadow-lg">
            <PaperMark className="size-10" />
          </div>
        </div>
        <div className="rise absolute top-0 left-0 w-[210px] rounded-xl bg-surface p-4 shadow-card">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <ScanSearch className="size-4 text-accent" /> Find the signal
          </div>
          <p className="mt-2 text-[11.5px] text-muted">12 interviews → 3 clear themes</p>
          <span className="mt-3 inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-1 text-[11px] text-success">
            <Check className="size-3" /> Grounded in your sources
          </span>
        </div>
        <div className="rise absolute right-0 bottom-0 w-[220px] rounded-xl bg-surface p-4 shadow-card [animation-delay:120ms]">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <PenLine className="size-4 text-accent" /> Make it something
          </div>
          <p className="mt-2 text-[11.5px] text-muted">Your research. A stronger first draft.</p>
          <div className="mt-3 h-1.5 w-[85%] rounded bg-line-soft" />
          <div className="mt-2 h-1.5 w-[60%] rounded bg-line-soft" />
        </div>
      </div>
      <div>
        <p className="flex items-center gap-2 text-[13.5px] font-medium">
          <ShieldCheck className="size-4 text-muted" /> Your ideas stay yours.
        </p>
        <p className="mt-1.5 text-[13px] text-muted">Private by default. Your team's content is never used to train AI models.</p>
      </div>
    </aside>
  )
}

function strength(pw: string) {
  const checks = [
    { label: "8+ characters", ok: pw.length >= 8 },
    { label: "A number", ok: /\d/.test(pw) },
    { label: "Upper & lower case", ok: /[a-z]/.test(pw) && /[A-Z]/.test(pw) },
  ]
  const score = checks.filter((c) => c.ok).length + (pw.length >= 12 ? 1 : 0)
  return { checks, score, label: ["Too weak", "Weak", "Okay", "Strong", "Very strong"][score] }
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.3v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6H1.3a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1c.9-2.9 3.6-4.9 6.7-4.9Z" />
    </svg>
  )
}

export default function Auth({ mode }: { mode: "signup" | "signin" | "forgot" }) {
  const { signUp, signIn, startDemo, resetPassword, choosePlan } = useStore()
  const { query } = useRoute()
  const [name, setName] = useState("")
  const [email, setEmail] = useState(query.get("email") ?? "")
  const [password, setPassword] = useState("")
  const [show, setShow] = useState(false)
  const [agree, setAgree] = useState(false)
  const [busy, setBusy] = useState(false)
  const [demoBusy, setDemoBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [resetDone, setResetDone] = useState(false)
  const pw = useMemo(() => strength(password), [password])
  const preselected = query.get("plan") as PlanId | null

  const errors = {
    name: mode === "signup" && name.trim().length < 2 ? "Tell us what to call you" : undefined,
    email: !isEmail(email) ? "Enter a valid email address" : undefined,
    password: mode === "signin" ? (!password ? "Enter your password" : undefined) : pw.score < 2 ? "Use at least 8 characters and a number" : undefined,
    agree: undefined,
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setTouched({ name: true, email: true, password: true, agree: true })
    setError(null)
    const relevant = mode === "signup" ? errors : mode === "signin" ? { email: errors.email, password: errors.password } : { email: errors.email, password: errors.password }
    if (Object.values(relevant).some(Boolean)) return
    setBusy(true)
    if (mode === "signup") {
      const r = await signUp(name, email, password)
      setBusy(false)
      if (!r.ok) return setError(r.error!)
      toast(`Welcome to Paper Tech, ${name.trim().split(" ")[0]}!`)
      if (preselected) choosePlan(preselected, (query.get("billing") as Billing) ?? "monthly")
      // Straight in: the workspace is set up automatically (no plan or setup steps).
      navigate("/start")
    } else if (mode === "signin") {
      const r = await signIn(email, password)
      setBusy(false)
      if (!r.ok) return setError(r.error!)
      navigate("/app")
    } else {
      const ok = await resetPassword(email, password)
      setBusy(false)
      if (!ok) return setError("We couldn't find an account with that email on this device.")
      setResetDone(true)
    }
  }

  async function demo() {
    setDemoBusy(true)
    await startDemo()
    navigate("/app")
  }

  const title = { signup: "Create your account", signin: "Welcome back", forgot: "Reset your password" }[mode]
  const sub = {
    signup: "Free, private AI that runs on your device.",
    signin: "Sign in to pick up where you left off.",
    forgot: "Accounts in this version of Paper Tech live on this device. Choose a new password below.",
  }[mode]

  return (
    <div className="flex min-h-dvh bg-canvas">
      <main className="flex flex-1 flex-col px-5 py-6 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between">
          <Logo href="#/" size="sm" />
          <p className="text-[13px] text-muted">
            {mode === "signup" ? (
              <>
                Have an account?{" "}
                <a className="text-accent hover:underline" href="#/signin">
                  Sign in
                </a>
              </>
            ) : (
              <>
                New to Paper Tech?{" "}
                <a className="text-accent hover:underline" href="#/signup">
                  Create an account
                </a>
              </>
            )}
          </p>
        </div>

        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10">
          {resetDone ? (
            <div className="rise text-center">
              <div className="mx-auto mb-4 grid size-12 place-items-center rounded-full bg-success-soft text-success">
                <Check className="size-6" />
              </div>
              <h1 className="display text-[30px] font-semibold">Password updated</h1>
              <p className="mt-2 text-muted">You can sign in with your new password now.</p>
              <Button className="mt-6" onClick={() => navigate(`/signin?email=${encodeURIComponent(email)}`)}>
                Back to sign in
              </Button>
            </div>
          ) : (
            <div className="rise">
              <h1 className="display text-[32px] font-semibold">{title}</h1>
              <p className="mt-2 text-[15px] text-muted">{sub}</p>
              {preselected && mode === "signup" && (
                <p className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2 py-1 text-[12.5px] text-accent">
                  <Sparkles className="size-3.5" /> You picked the {preselected[0].toUpperCase() + preselected.slice(1)} plan
                </p>
              )}

              <div className="h-7" />

              <form onSubmit={submit} className={cx("space-y-4", mode === "forgot" && "mt-7")} noValidate>
                {mode === "signup" && (
                  <Field label="Full name" htmlFor="name" error={touched.name ? errors.name : undefined}>
                    <Input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, name: true }))} placeholder="Maya Chen" leading={<User className="size-4 text-faint" />} invalid={touched.name && !!errors.name} />
                  </Field>
                )}
                <Field label={mode === "signup" ? "Email" : "Email"} htmlFor="email" error={touched.email ? errors.email : undefined}>
                  <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, email: true }))} placeholder="you@example.com" leading={<Mail className="size-4 text-faint" />} invalid={touched.email && !!errors.email} valid={mode === "signup" && isEmail(email)} />
                </Field>
                <Field
                  label={mode === "forgot" ? "New password" : "Password"}
                  htmlFor="password"
                  error={touched.password ? errors.password : undefined}
                  aside={
                    mode === "signin" ? (
                      <a href={`#/forgot?email=${encodeURIComponent(email)}`} className="text-[12px] text-accent hover:underline">
                        Forgot password?
                      </a>
                    ) : undefined
                  }
                >
                  <Input
                    id="password"
                    type={show ? "text" : "password"}
                    autoComplete={mode === "signin" ? "current-password" : "new-password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    placeholder={mode === "signin" ? "Your password" : "At least 8 characters"}
                    leading={<Lock className="size-4 text-faint" />}
                    invalid={touched.password && !!errors.password}
                    trailing={
                      <button type="button" onClick={() => setShow((s) => !s)} className="text-faint hover:text-ink" aria-label={show ? "Hide password" : "Show password"}>
                        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                      </button>
                    }
                  />
                </Field>
                {mode !== "signin" && password && (
                  <div className="fade -mt-1">
                    <div className="flex gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <span key={i} className={cx("h-1 flex-1 rounded-full transition-colors", i < pw.score ? (pw.score < 2 ? "bg-danger" : pw.score < 3 ? "bg-warn" : "bg-success") : "bg-line-soft")} />
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                      <span className="font-medium">{pw.label}</span>
                      {pw.checks.map((c) => (
                        <span key={c.label} className={cx("inline-flex items-center gap-1", c.ok ? "text-success" : "text-faint")}>
                          <Check className="size-3" /> {c.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {error && <p className="rounded-lg bg-danger-soft px-3 py-2.5 text-[13px] text-danger">{error}</p>}
                <Button type="submit" size="lg" className="w-full" loading={busy} iconRight={<ArrowRight className="size-4" />}>
                  {mode === "signup" ? "Create account" : mode === "signin" ? "Sign in" : "Update password"}
                </Button>
                {mode === "signup" && <p className="text-center text-[12px] text-faint">By creating an account you agree to Paper Tech's Terms and Privacy Policy.</p>}
              </form>

              {mode !== "forgot" ? (
                <p className="mt-6 text-center text-[13px] text-muted">
                  <button className="text-accent hover:underline" onClick={demo} disabled={demoBusy}>
                    {demoBusy ? "Setting up…" : "Explore a demo workspace"}
                  </button>
                  <span className="text-faint"> · </span>
                  <a className="hover:text-ink" href="#/about">
                    About Paper Tech
                  </a>
                </p>
              ) : (
                <p className="mt-6 text-center text-[13px]">
                  <a href="#/signin" className="text-accent hover:underline">
                    Back to sign in
                  </a>
                </p>
              )}
            </div>
          )}
        </div>
        <p className="text-center text-[12px] text-faint">Private by default. Your content is never used to train AI models.</p>
      </main>
    </div>
  )
}
