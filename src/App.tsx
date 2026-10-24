import { Component, lazy, Suspense, useEffect, useRef, useState } from "react"
import { StoreProvider, useStore } from "./lib/store"
import { match, navigate, useRoute } from "./lib/router"
import { Toaster } from "./components/toast"
import { UpgradeModal } from "./components/upgrade"
import { PaperMark } from "./components/ui"

const Landing = lazy(() => import("./pages/Landing"))
const Auth = lazy(() => import("./pages/Auth"))
const Plans = lazy(() => import("./pages/Plans"))
const NotFound = lazy(() => import("./pages/NotFound"))
const AppShell = lazy(() => import("./components/AppShell"))
const Home = lazy(() => import("./pages/app/Home"))
const Chat = lazy(() => import("./pages/app/Chat"))
const Chats = lazy(() => import("./pages/app/Chats"))
const Knowledge = lazy(() => import("./pages/app/Knowledge"))
const Upload = lazy(() => import("./pages/app/Upload"))
const Assistants = lazy(() => import("./pages/app/Assistants"))
const Editor = lazy(() => import("./pages/app/Editor"))
const Settings = lazy(() => import("./pages/app/Settings"))
const Today = lazy(() => import("./pages/app/Today"))
const ModePage = lazy(() => import("./pages/app/Mode"))

function Loading() {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 8000)
    return () => clearTimeout(t)
  }, [])
  return (
    <div className="grid min-h-dvh place-items-center bg-canvas">
      <div className="flex flex-col items-center gap-3">
        <PaperMark className="size-9 animate-pulse" />
        <span className="font-mono text-[11px] tracking-[0.06em] text-muted uppercase">Loading Paper Tech…</span>
        {slow && (
          <div className="mt-4 grid justify-items-center gap-3 text-center">
            <p className="max-w-xs text-[13px] text-muted">This is taking longer than it should.</p>
            <div className="flex gap-2">
              <button className="h-9 rounded-lg border border-line bg-surface px-3.5 text-[13px]" onClick={() => location.reload()}>
                Reload
              </button>
              <button
                className="h-9 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-on-accent"
                onClick={() => {
                  try { localStorage.removeItem("papertech:v1") } catch { /* ignore */ }
                  navigate("/")
                  location.reload()
                }}
              >
                Start fresh
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Redirect({ to }: { to: string }) {
  useEffect(() => {
    navigate(to, { replace: true })
  }, [to])
  return <Loading />
}

/** After sign-up: set up a personal workspace automatically and open Chat. No setup questions. */
function AutoStart() {
  const { state, user, createWorkspace } = useStore()
  const started = useRef(false)
  useEffect(() => {
    if (!user) return void navigate("/", { replace: true })
    if (state.onboarded[user.id]) return void navigate("/app/c", { replace: true })
    if (started.current) return
    started.current = true
    const first = user.name.trim().split(" ")[0] || "My"
    void createWorkspace({ name: `${first}'s workspace`, uses: [], teamSize: "Just me", sample: false, invites: [] }).then(() => navigate("/app/c", { replace: true }))
  }, [user, state.onboarded, createWorkspace])
  return <Loading />
}

function useTheme() {
  const { state } = useStore()
  const theme = state.prefs.theme
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && mq.matches))
    apply()
    mq.addEventListener("change", apply)
    return () => mq.removeEventListener("change", apply)
  }, [theme])
}

