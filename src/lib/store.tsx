import { quietReplace } from "./router"
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import type { Account, AppState, Message, PlanId, Billing, Workspace } from "./types"
import { DEFAULT_MODEL } from "./models"
import { monthKey, sha256, slugify, uid } from "./utils"
import {
  SAMPLE_TEXT,
  sampleAssistants,
  sampleConversations,
  sampleDocs,
  sampleFiles,
  sampleNotifications,
  sampleProjects,
} from "./seed"
import { saveText } from "./knowledge"
import { planById } from "./plans"
import { configureLocal, DEFAULT_LOCAL_MODEL, MODE_DEFAULT_MODEL, localModel } from "./local"

const KEY = "papertech:v1"

const initial: AppState = {
  accounts: [],
  session: null,
  onboarded: {},
  workspace: null,
  projects: [],
  files: [],
  conversations: [],
  assistants: [],
  docs: [],
  notifications: [],
  prefs: {
    theme: "light",
    defaultModel: DEFAULT_MODEL,
    enterToSend: true,
    digest: true,
    notifyMentions: true,
    notifyUploads: true,
    notifyProduct: false,
    apiKey: "",
    localAI: true,
    localModel: DEFAULT_LOCAL_MODEL,
    modeModels: { ...MODE_DEFAULT_MODEL },
    visionImages: true,
    integrations: {},
    googleSample: false,
    googleSampleSince: 0,
    gAlerts: { meetings: true, lead: 10, email: true, importantOnly: false, drive: true, desktop: false, quiet: false },
  },
  usage: {},
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY) ?? localStorage.getItem("orbit:v1")
    if (!raw) return initial
    const parsed = JSON.parse(raw) as Partial<AppState>
    const st: AppState = { ...initial, ...parsed, prefs: { ...initial.prefs, ...(parsed.prefs ?? {}), gAlerts: { ...initial.prefs.gAlerts, ...(parsed.prefs?.gAlerts ?? {}) } } }
    return repair(st)
  } catch {
    return initial
  }
}

/** Fix saved data that doesn't hang together (older versions, partial saves). */
function repair(st: AppState): AppState {
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  st.accounts = arr(st.accounts)
  for (const k of ["projects", "files", "conversations", "assistants", "docs", "notifications"] as const) (st as any)[k] = arr((st as any)[k])
  st.onboarded = st.onboarded && typeof st.onboarded === "object" ? st.onboarded : {}
  st.usage = st.usage && typeof st.usage === "object" ? st.usage : {}
  if (st.session && !st.accounts.some((a) => a.id === st.session)) st.session = null
  const ws = st.workspace as Partial<Workspace> | null
  if (!ws || typeof ws !== "object" || !ws.name || !ws.plan) {
    st.workspace = null
    st.onboarded = {} // nobody can be "set up" without a workspace — send them through onboarding again
  } else {
    st.workspace = { slug: "", uses: [], teamSize: "", billing: "monthly", ...ws, members: arr(ws.members) } as Workspace
  }
  st.conversations = st.conversations.filter((c) => c && typeof c === "object" && typeof c.id === "string")
  for (const c of st.conversations) {
    if (typeof c.title !== "string") c.title = "Conversation"
    if (typeof c.updatedAt !== "number") c.updatedAt = Date.now()
    c.messages = arr<Message>(c.messages).filter((m) => m && typeof m === "object" && (m.role === "user" || m.role === "assistant"))
    for (const m of c.messages) {
      if (typeof m.content !== "string") m.content = String(m.content ?? "")
      if (m.images !== undefined && !Array.isArray(m.images)) delete m.images
      if (m.sources !== undefined && !Array.isArray(m.sources)) delete m.sources
      if (m.steps !== undefined && !Array.isArray(m.steps)) delete m.steps
      if (m.status === "streaming") m.status = "stopped" // a reply that was cut off by closing the page
    }
  }
  if (!st.prefs.integrations || typeof st.prefs.integrations !== "object") st.prefs.integrations = {} as AppState["prefs"]["integrations"]
  // Older saves: map retired on-device models to the Paper Tech 1 family.
  st.prefs.localModel = localModel(st.prefs.localModel).key
  st.prefs.modeModels = { ...MODE_DEFAULT_MODEL, ...(st.prefs.modeModels ?? {}) }
  for (const k of Object.keys(st.prefs.modeModels) as Array<keyof typeof MODE_DEFAULT_MODEL>) st.prefs.modeModels[k] = localModel(st.prefs.modeModels[k]).key
  st.docs.forEach((d) => ((d.versions = arr(d.versions)), (d.chat = arr(d.chat))))
  return st
}

