import { Capacitor } from '@capacitor/core'
import { FilesetResolver, ObjectDetector } from '@mediapipe/tasks-vision'

export const TARGET_CLASSES = ['person', 'car', 'motorcycle', 'bicycle', 'bus', 'truck'] as const
export type TargetClass = (typeof TARGET_CLASSES)[number]

// Runtime and model are served from public/, relative to index.html, so the APK carries them.
const WASM_PATH = './vendor/wasm'
const MODEL_PATH = './models/efficientdet_lite0.tflite'

export type Delegate = 'GPU' | 'CPU'
const DELEGATE_KEY = 'secondsight.delegate'
// Verified on an iQOO Neo 10 (Android 16 WebView): the GPU delegate runs but returns zero detections,
// CPU (XNNPACK) detects at ~5 fps. Browsers on the Mac and phone Chrome are fine with GPU.
export function preferredDelegate(): Delegate {
  try {
    const forced = localStorage.getItem(DELEGATE_KEY)
    if (forced === 'CPU' || forced === 'GPU') return forced
  } catch {
    /* storage blocked */
  }
  return Capacitor.isNativePlatform() ? 'CPU' : 'GPU'
}

export async function createDetector(delegate: Delegate = preferredDelegate()): Promise<ObjectDetector> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_PATH)
  const options = {
    baseOptions: { modelAssetPath: MODEL_PATH, delegate },
    runningMode: 'VIDEO' as const,
    scoreThreshold: 0.45,
    categoryAllowlist: [...TARGET_CLASSES],
  }
  try {
    return await ObjectDetector.createFromOptions(fileset, options)
  } catch {
    // Some WebViews refuse the WebGL delegate; CPU is slower but always works.
    return ObjectDetector.createFromOptions(fileset, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: 'CPU' },
    })
  }
}
