import runtimeUrl from 'onnxruntime-web/ort-wasm-simd-threaded.wasm?url'
import * as ort from 'onnxruntime-web/wasm'

import { decodeGround, GROUND_INPUT, type RawGround } from './ground'

// Runs the pothole model off the main thread, so the people-and-vehicles detector never waits for it.
// The runtime and the model are files inside the app (the build copies the runtime, the model is in public/models):
// no network.

export type GroundRequest =
  | { type: 'init'; base: string }
  // pixels: the RGBA bytes of a GROUND_INPUT x GROUND_INPUT picture
  | { type: 'frame'; id: number; pixels: ArrayBuffer }
export type GroundReply =
  | { type: 'ready' }
  | { type: 'failed'; message: string }
  | { type: 'result'; id: number; found: RawGround[]; ms: number }

const MODEL_PATH = 'models/pothole_yolo11n_320.onnx'

let session: ort.InferenceSession | null = null
const reply = (message: GroundReply) => self.postMessage(message)

async function bytes(url: string): Promise<Uint8Array> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${url}: ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

async function init(base: string) {
  // The runtime is handed over as bytes, so nothing depends on how the WebView labels a .wasm file. One thread:
  // more would need a cross-origin-isolated page, which the WebView is not.
  ort.env.wasm.numThreads = 1
  ort.env.wasm.wasmBinary = await bytes(runtimeUrl)
  session = await ort.InferenceSession.create(await bytes(base + MODEL_PATH), { executionProviders: ['wasm'] })
}

async function run(id: number, pixels: ArrayBuffer) {
  if (!session) throw new Error('not ready')
  const started = performance.now()
  const rgba = new Uint8ClampedArray(pixels)
  const size = GROUND_INPUT * GROUND_INPUT
  // The model wants three planes (all red, all green, all blue), each value from 0 to 1.
  const planes = new Float32Array(3 * size)
  for (let i = 0; i < size; i++) {
    planes[i] = (rgba[4 * i] ?? 0) / 255
    planes[size + i] = (rgba[4 * i + 1] ?? 0) / 255
    planes[2 * size + i] = (rgba[4 * i + 2] ?? 0) / 255
  }
  const input = new ort.Tensor('float32', planes, [1, 3, GROUND_INPUT, GROUND_INPUT])
  const outputs = await session.run({ [session.inputNames[0] ?? 'images']: input })
  const output = outputs[session.outputNames[0] ?? 'output0']
  const found = output ? decodeGround(output.data as Float32Array) : []
  reply({ type: 'result', id, found, ms: Math.round(performance.now() - started) })
}

self.onmessage = (event: MessageEvent<GroundRequest>) => {
  const message = event.data
  if (message.type === 'init') {
    init(message.base).then(
      () => reply({ type: 'ready' }),
      (err: unknown) => reply({ type: 'failed', message: err instanceof Error ? err.message : String(err) })
    )
  } else {
    // A picture that cannot be read is an empty answer, so the sender never waits for a reply that is not coming.
    run(message.id, message.pixels).catch(() => reply({ type: 'result', id: message.id, found: [], ms: 0 }))
  }
}
