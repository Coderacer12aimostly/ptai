import { LocalPreparing } from "../../components/LocalAI"
import { useEffect, useMemo, useRef, useState } from "react"
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  Copy,
  Cpu,
  Download,
  FilePen,
  FolderInput,
  Globe,
  MoreHorizontal,
  PanelRightClose,
  PanelRightOpen,
  Pencil,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
} from "lucide-react"
import Composer from "../../components/Composer"
import { Markdown, renderMarkdown } from "../../components/Markdown"
import { Badge, Button, Input, Menu, MenuItem, Modal } from "../../components/ui"
import { AssistantIcon, FileIcon } from "../../components/icons"
import FilePreview from "../../components/FilePreview"
import { TopbarActions } from "../../components/AppShell"
import { useStore } from "../../lib/store"
import { navigate, quietReplace, useRoute } from "../../lib/router"
import { isStreaming, stopStreaming, useSend } from "../../lib/chat"
import { modelName } from "../../lib/models"
import { cx, download, timeAgo, uid } from "../../lib/utils"
import type { KnowledgeFile, Message, Source } from "../../lib/types"
import { toast } from "../../components/toast"
import NotFound from "../NotFound"
import { MessageImages } from "../../components/ImageAttach"
import ReplyActions from "../../components/ReplyActions"
import { takeImages } from "../../lib/images"

const autoSent = new Set<string>()

