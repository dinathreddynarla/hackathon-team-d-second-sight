import type { ObjectDetector } from '@mediapipe/tasks-vision'

declare global {
  interface Window {
    __ss?: {
      detector: ObjectDetector
      delegate: 'GPU' | 'CPU'
      last: { n: number; labels: string[] } | null
      depth?: { left: number; ahead: number; right: number; ms: number }
      signs?: { ms: number; hits: { key: string; score: number }[] }
      chosen?: { label: string; side: string; distance: number; approaching: boolean } | null
      // The colour last read off a traffic light in view (null: could not be read).
      light?: 'red' | 'green' | null
    }
    // Stand in for the phone when there is none: see src/native/calls.ts and src/native/setup.ts.
    __ssCall?: (number: string) => Promise<{ started: boolean; answered: boolean; seconds: number }>
    __ssSms?: (to: string, text: string) => Promise<boolean>
  }
}
export {}
