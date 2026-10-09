import type { ObjectDetector } from '@mediapipe/tasks-vision'

declare global {
  interface Window {
    __ss?: { detector: ObjectDetector; delegate: 'GPU' | 'CPU'; last: { n: number; labels: string[] } | null }
  }
}
export {}
