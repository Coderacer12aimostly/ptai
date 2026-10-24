import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUp,
  Bot,
  BrainCircuit,
  Calculator,
  CalendarDays,
  Check,
  ChevronDown,
  Clock,
  Code2,
  Copy,
  Cpu,
  Download,
  FileSearch,
  FilePlus2,
  Globe,
  MessageCircle,
  Paperclip,
  PanelRight,
  Play,
  Square,
  Terminal,
  TriangleAlert,
  Waves,
  X,
  Zap,
} from "lucide-react"
import { useStore } from "../../lib/store"
import { navigate, quietReplace, useRoute } from "../../lib/router"
import { isStreaming, stopStreaming, useNewConversation, useSend } from "../../lib/chat"
import { stopAgent, useRunAgent } from "../../lib/agent"
import { CHAT_MODELS, checkWebGPU, localModel } from "../../lib/local"
import { codeBlocks, convoPath, fileExt, langName, modeInfo, previewDoc, type CodeBlock } from "../../lib/modes"
import type { AgentStep, AppMode, Message } from "../../lib/types"
import { Markdown } from "../../components/Markdown"
import { LocalPreparing } from "../../components/LocalAI"
import { Menu, MenuItem, PaperMark, Spinner } from "../../components/ui"
import { toast } from "../../components/toast"
import { cx, download, greeting } from "../../lib/utils"
import NotFound from "../NotFound"
import { DropOverlay, ImageStrip, MessageImages, useImageAttach } from "../../components/ImageAttach"
import ReplyActions from "../../components/ReplyActions"
import { MicButton, PlusMenu, SendButton, ToolChip, composerBox, useDictation, type PlusItem } from "../../components/ComposerBits"
import { stashImages, takeImages } from "../../lib/images"
import type { ImageRef } from "../../lib/types"

/* ------------------------------------------------------------------ icons */

export function ModeIcon({ mode, className = "size-4" }: { mode: AppMode; className?: string }) {
  const I = mode === "chat" ? MessageCircle : mode === "code" ? Code2 : mode === "agent" ? Bot : BriefcaseIcon
  return <I className={className} />
}
function BriefcaseIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
    </svg>
  )
}

export function ModelIcon({ k, className = "size-4" }: { k: string; className?: string }) {
  if (k === "pt1-wave") return <Waves className={className} />
  if (k === "pt1-mini") return <Zap className={className} />
  if (k === "pt1-renat") return <Code2 className={className} />
  return <PaperMark className={className} mono />
}

/* ------------------------------------------------------------------ model picker */

function useGpuOk() {
  const [ok, setOk] = useState(true)
  useEffect(() => void checkWebGPU().then((g) => setOk(g.ok)), [])
  return ok
}

export function ModelPicker({ value, onChange, compact, side = "up", align = "right" }: { value: string; onChange: (k: string) => void; compact?: boolean; side?: "up" | "down"; align?: "left" | "right" }) {
  const gpu = useGpuOk()
  const m = localModel(value)
  return (
    <Menu
      align={align}
      side={side}
      width={300}
      trigger={() => (
        <button type="button" className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] whitespace-nowrap text-ink hover:bg-sunken" title="Choose a model">
          {compact ? m.name.replace("Paper Tech 1 ", "") : m.name}
          {m.family && !compact && <span className="hidden text-faint sm:inline">{m.family.role}</span>}
          <ChevronDown className="size-3.5 text-muted" />
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="px-2.5 pt-1 pb-1.5 text-[11px] text-faint">Runs privately on this device</div>
          {CHAT_MODELS.map((x) => {
            const blocked = !gpu && !x.builtin
            return (
              <MenuItem
                key={x.key}
                active={x.key === m.key}
                icon={<ModelIcon k={x.key} />}
                onClick={() => {
                  close()
                  if (blocked) toast(`${x.name} needs WebGPU. Paper Tech will use its backup in this browser.`, "info")
                  onChange(x.key)
                }}
              >
                <span className="block">
                  {x.name} <span className="text-faint">· {x.family?.role ?? "Built in"}</span>
                </span>
                <span className="block text-[11px] text-faint">{blocked ? "Needs WebGPU (Chrome, Edge, Opera, Safari 26+)" : `${x.size === "built in" ? "Built in" : x.size} · ${x.blurb}`}</span>
              </MenuItem>
            )
          })}
        </>
      )}
    </Menu>
  )
}

