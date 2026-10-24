// Web search for the app: GET /api/search?q=…  ->  { results: [{ title, url, text }], provider }
// Uses Tavily (TAVILY_API_KEY) or Brave Search (BRAVE_API_KEY) when set; otherwise free sources that need no key:
// Wikipedia and DuckDuckGo's instant-answer API.

const TAVILY = process.env.TAVILY_API_KEY || ""
const BRAVE = process.env.BRAVE_API_KEY || ""
export const searchProvider = TAVILY ? "tavily" : BRAVE ? "brave" : "free"
const cache = new Map()
const UA = { "user-agent": "PaperTechAI/1.0 (web search for an AI workspace)" }

async function tavily(q) {
  const r = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${TAVILY}` },
    body: JSON.stringify({ query: q, max_results: 5, search_depth: "basic" }),
    signal: AbortSignal.timeout(12_000),
  })
  if (!r.ok) throw new Error(`Tavily ${r.status}`)
  const j = await r.json()
  return (j.results ?? []).map((x) => ({ title: x.title, url: x.url, text: x.content ?? "" }))
}

async function brave(q) {
  const r = await fetch(`https://api.search.brave.com/res/v1/web/search?count=5&q=${encodeURIComponent(q)}`, {
    headers: { accept: "application/json", "x-subscription-token": BRAVE },
    signal: AbortSignal.timeout(12_000),
  })
  if (!r.ok) throw new Error(`Brave ${r.status}`)
  const j = await r.json()
  const strip = (s = "") => s.replace(/<[^>]+>/g, "")
  return (j.web?.results ?? []).map((x) => ({ title: strip(x.title), url: x.url, text: strip([x.description, ...(x.extra_snippets ?? [])].join(" ")) }))
}

async function wikipedia(q) {
  const s = await fetch(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(q)}&srlimit=3&format=json`, { headers: UA, signal: AbortSignal.timeout(10_000) }).then((r) => r.json())
  const titles = (s?.query?.search ?? []).map((x) => x.title)
  if (!titles.length) return []
  const e = await fetch(`https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&exchars=1400&titles=${encodeURIComponent(titles.join("|"))}&format=json`, { headers: UA, signal: AbortSignal.timeout(10_000) }).then((r) => r.json())
  const pages = Object.values(e?.query?.pages ?? {})
  return titles
    .map((t) => pages.find((p) => p.title === t))
    .filter((p) => p?.extract)
    .map((p) => ({ title: `${p.title} — Wikipedia`, url: `https://en.wikipedia.org/wiki/${encodeURIComponent(p.title.replace(/ /g, "_"))}`, text: p.extract.replace(/\n{2,}/g, "\n").trim() }))
}

async function duckduckgo(q) {
  const j = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_html=1&skip_disambig=1`, { headers: UA, signal: AbortSignal.timeout(8_000) }).then((r) => r.json())
  const out = []
  if (j.AbstractText) out.push({ title: `${j.Heading || q} — ${j.AbstractSource || "DuckDuckGo"}`, url: j.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(q)}`, text: j.AbstractText })
  if (j.Answer) out.push({ title: `${q} — DuckDuckGo`, url: `https://duckduckgo.com/?q=${encodeURIComponent(q)}`, text: String(j.Answer) })
  return out
}

export async function search(q) {
  q = String(q || "").trim().slice(0, 200)
  if (!q) return { results: [], provider: searchProvider }
  const hit = cache.get(q)
  if (hit && Date.now() - hit.at < 15 * 60_000) return hit.value
  let results = []
  try {
    if (TAVILY) results = await tavily(q)
    else if (BRAVE) results = await brave(q)
  } catch (e) {
    console.warn("search provider failed, using free sources:", e.message)
  }
  if (!results.length) {
    const [d, w] = await Promise.allSettled([duckduckgo(q), wikipedia(q)])
    results = [...(d.status === "fulfilled" ? d.value : []), ...(w.status === "fulfilled" ? w.value : [])]
  }
  const merged = []
  for (const r of results.filter((r) => r.text?.trim())) {
    const same = merged.find((m) => m.url === r.url)
    if (same) same.text = same.text.includes(r.text) ? same.text : `${same.text}\n${r.text}`
    else merged.push({ ...r })
  }
  const value = { results: merged.slice(0, 5), provider: merged.length ? searchProvider : "none" }
  cache.set(q, { at: Date.now(), value })
  if (cache.size > 500) cache.delete(cache.keys().next().value)
  return value
}
