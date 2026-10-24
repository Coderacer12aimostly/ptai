export const uid = (p = "") => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4)

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ")
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return "?"
  return ((parts[0][0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase()
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
}

export function timeAgo(t: number) {
  const s = Math.round((Date.now() - t) / 1000)
  if (s < 45) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} hour${h > 1 ? "s" : ""} ago`
  const d = Math.round(h / 24)
  if (d === 1) return "Yesterday"
  if (d < 7) return `${d} days ago`
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function shortDate(t: number) {
  return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" })
}

export function bytes(n: number) {
  if (!n) return "—"
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export async function sha256(text: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

export function monthKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
}

export function greeting() {
  const h = new Date().getHours()
  if (h < 12) return "Good morning"
  if (h < 18) return "Good afternoon"
  return "Good evening"
}

export function download(name: string, content: string, type = "text/plain") {
  const blob = new Blob([content], { type })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

export function htmlToText(html: string) {
  const div = document.createElement("div")
  div.innerHTML = html
  div.querySelectorAll("p,h1,h2,h3,li,blockquote,br,div").forEach((el) => el.append("\n"))
  return (div.textContent ?? "").replace(/\n{3,}/g, "\n\n").trim()
}

export function wordCount(text: string) {
  return text.split(/\s+/).filter(Boolean).length
}

export function isEmail(s: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(s.trim())
}