/** sessionStorage can throw when a browser blocks storage for local files. */
const sess = {
  get(k: string) { try { return sessionStorage.getItem(k) } catch { return null } },
  set(k: string, v: string) { try { sessionStorage.setItem(k, v) } catch { /* ignore */ } },
  del(k: string) { try { sessionStorage.removeItem(k) } catch { /* ignore */ } },
}
export const pendingPlan = () => { try { return JSON.parse(sess.get("papertech:plan") ?? "null") } catch { return null } }

type Recipe = (draft: AppState) => void

interface Store {
  state: AppState
  update: (recipe: Recipe) => void
  user: Account | null
  signUp: (name: string, email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signIn: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>
  signOut: () => void
  choosePlan: (plan: PlanId, billing: Billing) => void
  createWorkspace: (input: { name: string; uses: string[]; teamSize: string; sample: boolean; invites: string[] }) => Promise<void>
  startDemo: () => Promise<void>
  resetPassword: (email: string, password: string) => Promise<boolean>
  usedThisMonth: number
  limit: number
  countMessage: () => boolean
  resetAll: () => void
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(load)
  const saveTimer = useRef<number | undefined>(undefined)

  useEffect(() => {
    window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => {
      try {
        localStorage.setItem(KEY, JSON.stringify(state))
      } catch {
        /* storage full or blocked — app keeps working in memory */
      }
    }, 250)
  }, [state])

  // Keep the on-device AI engine in step with the user's settings.
  configureLocal({ enabled: state.prefs.localAI, model: state.prefs.localModel })

  const update = useCallback((recipe: Recipe) => {
    setState((prev) => {
      const draft = structuredClone(prev)
      recipe(draft)
      return draft
    })
  }, [])

  const user = useMemo(() => state.accounts.find((a) => a.id === state.session) ?? null, [state.accounts, state.session])

  const signUp = useCallback<Store["signUp"]>(
    async (name, email, password) => {
      const e = email.trim().toLowerCase()
      if (state.accounts.some((a) => a.email === e)) return { ok: false, error: "An account with this email already exists. Try signing in." }
      const account: Account = { id: uid("u-"), name: name.trim(), email: e, passwordHash: await sha256(e + ":" + password), createdAt: Date.now() }
      update((d) => {
        d.accounts.push(account)
        d.session = account.id
      })
      return { ok: true }
    },
    [state.accounts, update],
  )

  const signIn = useCallback<Store["signIn"]>(
    async (email, password) => {
      const e = email.trim().toLowerCase()
      const acc = state.accounts.find((a) => a.email === e)
      if (!acc) return { ok: false, error: "We couldn't find an account with that email." }
      if (acc.passwordHash !== (await sha256(e + ":" + password))) return { ok: false, error: "That password doesn't match. Try again." }
      update((d) => {
        d.session = acc.id
      })
      return { ok: true }
    },
    [state.accounts, update],
  )

  const signOut = useCallback(() => {
    // Leave the app first so route guards don't bounce to the sign-in page.
    quietReplace("#/")
    window.dispatchEvent(new HashChangeEvent("hashchange"))
    update((d) => void (d.session = null))
  }, [update])

  const choosePlan = useCallback<Store["choosePlan"]>(
    (plan, billing) =>
      update((d) => {
        const trial = plan === "pro" || plan === "team" ? Date.now() + 14 * 864e5 : undefined
        if (d.workspace) {
          d.workspace.plan = plan
          d.workspace.billing = billing
          d.workspace.trialEndsAt = d.workspace.trialEndsAt ?? trial
        } else {
          sess.set("papertech:plan", JSON.stringify({ plan, billing, trial }))
        }
      }),
    [update],
  )

