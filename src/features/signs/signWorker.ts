// Runs the road-sign model off the main thread, so the hazard loop never waits for it.
import * as ort from 'onnxruntime-web/wasm'

const SIZE = 416
const CLASSES = 37
const MIN_SCORE = 0.5

export type SignHit = { cls: number; score: number; h: number } // h = box height as a share of the frame

let session: ort.InferenceSession | null = null
const canvas = new OffscreenCanvas(SIZE, SIZE)
const g = canvas.getContext('2d', { willReadFrequently: true })!

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data
  try {
    if (msg.type === 'init') {
      ort.env.wasm.wasmPaths = msg.wasm
      ort.env.wasm.numThreads = 1 // the WebView page is not cross-origin isolated, so no wasm threads
      session = await ort.InferenceSession.create(msg.model, { executionProviders: ['wasm'] })
      self.postMessage({ type: 'ready' })
    } else if (msg.type === 'detect' && session) {
      const bmp: ImageBitmap = msg.bitmap
      const t0 = performance.now()
      const hits = await detect(session, bmp)
      bmp.close()
      self.postMessage({ type: 'result', hits, ms: Math.round(performance.now() - t0) })
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) })
  }
}

async function detect(s: ort.InferenceSession, bmp: ImageBitmap): Promise<SignHit[]> {
  // Letterbox to 416x416 with grey padding, as the model was trained.
  const scale = Math.min(SIZE / bmp.width, SIZE / bmp.height)
  const w = Math.round(bmp.width * scale)
  const h = Math.round(bmp.height * scale)
  g.fillStyle = 'rgb(114,114,114)'
  g.fillRect(0, 0, SIZE, SIZE)
  g.drawImage(bmp, (SIZE - w) / 2, (SIZE - h) / 2, w, h)
  const px = g.getImageData(0, 0, SIZE, SIZE).data
  const plane = SIZE * SIZE
  const input = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++) {
    input[i] = (px[i * 4] ?? 0) / 255
    input[plane + i] = (px[i * 4 + 1] ?? 0) / 255
    input[2 * plane + i] = (px[i * 4 + 2] ?? 0) / 255
  }
  const out = await s.run({ images: new ort.Tensor('float32', input, [1, 3, SIZE, SIZE]) })
  const data = out.output0!.data as Float32Array
  const n = data.length / (4 + CLASSES) // candidates; layout [4 + classes][n]
  const found = new Map<number, SignHit>() // best box per class is enough: we only say which signs are there
  for (let j = 0; j < n; j++) {
    let best = 0
    let cls = -1
    for (let c = 0; c < CLASSES; c++) {
      const v = data[(4 + c) * n + j] ?? 0
      if (v > best) {
        best = v
        cls = c
      }
    }
    if (best < MIN_SCORE) continue
    const prev = found.get(cls)
    if (!prev || best > prev.score) found.set(cls, { cls, score: best, h: (data[3 * n + j] ?? 0) / h })
  }
  return [...found.values()].sort((a, b) => b.score - a.score)
}
