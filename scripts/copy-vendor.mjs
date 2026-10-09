// Copies the MediaPipe runtime out of node_modules into public/vendor so the APK carries it (no CDN, no internet).
import { cpSync, mkdirSync } from 'node:fs'

mkdirSync('public/vendor', { recursive: true })
cpSync('node_modules/@mediapipe/tasks-vision/wasm', 'public/vendor/wasm', { recursive: true })
// ONNX Runtime (road-sign model): the loader and its wasm, fetched by the sign worker from public/vendor/ort.
mkdirSync('public/vendor/ort', { recursive: true })
for (const f of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm'])
  cpSync(`node_modules/onnxruntime-web/dist/${f}`, `public/vendor/ort/${f}`)
console.log('MediaPipe wasm copied to public/vendor/wasm, ONNX Runtime to public/vendor/ort')
