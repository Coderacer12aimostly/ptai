import { useEffect, useMemo, useState } from "react"
import { ExternalLink, Search } from "lucide-react"
import { Badge, Button, Input, Modal, Spinner } from "./ui"
import { FileIcon } from "./icons"
import { getText } from "../lib/knowledge"
import type { KnowledgeFile } from "../lib/types"
import { bytes, shortDate } from "../lib/utils"

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

export default function FilePreview({ file, onClose, highlight, onAsk }: { file: KnowledgeFile | null; onClose: () => void; highlight?: string; onAsk?: (f: KnowledgeFile) => void }) {
  const [text, setText] = useState<string | null>(null)
  const [q, setQ] = useState("")
  useEffect(() => {
    setText(null)
    setQ("")
    if (file) getText(file.id).then(setText)
  }, [file])

  const html = useMemo(() => {
    if (!text) return ""
    let out = esc(text.slice(0, 60_000))
    if (highlight) {
      const h = esc(highlight.slice(0, 120)).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      out = out.replace(new RegExp(h, "i"), (m) => `<mark id="hl" class="rounded bg-accent-soft px-0.5 text-accent">${m}</mark>`)
    }
    if (q.trim().length > 1) {
      const r = new RegExp(`(${q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi")
      out = out.replace(r, '<mark class="rounded bg-warn-soft px-0.5 text-ink">$1</mark>')
    }
    return out
  }, [text, highlight, q])

  useEffect(() => {
    if (html && highlight) setTimeout(() => document.getElementById("hl")?.scrollIntoView({ block: "center" }), 50)
  }, [html, highlight])

  const matches = q.trim().length > 1 && text ? (text.match(new RegExp(q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"))?.length ?? 0) : 0

  return (
    <Modal
      open={!!file}
      onClose={onClose}
      width={760}
      title={
        file && (
          <span className="flex items-center gap-2">
            <FileIcon kind={file.kind} className="text-accent" /> {file.name}
          </span>
        )
      }
      description={file && `${file.meta ?? file.kind} · ${bytes(file.size)} · Added by ${file.owner} · ${shortDate(file.updatedAt)}`}
      footer={
        file && (
          <>
            {file.url && (
              <Button variant="secondary" icon={<ExternalLink className="size-4" />} onClick={() => window.open(file.url, "_blank", "noopener")}>
                Open link
              </Button>
            )}
            {onAsk && <Button onClick={() => onAsk(file)}>Start a conversation</Button>}
          </>
        )
      }
    >
      {file && (
        <>
          <div className="mb-3 flex items-center gap-3">
            <Input className="h-9 flex-1" leading={<Search className="size-4 text-faint" />} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find in file…" />
            {q.trim().length > 1 && <Badge tone={matches ? "accent" : "neutral"}>{matches} matches</Badge>}
          </div>
          {text === null ? (
            <div className="grid h-40 place-items-center">
              <Spinner />
            </div>
          ) : text ? (
            <pre className="max-h-[55vh] overflow-y-auto rounded-lg border border-line-soft bg-sunken p-4 font-sans text-[13.5px] leading-relaxed whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: html }} />
          ) : (
            <p className="rounded-lg bg-sunken p-6 text-center text-[13px] text-muted">{file.kind === "image" ? "Images are stored for reference — text isn't extracted from them yet." : "No readable text was found in this file."}</p>
          )}
        </>
      )}
    </Modal>
  )
}
