// Depth Anything V2 Small (int8 ONNX, Apache 2.0) off the main thread. It gives relative nearness, not metres, so
// each zone is compared with the floor at the bottom of the picture, which is about a metre ahead when the phone
// is worn at chest height. A zone as near as that floor has something solid in it about a step away.
import * as ort from 'onnxruntime-web/wasm'

const W = 196 // multiples of 14 (the model's patch size), portrait like the camera
const H = 252
const MEAN = [0.485, 0.456, 0.406]
const STD = [0.229, 0.224, 0.225]

export type Nearness = { left: number; ahead: number; right: number; ms: number }

let session: ort.InferenceSession | null = null
const canvas = new OffscreenCanvas(W, H)
const g = canvas.getContext('2d', { willReadFrequently: true })!

self.onmessage = async (e: MessageEvent) => {
  const msg = e.data
  try {
    if (msg.type === 'init') {
      ort.env.wasm.wasmPaths = msg.wasm
      ort.env.wasm.numThreads = 1
      session = await ort.InferenceSession.create(msg.model, { executionProviders: ['wasm'] })
      self.postMessage({ type: 'ready' })
    } else if (msg.type === 'detect' && session) {
      const bmp: ImageBitmap = msg.bitmap
      const t0 = performance.now()
      const n = await nearness(session, bmp)
      bmp.close()
      self.postMessage({ type: 'result', nearness: { ...n, ms: Math.round(performance.now() - t0) } })
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: String(err) })
  }
}

async function nearness(s: ort.InferenceSession, bmp: ImageBitmap): Promise<Omit<Nearness, 'ms'>> {
  g.drawImage(bmp, 0, 0, W, H)
  const px = g.getImageData(0, 0, W, H).data
  const plane = W * H
  const input = new Float32Array(3 * plane)
  for (let i = 0; i < plane; i++)
    for (let c = 0; c < 3; c++) input[c * plane + i] = ((px[i * 4 + c] ?? 0) / 255 - MEAN[c]!) / STD[c]!
  const out = await s.run({ pixel_values: new ort.Tensor('float32', input, [1, 3, H, W]) })
  const d = out.predicted_depth!.data as Float32Array // larger = nearer
  const zone = (x0: number, x1: number, y0: number, y1: number, q: number) => {
    const v: number[] = []
    for (let y = Math.floor(y0 * H); y < Math.floor(y1 * H); y++)
      for (let x = Math.floor(x0 * W); x < Math.floor(x1 * W); x++) v.push(d[y * W + x] ?? 0)
    v.sort((a, b) => a - b)
    return v[Math.floor(q * (v.length - 1))] ?? 0
  }
  const floor = Math.max(zone(0.25, 0.75, 0.88, 1, 0.5), 1e-6)
  // Upper-middle band of each third, 75th percentile: the nearest substantial thing at body height.
  return {
    left: zone(0, 0.33, 0.25, 0.7, 0.75) / floor,
    ahead: zone(0.33, 0.67, 0.25, 0.7, 0.75) / floor,
    right: zone(0.67, 1, 0.25, 0.7, 0.75) / floor,
  }
}
