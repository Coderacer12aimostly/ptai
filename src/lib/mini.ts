/**
 * Paper Tech Nano — Paper Tech's own tiny language model, trained from scratch.
 * This is a dependency-free runtime: a byte-level BPE tokenizer and a small GPT
 * (pre-LayerNorm, causal attention, GELU MLP, tied embeddings) in plain TypeScript.
 * It runs on the CPU in any browser, offline, with no download beyond the app.
 */
import weightsUrl from "../assets/papertech-nano.bin?url"

interface Header {
  cfg: { vocab: number; ctx: number; d: number; layers: number; heads: number }
  merges: [number, number][]
  tensors: Record<string, { shape: number[]; offset: number; dtype: "i8" | "f32"; scale?: number }>
}

const USER = 1, BOT = 2, END = 3, BYTE0 = 4
const PAT = /'s|'t|'re|'ve|'m|'ll|'d| ?[A-Za-z]+| ?[0-9]+| ?[^\sA-Za-z0-9]+|\s+(?!\S)|\s+/g

export class MiniModel {
  cfg: Header["cfg"]
  private W: Record<string, Float32Array> = {}
  private rank = new Map<number, number>()
  private bytes: Uint8Array[] = []
  private cache = new Map<string, number[]>()

  constructor(buf: ArrayBuffer) {
    const dv = new DataView(buf)
    const hlen = dv.getUint32(0, true)
    const h: Header = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hlen)))
    const base = 4 + hlen
    this.cfg = h.cfg
    for (const [name, t] of Object.entries(h.tensors)) {
      const n = t.shape.reduce((a, b) => a * b, 1)
      if (t.dtype === "f32") {
        this.W[name] = new Float32Array(buf.slice(base + t.offset, base + t.offset + n * 4))
      } else {
        // int8 with one float32 scale per row (rows = shape[0])
        const rows = t.shape[0], cols = n / rows
        const q = new Int8Array(buf, base + t.offset, n)
        const sc = new Float32Array(buf.slice(base + t.scale!, base + t.scale! + rows * 4))
        const w = new Float32Array(n)
        for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) w[r * cols + c] = q[r * cols + c] * sc[r]
        this.W[name] = w
      }
    }
    for (let i = 0; i < 256; i++) this.bytes[BYTE0 + i] = new Uint8Array([i])
    h.merges.forEach(([a, b], i) => {
      this.rank.set(a * 65536 + b, i)
      const x = this.bytes[a], y = this.bytes[b], z = new Uint8Array(x.length + y.length)
      z.set(x); z.set(y, x.length)
      this.bytes[BYTE0 + 256 + i] = z
    })
  }

  /* ---------------- tokenizer ---------------- */
  private word(w: string) {
    const hit = this.cache.get(w)
    if (hit) return hit
    let ids = Array.from(new TextEncoder().encode(w), (b) => b + BYTE0)
    while (ids.length > 1) {
      let best = -1, bi = -1
      for (let i = 0; i < ids.length - 1; i++) {
        const r = this.rank.get(ids[i] * 65536 + ids[i + 1])
        if (r !== undefined && (best < 0 || r < best)) (best = r), (bi = i)
      }
      if (best < 0) break
      ids = [...ids.slice(0, bi), BYTE0 + 256 + best, ...ids.slice(bi + 2)]
    }
    this.cache.set(w, ids)
    return ids
  }
  encode(text: string) {
    return (text.match(PAT) ?? []).flatMap((w) => this.word(w))
  }
  tokenBytes(id: number) {
    return this.bytes[id] ?? new Uint8Array()
  }

  /* ---------------- transformer ---------------- */
  private layerNorm(x: Float32Array, w: Float32Array, b: Float32Array) {
    const d = x.length
    let m = 0
    for (let i = 0; i < d; i++) m += x[i]
    m /= d
    let v = 0
    for (let i = 0; i < d; i++) v += (x[i] - m) ** 2
    const inv = 1 / Math.sqrt(v / d + 1e-5)
    const o = new Float32Array(d)
    for (let i = 0; i < d; i++) o[i] = (x[i] - m) * inv * w[i] + b[i]
    return o
  }
  /** y = W x, W stored row-major as (out, in). */
  private matvec(W: Float32Array, x: Float32Array, out: number) {
    const n = x.length, y = new Float32Array(out)
    for (let o = 0; o < out; o++) {
      let s = 0
      const r = o * n
      for (let i = 0; i < n; i++) s += W[r + i] * x[i]
      y[o] = s
    }
    return y
  }

  /** Greedy generation with a KV cache. Yields one token id at a time. */
  *generate(prompt: number[], maxNew = 120, stop?: () => boolean) {
    const { d, layers, heads, ctx, vocab } = this.cfg
    const hd = d / heads
    const K: Float32Array[][] = Array.from({ length: layers }, () => [])
    const V: Float32Array[][] = Array.from({ length: layers }, () => [])
    const W = this.W
    const step = (tok: number, pos: number) => {
      let x = new Float32Array(d)
      const te = W["tok.weight"], pe = W["pos.weight"]
      for (let i = 0; i < d; i++) x[i] = te[tok * d + i] + pe[pos * d + i]
      for (let l = 0; l < layers; l++) {
        const p = `blocks.${l}.`
        const h = this.layerNorm(x, W[p + "ln1.weight"], W[p + "ln1.bias"])
        const qkv = this.matvec(W[p + "qkv.weight"], h, 3 * d)
        K[l].push(qkv.slice(d, 2 * d))
        V[l].push(qkv.slice(2 * d, 3 * d))
        const att = new Float32Array(d)
        const T = K[l].length
        const sc = new Float32Array(T)
        for (let hh = 0; hh < heads; hh++) {
          const off = hh * hd
          let mx = -Infinity
          for (let t = 0; t < T; t++) {
            let s = 0
            const k = K[l][t]
            for (let i = 0; i < hd; i++) s += qkv[off + i] * k[off + i]
            sc[t] = s / Math.sqrt(hd)
            if (sc[t] > mx) mx = sc[t]
          }
          let sum = 0
          for (let t = 0; t < T; t++) (sc[t] = Math.exp(sc[t] - mx)), (sum += sc[t])
          for (let t = 0; t < T; t++) {
            const w = sc[t] / sum, v = V[l][t]
            for (let i = 0; i < hd; i++) att[off + i] += w * v[off + i]
          }
        }
        const pr = this.matvec(W[p + "proj.weight"], att, d)
        for (let i = 0; i < d; i++) x[i] += pr[i]
        const h2 = this.layerNorm(x, W[p + "ln2.weight"], W[p + "ln2.bias"])
        const f = this.matvec(W[p + "fc.weight"], h2, 4 * d)
        for (let i = 0; i < f.length; i++) {
          const u = f[i]
          f[i] = 0.5 * u * (1 + Math.tanh(0.7978845608028654 * (u + 0.044715 * u * u * u)))
        }
        const o = this.matvec(W[p + "out.weight"], f, d)
        for (let i = 0; i < d; i++) x[i] += o[i]
      }
      x = this.layerNorm(x, W["lnf.weight"], W["lnf.bias"])
      return this.matvec(W["tok.weight"], x, vocab)
    }
    let logits: Float32Array = new Float32Array()
    const ids = prompt.slice(-(ctx - 8))
    ids.forEach((t, i) => (logits = step(t, i)))
    for (let n = 0; n < maxNew && ids.length < ctx; n++) {
      if (stop?.()) return
      let best = 0
      for (let i = 1; i < logits.length; i++) if (logits[i] > logits[best]) best = i
      if (best === END) return
      yield best
      logits = step(best, ids.length)
      ids.push(best)
    }
  }

  promptFor(question: string) {
    return [USER, ...this.encode(question.trim()).slice(0, 60), BOT]
  }
}