  const createWorkspace = useCallback<Store["createWorkspace"]>(
    async ({ name, uses, teamSize, sample, invites }) => {
      const pending = pendingPlan() as { plan: PlanId; billing: Billing; trial?: number } | null
      const me = state.accounts.find((a) => a.id === state.session)
      if (!me) return
      const ws: Workspace = {
        name: name.trim(),
        slug: slugify(name),
        uses,
        teamSize,
        plan: pending?.plan ?? "free",
        billing: pending?.billing ?? "monthly",
        trialEndsAt: pending?.trial,
        members: [
          { id: me.id, name: me.name, email: me.email, role: "Owner", status: "active" },
          ...invites.map((email) => ({ id: uid("m-"), name: email.split("@")[0], email, role: "Member" as const, status: "invited" as const })),
        ],
      }
      if (sample) await Promise.all(Object.entries(SAMPLE_TEXT).map(([id, text]) => saveText(id, text)))
      update((d) => {
        // Build fresh objects inside the recipe (React may run it twice in dev).
        d.workspace = { ...ws, members: [...ws.members] }
        d.onboarded[me.id] = true
        if (sample) {
          d.projects = sampleProjects()
          d.files = sampleFiles(me.name)
          d.conversations = sampleConversations()
          d.assistants = sampleAssistants()
          d.docs = sampleDocs()
          d.notifications = sampleNotifications()
          d.workspace.members.push(
            { id: "m-jonah", name: "Jonah Lee", email: "jonah@example.com", role: "Member", status: "active" },
            { id: "m-alex", name: "Alex Kim", email: "alex@example.com", role: "Admin", status: "active" },
          )
        } else {
          d.assistants = sampleAssistants().slice(0, 2)
          d.notifications = [{ id: uid("n-"), text: `Welcome to Paper Tech AI, ${me.name.split(" ")[0]}`, sub: "Start a conversation or add some knowledge.", at: Date.now(), read: false, who: "Paper Tech" }]
        }
        sess.del("papertech:plan")
      })
    },
    [state.accounts, state.session, update],
  )

  /** One-click demo: account + sample workspace, straight into the app. */
  const startDemo = useCallback(async () => {
    await Promise.all(Object.entries(SAMPLE_TEXT).map(([id, text]) => saveText(id, text)))
    const id = uid("u-")
    const email = `demo-${id.slice(2, 8)}@papertech.local`
    const account: Account = { id, name: "Maya Chen", email, passwordHash: await sha256(email + ":" + uid()), createdAt: Date.now(), role: "Workspace owner" }
    update((d) => {
      d.accounts.push(account)
      d.session = id
      d.onboarded[id] = true
      d.workspace = {
        name: "Studio North",
        slug: "studio-north",
        uses: ["Research", "Writing"],
        teamSize: "2–10 people",
        plan: "team",
        billing: "monthly",
        trialEndsAt: Date.now() + 14 * 864e5,
        members: [
          { id, name: "Maya Chen", email, role: "Owner", status: "active" },
          { id: "m-jonah", name: "Jonah Lee", email: "jonah@example.com", role: "Member", status: "active" },
          { id: "m-alex", name: "Alex Kim", email: "alex@example.com", role: "Admin", status: "active" },
        ],
      }
      d.projects = sampleProjects()
      d.files = sampleFiles("Maya Chen")
      d.conversations = sampleConversations()
      d.assistants = sampleAssistants()
      d.docs = sampleDocs()
      d.notifications = sampleNotifications()
    })
  }, [update])

  const resetPassword = useCallback(
    async (email: string, password: string) => {
      const e = email.trim().toLowerCase()
      if (!state.accounts.some((a) => a.email === e)) return false
      const hash = await sha256(e + ":" + password)
      update((d) => {
        const a = d.accounts.find((x) => x.email === e)
        if (a) a.passwordHash = hash
      })
      return true
    },
    [state.accounts, update],
  )

  const usedThisMonth = state.usage[monthKey()] ?? 0
  const plan = planById(state.workspace?.plan ?? "free")
  const limit = plan.messages

  const countMessage = useCallback(() => {
    if (usedThisMonth >= limit) return false
    update((d) => {
      const k = monthKey()
      const day = new Date().toLocaleDateString("en-CA")
      d.usage[k] = (d.usage[k] ?? 0) + 1
      d.usage[day] = (d.usage[day] ?? 0) + 1
    })
    return true
  }, [usedThisMonth, limit, update])

  const resetAll = useCallback(() => {
    try { localStorage.removeItem(KEY) } catch { /* ignore */ }
    try { indexedDB.deleteDatabase("keyval-store") } catch { /* ignore */ }
    setState(initial)
  }, [])

  const value: Store = { state, update, user, signUp, signIn, signOut, choosePlan, createWorkspace, startDemo, resetPassword, usedThisMonth, limit, countMessage, resetAll }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error("useStore outside provider")
  return s
}
