import { localModel } from "./local"
export interface ModelInfo {
  id: string
  name: string
  blurb: string
  minPlan: "free" | "pro"
}

/** API model ids for the Anthropic Messages API. */
export const MODELS: ModelInfo[] = [
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5", blurb: "Balanced reasoning & writing", minPlan: "free" },
  { id: "claude-opus-5-5", name: "Claude Opus 5.5", blurb: "Deep analysis & complex tasks", minPlan: "pro" },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", blurb: "Fast answers & quick edits", minPlan: "free" },
]

export const DEFAULT_MODEL = MODELS[0].id
export const modelName = (id: string) => (id.startsWith("local:") ? `${localModel(id.slice(6)).name} · on device` : MODELS.find((m) => m.id === id)?.name ?? id)
