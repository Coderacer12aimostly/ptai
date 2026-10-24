import { useRef, useState } from "react"
import { ArrowRight, ArrowUpRight, Check, CircleDashed, Clock, CloudUpload, Loader2, Lock, MoreHorizontal, Sparkles, Trash2, X } from "lucide-react"
import { Button, EmptyState, Menu, MenuItem } from "../../components/ui"
import { FileIcon } from "../../components/icons"
import FilePreview from "../../components/FilePreview"
import { AddLinkModal } from "./Knowledge"
import { useStore } from "../../lib/store"
import { navigate } from "../../lib/router"
import { ACCEPT, deleteText } from "../../lib/knowledge"
import { storageLimitBytes, storageUsed, useUploader } from "../../lib/upload"
import { useNewConversation } from "../../lib/chat"
import type { KnowledgeFile } from "../../lib/types"
import { bytes, cx } from "../../lib/utils"
import { useShell } from "../../components/AppShell"
import { openUpgrade } from "../../components/upgrade"
import DriveImport from "../../components/DriveImport"
import { GoogleG } from "../../components/icons"

export default function Upload({ projectId: initial }: { projectId?: string }) {
  const { state, update } = useStore()
  const { openProject } = useShell()
  const upload = useUploader()
  const newConversation = useNewConversation()
  const [projectId, setProjectId] = useState(initial ?? state.projects[0]?.id)
  const [session, setSession] = useState<string[]>([])
  const [drag, setDrag] = useState(false)
  const [link, setLink] = useState(false)
  const [preview, setPreview] = useState<KnowledgeFile | null>(null)
  const [driveOpen, setDriveOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const project = state.projects.find((p) => p.id === projectId)
  const used = storageUsed(state.files)
  const limit = storageLimitBytes(state.workspace?.plan ?? "free")

  if (!project) {
    return (
      <div className="mx-auto max-w-[700px] px-5 py-16">
        <EmptyState icon={<CloudUpload />} title="Create a project first" action={<Button onClick={openProject}>New project</Button>}>
          Knowledge lives inside projects, so Paper Tech knows which sources belong together.
        </EmptyState>
      </div>
    )
  }

  const list = state.files.filter((f) => session.includes(f.id) || (f.projectId === projectId && ["queued", "processing"].includes(f.status)))
  const shown = list.length ? list : state.files.filter((f) => f.projectId === projectId && f.kind !== "artifact").slice(0, 4)
  const ready = list.filter((f) => f.status === "ready")
  const processing = list.some((f) => f.status === "queued" || f.status === "processing")
  const any = list.length > 0
  const allDone = any && !processing

  async function add(files: FileList | File[]) {
    const total = Array.from(files).reduce((a, f) => a + f.size, 0)
    if (used + total > limit) return openUpgrade(`You're out of knowledge storage on your plan (${bytes(limit)}).`)
    // Files show up immediately as "queued/processing"; once done we keep them in this session's list.
    const ids = await upload(files, projectId!)
    setSession((s) => Array.from(new Set([...s, ...ids])))
  }

  const steps = [
    { t: "Upload securely", s: any ? `${list.length} file${list.length > 1 ? "s" : ""} received` : "Waiting for files", done: any },
    { t: "Read and extract", s: "Text and tables recognised", done: any && list.every((f) => f.status !== "queued" && (f.progress ?? 0) >= 0.85), active: processing },
    { t: "Build understanding", s: "Finding themes and connections", done: allDone, active: processing },
    { t: "Ready for questions", s: "Search, cite, and create", done: allDone && ready.length > 0 },
  ]

  return (
    <div className="mx-auto max-w-[1240px] px-5 py-8 md:px-10 md:py-12">
      <p className="eyebrow">Project knowledge</p>
      <h1 className="display mt-3 text-[32px] font-semibold md:text-[38px]">Give your next idea a little context.</h1>
      <p className="mt-2 text-[15px] text-muted">Add source material. Paper Tech will make it searchable, connected, and ready to work with.</p>

      <div className="mt-9 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div
            onDragOver={(e) => (e.preventDefault(), setDrag(true))}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault()
              setDrag(false)
              if (e.dataTransfer.files.length) add(e.dataTransfer.files)
            }}
            className={cx("rounded-2xl border border-dashed px-6 py-12 text-center transition-colors", drag ? "border-accent bg-accent-soft" : "border-accent-line bg-surface")}
          >
            <span className="mx-auto grid size-12 place-items-center rounded-xl bg-accent-soft text-accent">
              <CloudUpload className="size-6" strokeWidth={1.6} />
            </span>
            <p className="mt-4 text-[16px]">
              Drop your files here, or{" "}
              <button className="text-accent underline-offset-2 hover:underline" onClick={() => input.current?.click()}>
                browse files
              </button>
            </p>
            <p className="mt-2 text-[12.5px] text-muted">PDF, DOCX, TXT, Markdown, CSV and images · Up to 50 MB each</p>
            <div className="mt-4 flex justify-center gap-5 text-[12.5px]">
              <button className="inline-flex items-center gap-1 text-accent hover:underline" onClick={() => setLink(true)}>
                Paste a link <ArrowUpRight className="size-3" />
              </button>
              <button className="inline-flex items-center gap-1.5 text-accent hover:underline" onClick={() => setDriveOpen(true)}>
                <GoogleG className="size-3.5" /> Import from Google Drive
              </button>
            </div>
            <input ref={input} type="file" multiple hidden accept={ACCEPT} onChange={(e) => (e.target.files && add(e.target.files), (e.target.value = ""))} />
          </div>

          <div className="mt-8 mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-[15px]">
              Adding to
              <select value={projectId} onChange={(e) => (setProjectId(e.target.value), setSession([]))} className="rounded-md border border-line bg-surface px-2 py-1 text-[14px] font-medium">
                {state.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </h2>
            <span className="font-mono text-[11px] text-faint uppercase">
              {any ? `${ready.length} of ${list.length} ready` : `${shown.length} existing`}
            </span>
          </div>

          <div className="space-y-3">
            {shown.length === 0 && <p className="rounded-xl border border-line bg-surface px-5 py-8 text-center text-[13px] text-muted">Nothing here yet — your files will appear as they upload.</p>}
            {shown.map((f) => {
              const active = f.status === "processing" || f.status === "queued"
              return (
                <div key={f.id} className={cx("rounded-xl border p-4 transition-colors", active ? "border-accent-line bg-accent-soft" : "border-line bg-surface")}>
                  <div className="flex items-center gap-3.5">
                    <FileIcon kind={f.kind} className={active ? "text-accent" : "text-muted"} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px]">{f.name}</p>
                      <p className="text-[12px] text-muted">
                        {bytes(f.size)} · {f.status === "ready" ? `${f.meta} indexed` : f.meta}
                      </p>
                    </div>
                    {f.status === "ready" && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-success-soft px-2 py-1 text-[12px] text-success">
                        <Check className="size-3.5" /> Ready
                      </span>
                    )}
                    {f.status === "error" && <span className="text-[12px] text-danger">Couldn't read</span>}
                    {f.status === "queued" && <span className="text-[12px] text-faint">Queued</span>}
                    {f.status === "processing" && <span className="font-mono text-[12px] text-accent">{Math.round((f.progress ?? 0) * 100)}%</span>}
                    {active ? (
                      <button className="rounded p-1 text-muted hover:text-ink" aria-label="Cancel" onClick={() => (update((d) => void (d.files = d.files.filter((x) => x.id !== f.id))), deleteText(f.id))}>
                        <X className="size-4" />
                      </button>
                    ) : (
                      <Menu
                        width={170}
                        trigger={() => (
                          <button className="rounded p-1 text-muted hover:text-ink" aria-label="File options">
                            <MoreHorizontal className="size-4" />
                          </button>
                        )}
                      >
                        {(close) => (
                          <>
                            <MenuItem onClick={() => (close(), setPreview(f))}>View source</MenuItem>
                            <MenuItem danger icon={<Trash2 />} onClick={() => (close(), update((d) => void (d.files = d.files.filter((x) => x.id !== f.id))), deleteText(f.id))}>
                              Remove
                            </MenuItem>
                          </>
                        )}
                      </Menu>
                    )}
                  </div>
                  {active && (
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line-soft">
                      <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${Math.max(4, (f.progress ?? 0) * 100)}%` }} />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <p className="mt-5 flex items-center gap-2 text-[12px] text-muted">
            <Lock className="size-3.5" /> Encrypted and private. Only members of this project can access these files.
          </p>
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-line bg-surface p-6">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-medium">Making connections</h3>
              {processing ? <Loader2 className="size-5 animate-spin text-accent" /> : allDone ? <Check className="size-5 text-success" /> : null}
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">Paper Tech is reading your files so you can ask better questions of them.</p>
            <ul className="mt-6 space-y-5">
              {steps.map((s) => (
                <li key={s.t} className="flex gap-3">
                  {s.done ? <Check className="mt-0.5 size-4 text-success" /> : s.active ? <Loader2 className="mt-0.5 size-4 animate-spin text-accent" /> : <CircleDashed className="mt-0.5 size-4 text-faint" />}
                  <span>
                    <span className={cx("block text-[13px]", !s.done && !s.active && "text-muted")}>{s.t}</span>
                    <span className="block text-[11.5px] text-muted">{s.s}</span>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-6 flex items-center gap-2 border-t border-line-soft pt-4 text-[12px] text-muted">
              <Clock className="size-3.5" /> {processing ? "A few seconds remaining" : allDone ? "All done" : "Usually takes a few seconds per file"}
            </p>
          </div>

          <div className="rounded-2xl bg-sunken p-6">
            <span className="grid size-10 place-items-center rounded-full bg-surface text-accent">
              <Sparkles className="size-5" strokeWidth={1.6} />
            </span>
            <h3 className="mt-4 text-[15px] font-medium">The insights start here.</h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-muted">Once processing is complete, ask Paper Tech for a summary and suggested questions for your new sources.</p>
            <Button
              variant="secondary"
              className="mt-4"
              disabled={!ready.length}
              icon={<ArrowRight className="size-4" />}
              onClick={() => {
                const names = ready.map((f) => `“${f.name}”`).join(", ")
                const id = newConversation({ projectId })
                navigate(`/app/chat/${id}?q=${encodeURIComponent(`Summarise the key themes in ${names}, then suggest three good questions to ask next.`)}`)
              }}
            >
              Start with {ready.length || "your"} ready file{ready.length === 1 ? "" : "s"}
            </Button>
            <p className="mt-3 text-[11.5px] text-faint">You can leave this page. We'll keep going.</p>
          </div>

          <div className="rounded-2xl border border-line bg-surface p-5">
            <div className="flex justify-between text-[12.5px]">
              <span className="text-muted">Knowledge storage</span>
              <span>
                {bytes(used)} of {limit === Infinity ? "Unlimited" : bytes(limit)}
              </span>
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line-soft">
              <div className="h-full rounded-full bg-accent" style={{ width: `${limit === Infinity ? 2 : Math.min(100, (used / limit) * 100)}%` }} />
            </div>
          </div>
        </aside>
      </div>
      <AddLinkModal open={link} onClose={() => setLink(false)} projectId={projectId!} />
      <FilePreview file={preview} onClose={() => setPreview(null)} />
      <DriveImport open={driveOpen} onClose={() => setDriveOpen(false)} projectId={projectId} />
    </div>
  )
}