function SourceCard({ s, file, active, onOpen }: { s: Source; file?: KnowledgeFile; active: boolean; onOpen: () => void }) {
  return (
    <div id={`src-${s.n}`} className={cx("rounded-xl border bg-surface p-4 transition-all", active ? "border-accent ring-3 ring-accent/15" : "border-line")}>
      <div className="flex items-start justify-between">
        <span className="font-mono text-[10.5px] text-accent">{String(s.n).padStart(2, "0")}</span>
        {s.url && !file ? <Globe className="size-4 text-muted" /> : <FileIcon kind={file?.kind ?? "doc"} className="size-4 text-muted" />}
      </div>
      <p className="mt-2 text-[13.5px] font-medium">{s.title}</p>
      <p className="mt-0.5 text-[11.5px] text-muted">{s.meta}</p>
      {file && (
        <p className="mt-0.5 text-[11.5px] text-faint">
          {file.owner} · {new Date(file.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
        </p>
      )}
      {s.quote && <p className="mt-3 line-clamp-3 text-[12.5px] leading-relaxed text-muted">“{s.quote}”</p>}
      {file ? (
        <button onClick={onOpen} className="mt-3 text-[12px] text-accent hover:underline">
          View highlighted passages →
        </button>
      ) : s.url ? (
        <a href={s.url} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1 text-[12px] text-accent hover:underline">
          Open source <ArrowUpRight className="size-3" />
        </a>
      ) : null}
    </div>
  )
}

function AssistantMessage({ m, onCite, onRegenerate, onBrief, last, assistantName }: { m: Message; onCite: (n: number) => void; onRegenerate: () => void; onBrief: () => void; last: boolean; assistantName?: string }) {
  const { update } = useStore()
  const streaming = m.status === "streaming"
  const setFeedback = (f: "up" | "down" | undefined) =>
    update((d) => {
      for (const c of d.conversations) {
        const x = c.messages.find((y) => y.id === m.id)
        if (x) x.feedback = f
      }
    })
  const badges = !streaming && (m.status === "error" || m.status === "stopped" || !!m.sources?.length || m.mode === "demo")
  return (
    <div className="rise text-[15px]">
      {streaming && !m.content && (
        <span className="inline-flex items-center gap-1 text-[13px] text-muted">
          {(m.phase ?? "Thinking").replace(/…$/, "")}
          <span className="typing-dot">.</span>
          <span className="typing-dot">.</span>
          <span className="typing-dot">.</span>
        </span>
      )}
      {badges && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-[12px]">
          {m.status === "error" && <Badge tone="danger">Didn't finish</Badge>}
          {m.status === "stopped" && <Badge>Stopped</Badge>}
          {!!m.sources?.length && (
            <Badge tone="success">
              <Check className="size-3" /> {m.sources.length} source{m.sources.length > 1 ? "s" : ""} reviewed
            </Badge>
          )}
          {m.mode === "demo" && (
            <a href="#/app/settings/ai">
              <Badge tone="warn">Demo answer</Badge>
            </a>
          )}
        </div>
      )}
      {m.content ? <Markdown text={m.content} streaming={streaming} onCite={onCite} /> : streaming ? <><LocalPreparing /><div className="mt-3 h-4 w-40 animate-pulse rounded bg-line-soft" /></> : null}
      {!streaming && m.content && (
        <ReplyActions
          id={m.id}
          text={m.content}
          feedback={m.feedback}
          onFeedback={setFeedback}
          onRetry={last ? onRegenerate : undefined}
          meta={
            <>
              {m.model ? modelName(m.model) : "Paper Tech"}
              {assistantName && <span>· {assistantName}</span>}
              {m.mode === "device" && (
                <>
                  <span>·</span>
                  <Cpu className="size-3" /> on device
                </>
              )}
            </>
          }
          extra={
            <button onClick={onBrief} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[12.5px] text-muted hover:bg-sunken hover:text-ink">
              <FilePen className="size-3.5" /> Turn into a brief
            </button>
          }
        />
      )}
    </div>
  )
}

export default function Chat({ id }: { id: string }) {
  const { state, update, user } = useStore()
  const { query } = useRoute()
  const send = useSend()
  const convo = state.conversations.find((c) => c.id === id)
  const [panel, setPanel] = useState(() => window.innerWidth >= 1280)
  const [tab, setTab] = useState<"cited" | "all">("cited")
  const [activeCite, setActiveCite] = useState<number | null>(null)
  const [preview, setPreview] = useState<{ file: KnowledgeFile; quote?: string } | null>(null)
  const [rename, setRename] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const busy = isStreaming(convo)
  const assistant = state.assistants.find((a) => a.id === convo?.assistantId)
  const project = state.projects.find((p) => p.id === convo?.projectId)

  // Send the opening question passed from Home / search.
  useEffect(() => {
    const q = query.get("q")
    if (convo && q !== null && !autoSent.has(id)) {
      autoSent.add(id)
      quietReplace(`#/app/chat/${id}`)
      send(id, q, { images: takeImages(id) })
    }
  }, [convo, id, query, send])

  // Keep scrolled to the bottom while streaming, unless the user scrolled up.
  useEffect(() => {
    const el = scroller.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [convo?.messages])

  const lastAssistant = [...(convo?.messages ?? [])].reverse().find((m) => m.role === "assistant" && m.sources?.length)
  const cited: Source[] = lastAssistant?.sources ?? []
  const allSources = useMemo(() => state.files.filter((f) => f.projectId === convo?.projectId && f.kind !== "artifact"), [state.files, convo?.projectId])

  if (!convo) return <NotFound inApp />

  function cite(n: number, msg?: Message) {
    const s = (msg ?? lastAssistant)?.sources?.find((x) => x.n === n)
    setPanel(true)
    setTab("cited")
    setActiveCite(n)
    setTimeout(() => document.getElementById(`src-${n}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60)
    setTimeout(() => setActiveCite(null), 2200)
    if (!s) toast("That source isn't in this answer's list.", "info")
  }

  function regenerate() {
    const msgs = convo!.messages
    const lastUser = [...msgs].reverse().find((m) => m.role === "user")
    if (!lastUser) return
    send(id, lastUser.content, { truncateAt: msgs.lastIndexOf(lastUser) })
  }

  function toBrief(m: Message) {
    const docId = uid("d-")
    const title = convo!.title === "New conversation" ? "Untitled brief" : `${convo!.title} — brief`
    const body = renderMarkdown(m.content).replace(/<span class="cite">(.*?)<\/span><\/span>/g, (x) => x.replace(/<[^>]+>/g, ""))
    const refs = m.sources?.length ? `<h2>Sources</h2><ol>${m.sources.map((s) => `<li>${s.title} — ${s.meta}</li>`).join("")}</ol>` : ""
    const html = `<h1>${title}</h1>${body}${refs}`
    update((d) => {
      d.docs.unshift({ id: docId, title, projectId: convo!.projectId, html, status: "draft", updatedAt: Date.now(), versions: [], chat: [] })
      if (convo!.projectId) d.files.unshift({ id: uid("f-"), projectId: convo!.projectId, name: title, kind: "artifact", size: html.length, owner: user?.name ?? "You", updatedAt: Date.now(), status: "draft", meta: "Artifact · brief", docId })
    })
    toast("Brief created — opening the editor")
    navigate(`/app/editor/${docId}`)
  }

  function exportMd() {
    const md = convo!.messages.map((m) => `### ${m.role === "user" ? user?.name ?? "You" : "Paper Tech"}\n\n${m.content}`).join("\n\n---\n\n")
    download(`${convo!.title}.md`, `# ${convo!.title}\n\n${md}`, "text/markdown")
  }

  return (
    <div className="flex h-full">
      <TopbarActions>
        <span className="hidden items-center gap-1.5 rounded-md bg-sunken px-2 py-1 text-[12px] text-muted md:inline-flex">
          <Users className="size-3.5" /> {project ? "Team visible" : "Only you"}
        </span>
        <Menu
          width={230}
          trigger={() => (
            <button className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink" aria-label="Conversation options">
              <MoreHorizontal className="size-[18px]" />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={<Pencil />} onClick={() => (close(), setRename(convo.title))}>
                Rename
              </MenuItem>
              <div className="px-2.5 pt-2 pb-1 text-[11px] text-faint">Move to project</div>
              {state.projects.map((p) => (
                <MenuItem
                  key={p.id}
                  icon={<FolderInput />}
                  active={p.id === convo.projectId}
                  onClick={() => {
                    close()
                    update((d) => void (d.conversations.find((x) => x.id === id)!.projectId = p.id))
                    toast(`Moved to ${p.name}`)
                  }}
                >
                  {p.name}
                </MenuItem>
              ))}
              <div className="my-1 h-px bg-line-soft" />
              <MenuItem icon={<Download />} onClick={() => (close(), exportMd())}>
                Export as Markdown
              </MenuItem>
              <MenuItem danger icon={<Trash2 />} onClick={() => (close(), setConfirmDelete(true))}>
                Delete conversation
              </MenuItem>
            </>
          )}
        </Menu>
        <button onClick={() => setPanel((p) => !p)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-sunken hover:text-ink" aria-label="Toggle sources" title="Sources">
          {panel ? <PanelRightClose className="size-[18px]" /> : <PanelRightOpen className="size-[18px]" />}
        </button>
      </TopbarActions>

      <div className="flex min-w-0 flex-1 flex-col">
        <div
          ref={scroller}
          className="scroll-thin flex-1 overflow-y-auto"
          onScroll={(e) => {
            const el = e.currentTarget
            stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80
          }}
        >
          <div className="mx-auto max-w-[760px] px-5 pt-8 pb-10 md:px-10">
            <div className="mb-6 flex items-center justify-between gap-3">
              <Menu
                align="left"
                width={260}
                trigger={() => (
                  <button className="inline-flex items-center gap-1.5 rounded-md bg-accent-soft px-2.5 py-1.5 text-[12.5px] text-accent">
                    {assistant ? <AssistantIcon icon={assistant.icon} className="size-4" /> : <Sparkles className="size-4" />}
                    {assistant?.name ?? "Paper Tech"}
                    <ChevronDown className="size-3.5" />
                  </button>
                )}
              >
                {(close) => (
                  <>
                    <div className="px-2.5 pt-1 pb-1.5 text-[11px] text-faint">Talk with</div>
                    <MenuItem active={!assistant} icon={<Sparkles />} onClick={() => (close(), update((d) => void (d.conversations.find((x) => x.id === id)!.assistantId = undefined)))}>
                      Paper Tech (default)
                    </MenuItem>
                    {state.assistants.map((a) => (
                      <MenuItem
                        key={a.id}
                        active={a.id === assistant?.id}
                        icon={<AssistantIcon icon={a.icon} />}
                        onClick={() => {
                          close()
                          update((d) => {
                            const c = d.conversations.find((x) => x.id === id)!
                            c.assistantId = a.id
                            c.model = a.model
                          })
                        }}
                      >
                        {a.name}
                      </MenuItem>
                    ))}
                  </>
                )}
              </Menu>
              <span className="font-mono text-[11px] text-faint uppercase">
                {new Date(convo.createdAt).toDateString() === new Date().toDateString() ? "Today" : new Date(convo.createdAt).toLocaleDateString()} ·{" "}
                {new Date(convo.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
              </span>
            </div>

            {convo.messages.length === 0 && (
              <div className="py-16 text-center">
                <Sparkles className="mx-auto size-8 text-accent" strokeWidth={1.5} />
                <h2 className="display mt-4 text-[28px] font-semibold">What's on your mind?</h2>
                <p className="mt-2 text-[14px] text-muted">{project ? `Answers will be grounded in ${project.name}'s sources.` : "Pick a project below to ground answers in your sources."}</p>
              </div>
            )}

            <div className="space-y-8">
              {convo.messages.map((m, i) =>
                m.role === "user" ? (
                  <div key={m.id} className="rise ml-auto grid max-w-[85%] justify-items-end gap-2">
                    {m.images && m.images.length > 0 && <MessageImages images={m.images} />}
                    {m.content && <p className="rounded-[18px] bg-sunken px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">{m.content}</p>}
                  </div>
                ) : (
                  <AssistantMessage key={m.id} m={m} assistantName={assistant?.name} last={i === convo.messages.length - 1} onCite={(n) => cite(n, m)} onRegenerate={regenerate} onBrief={() => toBrief(m)} />
                ),
              )}
            </div>
          </div>
        </div>
        <div className="mx-auto w-full max-w-[760px] px-4 pb-4 md:px-10">
          <p className="mb-2 text-center text-[11.5px] text-faint">Paper Tech is AI and can make mistakes. Check important details against the sources.</p>
          <Composer
            placeholder={convo.messages.length ? "Ask a follow-up, or turn these insights into something…" : "Ask anything…"}
            autoFocus
            busy={busy}
            onStop={() => stopStreaming(id)}
            onSend={(t, images) => {
              stick.current = true
              send(id, t, { images })
            }}
            model={convo.model}
            onModel={(m) => update((d) => void (d.conversations.find((x) => x.id === id)!.model = m))}
            web={convo.web}
            onWeb={(w) => update((d) => void (d.conversations.find((x) => x.id === id)!.web = w))}
            projectId={convo.projectId}
            onProject={(p) => update((d) => void (d.conversations.find((x) => x.id === id)!.projectId = p))}
            google={convo.google}
            onGoogle={(v) => update((d) => void (d.conversations.find((x) => x.id === id)!.google = v))}
          />
        </div>
      </div>

      {panel && (
        <aside className="fade fixed inset-y-0 right-0 z-50 flex w-[min(360px,92vw)] flex-col border-l border-line bg-canvas shadow-pop xl:static xl:z-auto xl:w-[340px] xl:shadow-none">
          <div className="flex items-center justify-between px-6 pt-6">
            <h2 className="text-[17px] font-medium">
              Sources <span className="text-muted">{allSources.length}</span>
            </h2>
            <button onClick={() => setPanel(false)} className="rounded-md p-1 text-muted hover:bg-sunken hover:text-ink" aria-label="Close sources">
              <PanelRightClose className="size-[18px]" />
            </button>
          </div>
          <div className="mt-4 flex gap-5 border-b border-line px-6 text-[12.5px]">
            {(
              [
                ["cited", `Cited · ${cited.length}`],
                ["all", `All sources · ${allSources.length}`],
              ] as const
            ).map(([k, l]) => (
              <button key={k} onClick={() => setTab(k)} className={cx("-mb-px border-b-2 pb-3", tab === k ? "border-accent font-medium text-accent" : "border-transparent text-muted hover:text-ink")}>
                {l}
              </button>
            ))}
          </div>
          <div className="scroll-thin flex-1 space-y-4 overflow-y-auto p-5">
            {tab === "cited" ? (
              cited.length ? (
                cited.map((s) => {
                  const file = state.files.find((f) => f.id === s.fileId)
                  return <SourceCard key={s.n} s={s} file={file} active={activeCite === s.n} onOpen={() => file && setPreview({ file, quote: s.quote })} />
                })
              ) : (
                <p className="py-10 text-center text-[13px] text-muted">Citations from Paper Tech's answers will appear here.</p>
              )
            ) : allSources.length ? (
              allSources.map((f) => (
                <button key={f.id} onClick={() => setPreview({ file: f })} className="flex w-full items-center gap-3 rounded-xl border border-line bg-surface p-3 text-left hover:border-accent-line">
                  <FileIcon kind={f.kind} className="text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] font-medium">{f.name}</span>
                    <span className="block text-[11.5px] text-muted">{f.meta}</span>
                  </span>
                </button>
              ))
            ) : (
              <div className="py-10 text-center text-[13px] text-muted">
                {project ? "This project has no sources yet." : "No project selected."}
                <br />
                <a href={project ? `#/app/upload/${project.id}` : "#/app/knowledge"} className="text-accent hover:underline">
                  {project ? "Add knowledge →" : "Choose a project →"}
                </a>
              </div>
            )}
          </div>
          {cited.length > 0 && (
            <p className="flex items-center gap-2 border-t border-line-soft px-6 py-4 text-[12px] text-muted">
              <ShieldCheck className="size-4 text-success" /> Grounded in {cited.filter((c) => c.fileId).length} workspace file{cited.filter((c) => c.fileId).length === 1 ? "" : "s"}
              {cited.some((c) => !c.fileId) ? ` and ${cited.filter((c) => !c.fileId).length} web sources` : ""}.
            </p>
          )}
        </aside>
      )}

      <FilePreview file={preview?.file ?? null} highlight={preview?.quote} onClose={() => setPreview(null)} />
      <Modal
        open={rename !== null}
        onClose={() => setRename(null)}
        title="Rename conversation"
        footer={
          <>
            <Button variant="secondary" onClick={() => setRename(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                update((d) => void (d.conversations.find((x) => x.id === id)!.title = rename!.trim() || "Untitled"))
                setRename(null)
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <Input value={rename ?? ""} onChange={(e) => setRename(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (update((d) => void (d.conversations.find((x) => x.id === id)!.title = rename!.trim() || "Untitled")), setRename(null))} />
      </Modal>
      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this conversation?"
        description="This can't be undone."
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                update((d) => void (d.conversations = d.conversations.filter((x) => x.id !== id)))
                toast("Conversation deleted")
                navigate("/app")
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-muted">“{convo.title}” and its {convo.messages.length} messages will be removed. Last active {timeAgo(convo.updatedAt)}.</p>
      </Modal>
    </div>
  )
}
