import { useEffect, useRef, useState } from "react"
import { ArrowUp, Check, Code2, Copy, FolderSearch, Globe, Info, LayoutGrid, MessageSquare, Plus, RotateCcw, Trash2, Users } from "lucide-react"
import { Badge, Button, Field, Input, Modal, Textarea, Toggle } from "../../components/ui"
import { ASSISTANT_ICONS, AssistantIcon } from "../../components/icons"
import { Markdown } from "../../components/Markdown"
import { TopbarActions } from "../../components/AppShell"
import { useStore } from "../../lib/store"
import { navigate } from "../../lib/router"
import { MODELS } from "../../lib/models"
import { planById } from "../../lib/plans"
import { isOnDevice, streamChat } from "../../lib/ai"
import { retrieve } from "../../lib/knowledge"
import { systemPrompt, useNewConversation } from "../../lib/chat"
import type { Assistant } from "../../lib/types"
import { cx, timeAgo, uid } from "../../lib/utils"
import { toast } from "../../components/toast"
import { openUpgrade } from "../../components/upgrade"

const TEMPLATES: Array<Omit<Assistant, "id" | "updatedAt" | "shared">> = [
  { name: "Interview analyst", tagline: "Patterns across conversations.", icon: "scan", model: "claude-sonnet-5-5", creativity: 0.2, tools: { web: false, knowledge: true, code: false }, instructions: "You analyse customer interviews. Group findings into themes, count how many participants mention each, and quote participants verbatim with citations. Separate what people said from your interpretation." },
  { name: "Editor", tagline: "Sharper, shorter, kinder.", icon: "pen", model: "claude-sonnet-5-5", creativity: 0.4, tools: { web: false, knowledge: true, code: false }, instructions: "You are a careful editor. Tighten sentences, cut filler, and keep the author's voice. Return the edited text first, then list the three most important changes." },
  { name: "Competitive analyst", tagline: "Who else is out there.", icon: "chart", model: "claude-opus-5-5", creativity: 0.3, tools: { web: true, knowledge: true, code: false }, instructions: "You research competitors. Produce comparison tables with pricing, positioning, strengths and gaps. Always cite sources and flag anything that may be out of date." },
  { name: "Meeting summariser", tagline: "Decisions, owners, next steps.", icon: "sparkles", model: "claude-haiku-5-5", creativity: 0.2, tools: { web: false, knowledge: true, code: false }, instructions: "Summarise meeting notes into: Decisions, Action items (owner + date), Open questions. Keep it under 200 words." },
  { name: "Strategy sparring partner", tagline: "Pressure-test the plan.", icon: "compass", model: "claude-opus-5-5", creativity: 0.7, tools: { web: true, knowledge: true, code: false }, instructions: "Challenge plans constructively. Identify the riskiest assumption, the strongest counter-argument, and one cheap experiment to test it." },
]

interface PlayMsg {
  role: "user" | "assistant"
  content: string
  streaming?: boolean
}

