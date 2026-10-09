import type { ObjectDetector } from '@mediapipe/tasks-vision'

declare global {
  interface Window {
    __ss?: {
      detector: ObjectDetector
      delegate: 'GPU' | 'CPU'
      last: { n: number; labels: string[] } | null
      chosen?: { label: string; side: string; distance: number; approaching: boolean } | null
    }
  }
}
export {}
