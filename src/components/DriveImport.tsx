import { useEffect, useMemo, useState } from "react"
import { Check, ExternalLink, Search } from "lucide-react"
import { Badge, Button, Input, Modal, Spinner } from "./ui"
import { GoogleG } from "./icons"
import { useGoogle } from "./GoogleProvider"
import GoogleConnect from "./GoogleConnect"
import { driveLabel, fetchDriveFile, getFiles, type GFile } from "../lib/google"
import { extractText, saveText } from "../lib/knowledge"
import { useStore } from "../lib/store"
import type { FileKind } from "../lib/types"
import { cx, timeAgo, uid } from "../lib/utils"
import { toast } from "./toast"

function kindOf(mime: string): FileKind {
  if (mime.includes("spreadsheet") || mime.includes("csv")) return "csv"
  if (mime.includes("pdf")) return "pdf"
  if (mime.startsWith("image/")) return "image"
  return "doc"
}

export default function DriveImport({ open, onClose, projectId: initial }: { open: boolean; onClose: () => void; projectId?: string }) {
  const { state, update, user } = useStore()
  const google = useGoogle()
  const [q, setQ] = useState("")
  const [list, setList] = useState<GFile[] | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const [projectId, setProjectId] = useState(initial ?? state.projects[0]?.id)
  const [busy, setBusy] = useState(false)
  const connected = google.has("drive")

  useEffect(() => {
    if (!open) return
    setPicked([])
    setProjectId(initial ?? state.projects[0]?.id)
  }, [open, initial, state.projects])

  useEffect(() => {
    if (!open || !connected) return
    let live = true
    setList(null)
    const t = setTimeout(() => {
      getFiles(google.opts, q.trim())
        .then((f) => live && setList(f))
        .catch((e) => {
          if (live) setList([])
          toast((e as Error).message, "error")
        })
    }, q ? 300 : 0)
    return () => {
      live = false
      clearTimeout(t)
    }
  }, [open, q, connected, google.opts])

  const imported = useMemo(() => new Set(state.files.filter((f) => f.projectId === projectId && f.url).map((f) => f.url)), [state.files, projectId])

  async function run() {
    if (!projectId || !list) return
    setBusy(true)
    const chosen = list.filter((f) => picked.includes(f.id))
    let ok = 0
    for (const f of chosen) {
      const id = uid("f-")
      update((d) => void d.files.unshift({ id, projectId, name: f.name, kind: kindOf(f.mimeType), size: f.size, owner: f.owner || user?.name || "You", updatedAt: Date.now(), status: "processing", progress: 0.2, meta: `${driveLabel(f.mimeType)} · importing…`, url: f.url }))
      try {
        const { file, label } = await fetchDriveFile(google.opts, f)
        const { text, meta } = await extractText(file)
        await saveText(id, text)
        const words = text.split(/\s+/).filter(Boolean).length
        update((d) => {
          const x = d.files.find((y) => y.id === id)
          if (x) Object.assign(x, { status: "ready", progress: 1, size: file.size, chars: text.length, meta: label === "PDF" ? meta : `${label} · ${words.toLocaleString()} words`, summary: text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0]?.slice(0, 180) })
        })
        ok++
      } catch (e) {
        update((d) => {
          const x = d.files.find((y) => y.id === id)
          if (x) Object.assign(x, { status: "error", meta: (e as Error).message })
        })
      }
    }
    setBusy(false)
    toast(ok === chosen.length ? `Imported ${ok} file${ok === 1 ? "" : "s"} from Google Drive` : `Imported ${ok} of ${chosen.length}. Some files couldn't be read.`, ok ? "success" : "error")
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      width={640}
      title={
        <span className="flex items-center gap-2">
          <GoogleG /> Import from Google Drive
        </span>
      }
      description={connected ? "Paper Tech copies the text of each file into the project so you can ask questions about it." : undefined}
      footer={
        connected ? (
          <>
            <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="mr-auto h-10 rounded-lg border border-line bg-surface px-2 text-[13px]" aria-label="Project">
              {state.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  Add to {p.name}
                </option>
              ))}
            </select>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={run} loading={busy} disabled={!picked.length || !projectId}>
              Import {picked.length || ""}
            </Button>
          </>
        ) : undefined
      }
    >
      {!connected ? (
        <GoogleConnect ret={projectId ? `/app/knowledge/${projectId}` : "/app/today"} />
      ) : (
        <>
          <Input className="h-10" leading={<Search className="size-4 text-faint" />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your Drive…" />
          <div className="mt-3 max-h-[46vh] overflow-y-auto">
            {list === null ? (
              <div className="grid h-40 place-items-center">
                <Spinner />
              </div>
            ) : list.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-muted">No files found.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {list.map((f) => {
                  const on = picked.includes(f.id)
                  const already = imported.has(f.url)
                  return (
                    <li key={f.id}>
                      <label className={cx("flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2.5", on ? "bg-accent-soft" : "hover:bg-sunken")}>
                        <input type="checkbox" checked={on} onChange={() => setPicked((p) => (on ? p.filter((x) => x !== f.id) : [...p, f.id]))} className="size-4 accent-[var(--accent)]" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px]">{f.name}</span>
                          <span className="block text-[11.5px] text-muted">
                            {driveLabel(f.mimeType)} · {f.modifiedBy ? `${f.modifiedByMe ? "You" : f.modifiedBy} edited` : "Edited"} {timeAgo(Date.parse(f.modifiedTime))}
                          </span>
                        </span>
                        {already && (
                          <Badge tone="success">
                            <Check className="size-3" /> In project
                          </Badge>
                        )}
                        <a href={f.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="rounded p-1 text-faint hover:text-ink" aria-label={`Open ${f.name} in Drive`}>
                          <ExternalLink className="size-3.5" />
                        </a>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </>
      )}
    </Modal>
  )
}