function Playground({ draft }: { draft: Assistant }) {
  const { state, countMessage } = useStore()
  const [msgs, setMsgs] = useState<PlayMsg[]>([])
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    setMsgs([])
  }, [draft.id])
  useEffect(() => {
    box.current?.scrollTo({ top: box.current.scrollHeight })
  }, [msgs])

  async function ask(q: string) {
    if (!q.trim() || busy) return
    if (!(await isOnDevice(state.prefs.apiKey)) && !countMessage()) return openUpgrade("You've used all of this month's cloud AI messages. On-device AI is unlimited.")
    setText("")
    setBusy(true)
    const history = [...msgs, { role: "user" as const, content: q }]
    setMsgs([...history, { role: "assistant", content: "", streaming: true }])
    const files = draft.tools.knowledge ? state.files.filter((f) => f.status === "ready") : []
    const passages = await retrieve(files, q)
    try {
      await streamChat({
        system:
          systemPrompt({ workspace: state.workspace?.name, instructions: draft.instructions, hasSources: passages.length > 0, web: draft.tools.web }) +
          (passages.length ? `\n\n<sources>\n${passages.map((p, i) => `<source n="${i + 1}" title="${p.file.name}">${p.text}</source>`).join("\n")}\n</sources>` : ""),
        model: draft.model,
        temperature: draft.creativity,
        web: draft.tools.web,
        apiKey: state.prefs.apiKey,
        messages: history,
        maxTokens: 900,
        demo: { passages },
        onText: (t) => setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, content: x.content + t } : x))),
      })
    } catch (e) {
      setMsgs((m) => m.map((x, i) => (i === m.length - 1 ? { ...x, content: `Something went wrong: ${(e as Error).message}` } : x)))
    }
    setMsgs((m) => m.map((x) => ({ ...x, streaming: false })))
    setBusy(false)
  }

  return (
    <div className="flex h-[440px] flex-col rounded-2xl border border-line bg-sunken p-5">
      <div className="flex items-center justify-between">
        <span className="eyebrow">Playground</span>
        <button className="inline-flex items-center gap-1 text-[12px] text-muted hover:text-ink" onClick={() => setMsgs([])} disabled={!msgs.length}>
          <RotateCcw className="size-3.5" /> Reset
        </button>
      </div>
      <div ref={box} className="scroll-thin mt-4 flex-1 space-y-4 overflow-y-auto pr-1">
        {msgs.length === 0 && (
          <div className="space-y-2">
            <p className="text-[12.5px] text-muted">Test your assistant with its current, unsaved settings:</p>
            {["What's the strongest signal in our sources?", "Give me three ways to open the launch post.", "What should I be worried about?"].map((s) => (
              <button key={s} onClick={() => ask(s)} className="block w-full rounded-lg bg-surface px-3 py-2.5 text-left text-[12.5px] hover:text-accent">
                {s}
              </button>
            ))}
          </div>
        )}
        {msgs.map((m, i) =>
          m.role === "user" ? (
            <div key={i} className="rounded-lg bg-surface px-3.5 py-3 text-[13px]">
              {m.content}
            </div>
          ) : (
            <div key={i}>
              <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium">
                <AssistantIcon icon={draft.icon} className="size-4 text-accent" /> {draft.name || "Assistant"}
              </p>
              <Markdown text={m.content || "…"} streaming={m.streaming} className="text-[13px]! leading-relaxed" />
            </div>
          ),
        )}
      </div>
      <form
        className="mt-3 flex items-center gap-2 rounded-lg border border-line bg-surface py-1.5 pr-1.5 pl-3"
        onSubmit={(e) => {
          e.preventDefault()
          ask(text)
        }}
      >
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder="Test your assistant…" className="h-8 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint" />
        <button disabled={!text.trim() || busy} className="grid size-8 place-items-center rounded-md text-accent disabled:opacity-40" aria-label="Send test message">
          <ArrowUp className="size-4" />
        </button>
      </form>
    </div>
  )
}

