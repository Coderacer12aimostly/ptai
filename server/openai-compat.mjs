// Free / open-model AI via any OpenAI-compatible API (Groq, OpenRouter, Together, a local Ollama…).
// Default: Meta Llama 3.3 70B on Groq's free tier.
//
// Env:
//   LLM_API_KEY     your key (Groq: console.groq.com → API Keys)
//   LLM_BASE_URL    default https://api.groq.com/openai/v1
//   LLM_MODEL       default llama-3.3-70b-versatile  (switch to a Llama 5 id once your provider hosts it)
//   LLM_LABEL       name shown in the app, default "Llama 3.3 70B"
//   LLM_MAX_CONTEXT max characters of instructions + sources sent per request (default 14000,
//                   keeps requests inside free-tier token-per-minute limits)

export const LLM = {
  key: process.env.LLM_API_KEY || "",
  base: (process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1").replace(/\/$/, ""),
  model: process.env.LLM_MODEL || "llama-3.3-70b-versatile",
  label: process.env.LLM_LABEL || (process.env.LLM_MODEL ? process.env.LLM_MODEL : "Llama 3.3 70B"),
  maxContext: Number(process.env.LLM_MAX_CONTEXT || 14000),
}

function fitSystem(system) {
  if (system.length <= LLM.maxContext) return system
  // Keep the instructions; trim the attached sources (they come last).
  const i = system.indexOf("<sources>")
  if (i > 0 && i < LLM.maxContext - 500) {
    const end = system.lastIndexOf("</sources>")
    const tail = end > 0 ? system.slice(end + "</sources>".length) : ""
    const room = Math.max(500, LLM.maxContext - i - tail.length - 60)
    return system.slice(0, i) + system.slice(i, i + room) + "\n…(sources shortened)\n</sources>" + tail
  }
  return system.slice(0, LLM.maxContext)
}

const sse = (res, obj) => res.write(`event: ${obj.type}\ndata: ${JSON.stringify(obj)}\n\n`)

/** Handle /api/chat with an OpenAI-compatible provider, replying in the Anthropic-style stream the app reads. */
export async function chatOpenAI(input, res, json) {
  const messages = [
    { role: "system", content: fitSystem(String(input.system || "")) },
    ...(Array.isArray(input.messages) ? input.messages.slice(-16) : []).map((m) => ({ role: m.role === "assistant" ? "assistant" : "user", content: String(m.content || "").slice(0, 8000) })),
  ]
  const body = { model: LLM.model, messages, stream: true, max_tokens: Math.min(Number(input.max_tokens) || 1500, 2048) }
  if (typeof input.temperature === "number") body.temperature = Math.max(0, Math.min(1, input.temperature))

  const ctrl = new AbortController()
  res.on("close", () => ctrl.abort())
  let upstream
  try {
    upstream = await fetch(`${LLM.base}/chat/completions`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${LLM.key}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    })
  } catch {
    return json(res, 502, { error: { message: "Couldn't reach the AI service." } })
  }
  if (!upstream.ok) {
    const j = await upstream.json().catch(() => ({}))
    const msg = upstream.status === 429
      ? "The free AI limit was reached for a moment. Please try again in a minute."
      : upstream.status === 413
        ? "That request was too large for the free AI plan. Try a shorter question or fewer sources."
        : j?.error?.message || `AI service error (${upstream.status})`
    return json(res, upstream.status, { error: { message: msg } })
  }

  res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-cache", connection: "keep-alive" })
  sse(res, { type: "message_start", message: { model: LLM.model } })
  sse(res, { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } })
  const dec = new TextDecoder()
  let buf = ""
  try {
    for await (const chunk of upstream.body) {
      buf += dec.decode(chunk, { stream: true })
      let i
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i).trim()
        buf = buf.slice(i + 1)
        if (!line.startsWith("data:")) continue
        const data = line.slice(5).trim()
        if (data === "[DONE]") continue
        try {
          const j = JSON.parse(data)
          if (j.error) { sse(res, { type: "error", error: { message: j.error.message || "AI error" } }); continue }
          const text = j.choices?.[0]?.delta?.content
          if (text) sse(res, { type: "content_block_delta", index: 0, delta: { type: "text_delta", text } })
        } catch { /* partial line */ }
      }
    }
  } catch { /* client went away */ }
  sse(res, { type: "content_block_stop", index: 0 })
  sse(res, { type: "message_stop" })
  res.end()
}
