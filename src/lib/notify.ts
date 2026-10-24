import { navigate } from "./router"
/** Desktop (system) notifications, via the service worker when one is running. */

export const desktopSupported = () => typeof window !== "undefined" && "Notification" in window

export function desktopPermission(): NotificationPermission | "unsupported" {
  return desktopSupported() ? Notification.permission : "unsupported"
}

export async function requestDesktop(): Promise<NotificationPermission | "unsupported"> {
  if (!desktopSupported()) return "unsupported"
  try {
    return await Notification.requestPermission()
  } catch {
    return Notification.permission
  }
}

export async function showDesktop(title: string, body: string, opts: { url?: string; href?: string; tag?: string } = {}) {
  if (!desktopSupported() || Notification.permission !== "granted") return false
  const data = { url: opts.url, href: opts.href }
  const icon = "./icon-192.png"
  try {
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg) {
      await reg.showNotification(title, { body, icon, badge: icon, tag: opts.tag, data })
      return true
    }
  } catch {
    /* fall through */
  }
  try {
    const n = new Notification(title, { body, icon, tag: opts.tag })
    n.onclick = () => {
      window.focus()
      if (opts.url) window.open(opts.url, "_blank", "noopener")
      else if (opts.href) navigate(opts.href)
      n.close()
    }
    return true
  } catch {
    return false
  }
}

export function inQuietHours(d = new Date()) {
  const h = d.getHours()
  return h >= 22 || h < 8
}
