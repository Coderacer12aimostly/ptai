import { useCallback } from "react"
import { useStore } from "./store"
import { extractText, kindFor, saveText } from "./knowledge"
import type { KnowledgeFile } from "./types"
import { uid } from "./utils"
import { toast } from "../components/toast"
import { planById } from "./plans"

const MAX = 50 * 1024 * 1024

/** Add files to a project: extract text in the browser, then mark them ready. */
export function useUploader() {
  const { state, update, user } = useStore()

  return useCallback(
    async (list: File[] | FileList, projectId: string) => {
      const files = Array.from(list)
      const accepted: Array<{ file: File; rec: KnowledgeFile }> = []
      for (const file of files) {
        if (file.size > MAX) {
          toast(`${file.name} is over 50 MB`, "error")
          continue
        }
        accepted.push({
          file,
          rec: { id: uid("f-"), projectId, name: file.name, kind: kindFor(file.name, file.type), size: file.size, owner: user?.name ?? "You", updatedAt: Date.now(), status: "queued", progress: 0, meta: "Waiting to process" },
        })
      }
      if (!accepted.length) return []
      update((d) => void d.files.unshift(...accepted.map((a) => a.rec)))

      for (const { file, rec } of accepted) {
        const set = (patch: Partial<KnowledgeFile>) =>
          update((d) => {
            const f = d.files.find((x) => x.id === rec.id)
            if (f) Object.assign(f, patch)
          })
        set({ status: "processing", progress: 0.05, meta: "Reading…" })
        try {
          const { text, meta } = await extractText(file, (p) => set({ progress: 0.1 + p * 0.75, meta: "Extracting text…" }))
          await saveText(rec.id, text)
          set({ progress: 0.92, meta: "Building understanding…" })
          await new Promise((r) => setTimeout(r, 350))
          const firstSentence = text.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s/)[0]?.slice(0, 180)
          set({ status: "ready", progress: 1, meta, chars: text.length, summary: firstSentence || (rec.kind === "image" ? "Image stored for reference." : "No readable text found."), updatedAt: Date.now() })
        } catch (e) {
          console.error(e)
          set({ status: "error", meta: "Couldn't read this file" })
        }
      }
      const project = state.projects.find((p) => p.id === projectId)
      update((d) =>
        void d.notifications.unshift({ id: uid("n-"), who: user?.name ?? "You", text: `You added ${accepted.length} source${accepted.length > 1 ? "s" : ""}`, sub: project?.name, at: Date.now(), read: true, href: `#/app/knowledge/${projectId}` }),
      )
      return accepted.map((a) => a.rec.id)
    },
    [state.projects, update, user],
  )
}

export function storageUsed(files: KnowledgeFile[]) {
  return files.reduce((a, f) => a + (f.size || 0), 0)
}

export function storageLimitBytes(plan: string) {
  const s = planById(plan as never).storage
  if (s === "Unlimited") return Infinity
  const n = parseFloat(s)
  return s.includes("GB") ? n * 1024 ** 3 : n * 1024 ** 2
}
