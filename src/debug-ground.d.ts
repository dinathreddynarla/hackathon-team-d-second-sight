import type { GroundHazard } from './features/vision/ground'

declare global {
  interface Window {
    // ponytail: debug handle, like __ss. What the road-surface model last confirmed, how long it took, how often it ran.
    __ssGround?: { last: GroundHazard[]; ms: number; runs: number }
  }
}
export {}
