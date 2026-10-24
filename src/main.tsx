import React from "react"
import ReactDOM from "react-dom/client"
import "@fontsource-variable/inter"
import "@fontsource/ibm-plex-mono/400.css"
import App from "./App"
import "./index.css"

// Apply the saved theme before first paint to avoid a flash.
try {
  const theme = JSON.parse((localStorage.getItem("papertech:v1") ?? localStorage.getItem("orbit:v1")) ?? "{}")?.prefs?.theme
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.toggle("dark", dark)
} catch {
  /* ignore */
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// Installable app (PWA): register the service worker in production builds.
if (import.meta.env.PROD && !import.meta.env.VITE_NO_SW && "serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => {}))
}
