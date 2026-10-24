import { useCallback, useEffect, useRef, useState } from "react"
import {
  ArrowUp,
  Bold,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileDown,
  GitCompare,
  History,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  MoreHorizontal,
  PenLine,
  Printer,
  Redo2,
  Square,
  Undo2,
  X,
} from "lucide-react"
import { Avatar, Badge, Button, Menu, MenuItem, Modal } from "../../components/ui"
import { Markdown } from "../../components/Markdown"
import { TopbarActions, useAILabel } from "../../components/AppShell"
import { useStore } from "../../lib/store"
import { isOnDevice, streamChat } from "../../lib/ai"
import { retrieve } from "../../lib/knowledge"
import { modelName } from "../../lib/models"
import type { Doc, Message } from "../../lib/types"
import { cx, download, htmlToText, timeAgo, uid, wordCount } from "../../lib/utils"
import { toast } from "../../components/toast"
import { openUpgrade } from "../../components/upgrade"
import NotFound from "../NotFound"

const ALLOWED = new Set(["H1", "H2", "H3", "P", "UL", "OL", "LI", "BLOCKQUOTE", "STRONG", "B", "EM", "I", "A", "BR", "SMALL", "U", "CODE", "HR"])

/** Keep AI-written HTML to a safe set of formatting tags. */
function sanitize(html: string) {
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html")
  const root = doc.body.firstElementChild as HTMLElement
  const walk = (el: Element) => {
    for (const child of Array.from(el.children)) {
      if (!ALLOWED.has(child.tagName)) {
        if (["SCRIPT", "STYLE", "IFRAME", "OBJECT"].includes(child.tagName)) child.remove()
        else {
          walk(child)
          child.replaceWith(...Array.from(child.childNodes))
        }
        continue
      }
      for (const attr of Array.from(child.attributes)) {
        if (!(child.tagName === "A" && attr.name === "href" && /^https?:/.test(attr.value))) child.removeAttribute(attr.name)
      }
      walk(child)
    }
  }
  walk(root)
  return root.innerHTML
}

function blocks(html: string) {
  const div = document.createElement("div")
  div.innerHTML = html
  return Array.from(div.children).map((c) => ({ tag: c.tagName, text: (c.textContent ?? "").trim() }))
}

function Diff({ before, after }: { before: string; after: string }) {
  const a = blocks(before)
  const b = blocks(after)
  const aSet = new Set(a.map((x) => x.text))
  const bSet = new Set(b.map((x) => x.text))
  const removed = a.filter((x) => !bSet.has(x.text))
  return (
    <div className="space-y-2 text-[13.5px] leading-relaxed">
      {b.map((x, i) => (
        <p key={i} className={cx("rounded-md px-3 py-1.5", !aSet.has(x.text) ? "bg-success-soft" : "text-muted")}>
          {!aSet.has(x.text) && <span className="mr-2 font-mono text-[11px] text-success">+</span>}
          {x.text || "—"}
        </p>
      ))}
      {removed.map((x, i) => (
        <p key={"r" + i} className="rounded-md bg-danger-soft px-3 py-1.5 text-danger line-through">
          <span className="mr-2 font-mono text-[11px] no-underline">−</span>
          {x.text}
        </p>
      ))}
      {!removed.length && b.every((x) => aSet.has(x.text)) && <p className="py-6 text-center text-muted">No changes since this version.</p>}
    </div>
  )
}

const BLOCKS = [
  ["P", "Normal text"],
  ["H1", "Title"],
  ["H2", "Heading"],
  ["H3", "Subheading"],
  ["BLOCKQUOTE", "Quote"],
] as const