/* ------------------------------------------------------------------ composer */

function ModeComposer({ mode, model, onModel, onSend, busy, onStop, autoFocus, big }: { mode: AppMode; model: string; onModel: (k: string) => void; onSend: (t: string, images: ImageRef[]) => void; busy?: boolean; onStop?: () => void; autoFocus?: boolean; big?: boolean }) {
  const { state, update } = useStore()
  const web = Boolean(state.prefs.webSearch)
  const [text, setText] = useState("")
  const att = useImageAttach()
  const mic = useDictation(text, setText)
  const ta = useRef<HTMLTextAreaElement>(null)
  const info = modeInfo(mode)
  useEffect(() => {
    const el = ta.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = Math.min(el.scrollHeight, 260) + "px"
  }, [text])
  const submit = () => {
    if ((!text.trim() && !att.images.length) || busy || att.busy) return
    onSend(text, att.images)
    setText("")
    att.clear()
  }
  const setWeb = (on: boolean) => {
    update((d) => void (d.prefs.webSearch = on))
    toast(on ? "Web search on — answers will include web sources" : "Web search off", "info")
  }
  return (
    <div className={composerBox} {...att.dropProps}>
      <DropOverlay show={att.dragging} />
      {att.input}
      <ImageStrip images={att.images} busy={att.busy} onRemove={att.remove} />
      <textarea
        onPaste={att.onPaste}
        ref={ta}
        value={text}
        autoFocus={autoFocus}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          const enter = e.key === "Enter" && !e.nativeEvent.isComposing
          if (enter && ((state.prefs.enterToSend && !e.shiftKey) || e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            submit()
          }
        }}
        rows={big ? 2 : 1}
        placeholder={mic.listening ? "Listening…" : info.placeholder}
        aria-label="Message"
        className={cx("block w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-[15px] leading-relaxed outline-none placeholder:text-faint", big && "min-h-[64px]", mode === "code" && "font-mono text-[13.5px]")}
      />
      <div className="flex items-center gap-1 px-2.5 pt-1 pb-2.5">
        <PlusMenu
          items={[
            { icon: <Paperclip />, label: "Add files or photos", hint: "PDF, Word, text, CSV, code, images", onClick: att.open },
            ...(mode !== "agent" ? (["divider", { icon: <Globe />, label: "Web search", hint: "Look things up before answering", onClick: () => setWeb(!web), checked: web }] as PlusItem[]) : []),
          ]}
        />
        <MicButton listening={mic.listening} onClick={mic.toggle} />
        {web && mode !== "agent" && <ToolChip icon={<Globe />} label="Web search" onRemove={() => setWeb(false)} />}
        <div className="flex-1" />
        <ModelPicker value={model} onChange={onModel} compact={!big} />
        <SendButton busy={busy} onStop={onStop} onSend={submit} disabled={(!text.trim() && !att.images.length) || att.busy} />
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ hooks */

function useModeModel(mode: AppMode, convoId?: string) {
  const { state, update } = useStore()
  const convo = state.conversations.find((c) => c.id === convoId)
  const key = localModel(convo?.localModel ?? state.prefs.modeModels?.[mode]).key
  const set = (k: string) =>
    update((d) => {
      d.prefs.modeModels = { ...d.prefs.modeModels, [mode]: k }
      d.prefs.localAI = true
      const c = d.conversations.find((x) => x.id === convoId)
      if (c) c.localModel = k
    })
  return [key, set] as const
}

function useStartConversation(mode: AppMode) {
  const newConversation = useNewConversation()
  const { state } = useStore()
  return (text: string, images: ImageRef[] = []) => {
    const id = newConversation({ appMode: mode, localModel: state.prefs.modeModels?.[mode], title: "New conversation", web: mode !== "agent" && Boolean(state.prefs.webSearch) })
    stashImages(id, images)
    navigate(`${convoPath(mode, id)}?q=${encodeURIComponent(text)}`)
  }
}

/* ------------------------------------------------------------------ mode home */

function ModeHome({ mode }: { mode: AppMode }) {
  const { user } = useStore()
  const info = modeInfo(mode)
  const [model, setModel] = useModeModel(mode)
  const start = useStartConversation(mode)
  const m = localModel(model)
  return (
    <div className="mx-auto flex min-h-full max-w-[720px] flex-col justify-center px-4 py-10 md:px-8">
      <div className="mb-7 text-center">
        <h1 className="display flex items-center justify-center gap-3 text-[30px] font-medium tracking-[-0.02em] md:text-[38px]">
          <PaperMark className="size-8 shrink-0 md:size-9" />
          {mode === "chat" ? `${greeting()}, ${user?.name.split(" ")[0] ?? "there"}` : mode === "code" ? "What are we building?" : "What should the agent do?"}
        </h1>
        <p className="mt-2 text-[15px] text-muted">{info.tagline}</p>
      </div>
      <ModeComposer mode={mode} model={model} onModel={setModel} onSend={start} autoFocus big />
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        {info.suggestions.map((s) => (
          <button key={s} onClick={() => start(s)} className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-[13px] text-muted transition-colors hover:border-accent-line hover:text-ink">
            {s}
          </button>
        ))}
      </div>
      <p className="mt-8 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-[12.5px] text-faint">
        <span className="inline-flex items-center gap-1.5">
          <ModelIcon k={m.key} className="size-3.5" /> {m.name}
        </span>
        <span>·</span>
        <span>Runs on this device. Nothing you type leaves your computer.</span>
      </p>
      {mode === "agent" && <AgentToolsNote />}
    </div>
  )
}

function AgentToolsNote() {
  const tools: Array<[React.ReactNode, string]> = [
    [<FileSearch key="a" />, "Search your files"],
    [<FilePlus2 key="b" />, "Create documents"],
    [<Calculator key="c" />, "Calculate"],
    [<Terminal key="d" />, "Run JavaScript"],
    [<CalendarDays key="e" />, "Read calendar & email"],
    [<Globe key="f" />, "Wikipedia"],
  ]
  return (
    <div className="mt-6 rounded-xl border border-line-soft bg-sunken p-4">
      <p className="text-[12.5px] font-medium">Tools the agent can use</p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {tools.map(([icon, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-2.5 py-1 text-[12px] text-muted [&_svg]:size-3.5">
            {icon}
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ message parts */

function ThinkingBlock({ m }: { m: Message }) {
  const streaming = m.status === "streaming" && !m.content
  const [open, setOpen] = useState(false)
  if (!m.thinking) return null
  const secs = m.thinkMs ? Math.max(1, Math.round(m.thinkMs / 1000)) : null
  return (
    <div className="mb-3 rounded-xl border border-line-soft bg-sunken">
      <button onClick={() => setOpen(!open)} className="flex w-full items-center gap-2 px-3.5 py-2.5 text-left text-[12.5px] text-muted hover:text-ink" aria-expanded={open || streaming}>
        <BrainCircuit className={cx("size-4", streaming && "animate-pulse text-brand-b")} />
        <span className="font-medium">{streaming ? "Thinking…" : secs ? `Thought for ${secs} s` : "Thoughts"}</span>
        <ChevronDown className={cx("ml-auto size-3.5 transition-transform", (open || streaming) && "rotate-180")} />
      </button>
      {(open || streaming) && <div className="max-h-[260px] overflow-y-auto border-t border-line-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed whitespace-pre-wrap text-muted">{m.thinking.trim()}</div>}
    </div>
  )
}

const STEP_ICON: Record<string, React.ReactNode> = {
  search_files: <FileSearch />,
  create_document: <FilePlus2 />,
  calculator: <Calculator />,
  run_javascript: <Terminal />,
  current_time: <Clock />,
  calendar_and_email: <CalendarDays />,
  wikipedia: <Globe />,
  web_search: <Globe />,
}

function AgentSteps({ steps }: { steps: AgentStep[] }) {
  if (!steps.length) return null
  return (
    <ol className="mb-3 grid gap-1.5">
      {steps.map((s, i) => (
        <li key={s.id} className="rounded-xl border border-line bg-surface">
          <details className="group">
            <summary className="flex cursor-pointer list-none items-center gap-2.5 px-3 py-2 text-[13px] [&::-webkit-details-marker]:hidden">
              <span className="grid size-6 shrink-0 place-items-center rounded-md bg-sunken text-muted [&_svg]:size-3.5">{STEP_ICON[s.tool] ?? <Bot />}</span>
              <span className="min-w-0 flex-1 truncate">
                <span className="mr-1.5 font-mono text-[11px] text-faint">{i + 1}</span>
                {s.label}
              </span>
              {s.status === "running" ? <Spinner className="size-3.5 text-muted" /> : s.status === "error" ? <TriangleAlert className="size-3.5 text-warn" /> : <Check className="size-3.5 text-success" />}
              <ChevronDown className="size-3.5 text-faint transition-transform group-open:rotate-180" />
            </summary>
            {s.output && (
              <div className="border-t border-line-soft px-3 py-2">
                <pre className="max-h-[200px] overflow-auto font-mono text-[11.5px] leading-relaxed whitespace-pre-wrap text-muted">{s.output}</pre>
                {s.href && (
                  <a href={s.href} className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-accent hover:underline">
                    Open document →
                  </a>
                )}
              </div>
            )}
          </details>
        </li>
      ))}
    </ol>
  )
}

/** Code mode: text parts as Markdown, code blocks as chips that open in the code panel. */
function CodeAnswer({ text, streaming, onOpen }: { text: string; streaming: boolean; onOpen: (i: number) => void }) {
  const parts: Array<{ kind: "text"; v: string } | { kind: "code"; b: CodeBlock; open: boolean }> = []
  const re = /```([\w+#.-]*)[^\n]*\n([\s\S]*?)(```|$)/g
  let last = 0
  let m: RegExpExecArray | null
  let i = 0
  while ((m = re.exec(text))) {
    if (m.index > last) parts.push({ kind: "text", v: text.slice(last, m.index) })
    parts.push({ kind: "code", b: { lang: (m[1] || "text").toLowerCase(), code: m[2], index: i++ }, open: m[3] !== "```" })
    last = m.index + m[0].length
  }
  if (last < text.length) parts.push({ kind: "text", v: text.slice(last) })
  return (
    <div className="grid gap-2">
      {parts.map((p, k) =>
        p.kind === "text" ? (
          p.v.trim() ? <Markdown key={k} text={p.v} streaming={streaming && k === parts.length - 1} /> : null
        ) : (
          <button key={k} onClick={() => onOpen(p.b.index)} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-left hover:bg-sunken">
            <span className="grid size-8 place-items-center rounded-lg bg-sunken text-muted">
              <Code2 className="size-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-medium">{fileName(p.b)}</span>
              <span className="block text-[11.5px] text-faint">
                {langName(p.b.lang)} · {p.b.code.split("\n").length} lines{p.open && streaming ? " · writing…" : ""}
              </span>
            </span>
            {p.open && streaming ? <Spinner className="size-3.5 text-muted" /> : <span className="text-[12px] text-muted">Open</span>}
          </button>
        ),
      )}
    </div>
  )
}

const fileName = (b: CodeBlock) => (b.lang === "html" ? "index.html" : b.lang === "css" ? "styles.css" : b.lang === "javascript" || b.lang === "js" ? "script.js" : b.lang === "python" || b.lang === "py" ? "main.py" : `snippet-${b.index + 1}.${fileExt[b.lang] ?? "txt"}`)

/* ------------------------------------------------------------------ code panel */

function CodePanel({ blocks, active, onActive, onClose, live }: { blocks: CodeBlock[]; active: number; onActive: (i: number) => void; onClose: () => void; live: boolean }) {
  // Build the preview once the answer has finished, so the page doesn't reload on every token.
  const doc = useMemo(() => (live ? null : previewDoc(blocks)), [blocks, live])
  const [tab, setTab] = useState<"code" | "preview">(doc ? "preview" : "code")
  const hadDoc = useRef(Boolean(doc))
  useEffect(() => {
    if (doc && !hadDoc.current) setTab("preview")
    hadDoc.current = Boolean(doc)
  }, [doc])
  const [runKey, setRunKey] = useState(0)
  const [logs, setLogs] = useState<Array<{ type: string; text: string }>>([])
  const b = blocks[Math.min(active, blocks.length - 1)]
  useEffect(() => {
    const on = (e: MessageEvent) => e.data?.__ptconsole && setLogs((l) => [...l.slice(-49), { type: e.data.type, text: e.data.text }])
    window.addEventListener("message", on)
    return () => window.removeEventListener("message", on)
  }, [])
  useEffect(() => {
    setLogs([])
  }, [runKey, doc])
  useEffect(() => {
    if (!doc && tab === "preview") setTab("code")
  }, [doc, tab])
  if (!b) {
    return (
      <div className="grid h-full place-items-center p-8 text-center">
        <div>
          <Code2 className="mx-auto size-6 text-faint" />
          <p className="mt-3 text-[14px] font-medium">Code shows up here</p>
          <p className="mt-1 text-[13px] text-muted">Ask for a web page to see a live preview.</p>
        </div>
      </div>
    )
  }
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-1 border-b border-line px-3 py-2">
        <div className="flex rounded-lg bg-sunken p-0.5 text-[12.5px]" role="tablist">
          <button role="tab" aria-selected={tab === "code"} onClick={() => setTab("code")} className={cx("rounded-md px-3 py-1", tab === "code" ? "bg-surface font-medium shadow-card" : "text-muted")}>
            Code
          </button>
          <button role="tab" aria-selected={tab === "preview"} disabled={!doc} onClick={() => setTab("preview")} className={cx("rounded-md px-3 py-1 disabled:opacity-40", tab === "preview" ? "bg-surface font-medium shadow-card" : "text-muted")}>
            Preview
          </button>
        </div>
        <div className="flex-1" />
        {tab === "preview" ? (
          <button onClick={() => setRunKey((k) => k + 1)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] text-muted hover:bg-sunken hover:text-ink">
            <Play className="size-3.5" /> Run again
          </button>
        ) : (
          <>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(b.code)
                  toast("Code copied")
                } catch {
                  toast("Couldn't copy here. Select the code and copy it instead.", "error")
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] text-muted hover:bg-sunken hover:text-ink"
            >
              <Copy className="size-3.5" /> Copy
            </button>
            <button onClick={() => download(fileName(b), b.code)} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-[12.5px] text-muted hover:bg-sunken hover:text-ink">
              <Download className="size-3.5" /> Download
            </button>
          </>
        )}
        <button onClick={onClose} className="grid size-8 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink" aria-label="Close code panel">
          <X className="size-4" />
        </button>
      </div>
      {tab === "code" ? (
        <>
          {blocks.length > 1 && (
            <div className="flex gap-1 overflow-x-auto border-b border-line-soft px-3 py-1.5">
              {blocks.map((x, i) => (
                <button key={i} onClick={() => onActive(i)} className={cx("rounded-md px-2.5 py-1 font-mono text-[12px] whitespace-nowrap", i === active ? "bg-sunken text-ink" : "text-muted hover:text-ink")}>
                  {fileName(x)}
                </button>
              ))}
            </div>
          )}
          <div className="min-h-0 flex-1 overflow-auto bg-sunken">
            <pre className="min-w-max p-4 font-mono text-[12.5px] leading-[1.65]">
              {b.code.split("\n").map((line, i) => (
                <div key={i} className="flex">
                  <span className="mr-4 w-8 shrink-0 text-right text-faint select-none">{i + 1}</span>
                  <span className="whitespace-pre">{line || " "}</span>
                </div>
              ))}
            </pre>
          </div>
          {!doc && /^(py|python)$/.test(b.lang) && <p className="border-t border-line-soft px-4 py-2 text-[12px] text-muted">Python doesn't run in the browser preview. Download the file and run it with Python on your computer.</p>}
        </>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <iframe key={runKey} title="Preview" sandbox="allow-scripts allow-modals allow-forms" srcDoc={doc ?? ""} className="min-h-0 w-full flex-1 bg-white" />
          {logs.length > 0 && (
            <div className="max-h-[140px] overflow-auto border-t border-line bg-sunken px-3 py-2 font-mono text-[11.5px]">
              {logs.map((l, i) => (
                <div key={i} className={cx(l.type === "error" ? "text-danger" : l.type === "warn" ? "text-warn" : "text-muted")}>
                  › {l.text}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ------------------------------------------------------------------ conversation */

const autoSent = new Set<string>()

function ModeConversation({ mode, id }: { mode: AppMode; id: string }) {
  const { state, update } = useStore()
  const { query } = useRoute()
  const send = useSend()
  const runAgent = useRunAgent()
  const convo = state.conversations.find((c) => c.id === id)
  const [model, setModel] = useModeModel(mode, id)
  const busy = isStreaming(convo)
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const [panelOpen, setPanelOpen] = useState(mode === "code")
  const [codeFrom, setCodeFrom] = useState<string | null>(null)
  const [active, setActive] = useState(0)

  const go = (text: string, images: ImageRef[] = []) => (mode === "agent" ? runAgent(id, text, images) : send(id, text, { images, web: Boolean(state.prefs.webSearch) }))

  useEffect(() => {
    const q = query.get("q")
    if (convo && q !== null && !autoSent.has(id)) {
      autoSent.add(id)
      quietReplace(`#${convoPath(mode, id)}`)
      go(q, takeImages(id))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [convo, id, query])

  useEffect(() => {
    const el = scroller.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [convo?.messages])

  // Code mode: show the newest answer that has code (or the one the user opened).
  const codeMsg = useMemo(() => {
    if (mode !== "code" || !convo) return undefined
    const withCode = convo.messages.filter((m) => m.role === "assistant" && m.content.includes("```"))
    return withCode.find((m) => m.id === codeFrom) ?? withCode[withCode.length - 1]
  }, [mode, convo, codeFrom])
  const blocks = useMemo(() => (codeMsg ? codeBlocks(codeMsg.content) : []), [codeMsg])
  const finished = codeMsg?.status !== "streaming"

  if (!convo) return <NotFound inApp />

  const list = (
    <div ref={scroller} onScroll={(e) => (stick.current = e.currentTarget.scrollHeight - e.currentTarget.scrollTop - e.currentTarget.clientHeight < 80)} className="scroll-thin min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto grid max-w-[720px] gap-7 px-5 pt-8 pb-6 md:px-8">
        {convo.messages.map((m, idx) =>
          m.role === "user" ? (
            <div key={m.id} className="ml-auto grid max-w-[85%] justify-items-end gap-2">
              {m.images && m.images.length > 0 && <MessageImages images={m.images} />}
              {m.content && <div className={cx("rounded-[18px] bg-sunken px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap", mode === "code" && "font-mono text-[13px]")}>{m.content}</div>}
            </div>
          ) : (
            <div key={m.id} className="group/reply min-w-0 text-[15px]">
              <ThinkingBlock m={m} />
              {m.steps && <AgentSteps steps={m.steps} />}
              {m.status === "streaming" && !m.content && !m.thinking && !(m.steps && m.steps.length) && (
                <>
                  <span className="inline-flex items-center gap-2 text-[13px] text-muted">
                    <Spinner className="size-3.5" /> {m.phase ?? (mode === "agent" ? "Planning…" : "Working…")}
                  </span>
                  <LocalPreparing />
                </>
              )}
              {mode === "code" ? (
                <CodeAnswer
                  text={m.content}
                  streaming={m.status === "streaming"}
                  onOpen={(i) => {
                    setCodeFrom(m.id)
                    setActive(i)
                    setPanelOpen(true)
                  }}
                />
              ) : (
                m.content && <Markdown text={m.content} streaming={m.status === "streaming"} />
              )}
              {m.status === "error" && <p className="mt-2 text-[13px] text-danger">This answer didn't finish. Try again.</p>}
              {m.status !== "streaming" && m.content && (
                <ReplyActions
                  id={m.id}
                  text={m.content}
                  feedback={m.feedback}
                  onFeedback={(f) => update((d) => void (d.conversations.find((c) => c.id === id)!.messages.find((x) => x.id === m.id)!.feedback = f))}
                  onRetry={
                    mode !== "agent" && idx === convo.messages.length - 1 && !busy
                      ? () => {
                          const u = idx - 1
                          const prev = convo.messages[u]
                          if (prev?.role === "user") send(id, prev.content, { truncateAt: u, images: prev.images, web: Boolean(state.prefs.webSearch) })
                        }
                      : undefined
                  }
                  meta={
                    <>
                      {m.model?.startsWith("local:") ? localModel(m.model.slice(6)).name : m.mode === "demo" ? "Built-in helper" : "Paper Tech"}
                      {m.mode === "device" && (
                        <>
                          <span>·</span>
                          <Cpu className="size-3" /> on device
                        </>
                      )}
                    </>
                  }
                />
              )}
            </div>
          ),
        )}
      </div>
    </div>
  )

  const composer = (
    <div className="mx-auto w-full max-w-[720px] px-4 pb-4 md:px-8">
      <p className="mb-2 text-center text-[11.5px] text-faint">Paper Tech is AI and can make mistakes. Check important details.</p>
      <ModeComposer mode={mode} model={model} onModel={setModel} onSend={go} busy={busy} onStop={() => (mode === "agent" ? stopAgent(id) : stopStreaming(id))} />
    </div>
  )

  if (mode !== "code")
    return (
      <div className="flex h-full min-h-0 flex-col">
        {list}
        {composer}
      </div>
    )

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-end px-4 pt-3">
          {!panelOpen && (
            <button onClick={() => setPanelOpen(true)} className="inline-flex items-center gap-1.5 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[12.5px] text-muted hover:text-ink">
              <PanelRight className="size-3.5" /> Code panel
            </button>
          )}
        </div>
        {list}
        {composer}
      </div>
      {panelOpen && (
        <aside className="fixed inset-0 z-40 flex flex-col bg-surface md:static md:z-auto md:w-[min(46%,640px)] md:border-l md:border-line">
          {finished || blocks.length ? <CodePanel key={codeMsg?.id} blocks={blocks} active={active} onActive={setActive} onClose={() => setPanelOpen(false)} live={!finished} /> : null}
        </aside>
      )}
    </div>
  )
}

export default function ModePage({ mode, id }: { mode: AppMode; id?: string }) {
  return id ? <ModeConversation mode={mode} id={id} /> : <ModeHome mode={mode} />
}

