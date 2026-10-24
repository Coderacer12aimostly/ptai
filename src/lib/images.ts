/**
 * Images in conversations. Everything happens on this device:
 *  - images are shrunk and stored in IndexedDB (only a small thumbnail lives in the saved state),
 *  - text in images is read with Tesseract OCR (WebAssembly, works in every browser),
 *  - on browsers with WebGPU, Paper Tech 1 Vision (Phi-3.5-vision) describes the whole picture,
 *  - the selected model then answers using that description.
 */
import { get, set } from "idb-keyval"
import type { ImageRef } from "./types"
import { uid } from "./utils"
import { extractText, tokens } from "./knowledge"

export const MAX_IMAGES = 4
export const MAX_ATTACHMENTS = 6
export const MAX_IMAGE_MB = 10
export const MAX_DOC_MB = 20
export const IMAGE_ACCEPT = "image/png,image/jpeg,image/webp,image/gif"
const DOC_EXT = "pdf,docx,txt,md,markdown,csv,tsv,json,html,htm,xml,yml,yaml,log,rtf,js,jsx,ts,tsx,py,java,c,h,cpp,cs,go,rs,rb,php,swift,kt,css,scss,sql,sh,toml,ini".split(",")
/** Everything the message box accepts: pictures plus documents and code files */
export const ATTACH_ACCEPT = IMAGE_ACCEPT + "," + DOC_EXT.map((e) => "." + e).join(",")
export const isImageFile = (f: File) => /^image\/(png|jpe?g|webp|gif)$/.test(f.type)

const mem = new Map<string, string>()

function loadImg(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("This image couldn't be opened."))
    img.src = src
  })
}

function toDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(r.error)
    r.readAsDataURL(file)
  })
}

function draw(img: HTMLImageElement, max: number, type: string, quality: number) {
  const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const c = document.createElement("canvas")
  c.width = w
  c.height = h
  const ctx = c.getContext("2d")!
  ctx.fillStyle = "#fff"
  ctx.fillRect(0, 0, w, h)
  ctx.drawImage(img, 0, 0, w, h)
  return { url: c.toDataURL(type, quality), w, h, canvas: c }
}

/** Shrink, store and describe the basics of an image the user attached. */
export async function prepareImage(file: File): Promise<ImageRef> {
  if (!/^image\/(png|jpe?g|webp|gif)$/.test(file.type)) throw new Error(`${file.name || "That file"} isn't a PNG, JPG, WebP or GIF image.`)
  if (file.size > MAX_IMAGE_MB * 1024 * 1024) throw new Error(`${file.name || "That image"} is over ${MAX_IMAGE_MB} MB.`)
  const img = await loadImg(await toDataUrl(file))
  const full = draw(img, 1280, "image/jpeg", 0.88)
  const thumb = draw(img, 240, "image/jpeg", 0.72)
  const id = uid("img-")
  mem.set(id, full.url)
  try {
    await set(`img:${id}`, full.url)
  } catch {
    /* private mode: keep it in memory for this session */
  }
  return { id, name: file.name || "Pasted image", w: img.naturalWidth, h: img.naturalHeight, thumb: thumb.url, colors: mainColors(thumb.canvas) }
}

/* ------------------------------------------------------------------ documents */

const docMem = new Map<string, string>()

/** Read a document the user attached (PDF, Word, text, CSV, code…) on this device and keep its text. */
export async function prepareDoc(file: File): Promise<ImageRef> {
  const ext = file.name.split(".").pop()?.toLowerCase() ?? ""
  if (["xlsx", "xls", "numbers"].includes(ext)) throw new Error(`${file.name}: save the spreadsheet as CSV first, then attach that.`)
  if (["doc", "pages", "key", "pptx", "ppt"].includes(ext)) throw new Error(`${file.name}: this format can't be read here. Save it as PDF or .docx and attach that.`)
  if (!DOC_EXT.includes(ext) && !file.type.startsWith("text/")) throw new Error(`${file.name} isn't a file Paper Tech can read. Try PDF, Word (.docx), text, CSV or a code file.`)
  if (file.size > MAX_DOC_MB * 1024 * 1024) throw new Error(`${file.name} is over ${MAX_DOC_MB} MB.`)
  const { text, meta } = await extractText(file)
  const clean = text.replace(/\u0000/g, "").trim()
  if (!clean) throw new Error(`${file.name} has no readable text (a scanned PDF? attach it as an image instead).`)
  const id = uid("doc-")
  docMem.set(id, clean)
  try {
    await set(`doc:${id}`, clean)
  } catch {
    /* private mode: keep it in memory for this session */
  }
  return { id, name: file.name, w: 0, h: 0, thumb: "", doc: { meta, chars: clean.length } }
}

