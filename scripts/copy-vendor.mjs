// Copies the MediaPipe runtime out of node_modules into public/vendor so the APK carries it (no CDN, no internet).
import { cpSync, mkdirSync } from 'node:fs'

mkdirSync('public/vendor', { recursive: true })
cpSync('node_modules/@mediapipe/tasks-vision/wasm', 'public/vendor/wasm', { recursive: true })
console.log('MediaPipe wasm copied to public/vendor/wasm')
