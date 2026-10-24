/**
 * Web search for every model, including the on-device ones.
 *  - On a Paper Tech server (Render): /api/search, which uses Tavily or Brave when a key is set, otherwise free
 *    Wikipedia + DuckDuckGo instant answers.
 *  - Anywhere else (index.html, no server): Wikipedia straight from the browser.
 * Results become numbered <source> blocks, so every model answers with [n] citations, exactly like project files.
 */
import { tokens } from "./knowledge"

export interface WebResult {
  title: string
  url: string
  text: string
}

const cache = new Map<string, WebResult[]>()

/** Turn a chatty question into a search query ("can you find out when the next iPhone comes out" -> "next iphone comes out"). */
export function searchQuery(q: string) {
  const plain = q.replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, " ").replace(/\s+/g, " ").trim()
  const kept = plain
    .split(" ")
    .filter((w) => !/^(please|pls|can|could|you|search|google|look|up|find|out|tell|me|the|web|internet|online|for|about|what's|whats)$/i.test(w.replace(/[^\w']/g, "")))
    .join(" ")
  return (kept.length > 3 ? kept : plain).slice(0, 200)
}

async function viaServer(q: string, signal?: AbortSignal): Promise<WebResult[] | null> {
  if (!/^https?:$/.test(location.protocol)) return null
  try {
    const r = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal, headers: { accept: "application/json" } })
    if (!r.ok || !(r.headers.get("content-type") ?? "").includes("json")) return null
    const j = (await r.json()) as { results?: WebResult[] }
    return Array.isArray(j.results) ? j.results : null
  } catch {
    return null
  }
}

/** Wikipedia, straight from the browser (it allows that). */
export async function wikiSearch(q: string, signal?: AbortSignal, limit = 3): Promise<WebResult[]> {
  const terms = tokens(q).join(" ") || q
  const s = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(terms)}&srlimit=${limit}&format=json&origin=*`, { signal }).then((r) => r.json())
  const titles: string[] = (s?.query?.search ?? []).map((x: { title: string }) => x.title)
  if (!titles.length) return []
  const e = await fetch(
    `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exchars=1400&titles=${encodeURIComponent(titles.join("|"))}&format=json&origin=*`,
    { signal },
  ).then((r) => r.json())
  const pages = Object.values(e?.query?.pages ?? {}) as Array<{ title: string; extract?: string }>
  return titles
    .map((t) => pages.find((p) => p.title === t))
    .filter((p): p is { title: string; extract: string } => Boolean(p?.extract))
    .map((p) => ({ title: `${p.title} — Wikipedia`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`, text: p.extract.replace(/\n{2,}/g, "\n").trim() }))
}

export async function webSearch(question: string, signal?: AbortSignal): Promise<WebResult[]> {
  const q = searchQuery(question)
  if (!q) return []
  if (cache.has(q)) return cache.get(q)!
  let results = await viaServer(q, signal)
  if (!results?.length) {
    try {
      results = await wikiSearch(q, signal)
    } catch {
      results = []
    }
  }
  results = results.filter((r, i) => r.text?.trim() && results!.findIndex((x) => x.url === r.url) === i).slice(0, 4)
  cache.set(q, results)
  return results
}

/** Numbered sources for the model; `start` continues the numbering after project files. */
export function webContext(results: WebResult[], start = 0, perResult = 1100) {
  return results
    .map((r, i) => `<source n="${start + i + 1}" title="${r.title.replace(/"/g, "'")}" url="${r.url}">\n${r.text.slice(0, perResult)}\n</source>`)
    .join("\n\n")
}

export const hostOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return "web"
  }
}