export async function getDocText(id: string): Promise<string> {
  if (docMem.has(id)) return docMem.get(id)!
  try {
    const v = ((await get(`doc:${id}`)) as string | undefined) ?? ""
    if (v) docMem.set(id, v)
    return v
  } catch {
    return ""
  }
}

/**
 * The on-device models have a small memory (about 4,000 tokens), so long documents are trimmed to the parts that
 * matter for the question: the beginning, plus the passages that share the most words with what the user asked.
 */
export function excerpt(text: string, question: string, budget: number) {
  if (text.length <= budget) return { text, partial: false }
  const size = 700
  // Pieces of about 700 characters that end at a sentence or line break, so quotes aren't cut mid-word.
  const chunks: string[] = []
  let cur = ""
  for (const part of text.split(/(?<=[.!?])\s+|\n+/)) {
    if (cur && cur.length + part.length > size) chunks.push(cur), (cur = "")
    cur += (cur ? " " : "") + part
    while (cur.length > size * 1.5) chunks.push(cur.slice(0, size)), (cur = cur.slice(size))
  }
  if (cur) chunks.push(cur)
  const q = new Set(tokens(question))
  const score = (c: string) => tokens(c).reduce((s, t) => s + (q.has(t) ? 1 : 0), 0)
  const n = Math.max(1, Math.floor(budget / size))
  const keep = new Set<number>([0])
  chunks
    .map((c, i) => ({ i, s: score(c) }))
    .filter((x) => x.i !== 0)
    .sort((a, b) => b.s - a.s || a.i - b.i)
    .slice(0, n - 1)
    .forEach((x) => keep.add(x.i))
  let out = "", prev = -1
  for (const i of [...keep].sort((a, b) => a - b)) {
    if (prev >= 0 && i !== prev + 1) out += "\n[…]\n"
    out += chunks[i]
    prev = i
  }
  return { text: out + (prev < chunks.length - 1 ? "\n[…]" : ""), partial: true }
}

export async function getImage(id: string): Promise<string | undefined> {
  if (mem.has(id)) return mem.get(id)
  try {
    const v = (await get(`img:${id}`)) as string | undefined
    if (v) mem.set(id, v)
    return v
  } catch {
    return undefined
  }
}

/* ------------------------------------------------------------------ colors */

const NAMED: Array<[string, number[]]> = [
  ["black", [20, 20, 20]], ["white", [245, 245, 245]], ["gray", [128, 128, 128]], ["light gray", [200, 200, 200]], ["dark gray", [64, 64, 64]],
  ["red", [210, 40, 40]], ["orange", [240, 140, 40]], ["yellow", [240, 220, 60]], ["green", [60, 160, 70]], ["teal", [40, 150, 150]],
  ["blue", [50, 100, 220]], ["navy", [30, 40, 100]], ["purple", [130, 70, 180]], ["pink", [235, 130, 180]], ["brown", [130, 85, 50]], ["beige", [225, 205, 170]],
]
function colorName([r, g, b]: number[]) {
  let best = NAMED[0][0], d = Infinity
  for (const [n, c] of NAMED) {
    const x = (r - c[0]) ** 2 + (g - c[1]) ** 2 + (b - c[2]) ** 2
    if (x < d) (d = x), (best = n)
  }
  return best
}
function mainColors(c: HTMLCanvasElement) {
  const data = c.getContext("2d")!.getImageData(0, 0, c.width, c.height).data
  const counts = new Map<string, number>()
  const step = Math.max(1, Math.floor(data.length / 4 / 3000)) * 4
  for (let i = 0; i < data.length; i += step) {
    const n = colorName([data[i], data[i + 1], data[i + 2]])
    counts.set(n, (counts.get(n) ?? 0) + 1)
  }
  const total = [...counts.values()].reduce((a, b) => a + b, 0)
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .filter(([, n]) => n / total > 0.06)
    .slice(0, 3)
    .map(([n]) => n)
}

/* ------------------------------------------------------------------ OCR */

let ocrWorker: Promise<{ recognize: (img: string) => Promise<{ data: { text: string; confidence: number } }> }> | null = null
const ocrCache = new Map<string, string>()