function Routes() {
  const { path } = useRoute()
  const { state, user } = useStore()
  useTheme()

  useEffect(() => {
    // Some browsers/extensions make scrollTo return a value; an effect must not return anything but a cleanup function.
    window.scrollTo(0, 0)
  }, [path])

  // Start: sign up (or straight into the app when signed in)
  if (path === "/") return user ? <Redirect to={state.onboarded[user.id] ? "/app/c" : "/start"} /> : <Auth mode="signup" />
  if (path === "/about") return <Landing />
  if (path === "/start") return <AutoStart />
  if (path === "/signup") return user ? <Redirect to={state.onboarded[user.id] ? "/app/c" : "/start"} /> : <Auth mode="signup" />
  if (path === "/signin") return user ? <Redirect to={state.onboarded[user.id] ? "/app" : "/start"} /> : <Auth mode="signin" />
  if (path === "/forgot") return <Auth mode="forgot" />
  if (path === "/plans" || path === "/pricing") return <Plans mode={user && !state.onboarded[user.id] ? "signup" : "public"} />
  if (path === "/onboarding") return <AutoStart />

  // Product
  if (path === "/app" || path.startsWith("/app/")) {
    if (!user) return <Redirect to="/" />
    if (!state.onboarded[user.id]) return <Redirect to="/start" />
    let page: React.ReactNode = null
    let p: Record<string, string> | null
    if (path === "/app" || path === "/app/home") page = <Home />
    else if ((p = match("/app/chat/:id", path))) page = <Chat id={p.id} />
    else if (path === "/app/chats") page = <Chats />
    else if (path === "/app/today") page = <Today />
    else if (path === "/app/c") page = <ModePage key="chat" mode="chat" />
    else if ((p = match("/app/c/:id", path))) page = <ModePage key={p.id} mode="chat" id={p.id} />
    else if (path === "/app/code") page = <ModePage key="code" mode="code" />
    else if ((p = match("/app/code/:id", path))) page = <ModePage key={p.id} mode="code" id={p.id} />
    else if (path === "/app/agent") page = <ModePage key="agent" mode="agent" />
    else if ((p = match("/app/agent/:id", path))) page = <ModePage key={p.id} mode="agent" id={p.id} />
    else if (path === "/app/knowledge") page = <Knowledge />
    else if ((p = match("/app/knowledge/:projectId", path))) page = <Knowledge projectId={p.projectId} />
    else if (path === "/app/upload") page = <Upload />
    else if ((p = match("/app/upload/:projectId", path))) page = <Upload projectId={p.projectId} />
    else if (path === "/app/assistants") page = <Assistants />
    else if ((p = match("/app/assistants/:id", path))) page = <Assistants id={p.id} />
    else if ((p = match("/app/editor/:id", path))) page = <Editor id={p.id} />
    else if (path === "/app/settings") page = <Settings section="account" />
    else if ((p = match("/app/settings/:section", path))) page = <Settings section={p.section} />
    else if (path === "/app/plans") page = <Plans mode="app" />
    else page = <NotFound inApp />
    return <AppShell path={path}>{page}</AppShell>
  }
  return <NotFound />
}

/** Never show a blank page: catch render errors and offer a way out. */
class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null; where: string }> {
  state = { error: null as Error | null, where: "" }
  static getDerivedStateFromError(error: Error) {
    return { error }
  }
  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("Paper Tech crashed:", error, info.componentStack)
    // Keep the first few lines of where it happened, so a screenshot is enough to find the bug.
    const stack = String(error?.stack ?? "").split("\n").slice(1, 5).map((l) => l.trim().replace(/\(?(file|https?):\/\/[^)]*\/([^/)]+)\)?/, "($2)")).join("\n")
    const comps = String(info.componentStack ?? "").split("\n").map((l) => l.trim()).filter(Boolean).slice(0, 4).join("\n")
    this.setState({ where: [stack, comps && "In: " + comps.replace(/\n/g, " ← ")].filter(Boolean).join("\n") })
  }
  render() {
    if (!this.state.error) return this.props.children
    const reset = () => {
      try { localStorage.removeItem("papertech:v1") } catch { /* ignore */ }
      try { indexedDB.deleteDatabase("keyval-store") } catch { /* ignore */ }
      navigate("/")
      location.reload()
    }
    return (
      <div className="grid min-h-dvh place-items-center bg-canvas p-6 text-ink">
        <div className="max-w-md text-center">
          <PaperMark className="mx-auto size-10" />
          <h1 className="mt-5 text-[26px] font-semibold tracking-[-0.02em]">Something went off course.</h1>
          <p className="mt-2 text-[14px] text-muted">Paper Tech hit an error. Reloading usually fixes it. If it keeps happening, reset the data Paper Tech saved in this browser.</p>
          <pre className="mt-4 max-h-[40vh] overflow-auto rounded-lg bg-sunken p-3 text-left font-mono text-[11.5px] whitespace-pre-wrap text-muted">
            {String(this.state.error?.message || this.state.error)}
            {this.state.where ? "\n\n" + this.state.where : ""}
          </pre>
          <p className="mt-2 text-[12px] text-faint">Send a screenshot of this box to get it fixed.</p>
          <div className="mt-6 flex justify-center gap-2">
            <button className="h-10 rounded-lg border border-line bg-surface px-4 text-[13.5px]" onClick={() => location.reload()}>Reload</button>
            <button className="h-10 rounded-lg bg-accent px-4 text-[13.5px] font-medium text-on-accent" onClick={reset}>Reset Paper Tech data</button>
          </div>
        </div>
      </div>
    )
  }
}

export default function App() {
  return (
    <ErrorBoundary>
    <StoreProvider>
      <Suspense fallback={<Loading />}>
        <Routes />
      </Suspense>
      <UpgradeModal />
      <Toaster />
    </StoreProvider>
    </ErrorBoundary>
  )
}
