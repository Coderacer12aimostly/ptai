import { useCallback } from "react"
import { useStore } from "./store"
import { navigate } from "./router"
import { uid } from "./utils"

/** Create a blank document (optionally inside a project) and open it in the editor. */
export function useNewDoc() {
  const { update, user } = useStore()
  return useCallback(
    (projectId?: string) => {
      const id = uid("d-")
      update((d) => {
        d.docs.unshift({ id, title: "Untitled document", projectId, html: "", status: "draft", updatedAt: Date.now(), versions: [], chat: [] })
        if (projectId) d.files.unshift({ id: uid("f-"), projectId, name: "Untitled document", kind: "artifact", size: 0, owner: user?.name ?? "You", updatedAt: Date.now(), status: "draft", meta: "Artifact · document", docId: id })
      })
      navigate(`/app/editor/${id}`)
    },
    [update, user],
  )
}
