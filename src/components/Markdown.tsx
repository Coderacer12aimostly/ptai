import { memo } from "react"
import { cx } from "../lib/utils"

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")

function inline(s: string) {
  let out = esc(s)
  const codes: string[] = []
  out = out.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`)
  out = out
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer">$1</a>')
    // In-app links (e.g. a document the agent created)
    .replace(/\[([^\]]+)\]\((#\/[\w\-/]+)\)/g, '<a href="$2">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>")
    .replace(/(^|\s)_([^_\n]+)_(?=\s|$|[.,!?])/g, "$1<em>$2</em>")
    .replace(/((?:\[\d+(?:,\s*\d+)*\])+)/g, (m) => {
      const nums = m.match(/\d+/g) ?? []
      return `<span class="cite">${nums.map((n) => `<span data-cite="${n}">[${n}]</span>`).join("")}</span>`
    })
  return out.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${codes[Number(i)]}</code>`)
}

export function renderMarkdown(src: string) {
  const lines = src.replace(/\r/g, "").split("\n")
  const html: string[] = []
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (/^```/.test(line)) {
      const buf: string[] = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++])
      i++
      html.push(`<pre><code>${esc(buf.join("\n"))}</code></pre>`)
      continue
    }
    const h = line.match(/^(#{1,4})\s+(.*)$/)
    if (h) {
      const lvl = Math.min(h[1].length + 1, 3)
      html.push(`<h${lvl}>${inline(h[2])}</h${lvl}>`)
      i++
      continue
    }
    if (/^\s*(---|\*\*\*)\s*$/.test(line)) {
      html.push("<hr/>")
      i++
      continue
    }
    if (/^\|/.test(line) && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1])) {
      const row = (l: string) => l.replace(/^\||\|$/g, "").split("|").map((c) => c.trim())
      const head = row(line)
      i += 2
      const body: string[][] = []
      while (i < lines.length && /^\|/.test(lines[i])) body.push(row(lines[i++]))
      html.push(
        `<div style="overflow-x:auto"><table><thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join("")}</tr></thead><tbody>${body
          .map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join("")}</tr>`)
          .join("")}</tbody></table></div>`,
      )
      continue
    }
    if (/^>\s?/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^>\s?/.test(lines[i])) buf.push(lines[i++].replace(/^>\s?/, ""))
      html.push(`<blockquote>${buf.map(inline).join("<br/>")}</blockquote>`)
      continue
    }
    if (/^\s*([-*•])\s+/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && /^\s*([-*•])\s+/.test(lines[i])) buf.push(lines[i++].replace(/^\s*([-*•])\s+/, ""))
      html.push(`<ul>${buf.map((b) => `<li>${inline(b)}</li>`).join("")}</ul>`)
      continue
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const buf: string[] = []
      while (i < lines.length && (/^\s*\d+[.)]\s+/.test(lines[i]) || (/^\s{2,}\S/.test(lines[i]) && buf.length))) {
        if (/^\s*\d+[.)]\s+/.test(lines[i])) buf.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""))
        else buf[buf.length - 1] += " " + lines[i].trim()
        i++
      }
      html.push(`<ol>${buf.map((b) => `<li>${inline(b)}</li>`).join("")}</ol>`)
      continue
    }
    if (!line.trim()) {
      i++
      continue
    }
    const buf: string[] = []
    while (i < lines.length && lines[i].trim() && !/^(#{1,4}\s|>|```|\s*[-*•]\s|\s*\d+[.)]\s|\|)/.test(lines[i])) buf.push(lines[i++])
    html.push(`<p>${buf.map(inline).join("<br/>")}</p>`)
  }
  return html.join("\n")
}

export const Markdown = memo(function Markdown({ text, className, streaming, onCite }: { text: string; className?: string; streaming?: boolean; onCite?: (n: number) => void }) {
  return (
    <div
      className={cx("prose-orbit", streaming && "[&>*:last-child]:caret", className)}
      onClick={(e) => {
        const n = (e.target as HTMLElement).closest("[data-cite]")?.getAttribute("data-cite")
        if (n && onCite) onCite(Number(n))
      }}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
    />
  )
})
