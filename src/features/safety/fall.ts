import type { PluginListenerHandle } from '@capacitor/core'
import { Motion } from '@capacitor/motion'

// Impact above ~2.5 g, then 4 s of near-stillness with the screen facing up, reads as a fall.
// ponytail: fixed thresholds; tune on a mattress in Phase 4, make them settings if false triggers persist.
const IMPACT = 25
const STILL_WINDOW_MS = 4000
const STILL_TOLERANCE = 2.5
const FACE_UP_Z = 7

export function watchFalls(onFall: () => void): () => void {
  let impactAt = 0
  let maxDeviation = 0
  let handle: PluginListenerHandle | undefined
  void Motion.addListener('accel', ev => {
    const a = ev.accelerationIncludingGravity
    const mag = Math.hypot(a.x, a.y, a.z)
    const now = Date.now()
    if (mag > IMPACT) {
      impactAt = now
      maxDeviation = 0
      return
    }
    if (!impactAt) return
    if (now - impactAt > 800) maxDeviation = Math.max(maxDeviation, Math.abs(mag - 9.8))
    if (now - impactAt > STILL_WINDOW_MS) {
      const fell = maxDeviation < STILL_TOLERANCE && a.z > FACE_UP_Z
      impactAt = 0
      if (fell) onFall()
    }
  }).then(h => (handle = h))
  return () => void handle?.remove()
}
