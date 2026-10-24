// Runs the on-device model off the main thread so the app stays responsive.
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm"

const handler = new WebWorkerMLCEngineHandler()
self.onmessage = (msg: MessageEvent) => handler.onmessage(msg)