export default function Assistants({ id }: { id?: string }) {
  const { state, update } = useStore()
  const newConversation = useNewConversation()
  const [templates, setTemplates] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const current = state.assistants.find((a) => a.id === id) ?? state.assistants[0]
  const [draft, setDraft] = useState<Assistant | null>(current ?? null)
  const plan = state.workspace?.plan ?? "free"

  const createdNew = useRef(false)
  useEffect(() => {
    if (id === "new" && !createdNew.current) (createdNew.current = true), create()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])
  useEffect(() => {
    setDraft(current ?? null)
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = draft && current && JSON.stringify({ ...draft, updatedAt: 0 }) !== JSON.stringify({ ...current, updatedAt: 0 })

  function create(t?: (typeof TEMPLATES)[number]) {
    const limit = planById(plan).assistants
    if (state.assistants.length >= limit) {
      navigate("/app/assistants", { replace: true })
      return openUpgrade(`The Free plan includes ${limit} assistants. Upgrade for unlimited assistants.`)
    }
    const a: Assistant = {
      ...(t ?? { name: "New assistant", tagline: "A fresh role.", icon: "sparkles" as const, instructions: "", model: state.prefs.defaultModel, creativity: 0.5, tools: { web: false, knowledge: true, code: false } }),
      id: uid("a-"),
      shared: false,
      updatedAt: Date.now(),
    }
    update((d) => void d.assistants.push(a))
    setTemplates(false)
    navigate(`/app/assistants/${a.id}`, { replace: id === "new" })
    toast(t ? `Added ${t.name}` : "New assistant created")
  }

  function save() {
    if (!draft) return
    if (!draft.name.trim()) return toast("Give your assistant a name", "error")
    update((d) => {
      const i = d.assistants.findIndex((x) => x.id === draft.id)
      if (i >= 0) d.assistants[i] = { ...draft, name: draft.name.trim(), updatedAt: Date.now() }
    })
    toast("Assistant saved")
  }

  const set = <K extends keyof Assistant>(k: K, v: Assistant[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))

  return (
    <div className="mx-auto max-w-[1300px] px-5 py-8 md:px-10 md:py-12">
      {dirty && (
        <TopbarActions>
          <Badge tone="warn">Unsaved changes</Badge>
        </TopbarActions>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[32px] font-semibold md:text-[38px]">A partner for every kind of thinking.</h1>
          <p className="mt-2 text-[15px] text-muted">Give Paper Tech a role, the right tools, and a little direction.</p>
        </div>
        <Button size="lg" icon={<Plus className="size-4" />} onClick={() => create()}>
          New assistant
        </Button>
      </div>

      <div className="mt-9 grid gap-6 lg:grid-cols-[220px_1fr] xl:grid-cols-[220px_1fr_330px]">
        {/* List */}
        <div>
          <p className="eyebrow mb-3">Workspace assistants</p>
          <div className="flex gap-3 overflow-x-auto pb-2 lg:flex-col lg:overflow-visible">
            {state.assistants.map((a) => (
              <a
                key={a.id}
                href={`#/app/assistants/${a.id}`}
                className={cx("relative block min-w-[180px] rounded-xl border p-4 transition-colors", a.id === draft?.id ? "border-accent-line bg-accent-soft" : "border-line bg-surface hover:border-faint/50")}
              >
                <AssistantIcon icon={a.icon} className={a.id === draft?.id ? "size-[18px] text-accent" : "size-[18px] text-muted"} />
                {a.shared && <Users className="absolute top-4 right-4 size-3.5 text-faint" />}
                <p className="mt-3 text-[13.5px] font-medium">{a.name}</p>
                <p className="mt-0.5 text-[12px] text-muted">{a.tagline}</p>
              </a>
            ))}
          </div>
          <button onClick={() => setTemplates(true)} className="mt-4 inline-flex items-center gap-2 text-[13px] text-muted hover:text-accent">
            <LayoutGrid className="size-4" /> Explore templates
          </button>
          <p className="mt-10 hidden gap-2 text-[12px] leading-relaxed text-muted lg:flex">
            <Info className="mt-0.5 size-4 shrink-0" />
            Assistants remember their instructions, not your conversations. Project knowledge provides the context.
          </p>
        </div>

        {/* Editor */}
        {draft ? (
          <div className="rounded-2xl border border-line bg-surface p-5 md:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex gap-1">
                  {(Object.keys(ASSISTANT_ICONS) as Assistant["icon"][]).map((k) => (
                    <button key={k} onClick={() => set("icon", k)} className={cx("grid size-9 place-items-center rounded-lg", draft.icon === k ? "bg-accent-soft text-accent" : "text-faint hover:text-ink")} aria-label={`Icon ${k}`}>
                      <AssistantIcon icon={k} className="size-[18px]" />
                    </button>
                  ))}
                </div>
              </div>
              <label className="inline-flex items-center gap-2 rounded-md bg-sunken px-2.5 py-1.5 text-[12px] text-muted">
                <Users className="size-3.5" /> Shared with workspace
                <Toggle checked={draft.shared} onChange={(v) => set("shared", v)} label="Shared" />
              </label>
            </div>

            <div className="mt-6 grid gap-5 sm:grid-cols-2">
              <Field label="Name" htmlFor="aname">
                <Input id="aname" value={draft.name} onChange={(e) => set("name", e.target.value)} />
              </Field>
              <Field label="Tagline" htmlFor="atag">
                <Input id="atag" value={draft.tagline} onChange={(e) => set("tagline", e.target.value)} />
              </Field>
            </div>
            <div className="mt-5">
              <Field label="Instructions" htmlFor="ainst" hint="Applied to every conversation with this assistant.">
                <Textarea id="ainst" rows={5} value={draft.instructions} onChange={(e) => set("instructions", e.target.value)} placeholder="You are a thoughtful research partner…" />
              </Field>
            </div>

            <div className="mt-6">
              <p className="mb-2 text-[13px] font-medium">Model</p>
              <div className="space-y-2">
                {MODELS.map((m) => {
                  const locked = m.minPlan === "pro" && plan === "free"
                  const on = draft.model === m.id
                  return (
                    <button
                      key={m.id}
                      onClick={() => (locked ? openUpgrade(`${m.name} is available on Pro and Team.`) : set("model", m.id))}
                      className={cx("flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left", on ? "border-accent-line bg-accent-soft" : "border-line hover:border-faint/50")}
                    >
                      <span className={cx("grid size-4 place-items-center rounded-full border", on ? "border-accent" : "border-line")}>{on && <span className="size-2 rounded-full bg-accent" />}</span>
                      <span className="flex-1">
                        <span className="block text-[13.5px]">{m.name}</span>
                        <span className="block text-[11.5px] text-muted">{m.blurb}</span>
                      </span>
                      {locked ? <Badge>Pro</Badge> : on && <Check className="size-4 text-accent" />}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="mt-6">
              <p className="mb-2 text-[13px] font-medium">Tools & grounding</p>
              <div className="divide-y divide-line-soft">
                {(
                  [
                    ["web", Globe, "Web search", "Look things up and cite pages"],
                    ["knowledge", FolderSearch, "Project knowledge", "Read the conversation's project sources"],
                    ["code", Code2, "Code execution", "Coming soon"],
                  ] as const
                ).map(([k, I, l, s]) => (
                  <div key={k} className="flex items-center gap-3 py-3">
                    <I className="size-4 text-muted" />
                    <span className="flex-1">
                      <span className="block text-[13px]">{l}</span>
                      <span className="block text-[11.5px] text-muted">{s}</span>
                    </span>
                    <Toggle
                      checked={draft.tools[k]}
                      disabled={k === "code"}
                      label={l}
                      onChange={(v) => {
                        if (k === "web" && v && plan === "free") return openUpgrade("Web research is part of Pro and Team.")
                        set("tools", { ...draft.tools, [k]: v })
                      }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line-soft pt-5">
              <span className="mr-auto text-[12px] text-muted">{dirty ? "Unsaved changes" : `Edited ${timeAgo(current!.updatedAt)}`}</span>
              <Button variant="ghost" size="sm" icon={<Trash2 className="size-4" />} onClick={() => setConfirmDelete(true)} className="text-danger!">
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<Copy className="size-4" />}
                onClick={() => create({ ...draft, name: `${draft.name} (copy)` })}
              >
                Duplicate
              </Button>
              <Button variant="secondary" icon={<MessageSquare className="size-4" />} onClick={() => navigate(`/app/chat/${newConversation({ assistantId: draft.id, projectId: state.projects[0]?.id })}`)}>
                Chat
              </Button>
              <Button onClick={save} disabled={!dirty}>
                Save changes
              </Button>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-line p-10 text-center text-muted">No assistants yet. Create one to get started.</div>
        )}

        {/* Playground */}
        {draft && (
          <div className="space-y-5 lg:col-span-2 xl:col-span-1">
            <Playground draft={draft} />
            <div className="rounded-2xl border border-line bg-surface p-5">
              <p className="text-[14px] font-medium">Response preferences</p>
              <div className="mt-4 flex items-center justify-between text-[12.5px]">
                <span className="text-muted">Creativity</span>
                <span className="font-mono text-accent">{draft.creativity.toFixed(1)}</span>
              </div>
              <input type="range" min={0} max={1} step={0.1} value={draft.creativity} onChange={(e) => set("creativity", Number(e.target.value))} className="mt-2 w-full accent-[var(--accent)]" aria-label="Creativity" />
              <div className="flex justify-between text-[11px] text-faint">
                <span>Precise</span>
                <span>Exploratory</span>
              </div>
              <p className="mt-3 text-[12px] text-muted">{draft.creativity < 0.4 ? "Lower creativity keeps research focused and consistent." : draft.creativity < 0.7 ? "A balance of reliable and fresh." : "Higher creativity explores more surprising ideas."}</p>
            </div>
          </div>
        )}
      </div>

      <Modal open={templates} onClose={() => setTemplates(false)} title="Assistant templates" description="Start from a proven role, then make it yours." width={680}>
        <div className="grid gap-3 sm:grid-cols-2">
          {TEMPLATES.map((t) => (
            <button key={t.name} onClick={() => create(t)} className="rounded-xl border border-line bg-surface p-4 text-left hover:border-accent-line hover:bg-accent-soft/40">
              <AssistantIcon icon={t.icon} className="size-5 text-accent" />
              <p className="mt-3 text-[14px] font-medium">{t.name}</p>
              <p className="text-[12px] text-muted">{t.tagline}</p>
              <p className="mt-2 line-clamp-2 text-[12px] text-faint">{t.instructions}</p>
            </button>
          ))}
        </div>
      </Modal>
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete ${draft?.name}?`}
        description="Conversations with this assistant stay, and switch to default Paper Tech."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                update((d) => {
                  d.assistants = d.assistants.filter((a) => a.id !== draft!.id)
                  d.conversations.forEach((c) => c.assistantId === draft!.id && (c.assistantId = undefined))
                })
                setConfirmDelete(false)
                toast("Assistant deleted")
                navigate("/app/assistants")
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-muted">This can't be undone.</p>
      </Modal>
    </div>
  )
}
