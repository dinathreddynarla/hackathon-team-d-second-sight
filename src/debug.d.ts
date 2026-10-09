import type { ObjectDetector } from '@mediapipe/tasks-vision'

declare global {
  interface Window {
    __ss?: {
      detector: ObjectDetector
      delegate: 'GPU' | 'CPU'
      last: { n: number; labels: string[] } | null
      chosen?: { label: string; side: string; distance: number; approaching: boolean } | null
    }
    // Stand in for the phone when there is none: see src/native/calls.ts and src/native/setup.ts.
    __ssCall?: (number: string) => Promise<{ started: boolean; answered: boolean; seconds: number }>
    __ssSms?: (to: string, text: string) => Promise<boolean>
  }
}
export {}
