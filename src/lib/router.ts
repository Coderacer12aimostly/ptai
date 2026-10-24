import { useEffect, useState } from "react"

/** Tiny hash router — works on any static host (Render, Netlify, Figma Make) without rewrites. */
// Some embedded viewers (sandboxed iframes) don't allow changing the page address. Then the route lives in memory.
let memHash: string | null = null
function currentHash() {
  let h = ""
  try {
    h = window.location.hash
  } catch {
    /* blocked */
  }
  return memHash ?? h
}

function read() {
  const raw = currentHash().replace(/^#/, "") || "/"
  const [path, query = ""] = raw.split("?")
  return { path: path.startsWith("/") ? path : `/${path}`, query: new URLSearchParams(query) }
}

export function useRoute() {
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () =>
      setRoute((prev) => {
        const next = read()
        return next.path === prev.path && next.query.toString() === prev.query.toString() ? prev : next
      })
    window.addEventListener("hashchange", on)
    // A child (e.g. a redirect) may have changed the route before this listener existed — catch up now.
    on()
    return () => window.removeEventListener("hashchange", on)
  }, [])
  return route
}

export function navigate(to: string, opts: { replace?: boolean } = {}) {
  const hash = to.startsWith("#") ? to : `#${to}`
  const before = currentHash()
  try {
    if (opts.replace) history.replaceState(null, "", hash)
    else window.location.hash = hash
  } catch {
    /* blocked by the viewer */
  }
  let now = ""
  try {
    now = decodeURI(window.location.hash)
  } catch {
    /* ignore */
  }
  // If the address didn't change, remember the route ourselves and tell the app.
  memHash = now === decodeURI(hash) ? null : hash
  if (opts.replace || memHash !== null || before === hash) window.dispatchEvent(new HashChangeEvent("hashchange"))
}

/** Update the address without re-rendering (e.g. drop a "?q=" after it's been used). Never throws. */
export function quietReplace(to: string) {
  const hash = to.startsWith("#") ? to : `#${to}`
  if (memHash !== null) return void (memHash = hash)
  try {
    history.replaceState(null, "", hash)
  } catch {
    memHash = hash
  }
}

/** Follow plain <a href="#/…"> links even when the viewer blocks address changes. */
if (typeof window !== "undefined")
  window.addEventListener(
    "click",
    (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as HTMLElement)?.closest?.("a")
      const href = a?.getAttribute("href")
      if (!a || !href?.startsWith("#/") || a.target === "_blank") return
      if (memHash === null) {
        // Let the browser change the hash; if it can't, fall back next tick.
        setTimeout(() => {
          let h = ""
          try {
            h = window.location.hash
          } catch {
            /* ignore */
          }
          if (decodeURI(h) !== decodeURI(href)) navigate(href)
        }, 0)
        return
      }
      e.preventDefault()
      navigate(href)
    },
    true,
  )

/** Match "/app/chat/:id" style patterns. */
export function match(pattern: string, path: string): Record<string, string> | null {
  const a = pattern.split("/").filter(Boolean)
  const b = path.split("/").filter(Boolean)
  if (a.length !== b.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith(":")) params[a[i].slice(1)] = decodeURIComponent(b[i])
    else if (a[i] !== b[i]) return null
  }
  return params
}
