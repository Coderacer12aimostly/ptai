export type PlanId = "free" | "pro" | "team" | "enterprise"
export type Billing = "monthly" | "yearly"
export type Theme = "light" | "dark" | "system"

export interface Account {
  id: string
  name: string
  email: string
  passwordHash: string
  createdAt: number
  role?: string
}

export interface Member {
  id: string
  name: string
  email: string
  role: "Owner" | "Admin" | "Member"
  status: "active" | "invited"
}

export interface Workspace {
  name: string
  slug: string
  uses: string[]
  teamSize: string
  plan: PlanId
  billing: Billing
  trialEndsAt?: number
  members: Member[]
}

export interface Project {
  id: string
  name: string
  description: string
  icon: "sunrise" | "messages" | "shapes" | "folder" | "rocket" | "book"
  tint: "sage" | "sand" | "mist" | "blue"
  pinned: boolean
  createdAt: number
}

export type FileKind = "pdf" | "doc" | "csv" | "text" | "link" | "image" | "artifact"

export interface KnowledgeFile {
  id: string
  projectId: string
  name: string
  kind: FileKind
  size: number
  owner: string
  updatedAt: number
  status: "queued" | "processing" | "ready" | "error" | "draft"
  progress?: number
  summary?: string
  meta?: string
  url?: string
  /** Characters of extracted text kept in IndexedDB */
  chars?: number
  docId?: string
}

export interface Source {
  n: number
  fileId?: string
  title: string
  meta: string
  url?: string
  quote?: string
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  createdAt: number
  model?: string
  sources?: Source[]
  status?: "streaming" | "done" | "error" | "stopped"
  mode?: "live" | "demo" | "device"
  feedback?: "up" | "down"
  /** Wave's reasoning, shown in a collapsible block */
  thinking?: string
  thinkMs?: number
  /** Agent mode: the steps the agent took */
  steps?: AgentStep[]
  /** Images the user attached (thumbnails; full images live in IndexedDB) */
  images?: ImageRef[]
  /** What Paper Tech found in those images, given to the model as text */
  imageNotes?: string
  /** What the assistant is doing right now (e.g. "Reading the text in the image…") */
  phase?: string
}

export interface ImageRef {
  id: string
  name: string
  w: number
  h: number
  /** Small JPEG data URL for display */
  thumb: string
  colors?: string[]
  /** Set when this attachment is a document (PDF, Word, text, CSV, code…) rather than a picture */
  doc?: { meta: string; chars: number }
}

export interface AgentStep {
  id: string
  tool: string
  label: string
  input?: string
  output?: string
  status: "running" | "done" | "error"
  /** Link to something the step created (e.g. a document) */
  href?: string
}

export type AppMode = "work" | "chat" | "code" | "agent"

export interface Conversation {
  id: string
  title: string
  projectId?: string
  assistantId?: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  web: boolean
  model: string
  /** Include today's calendar and unread email as context */
  google?: boolean
  /** Which mode the conversation belongs to (default: work) */
  appMode?: AppMode
  /** On-device model used for this conversation */
  localModel?: string
}

export interface Assistant {
  id: string
  name: string
  tagline: string
  icon: "scan" | "pen" | "bulb" | "chart" | "sparkles" | "compass"
  instructions: string
  model: string
  tools: { web: boolean; knowledge: boolean; code: boolean }
  creativity: number
  shared: boolean
  updatedAt: number
}

export interface DocVersion {
  id: string
  html: string
  title: string
  at: number
  note: string
}

export interface Doc {
  id: string
  title: string
  projectId?: string
  html: string
  status: "draft" | "final"
  updatedAt: number
  versions: DocVersion[]
  chat: Message[]
}

export interface Notification {
  id: string
  text: string
  sub?: string
  at: number
  read: boolean
  href?: string
  /** External link (Gmail, Calendar, Drive) — opens in a new tab */
  url?: string
  who?: string
  kind?: "calendar" | "gmail" | "drive"
}

export interface GoogleAlerts {
  meetings: boolean
  lead: number
  email: boolean
  importantOnly: boolean
  drive: boolean
  desktop: boolean
  quiet: boolean
}

export interface Prefs {
  theme: Theme
  defaultModel: string
  enterToSend: boolean
  digest: boolean
  notifyMentions: boolean
  notifyUploads: boolean
  notifyProduct: boolean
  apiKey: string
  /** Run AI on this device (WebGPU) when possible */
  localAI: boolean
  /** Which on-device model to use (see LOCAL_MODELS) */
  localModel: string
  /** The model each mode uses */
  modeModels: Record<AppMode, string>
  /** Use Paper Tech 1 Vision to look at attached images (when WebGPU is available) */
  visionImages: boolean
  /** Search the web before answering in Chat and Code mode (globe button) */
  webSearch?: boolean
  integrations: Record<string, boolean>
  /** Use built-in sample Calendar/Gmail/Drive data instead of a real Google account */
  googleSample: boolean
  googleSampleSince: number
  gAlerts: GoogleAlerts
}

export interface AppState {
  accounts: Account[]
  session: string | null
  onboarded: Record<string, boolean>
  workspace: Workspace | null
  projects: Project[]
  files: KnowledgeFile[]
  conversations: Conversation[]
  assistants: Assistant[]
  docs: Doc[]
  notifications: Notification[]
  prefs: Prefs
  usage: Record<string, number>
}
