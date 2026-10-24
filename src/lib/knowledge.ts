import { get, set, del } from "idb-keyval"
import type { FileKind, KnowledgeFile } from "./types"

const MAX_CHARS = 400_000

// File text lives in IndexedDB; if the browser blocks it (e.g. local files), fall back to memory.
const memText = new Map<string, string>()
export const saveText = async (id: string, text: string) => {
  const t = text.slice(0, MAX_CHARS)
  memText.set(id, t)
  try { await set(`kt:${id}`, t) } catch { /* memory only */ }
}
export const getText = async (id: string) => {
  try { return ((await get(`kt:${id}`)) as string | undefined) ?? memText.get(id) ?? "" } catch { return memText.get(id) ?? "" }
}
export const deleteText = async (id: string) => {
  memText.delete(id)
  try { await del(`kt:${id}`) } catch { /* ignore */ }
}

export function kindFor(name: string, type = ""): FileKind {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  if (ext === "pdf" || type === "application/pdf") return "pdf"
  if (["doc", "docx", "rtf", "odt"].includes(ext)) return "doc"
  if (["csv", "tsv", "xlsx", "xls"].includes(ext)) return "csv"
  if (type.startsWith("image/") || ["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return "image"
  return "text"
}

export const ACCEPT = ".pdf,.docx,.txt,.md,.markdown,.csv,.tsv,.json,.html,.htm,.xml,.yml,.yaml,.log,.rtf,.png,.jpg,.jpeg,.webp,.gif"

/** Pull readable text out of an uploaded file, entirely in the browser. */
export async function extractText(
  file: File,
  onProgress?: (p: number) => void,
): Promise<{ text: string; meta: string }> {
  const kind = kindFor(file.name, file.type)
  if (kind === "pdf") {
    const pdfjs = await import("pdfjs-dist")
    const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url")
    pdfjs.GlobalWorkerOptions.workerSrc = worker.default
    const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
    const parts: string[] = []
    for (let i = 1; i <= doc.numPages; i++) {
      const page = await doc.getPage(i)
      const content = await page.getTextContent()
      parts.push(content.items.map((it) => ("str" in it ? it.str : "")).join(" "))
      onProgress?.(i / doc.numPages)
    }
    return { text: parts.join("\n\n"), meta: `PDF · ${doc.numPages} page${doc.numPages === 1 ? "" : "s"}` }
  }
  if (file.name.toLowerCase().endsWith(".docx")) {
    const mammoth = await import("mammoth")
    const res = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    const words = res.value.split(/\s+/).filter(Boolean).length
    return { text: res.value, meta: `Document · ${words.toLocaleString()} words` }
  }
  if (kind === "image") {
    return { text: "", meta: `Image · ${file.type.replace("image/", "").toUpperCase() || "file"}` }
  }
  const text = await file.text()
  if (kind === "csv") {
    const rows = text.split(/\r?\n/).filter(Boolean).length
    return { text, meta: `CSV · ${Math.max(rows - 1, 0)} rows` }
  }
  const words = text.split(/\s+/).filter(Boolean).length
  return { text, meta: `Text · ${words.toLocaleString()} words` }
}

export interface Passage {
  file: KnowledgeFile
  text: string
  score: number
}

const STOP = new Set(
  "the a an and or but of to in on for with is are was were be been this that these those it its our we you your they their i me my as at by from about into what which who how why when where should could would can do does did use using please make give tell show".split(
    " ",
  ),
)

export function tokens(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
}

/** Lightweight keyword retrieval over a set of files. */
export async function retrieve(files: KnowledgeFile[], query: string, limit = 6): Promise<Passage[]> {
  const docs = await Promise.all(files.map(async (file) => ({ file, text: await getText(file.id) })))
  return scorePassages(docs, query, limit)
}

/** Split a source into citable chunks: real sentences, not titles or table headers. */
export function chunksOf(file: KnowledgeFile, text: string): string[] {
  if (file.kind === "csv") {
    const rows = text.split(/\r?\n/).filter((r) => r.trim())
    const header = (rows[0] ?? "").split(",").map((h) => h.trim().replace(/_/g, " "))
    return rows.slice(1, 200).map((r) => {
      const c = r.split(",").map((x) => x.trim())
      const rest = header
        .slice(2)
        .map((h, i) => (c[i + 2] ? `${h} ${c[i + 2]}` : ""))
        .filter(Boolean)
        .join("; ")
      return `${c[0]}${c[1] ? ` (${c[1]})` : ""}: ${rest}.`
    })
  }
  const out: string[] = []
  for (const raw of text.split(/\n+/)) {
    const line = raw.replace(/\s+/g, " ").trim()
    const words = line.split(" ").length
    if (words < 6 || (!/[.!?]/.test(line) && words < 15)) continue
    if (line.length <= 380) {
      out.push(line)
      continue
    }
    let buf = ""
    for (const sent of line.split(/(?<=[.!?])\s+/)) {
      if ((buf + " " + sent).length > 260 && buf) {
        out.push(buf.trim())
        buf = ""
      }
      buf += " " + sent
    }
    if (buf.trim()) out.push(buf.trim())
  }
  return out
}

export function scorePassages(docs: Array<{ file: KnowledgeFile; text: string }>, query: string, limit = 6): Passage[] {
  const q = new Set(tokens(query))
  const out: Passage[] = []
  for (const { file, text } of docs) {
    if (!text) continue
    const nameHits = tokens(file.name).filter((w) => q.has(w) || q.has(w.replace(/s$/, ""))).length
    const chunks = chunksOf(file, text)
    chunks.forEach((chunk, i) => {
      const t = tokens(chunk)
      let score = nameHits * 0.6
      for (const w of t) if (q.has(w) || q.has(w.replace(/s$/, ""))) score += 1
      // Slight preference for evidence: numbers and quotes.
      if (/\d/.test(chunk)) score += 0.15
      if (/[“"]/.test(chunk)) score += 0.15
      if (score > 0.3) out.push({ file, text: chunk, score: score / Math.sqrt(t.length + 6) - i * 0.0005 })
    })
    if (!q.size && chunks[0]) out.push({ file, text: chunks[0], score: 0.1 })
  }
  // Broad questions ("what stands out?") — fall back to each source's opening points.
  if (!out.length) {
    for (const { file, text } of docs) chunksOf(file, text).slice(0, 2).forEach((c, i) => out.push({ file, text: c, score: 0.05 - i * 0.01 }))
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit)
}

/** Build a context block with numbered sources for the model. */
export async function buildContext(files: KnowledgeFile[], budget = 60_000) {
  const ready = files.filter((f) => f.status === "ready" || f.status === "draft")
  const parts: string[] = []
  const used: KnowledgeFile[] = []
  let left = budget
  for (const f of ready) {
    if (left <= 500) break
    const text = await getText(f.id)
    if (!text) continue
    const slice = text.slice(0, Math.min(left, 25_000))
    left -= slice.length
    used.push(f)
    parts.push(`<source n="${used.length}" title="${f.name}" type="${f.meta ?? f.kind}">\n${slice}\n</source>`)
  }
  return { context: parts.join("\n\n"), used }
}

/** Compact numbered sources built from the best-matching passages (for small on-device models). */
export function passageContext(passages: Passage[]) {
  const used: KnowledgeFile[] = []
  const byFile = new Map<string, string[]>()
  for (const p of passages) {
    if (!byFile.has(p.file.id)) {
      byFile.set(p.file.id, [])
      used.push(p.file)
    }
    byFile.get(p.file.id)!.push(p.text)
  }
  const context = used
    .map((f, i) => `<source n="${i + 1}" title="${f.name}">\n${byFile.get(f.id)!.join("\n…\n")}\n</source>`)
    .join("\n\n")
  return { context, used }
}
