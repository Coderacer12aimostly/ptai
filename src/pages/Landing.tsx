import { useRef, useState } from "react"
import {
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Bold,
  Check,
  ChevronDown,
  FileText,
  FolderOpen,
  Italic,
  List,
  Lock,
  Menu as MenuIcon,
  PenLine,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Upload,
  Users,
  X,
  Briefcase, MessageCircle, Code2, Bot, Waves, Zap,
} from "lucide-react"
import { Button, Logo, PaperMark } from "../components/ui"
import { Markdown } from "../components/Markdown"
import { navigate } from "../lib/router"
import { useStore } from "../lib/store"
import { PLANS } from "../lib/plans"
import { BillingToggle, ContactSales, PlanCard } from "./Plans"
import type { Billing } from "../lib/types"
import { streamChat } from "../lib/ai"
import { scorePassages } from "../lib/knowledge"
import { SAMPLE_TEXT, sampleFiles } from "../lib/seed"
import { cx } from "../lib/utils"

function Nav() {
  const { user, state } = useStore()
  const [open, setOpen] = useState(false)
  const links = [
    ["Modes", "#modes"],
    ["Models", "#models"],
    ["Try it", "#try"],
    ["Pricing", "#pricing"],
    ["FAQ", "#faq"],
  ]
  const go = (id: string) => {
    setOpen(false)
    document.querySelector(id)?.scrollIntoView({ behavior: "smooth" })
  }
  const signedIn = user && state.onboarded[user.id]
  return (
    <header className="sticky top-0 z-40 border-b border-line-soft/80 bg-canvas/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1240px] items-center justify-between px-5 md:px-8">
        <div className="flex items-center gap-8">
          <Logo href="#/about" />
          <nav className="hidden items-center gap-6 md:flex">
            {links.map(([l, id]) => (
              <button key={l} onClick={() => go(id)} className="text-[13.5px] text-muted transition-colors hover:text-ink">
                {l}
              </button>
            ))}
          </nav>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {signedIn ? (
            <Button size="sm" onClick={() => navigate("/app")} iconRight={<ArrowRight className="size-3.5" />}>
              Open Paper Tech
            </Button>
          ) : (
            <>
              <Button variant="ghost" size="sm" onClick={() => navigate("/signin")}>
                Sign in
              </Button>
              <Button size="sm" onClick={() => navigate("/signup")}>
                Get started free
              </Button>
            </>
          )}
        </div>
        <button className="rounded-md p-2 md:hidden" onClick={() => setOpen((o) => !o)} aria-label="Menu" aria-expanded={open}>
          {open ? <X className="size-5" /> : <MenuIcon className="size-5" />}
        </button>
      </div>
      {open && (
        <div className="fade border-t border-line-soft px-5 pt-2 pb-5 md:hidden">
          {links.map(([l, id]) => (
            <button key={l} onClick={() => go(id)} className="block w-full py-3 text-left text-[15px]">
              {l}
            </button>
          ))}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button variant="secondary" onClick={() => navigate(signedIn ? "/app" : "/signin")}>
              {signedIn ? "Open Paper Tech" : "Sign in"}
            </Button>
            <Button onClick={() => navigate("/signup")}>Get started</Button>
          </div>
        </div>
      )}
    </header>
  )
}