/** Read the text in an image (Tesseract, runs in a Web Worker on this device). */
export async function readText(id: string): Promise<string> {
  if (ocrCache.has(id)) return ocrCache.get(id)!
  const url = await getImage(id)
  if (!url) return ""
  if (!ocrWorker) {
    ocrWorker = (async () => {
      const t = await import("tesseract.js")
      // Use the copy shipped with the app (/ocr/) when it's there; otherwise Tesseract's CDN.
      let opts: Record<string, string> = {}
      if (/^https?:$/.test(location.protocol)) {
        const base = new URL("ocr/", location.href).href
        const ok = await fetch(base + "eng.traineddata.gz", { method: "HEAD" }).then((r) => r.ok && !(r.headers.get("content-type") ?? "").includes("text/html")).catch(() => false)
        if (ok) opts = { workerPath: base + "worker.min.js", corePath: base, langPath: base.replace(/\/$/, "") }
      }
      return (await t.createWorker("eng", 1, opts)) as unknown as { recognize: (img: string) => Promise<{ data: { text: string; confidence: number } }> }
    })()
    ocrWorker.catch(() => (ocrWorker = null))
  }
  const w = await ocrWorker
  const { data } = await w.recognize(url)
  // Keep lines that look like real text, not noise from photos.
  const lines = data.text
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 1 && /[A-Za-z0-9]{2,}/.test(l) && (l.match(/[A-Za-z0-9]/g)?.length ?? 0) / l.length > 0.55)
  const text = data.confidence < 35 ? "" : lines.join("\n").slice(0, 2000)
  ocrCache.set(id, text)
  return text
}

/* ------------------------------------------------------------------ context for the model */

/** Hand-off of pending images between the composer and the conversation page. */
const pending = new Map<string, ImageRef[]>()
export const stashImages = (conversationId: string, imgs: ImageRef[]) => imgs.length && pending.set(conversationId, imgs)
export function takeImages(conversationId: string) {
  const v = pending.get(conversationId) ?? []
  pending.delete(conversationId)
  return v
}

export interface ImageNotes {
  text: string
  /** Which methods produced the notes */
  used: { vision: boolean; ocr: boolean }
}

/**
 * Turn attached images into text the selected model can read.
 * `describe` is the Vision step (only on browsers that can run it).
 */
export async function imageNotes(
  imgs: ImageRef[],
  question: string,
  opts: { describe?: (url: string, question: string) => Promise<string>; onPhase?: (p: string) => void },
): Promise<ImageNotes> {
  const used = { vision: false, ocr: false }
  const blocks: string[] = []
  const docs = imgs.filter((x) => x.doc)
  const budget = Math.max(1500, Math.floor(5000 / Math.max(1, docs.length)))
  for (const [i, d] of docs.entries()) {
    opts.onPhase?.(`Reading ${d.name}…`)
    const full = await getDocText(d.id)
    const ex = excerpt(full, question, budget)
    blocks.push(
      [
        `<file n="${i + 1}" name="${d.name.replace(/"/g, "'")}" about="${d.doc!.meta}">`,
        ex.partial ? `(Long file: showing the beginning and the parts most related to the question, ${ex.text.length.toLocaleString()} of ${full.length.toLocaleString()} characters.)` : "",
        ex.text || "(This file had no readable text.)",
        `</file>`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
  }
  const pics = imgs.filter((x) => !x.doc)
  for (const [i, im] of pics.entries()) {
    const n = pics.length > 1 ? ` ${i + 1}` : ""
    opts.onPhase?.(`Reading the text in image${n}…`)
    let ocr = ""
    try {
      ocr = await readText(im.id)
      if (ocr) used.ocr = true
    } catch {
      /* OCR unavailable (offline on first use) */
    }
    let seen = ""
    if (opts.describe) {
      opts.onPhase?.(`Looking at image${n} with Paper Tech 1 Vision…`)
      try {
        const url = await getImage(im.id)
        if (url) seen = (await opts.describe(url, question)).trim()
        if (seen) used.vision = true
      } catch (e) {
        console.warn("Vision unavailable:", e)
      }
    }
    blocks.push(
      [
        `<image n="${i + 1}" name="${im.name.replace(/"/g, "'")}" size="${im.w}×${im.h}">`,
        seen ? `What it shows (described by Paper Tech 1 Vision): ${seen}` : "",
        ocr ? `Text in the image (OCR, may contain small errors):\n${ocr}` : "",
        im.colors?.length ? `Main colors: ${im.colors.join(", ")}` : "",
        !seen && !ocr ? "No readable text was found, and this device can't run Paper Tech 1 Vision to look at the picture itself." : "",
        `</image>`,
      ]
        .filter(Boolean)
        .join("\n"),
    )
  }
  return { text: blocks.join("\n"), used }
}

export function withImageNotes(text: string, notes?: string) {
  if (!notes) return text
  const files = notes.includes("<file "), pics = notes.includes("<image ")
  if (!files) return `${text}\n\nThe user attached images. You can't see them directly; here is what Paper Tech found in them:\n${notes}\nUse this to answer. If something isn't covered, say what you can't tell from the image.`
  return `${text}\n\nThe user attached ${pics ? "files and images" : "files"}. Here is what Paper Tech read from them:\n${notes}\nUse this to answer, and mention which file a fact comes from. If the answer isn't in what's shown, say so.`
}