export default function Editor({ id }: { id: string }) {
  const { state, update, user, countMessage } = useStore()
  const aiName = useAILabel()
  const doc = state.docs.find((d) => d.id === id)
  const ref = useRef<HTMLDivElement>(null)
  const [saved, setSaved] = useState<"saved" | "saving">("saved")
  const [block, setBlock] = useState("P")
  const [words, setWords] = useState(0)
  const [history, setHistory] = useState(false)
  const [changes, setChanges] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)
  const [text, setText] = useState("")
  const [busy, setBusy] = useState(false)
  const [selection, setSelection] = useState("")
  const [chatOpen, setChatOpen] = useState(() => window.innerWidth >= 900)
  const saveTimer = useRef<number | undefined>(undefined)
  const ctrl = useRef<AbortController | null>(null)
  const chatBox = useRef<HTMLDivElement>(null)

  const loadedFor = useRef<string | null>(null)
  useEffect(() => {
    if (doc && ref.current && loadedFor.current !== doc.id) {
      ref.current.innerHTML = doc.html
      loadedFor.current = doc.id
      setWords(wordCount(ref.current.innerText))
    }
  }, [doc])

  useEffect(() => {
    chatBox.current?.scrollTo({ top: chatBox.current.scrollHeight, behavior: "smooth" })
  }, [doc?.chat])

  const persist = useCallback(() => {
    if (!ref.current) return
    const html = ref.current.innerHTML.replace(/ data-changed="[^"]*"/g, "")
    update((d) => {
      const x = d.docs.find((y) => y.id === id)
      if (x) {
        x.html = html
        x.updatedAt = Date.now()
        const h1 = ref.current?.querySelector("h1")?.textContent?.trim()
        if (h1 && x.title === "Untitled document") x.title = h1.slice(0, 80)
      }
    })
    setSaved("saved")
  }, [id, update])

  const onInput = () => {
    setSaved("saving")
    setWords(wordCount(ref.current?.innerText ?? ""))
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(persist, 600)
  }

  const snapshot = useCallback(
    (note: string) => {
      if (!ref.current) return
      const html = ref.current.innerHTML.replace(/ data-changed="[^"]*"/g, "")
      update((d) => {
        const x = d.docs.find((y) => y.id === id)
        if (x) x.versions.unshift({ id: uid("v-"), html, title: x.title, at: Date.now(), note })
      })
    },
    [id, update],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault()
        persist()
        snapshot("Saved version")
        toast("Version saved")
      }
    }
    const onSel = () => {
      const s = document.getSelection()
      if (!s || !ref.current || !s.anchorNode || !ref.current.contains(s.anchorNode)) return
      let n: Node | null = s.anchorNode
      while (n && n.parentNode !== ref.current) n = n.parentNode
      const tag = (n as HTMLElement | null)?.tagName
      setBlock(tag === "UL" || tag === "OL" ? "P" : (tag ?? "P"))
      const t = s.toString().trim()
      if (t) setSelection(t.slice(0, 600))
    }
    window.addEventListener("keydown", onKey)
    document.addEventListener("selectionchange", onSel)
    return () => {
      window.removeEventListener("keydown", onKey)
      document.removeEventListener("selectionchange", onSel)
      window.clearTimeout(saveTimer.current)
    }
  }, [persist, snapshot])

  if (!doc) return <NotFound inApp />

  const exec = (cmd: string, value?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, value)
    onInput()
  }

  function applyHtml(html: string, note: string) {
    if (!ref.current) return
    snapshot(note)
    const before = new Set(blocks(ref.current.innerHTML).map((b) => b.text))
    ref.current.innerHTML = html
    Array.from(ref.current.children).forEach((c) => {
      if (!before.has((c.textContent ?? "").trim())) c.setAttribute("data-changed", "1")
    })
    setTimeout(() => ref.current?.querySelectorAll("[data-changed]").forEach((el) => el.removeAttribute("data-changed")), 9000)
    onInput()
    persist()
  }

  async function ask(q: string) {
    if (!q.trim() || busy || !ref.current) return
    if (!(await isOnDevice(state.prefs.apiKey)) && !countMessage()) return openUpgrade("You've used all of this month's cloud AI messages. On-device AI is unlimited.")
    const sel = selection
    setText("")
    setSelection("")
    setBusy(true)
    const userMsg: Message = { id: uid("m-"), role: "user", content: q.trim(), createdAt: Date.now() }
    const replyId = uid("m-")
    update((d) => void d.docs.find((x) => x.id === id)!.chat.push(userMsg, { id: replyId, role: "assistant", content: "", createdAt: Date.now(), status: "streaming", model: state.prefs.defaultModel }))
    const current = ref.current.innerHTML.replace(/ data-changed="[^"]*"/g, "")
    const files = state.files.filter((f) => f.projectId === doc!.projectId && f.status === "ready")
    const passages = await retrieve(files, q)
    const system = [
      `You are Paper Tech's writing partner, editing a document called "${doc!.title}" with ${user?.name ?? "the user"}. Write warmly and clearly. Avoid clichés and hype.`,
      "The current document HTML is inside <current_document>. If the user asks you to change, add to, rewrite or shorten the document, first reply with ONE or TWO short sentences describing what you changed, then output the COMPLETE revised document inside <document></document> tags. Use only these tags: h1, h2, h3, p, ul, ol, li, blockquote, strong, em, a, br. Keep everything the user didn't ask to change.",
      "If the user only asks a question about the document, answer briefly and do NOT include a <document> block.",
      sel ? `The user has selected this passage and wants the change applied to it: """${sel}"""` : "",
      passages.length ? `Relevant project sources:\n${passages.map((p) => `- (${p.file.name}) ${p.text}`).join("\n")}` : "",
      `<current_document>\n${current}\n</current_document>`,
    ]
      .filter(Boolean)
      .join("\n\n")
    const turns = [...doc!.chat.filter((m) => m.status !== "error").slice(-6).map((m) => ({ role: m.role, content: m.content.replace(/<document>[\s\S]*?<\/document>/g, "[document]") })), { role: "user" as const, content: q }]
    let out = ""
    const setReply = (patch: Partial<Message>) =>
      update((d) => {
        const m = d.docs.find((x) => x.id === id)?.chat.find((x) => x.id === replyId)
        if (m) Object.assign(m, patch)
      })
    const c = new AbortController()
    ctrl.current = c
    const timer = window.setInterval(() => setReply({ content: out.split("<document>")[0] }), 80)
    try {
      const res = await streamChat({ system, messages: turns, model: state.prefs.defaultModel, apiKey: state.prefs.apiKey, maxTokens: 4096, signal: c.signal, onText: (t) => (out += t), demo: { passages, kind: "edit", doc: current } })
      window.clearInterval(timer)
      const m = out.match(/<document>([\s\S]*?)(<\/document>|$)/)
      const reply = out.split("<document>")[0].trim() || (m ? "Done — the document is updated." : out)
      setReply({ content: reply + (m ? "\n\n✓ **Document updated.** Changes are highlighted." : ""), status: "done", mode: res.mode === "demo" ? "demo" : res.mode === "device" ? "device" : "live" })
      if (m && m[1].trim()) applyHtml(sanitize(m[1]), `Before: ${q.slice(0, 60)}`)
    } catch (e) {
      window.clearInterval(timer)
      setReply({ content: c.signal.aborted ? out.split("<document>")[0] || "Stopped." : `Something went wrong: ${(e as Error).message}`, status: c.signal.aborted ? "stopped" : "error" })
    }
    setBusy(false)
  }

  function exportAs(kind: "md" | "html" | "doc" | "txt") {
    const html = ref.current?.innerHTML ?? doc!.html
    const name = doc!.title.replace(/[^\w\s-]/g, "").trim() || "document"
    if (kind === "txt") return download(`${name}.txt`, htmlToText(html))
    if (kind === "md") {
      const div = document.createElement("div")
      div.innerHTML = html
      const md = Array.from(div.children)
        .map((el) => {
          const t = (el as HTMLElement).innerText.trim()
          switch (el.tagName) {
            case "H1": return `# ${t}`
            case "H2": return `## ${t}`
            case "H3": return `### ${t}`
            case "BLOCKQUOTE": return t.split("\n").map((l) => `> ${l}`).join("\n")
            case "UL": return Array.from(el.children).map((li) => `- ${(li as HTMLElement).innerText}`).join("\n")
            case "OL": return Array.from(el.children).map((li, i) => `${i + 1}. ${(li as HTMLElement).innerText}`).join("\n")
            default: return t
          }
        })
        .join("\n\n")
      return download(`${name}.md`, md, "text/markdown")
    }
    const page = `<!doctype html><html><head><meta charset="utf-8"><title>${doc!.title}</title><style>body{font-family:Inter,system-ui,sans-serif;max-width:720px;margin:48px auto;line-height:1.65;color:#1f1f22;padding:0 16px}h1{font-size:2.1em;letter-spacing:-.03em;line-height:1.15}blockquote{border-left:3px solid #2d2d32;background:#f0f0f2;margin:0;padding:.7em 1em}</style></head><body>${html}</body></html>`
    if (kind === "doc") return download(`${name}.doc`, page, "application/msword")
    download(`${name}.html`, page, "text/html")
  }

  const last = doc.versions[0]

  return (
    <div className="flex h-full">
      <TopbarActions>
        <div className="hidden items-center -space-x-1.5 md:flex">
          {(state.workspace?.members ?? []).slice(0, 3).map((m) => (
            <Avatar key={m.id} name={m.name} size={28} />
          ))}
        </div>
        <Badge tone={saved === "saved" ? "success" : "neutral"}>
          {saved === "saved" ? <Check className="size-3" /> : <Loader2 className="size-3 animate-spin" />}
          {saved === "saved" ? "Saved" : "Saving…"}
        </Badge>
        <Menu
          width={220}
          trigger={() => (
            <Button variant="secondary" size="sm" icon={<Download className="size-4" />}>
              <span className="hidden sm:inline">Export</span>
            </Button>
          )}
        >
          {(close) => (
            <>
              <MenuItem icon={<Printer />} onClick={() => (close(), window.print())}>
                Print / Save as PDF
              </MenuItem>
              <MenuItem icon={<FileDown />} onClick={() => (close(), exportAs("doc"))}>
                Word (.doc)
              </MenuItem>
              <MenuItem icon={<FileDown />} onClick={() => (close(), exportAs("md"))}>
                Markdown (.md)
              </MenuItem>
              <MenuItem icon={<FileDown />} onClick={() => (close(), exportAs("html"))}>
                Web page (.html)
              </MenuItem>
              <MenuItem
                icon={<Copy />}
                onClick={() => {
                  close()
                  navigator.clipboard?.writeText(htmlToText(ref.current?.innerHTML ?? ""))
                  toast("Copied as plain text")
                }}
              >
                Copy text
              </MenuItem>
            </>
          )}
        </Menu>
      </TopbarActions>

      {/* Writing partner */}
      {chatOpen && (
        <aside className="no-print fixed inset-y-0 left-0 z-50 flex w-[min(380px,92vw)] flex-col border-r border-line bg-canvas shadow-pop md:static md:z-auto md:w-[360px] md:shadow-none lg:w-[380px]">
          <div className="flex items-center justify-between px-6 pt-6 pb-3">
            <p className="flex items-center gap-2 text-[14px]">
              <PenLine className="size-[18px] text-accent" strokeWidth={1.7} /> Writing partner
            </p>
            <Menu
              width={200}
              trigger={() => (
                <button className="rounded-md p-1 text-muted hover:bg-sunken hover:text-ink" aria-label="Writing partner options">
                  <MoreHorizontal className="size-4" />
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem onClick={() => (close(), update((d) => void (d.docs.find((x) => x.id === id)!.chat = [])))}>Clear conversation</MenuItem>
                  <MenuItem onClick={() => (close(), setChatOpen(false))}>Hide panel</MenuItem>
                </>
              )}
            </Menu>
          </div>
          <div ref={chatBox} className="scroll-thin flex-1 space-y-6 overflow-y-auto px-6 pb-6">
            {doc.chat.length === 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-[13px] text-muted">Ask for an edit — Paper Tech changes the document directly and keeps a version you can restore.</p>
                {["Make the opening more concrete", "Tighten every paragraph", "Add a short list of key takeaways", "Suggest a stronger headline"].map((s) => (
                  <button key={s} onClick={() => ask(s)} className="block w-full rounded-lg border border-line bg-surface px-3 py-2.5 text-left text-[13px] hover:border-accent-line hover:text-accent">
                    {s}
                  </button>
                ))}
              </div>
            )}
            {doc.chat.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="rounded-xl bg-sunken p-4">
                  <p className="mb-1 text-[11.5px] font-semibold">You</p>
                  <p className="text-[13.5px] leading-relaxed">{m.content}</p>
                </div>
              ) : (
                <div key={m.id}>
                  <p className="mb-1.5 flex items-center gap-2 text-[12.5px] font-semibold">
                    Paper Tech {m.mode === "demo" && <Badge tone="warn">Demo</Badge>}
                    {m.status === "streaming" && <Loader2 className="size-3.5 animate-spin text-accent" />}
                  </p>
                  <Markdown text={m.content || "Thinking…"} className="text-[13.5px]! leading-relaxed" />
                </div>
              ),
            )}
          </div>
          <div className="p-4">
            <div className="rounded-2xl border border-accent-line/70 bg-surface p-3 focus-within:border-accent">
              {selection && (
                <div className="mb-2 flex items-center gap-2 rounded-md bg-accent-soft px-2 py-1 text-[11.5px] text-accent">
                  <span className="flex-1 truncate">Editing selection: “{selection}”</span>
                  <button onClick={() => setSelection("")} aria-label="Clear selection">
                    <X className="size-3.5" />
                  </button>
                </div>
              )}
              <textarea
                rows={2}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    ask(text)
                  }
                }}
                placeholder="Ask for an edit…"
                className="w-full resize-none bg-transparent text-[14px] outline-none placeholder:text-faint"
              />
              <div className="flex items-center justify-between">
                <span className="text-[11.5px] text-muted">{aiName}</span>
                {busy ? (
                  <button onClick={() => ctrl.current?.abort()} className="grid size-8 place-items-center rounded-lg bg-ink text-canvas" aria-label="Stop">
                    <Square className="size-3 fill-current" />
                  </button>
                ) : (
                  <button onClick={() => ask(text)} disabled={!text.trim()} className="grid size-8 place-items-center rounded-lg bg-accent text-on-accent disabled:opacity-40" aria-label="Send">
                    <ArrowUp className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Document */}
      <div className="flex min-w-0 flex-1 flex-col bg-sunken/50">
        <div className="no-print flex items-center gap-1 overflow-x-auto border-b border-line bg-canvas px-4 py-2.5 md:px-6">
          {!chatOpen && (
            <Button variant="secondary" size="sm" icon={<PenLine className="size-4" />} onClick={() => setChatOpen(true)} className="mr-2">
              Writing partner
            </Button>
          )}
          <Menu
            align="left"
            width={180}
            trigger={() => (
              <button className="inline-flex items-center gap-2 rounded-md px-2 py-1.5 text-[12.5px] hover:bg-sunken">
                {BLOCKS.find((b) => b[0] === block)?.[1] ?? "Normal text"} <ChevronDown className="size-3.5 text-muted" />
              </button>
            )}
          >
            {(close) =>
              BLOCKS.map(([tag, label]) => (
                <MenuItem key={tag} active={block === tag} onClick={() => (close(), exec("formatBlock", tag))}>
                  {label}
                </MenuItem>
              ))
            }
          </Menu>
          <span className="mx-1.5 h-4 w-px bg-line" />
          {[
            [Bold, "bold", "Bold"],
            [Italic, "italic", "Italic"],
            [List, "insertUnorderedList", "Bulleted list"],
            [ListOrdered, "insertOrderedList", "Numbered list"],
          ].map(([I, cmd, label]) => {
            const Icon = I as typeof Bold
            return (
              <button key={cmd as string} onMouseDown={(e) => e.preventDefault()} onClick={() => exec(cmd as string)} className="grid size-8 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink" title={label as string} aria-label={label as string}>
                <Icon className="size-4" />
              </button>
            )
          })}
          <button
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              const url = prompt("Link URL", "https://")
              if (url && /^https?:\/\//.test(url)) exec("createLink", url)
            }}
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink"
            title="Link"
            aria-label="Insert link"
          >
            <LinkIcon className="size-4" />
          </button>
          <div className="flex-1" />
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("undo")} className="grid size-8 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink" title="Undo" aria-label="Undo">
            <Undo2 className="size-4" />
          </button>
          <button onMouseDown={(e) => e.preventDefault()} onClick={() => exec("redo")} className="grid size-8 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink" title="Redo" aria-label="Redo">
            <Redo2 className="size-4" />
          </button>
          <button onClick={() => setHistory(true)} className="grid size-8 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink" title="Version history" aria-label="Version history">
            <History className="size-4" />
          </button>
        </div>

        <div className="scroll-thin flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <div className="no-print mx-auto mb-3 flex max-w-[780px] items-center justify-between">
            <input
              value={doc.title}
              onChange={(e) => update((d) => void (d.docs.find((x) => x.id === id)!.title = e.target.value))}
              className="w-full bg-transparent font-mono text-[11px] tracking-[0.06em] text-muted uppercase outline-none focus:text-ink"
              aria-label="Document title"
            />
            <button
              onClick={() => update((d) => void (d.docs.find((x) => x.id === id)!.status = doc.status === "draft" ? "final" : "draft"))}
              className="shrink-0 text-[12px] text-muted hover:text-ink"
              title="Toggle status"
            >
              {doc.status === "draft" ? "Draft" : "Final ✓"}
            </button>
          </div>
          <div className="mx-auto max-w-[780px] rounded-xl border border-line bg-surface px-6 py-8 shadow-card md:px-12 md:py-12">
            <div
              ref={ref}
              contentEditable
              suppressContentEditableWarning
              onInput={onInput}
              onBlur={persist}
              data-placeholder="Start writing, or ask your writing partner for a first draft…"
              className="editor-doc prose-orbit min-h-[50vh] [&_[data-changed]]:rounded-md [&_[data-changed]]:bg-accent-soft [&_[data-changed]]:outline [&_[data-changed]]:outline-4 [&_[data-changed]]:outline-accent-soft [&_[data-changed]]:transition-colors [&_h1]:text-[34px]! [&_small]:text-[12px] [&_small]:text-faint"
            />
          </div>
          <div className="no-print mx-auto mt-4 flex max-w-[780px] flex-wrap items-center justify-between gap-2 text-[12px] text-muted">
            <span>
              {words} words · {Math.max(1, Math.round(words / 220))} min read
            </span>
            <span className="flex gap-4">
              <button onClick={() => setChanges(true)} disabled={!last} className="inline-flex items-center gap-1 hover:text-ink disabled:opacity-40">
                <GitCompare className="size-3.5" /> View changes
              </button>
              <button onClick={() => setHistory(true)} className="text-accent hover:underline">
                Version history ({doc.versions.length})
              </button>
            </span>
          </div>
        </div>
      </div>

      <Modal open={history} onClose={() => (setHistory(false), setPreview(null))} title="Version history" description="Paper Tech saves a version before every AI edit. ⌘S saves one manually." width={860}>
        <div className="grid gap-4 md:grid-cols-[240px_1fr]">
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => setPreview(null)}
                className={cx("w-full rounded-lg px-3 py-2.5 text-left", preview === null ? "bg-accent-soft text-accent" : "hover:bg-sunken")}
              >
                <span className="block text-[13px] font-medium">Current</span>
                <span className="block text-[11.5px] text-muted">Edited {timeAgo(doc.updatedAt)}</span>
              </button>
            </li>
            {doc.versions.map((v: Doc["versions"][number]) => (
              <li key={v.id}>
                <button onClick={() => setPreview(v.id)} className={cx("w-full rounded-lg px-3 py-2.5 text-left", preview === v.id ? "bg-accent-soft text-accent" : "hover:bg-sunken")}>
                  <span className="block truncate text-[13px]">{v.note}</span>
                  <span className="block text-[11.5px] text-muted">{new Date(v.at).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                </button>
              </li>
            ))}
            {doc.versions.length === 0 && <li className="px-3 py-2 text-[12.5px] text-muted">No earlier versions yet.</li>}
          </ul>
          <div className="min-w-0 rounded-lg border border-line bg-surface p-5">
            <div className="prose-orbit max-h-[50vh] overflow-y-auto text-[14px]!" dangerouslySetInnerHTML={{ __html: preview ? (doc.versions.find((v) => v.id === preview)?.html ?? "") : (ref.current?.innerHTML ?? doc.html) }} />
            {preview && (
              <div className="mt-4 flex justify-end border-t border-line-soft pt-4">
                <Button
                  onClick={() => {
                    const v = doc.versions.find((x) => x.id === preview)!
                    applyHtml(v.html, "Before restoring an earlier version")
                    setHistory(false)
                    setPreview(null)
                    toast("Version restored")
                  }}
                >
                  Restore this version
                </Button>
              </div>
            )}
          </div>
        </div>
      </Modal>
      <Modal open={changes} onClose={() => setChanges(false)} title="Changes since last version" description={last ? `Compared with “${last.note}” · ${timeAgo(last.at)}` : undefined} width={720}>
        {last && <Diff before={last.html} after={ref.current?.innerHTML ?? doc.html} />}
      </Modal>
    </div>
  )
}