function HeroMock() {
  return (
    <div className="relative">
      <div className="overflow-hidden rounded-2xl border border-line bg-canvas shadow-pop">
        <div className="flex items-center justify-between border-b border-line-soft px-5 py-3.5 text-[13px]">
          <span>Daybreak launch narrative</span>
          <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-0.5 text-[11px] text-success">
            <Check className="size-3" /> Saved
          </span>
        </div>
        <div className="grid sm:grid-cols-[0.85fr_1.15fr]">
          <div className="hidden border-r border-line-soft p-4 sm:block">
            <p className="flex items-center gap-2 text-[12.5px]">
              <PenLine className="size-3.5 text-accent" /> Writing partner
            </p>
            <div className="mt-3 rounded-lg bg-sunken p-3 text-[12px] leading-relaxed">
              <p className="mb-1 text-[10.5px] font-semibold">You</p>
              Turn our audience research into a launch narrative. Keep it clear, human, and a little optimistic.
              <p className="mt-2 flex items-center gap-1 text-[10.5px] text-muted">
                <ArrowUpRight className="size-3" /> Launch audience research
              </p>
            </div>
            <p className="mt-4 text-[11.5px] font-semibold">Paper Tech</p>
            <p className="mt-1.5 text-[12px] leading-relaxed text-muted">I've shaped the story around a calmer morning, with the small-team lead at its center.</p>
          </div>
          <div className="bg-sunken/60 p-4">
            <div className="mb-3 flex items-center gap-3 text-muted">
              <span className="text-[11px]">Normal text</span>
              <Bold className="size-3.5" />
              <Italic className="size-3.5" />
              <List className="size-3.5" />
            </div>
            <div className="rounded-lg border border-line-soft bg-surface p-5">
              <h3 className="display text-[22px] font-semibold">
                A clearer start.
                <br />A different kind of day.
              </h3>
              <p className="mt-2 text-[10.5px] text-faint">Daybreak · Launch narrative · October 2026</p>
              <p className="mt-3 flex items-center gap-1 font-mono text-[9.5px] tracking-wide text-accent uppercase">
                <Sparkles className="size-3" /> Revised opening
              </p>
              <p className="mt-1.5 rounded-md bg-accent-soft p-2.5 text-[12px] leading-relaxed">It's 9:04. You've checked Slack, opened your calendar, and scanned three project boards. You're still not sure where to begin.</p>
              <p className="mt-3 text-[13px] font-medium">The work before the work</p>
              <div className="mt-2 space-y-1.5">
                <div className="h-1.5 w-full rounded bg-line-soft" />
                <div className="h-1.5 w-[80%] rounded bg-line-soft" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="rise absolute -bottom-6 -left-4 hidden w-[230px] rounded-xl border border-line bg-surface p-3.5 shadow-pop md:block [animation-delay:250ms]">
        <p className="flex items-center gap-2 text-[12px] font-medium">
          <ScanSearch className="size-3.5 text-accent" /> 12 sources reviewed
        </p>
        <p className="mt-1.5 text-[11.5px] text-muted">“I open five apps before I know what actually needs my attention.”</p>
      </div>
    </div>
  )
}

const SUGGESTIONS = ["Who should we focus on for the launch?", "Summarise the customer interviews", "Brainstorm three headline angles", "Draft a launch email"]