let loading: Promise<MiniModel> | null = null
export function loadMini(): Promise<MiniModel> {
  if (!loading) {
    loading = fetch(weightsUrl)
      .then((r) => {
        if (!r.ok) throw new Error("Paper Tech Nano's weights couldn't be loaded.")
        return r.arrayBuffer()
      })
      .then((b) => new MiniModel(b))
    loading.catch(() => (loading = null))
  }
  return loading
}

/** OpenAI-style streaming engine so Nano plugs into the same code path as WebLLM. */
export async function createMiniEngine() {
  const m = await loadMini()
  let stopped = false
  return {
    chat: {
      completions: {
        create: async (req: { messages: Array<{ role: string; content: string }> }) => {
          stopped = false
          const last = [...req.messages].reverse().find((x) => x.role === "user")?.content ?? ""
          const prompt = m.promptFor(questionOnly(last))
          const dec = new TextDecoder()
          return (async function* () {
            let n = 0
            for (const id of m.generate(prompt, 120, () => stopped)) {
              const text = dec.decode(m.tokenBytes(id), { stream: true })
              if (text) yield { choices: [{ delta: { content: text } }] }
              // let the page breathe between tokens
              if (++n % 4 === 0) await new Promise((r) => setTimeout(r, 0))
            }
            const tail = dec.decode()
            if (tail) yield { choices: [{ delta: { content: tail } }] }
          })()
        },
      },
    },
    interruptGenerate: () => void (stopped = true),
    unload: async () => {},
  }
}

/** Nano was trained on single questions — drop any context blocks the app adds. */
function questionOnly(s: string) {
  return s.replace(/<[a-z_]+>[\s\S]*?<\/[a-z_]+>/g, "").trim().slice(-400)
}