function TryIt() {
  const [q, setQ] = useState("")
  const [answer, setAnswer] = useState("")
  const [asked, setAsked] = useState("")
  const [busy, setBusy] = useState(false)
  const [sources, setSources] = useState<string[]>([])
  const ctrl = useRef<AbortController | null>(null)

  async function ask(text: string) {
    if (!text.trim() || busy) return
    ctrl.current?.abort()
    const c = new AbortController()
    ctrl.current = c
    setAsked(text)
    setQ("")
    setAnswer("")
    setBusy(true)
    const files = sampleFiles("You")
    const passages = scorePassages(
      files.filter((f) => SAMPLE_TEXT[f.id]).map((f) => ({ file: f, text: SAMPLE_TEXT[f.id] })),
      text,
    )
    const names: string[] = []
    passages.forEach((p) => !names.includes(p.file.name) && names.push(p.file.name))
    setSources(names)
    await streamChat({ forceDemo: true, model: "demo", system: "", messages: [{ role: "user", content: text }], signal: c.signal, onText: (t) => setAnswer((a) => a + t), demo: { passages } })
    setBusy(false)
  }

  return (
    <section id="try" className="scroll-mt-20 border-y border-line-soft bg-panel/60">
      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-20 md:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-28">
        <div>
          <p className="eyebrow text-accent!">Try it — no account needed</p>
          <h2 className="display mt-3 text-[34px] font-semibold md:text-[42px]">Ask a sample project anything.</h2>
          <p className="mt-4 max-w-md text-[16px] leading-relaxed text-muted">
            This demo has five sources from a fictional launch: customer interviews, a positioning brief, a competitor table and more. Paper Tech answers from them, and shows its work.
          </p>
          <ul className="mt-6 space-y-2 text-[14px]">
            {Object.values(sampleFiles("You"))
              .filter((f) => f.kind !== "artifact")
              .map((f) => (
                <li key={f.id} className="flex items-center gap-2 text-muted">
                  <FileText className="size-4 text-faint" /> {f.name}
                </li>
              ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-line bg-canvas p-4 shadow-card md:p-6">
          <div className="min-h-[300px]">
            {!asked ? (
              <div className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                <PaperMark className="size-10" />
                <p className="mt-4 text-[15px] font-medium">What would you like to know?</p>
                <div className="mt-5 flex max-w-lg flex-wrap justify-center gap-2">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} onClick={() => ask(s)} className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px] text-muted transition-colors hover:border-accent hover:text-accent">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="fade">
                <div className="ml-auto max-w-[85%] rounded-xl bg-sunken px-4 py-3 text-[14px]">{asked}</div>
                <div className="mt-5 flex items-center gap-2 text-[13px]">
                  <Sparkles className="size-4 text-accent" />
                  <span className="font-medium">Paper Tech</span>
                  {busy ? (
                    <span className="text-muted">Reading sources…</span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-1.5 py-0.5 text-[11px] text-success">
                      <Check className="size-3" /> {sources.length} sources
                    </span>
                  )}
                </div>
                <Markdown text={answer || " "} streaming={busy} className="mt-3 text-[14.5px]" />
                {!busy && sources.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {sources.map((s, i) => (
                      <span key={s} className="rounded-md border border-line bg-surface px-2 py-1 text-[11.5px] text-muted">
                        <span className="mr-1 font-mono text-accent">[{i + 1}]</span>
                        {s}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <form
            className="mt-5 flex items-center gap-2 rounded-xl border border-line bg-surface p-2 pl-4 focus-within:border-accent"
            onSubmit={(e) => {
              e.preventDefault()
              ask(q)
            }}
          >
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ask about the Daybreak launch…" className="h-9 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint" aria-label="Ask the demo" />
            <button disabled={!q.trim() || busy} className="grid size-9 place-items-center rounded-lg bg-accent text-on-accent disabled:opacity-40" aria-label="Ask">
              <ArrowUp className="size-4" />
            </button>
          </form>
          <p className="mt-3 text-center text-[11.5px] text-faint">Demo answers are generated from the sample files only. Sign up to use your own sources with private, on-device AI.</p>
        </div>
      </div>
    </section>
  )
}

const FEATURES = [
  {
    n: "01",
    title: "Find the signal",
    body: "Ask a question and Paper Tech reads your interviews, docs and the web — then answers with citations you can click and check.",
    icon: ScanSearch,
    mock: (
      <div className="space-y-3 p-5">
        <p className="flex items-center gap-2 text-[12px]">
          <Sparkles className="size-3.5 text-accent" /> <b className="font-medium">Paper Tech</b>
          <span className="rounded bg-success-soft px-1.5 text-[10.5px] text-success">✓ 12 sources reviewed</span>
        </p>
        <p className="text-[17px] font-semibold tracking-[-0.01em]">Lead with clarity, not productivity.</p>
        {["The audience: hands-on team leads", "The friction: a fragmented morning", "The opening: a calmer daily ritual"].map((t, i) => (
          <p key={t} className="text-[12.5px]">
            <span className="mr-2 font-mono text-[10px] text-accent">0{i + 1}</span>
            {t} <span className="font-mono text-[10px] text-accent">[{i + 1}]</span>
          </p>
        ))}
        <p className="rounded-r-md border-l-2 border-accent bg-accent-soft px-3 py-2 text-[12.5px] text-accent">“Start your day with a plan. Not another tab.”</p>
      </div>
    ),
  },
  {
    n: "02",
    title: "Make it something",
    body: "Turn research into a brief, a post or a launch narrative with a writing partner that edits right in the document — and keeps every version.",
    icon: PenLine,
    mock: (
      <div className="p-5">
        <p className="display text-[20px] font-semibold">A clearer start.</p>
        <p className="mt-2 rounded-md bg-accent-soft p-2.5 text-[12px]">It's 9:04. You've checked Slack and scanned three boards. You're still not sure where to begin.</p>
        <div className="mt-3 flex items-center gap-2 text-[11.5px] text-muted">
          <span className="rounded border border-line px-1.5 py-0.5">v2</span> Opening updated · just now
        </div>
      </div>
    ),
  },
  {
    n: "03",
    title: "A partner for every kind of thinking",
    body: "Give Paper Tech a role, the right tools and a little direction. Build a researcher, an editor, a sparring partner — and share them with your team.",
    icon: Sparkles,
    mock: (
      <div className="grid gap-2 p-5">
        {[
          ["Launch researcher", "Sources first, always."],
          ["Writing partner", "Clearer words. Your voice."],
          ["Thinking partner", "A fresh perspective."],
        ].map(([a, b], i) => (
          <div key={a} className={cx("rounded-lg border p-3", i === 0 ? "border-accent-line bg-accent-soft" : "border-line bg-surface")}>
            <p className="text-[12.5px] font-medium">{a}</p>
            <p className="text-[11px] text-muted">{b}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    n: "04",
    title: "A home for what your team knows",
    body: "Drop in PDFs, docs, spreadsheets and links. Paper Tech reads them in seconds, keeps them organised by project, and makes them ready for questions.",
    icon: FolderOpen,
    mock: (
      <div className="divide-y divide-line-soft p-3">
        {[
          ["Customer interviews.pdf", "Ready"],
          ["Competitive landscape.csv", "Ready"],
          ["Survey responses.pdf", "68%"],
        ].map(([a, b]) => (
          <div key={a} className="flex items-center gap-3 px-2 py-2.5 text-[12.5px]">
            <FileText className="size-4 text-faint" />
            <span className="flex-1">{a}</span>
            <span className={b === "Ready" ? "text-success" : "text-accent"}>{b}</span>
          </div>
        ))}
      </div>
    ),
  },
]

const FAQ = [
  ["Which AI models does Paper Tech use?", "The Paper Tech 1 family, running right in your browser: Wave for deep thinking, Mini for quick answers and Renat for coding — plus Nano, our tiny built-in model that works everywhere. They're built on open-source models (Qwen3 and Qwen2.5-Coder, Apache 2.0). You can also connect Claude with your own key."],
  ["Does the AI really run on my device?", "Yes. Paper Tech downloads an open model once (about 1 GB) and runs it on your computer's graphics chip with WebGPU. Your questions and files never leave the device, there's no usage limit, and it works offline. It needs a recent Chrome, Edge, Opera or Safari."],
  ["Is my content used to train AI models?", "No. Your workspace is private by default, and your content is never used to train AI models."],
  ["What files can I add?", "PDFs, Word documents, text and Markdown, CSV spreadsheets, links and images — up to 50 MB each. Paper Tech extracts the text so you can ask questions and get cited answers."],
  ["Does Paper Tech work with Google Workspace?", "Yes. Link your Google account to get meeting reminders, new-email alerts and Drive edit notifications, import Docs, Sheets and PDFs into projects, and ask Paper Tech to brief you on your day. Access is read-only, and you can disconnect anytime."],
  ["Can I try it before paying?", "Yes. The Free plan is free forever, and Pro and Team come with a 14-day trial — no credit card needed."],
  ["Can I use Paper Tech with my team?", "The Team plan adds a shared workspace with shared projects and assistants, invites and admin roles."],
  ["Does it work on my phone?", "Yes. Paper Tech works in any modern browser and can be installed as an app on desktop and mobile."],
]

const LANDING_MODES = [
  { id: "work", label: "Work", icon: Briefcase, path: "/app", body: "Projects, files and documents. Ask questions with citations, write with an AI editor, and plan your day with Google Workspace.", best: "Research & writing" },
  { id: "chat", label: "Chat", icon: MessageCircle, path: "/app/c", body: "A quick conversation about anything. No setup, no files — just ask.", best: "Everyday questions" },
  { id: "code", label: "Code", icon: Code2, path: "/app/code", body: "Write, fix and explain code. Web pages run in a live preview right next to the chat.", best: "Building things" },
  { id: "agent", label: "Agent", icon: Bot, path: "/app/agent", body: "Give it a task. It plans the steps, searches your files, does the math and creates documents — and shows every step.", best: "Getting things done" },
]

function ModesSection() {
  return (
    <section id="modes" className="scroll-mt-20 mx-auto max-w-[1240px] px-5 py-20 md:px-8 lg:py-24">
      <div className="max-w-2xl">
        <p className="eyebrow text-accent!">Four modes</p>
        <h2 className="display mt-3 text-[34px] font-semibold md:text-[46px]">One app for every kind of work.</h2>
        <p className="mt-4 text-[17px] text-muted">Switch modes at the top of the sidebar. Each one is tuned for its job, and every mode takes images: paste a screenshot, a photo or a receipt and ask about it.</p>
      </div>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {LANDING_MODES.map((m) => (
          <article key={m.id} className="flex flex-col rounded-2xl border border-line bg-surface p-6">
            <span className="grid size-10 place-items-center rounded-xl bg-sunken text-ink">
              <m.icon className="size-5" />
            </span>
            <h3 className="mt-5 text-[20px] font-semibold tracking-[-0.015em]">{m.label}</h3>
            <p className="mt-2 flex-1 text-[14.5px] leading-relaxed text-muted">{m.body}</p>
            <p className="mt-5 font-mono text-[11px] tracking-wide text-faint uppercase">{m.best}</p>
          </article>
        ))}
      </div>
    </section>
  )
}

const LANDING_MODELS = [
  { key: "pt1-wave", name: "Wave", role: "Deep thinking", icon: Waves, base: "Qwen3-4B", size: "2.3 GB", body: "Reasons step by step before it answers, and shows its thinking. Best for analysis, planning, math and the agent." },
  { key: "pt1-mini", name: "Mini", role: "Quick answers", icon: Zap, base: "Qwen3-0.6B", size: "0.4 GB", body: "The smallest download and the fastest replies. Great for everyday questions and quick edits." },
  { key: "pt1-renat", name: "Renat", role: "Coding", icon: Code2, base: "Qwen2.5-Coder-1.5B", size: "0.9 GB", body: "Writes, explains and fixes code, and builds web pages you can preview instantly in Code mode." },
]

function ModelsSection() {
  return (
    <section id="models" className="scroll-mt-20 border-y border-line-soft bg-panel/50">
      <div className="mx-auto max-w-[1240px] px-5 py-20 md:px-8 lg:py-24">
        <div className="max-w-2xl">
          <p className="eyebrow text-accent!">The Paper Tech 1 family</p>
          <h2 className="display mt-3 text-[34px] font-semibold md:text-[46px]">Three models. Pick the right one.</h2>
          <p className="mt-4 text-[17px] text-muted">Each one downloads once and then runs on your own computer — private, unlimited and offline.</p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {LANDING_MODELS.map((m) => (
            <article key={m.key} className="flex flex-col rounded-2xl border border-line bg-surface p-6">
              <div className="flex items-center gap-3">
                <span className="brand-gradient grid size-10 place-items-center rounded-xl text-white">
                  <m.icon className="size-5" />
                </span>
                <div>
                  <p className="font-mono text-[11px] tracking-wide text-faint uppercase">Paper Tech 1</p>
                  <h3 className="text-[22px] leading-tight font-semibold tracking-[-0.02em]">{m.name}</h3>
                </div>
              </div>
              <p className="mt-4 text-[13px] font-medium text-accent">{m.role}</p>
              <p className="mt-1.5 flex-1 text-[14.5px] leading-relaxed text-muted">{m.body}</p>
              <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-line-soft pt-4 text-[12.5px]">
                <div>
                  <dt className="text-faint">Download</dt>
                  <dd className="font-medium tabular-nums">{m.size}</dd>
                </div>
                <div>
                  <dt className="text-faint">Built on</dt>
                  <dd className="font-medium">{m.base}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
        <p className="mt-6 text-[13px] text-muted">
          Plus <b className="text-ink">Paper Tech Nano</b>, our tiny model trained from scratch. It's built in, works in every browser and knows its way around Paper Tech. The Paper Tech 1 models are built on open-source Qwen models (Apache 2.0) and need a browser with WebGPU.
        </p>
      </div>
    </section>
  )
}

export default function Landing() {
  const [billing, setBilling] = useState<Billing>("yearly")
  const [contact, setContact] = useState(false)
  const [faq, setFaq] = useState<number | null>(0)

  return (
    <div className="min-h-dvh bg-canvas">
      <Nav />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <svg className="pointer-events-none absolute -top-40 -right-60 hidden h-[900px] w-[1100px] text-line lg:block" viewBox="0 0 1100 900" fill="none" aria-hidden="true">
          <rect x="300" y="120" width="440" height="580" rx="22" stroke="currentColor" transform="rotate(-14 520 410)" />
          <rect x="360" y="150" width="440" height="580" rx="22" stroke="currentColor" transform="rotate(9 580 440)" />
          <path d="M700 150v70a18 18 0 0 0 18 18h70" stroke="currentColor" transform="rotate(9 580 440)" />
        </svg>
        <div className="relative mx-auto grid max-w-[1240px] items-center gap-14 px-5 pt-14 pb-20 md:px-8 lg:grid-cols-[1.1fr_1fr] lg:pt-24 lg:pb-32">
          <div className="rise">
            <p className="eyebrow inline-flex items-center gap-2 text-accent!">
              <span className="brand-gradient size-1.5 rounded-full" /> Paper Tech · the home of Paper Tech AI
            </p>
            <h1 className="display mt-5 text-[46px] font-semibold sm:text-[64px] lg:text-[58px] xl:text-[68px]">
              Work, chat, code and delegate.
              <br />
              <span className="brand-text">All on your device.</span>
            </h1>
            <p className="mt-6 max-w-[540px] text-[17px] leading-relaxed text-muted md:text-[19px]">One app, four modes and the Paper Tech 1 models: Wave for deep thinking, Mini for quick answers and Renat for code. Everything runs privately in your browser.</p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <Button size="lg" onClick={() => navigate("/signup")} iconRight={<ArrowUpRight className="size-4" />}>
                Get started free
              </Button>
              <Button size="lg" variant="secondary" onClick={() => document.querySelector("#try")?.scrollIntoView({ behavior: "smooth" })}>
                Try the live demo
              </Button>
            </div>
            <p className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13px] text-muted">
              {["Free plan forever", "Runs on your device", "Works offline"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check className="size-3.5 text-success" /> {t}
                </span>
              ))}
            </p>
          </div>
          <div className="rise [animation-delay:120ms]">
            <p className="eyebrow mb-4 text-accent!">Your research. A stronger first draft.</p>
            <HeroMock />
          </div>
        </div>
      </section>

      <ModesSection />
      <ModelsSection />

      {/* Features */}
      <section id="product" className="scroll-mt-20 mx-auto max-w-[1240px] px-5 py-20 md:px-8 lg:py-28">
        <div className="max-w-2xl">
          <p className="eyebrow text-accent!">Work mode</p>
          <h2 className="display mt-3 text-[34px] font-semibold md:text-[46px]">From a good question to a stronger draft.</h2>
          <p className="mt-4 text-[17px] text-muted">Your sources. Your team's context. Room to think.</p>
        </div>
        <div className="mt-14 grid gap-5 md:grid-cols-2">
          {FEATURES.map((f) => (
            <article key={f.n} className="group overflow-hidden rounded-2xl border border-line bg-surface transition-shadow hover:shadow-card">
              <div className="border-b border-line-soft bg-panel/50 p-5 md:p-6">
                <div className="overflow-hidden rounded-xl border border-line bg-canvas shadow-card transition-transform duration-500 group-hover:-translate-y-0.5">{f.mock}</div>
              </div>
              <div className="p-6 md:p-7">
                <p className="font-mono text-[11px] tracking-wide text-accent">{f.n} /</p>
                <h3 className="mt-2 text-[21px] font-semibold tracking-[-0.015em]">{f.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-muted">{f.body}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <TryIt />

      {/* How it works */}
      <section className="mx-auto max-w-[1240px] px-5 py-20 md:px-8 lg:py-28">
        <p className="eyebrow text-accent!">How it works</p>
        <h2 className="display mt-3 max-w-2xl text-[34px] font-semibold md:text-[46px]">Three steps to a calmer way of working.</h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          {[
            { icon: Upload, t: "Bring your context", b: "Add interviews, docs, spreadsheets and links to a project. Paper Tech reads them in seconds." },
            { icon: ScanSearch, t: "Ask and explore", b: "Ask questions in plain language. Get structured answers with sources you can check." },
            { icon: PenLine, t: "Make it something", b: "Turn findings into briefs and drafts with a writing partner — then share with your team." },
          ].map((s, i) => (
            <div key={s.t} className="relative">
              <div className="flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-xl bg-accent-soft text-accent">
                  <s.icon className="size-5" strokeWidth={1.7} />
                </span>
                <span className="font-mono text-[12px] text-faint">Step {i + 1}</span>
              </div>
              <h3 className="mt-5 text-[19px] font-semibold">{s.t}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.b}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy */}
      <section className="bg-navy text-white">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-20 md:grid-cols-2 md:px-8 lg:py-24">
          <div>
            <ShieldCheck className="size-8 text-white/80" strokeWidth={1.5} />
            <h2 className="display mt-5 text-[34px] font-semibold md:text-[44px]">Your ideas stay yours.</h2>
            <p className="mt-4 max-w-md text-[16px] leading-relaxed text-white/70">The AI runs on your own device, so your questions, files and drafts never leave your computer. Nothing is used to train AI models.</p>
          </div>
          <ul className="grid gap-4 self-center sm:grid-cols-2">
            {[
              [Lock, "On-device AI", "Answers are generated on your computer, not in the cloud."],
              [ShieldCheck, "Never used for training", "Your content isn't used to train AI models."],
              [Users, "Roles & permissions", "Owners, admins and members — you decide."],
              [FileText, "Export anytime", "Download your data whenever you like."],
            ].map(([Icon, t, b]) => {
              const I = Icon as typeof Lock
              return (
                <li key={t as string} className="rounded-xl border border-white/10 bg-white/[0.04] p-5">
                  <I className="size-5 text-white/80" strokeWidth={1.6} />
                  <p className="mt-3 font-medium">{t as string}</p>
                  <p className="mt-1 text-[13.5px] text-white/60">{b as string}</p>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 mx-auto max-w-[1240px] px-5 py-20 md:px-8 lg:py-28">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow text-accent!">Pricing</p>
            <h2 className="display mt-3 text-[34px] font-semibold md:text-[46px]">Simple plans. Room to grow.</h2>
            <p className="mt-3 text-[16px] text-muted">Start free. Try Pro or Team free for 14 days.</p>
          </div>
          <BillingToggle billing={billing} onChange={setBilling} />
        </div>
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((p) => (
            <PlanCard key={p.id} plan={p} billing={billing} onSelect={() => (p.id === "enterprise" ? setContact(true) : navigate(`/signup?plan=${p.id}&billing=${billing}`))} />
          ))}
        </div>
        <p className="mt-6 text-center text-[13.5px]">
          <a href="#/pricing" className="text-accent hover:underline">
            Compare every feature →
          </a>
        </p>
      </section>

      {/* FAQ */}
      <section id="faq" className="scroll-mt-20 border-t border-line-soft">
        <div className="mx-auto grid max-w-[1240px] gap-10 px-5 py-20 md:px-8 lg:grid-cols-[0.8fr_1.2fr] lg:py-28">
          <div>
            <p className="eyebrow text-accent!">FAQ</p>
            <h2 className="display mt-3 text-[34px] font-semibold md:text-[42px]">Good questions.</h2>
          </div>
          <div className="divide-y divide-line border-y border-line">
            {FAQ.map(([q, a], i) => (
              <div key={q}>
                <button className="flex w-full items-center justify-between gap-4 py-5 text-left text-[16px] font-medium" onClick={() => setFaq(faq === i ? null : i)} aria-expanded={faq === i}>
                  {q}
                  <ChevronDown className={cx("size-4 shrink-0 text-muted transition-transform", faq === i && "rotate-180")} />
                </button>
                {faq === i && <p className="fade -mt-1 pb-5 text-[15px] leading-relaxed text-muted">{a}</p>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="px-5 pb-20 md:px-8">
        <div className="relative mx-auto max-w-[1240px] overflow-hidden rounded-3xl bg-panel px-6 py-16 text-center md:py-20">
          <PaperMark className="mx-auto size-12" />
          <h2 className="display mx-auto mt-6 max-w-2xl text-[34px] font-semibold md:text-[48px]">From a good question to a stronger draft.</h2>
          <p className="mt-4 text-[16px] text-muted">Your sources. Your team's context. Room to think.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Button size="lg" onClick={() => navigate("/signup")} iconRight={<ArrowUpRight className="size-4" />}>
              Meet Paper Tech AI
            </Button>
            <Button size="lg" variant="secondary" onClick={() => navigate("/pricing")}>
              See pricing
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-line-soft">
        <div className="mx-auto grid max-w-[1240px] gap-8 px-5 py-12 md:grid-cols-[1.5fr_1fr_1fr_1fr] md:px-8">
          <div>
            <Logo />
            <p className="mt-3 max-w-xs text-[13.5px] text-muted">The AI workspace for your team's research, writing, and everything in between.</p>
          </div>
          {[
            ["Product", [["Features", "#product"], ["Live demo", "#try"], ["Pricing", "#/pricing"]]],
            ["Account", [["Sign up", "#/signup"], ["Sign in", "#/signin"], ["Open app", "#/app"]]],
            ["Legal", [["Terms", "#/terms"], ["Privacy", "#/privacy"]]],
          ].map(([h, items]) => (
            <div key={h as string}>
              <p className="text-[13px] font-medium">{h as string}</p>
              <ul className="mt-3 space-y-2">
                {(items as string[][]).map(([l, href]) => (
                  <li key={l}>
                    <a
                      href={href}
                      onClick={(e) => {
                        if (href.startsWith("#") && !href.startsWith("#/")) {
                          e.preventDefault()
                          document.querySelector(href)?.scrollIntoView({ behavior: "smooth" })
                        }
                      }}
                      className="text-[13.5px] text-muted hover:text-ink"
                    >
                      {l}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto flex max-w-[1240px] flex-wrap justify-between gap-2 border-t border-line-soft px-5 py-6 text-[12px] text-faint md:px-8">
          <span>© {new Date().getFullYear()} Paper Tech AI</span>
          <span>A little space for big ideas.</span>
        </div>
      </footer>
      <ContactSales open={contact} onClose={() => setContact(false)} />
    </div>
  )
}
