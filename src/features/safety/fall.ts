import type { PluginListenerHandle } from '@capacitor/core'
import { Motion } from '@capacitor/motion'

// Impact above ~2.5 g, then 4 s of near-stillness no longer upright, reads as a fall.
// Worn in portrait on the chest, gravity runs along the phone's long axis (y); lying on the back, the front or
// either side it does not. Assumes portrait wearing. A phone put down flat with a thump can also trigger it, and
// someone left slumped less than about 60° from upright is missed.
// ponytail: fixed thresholds; tune on a mattress in Phase 4, make them settings if false triggers persist.
const IMPACT = 25
const STILL_WINDOW_MS = 4000
const STILL_TOLERANCE = 2.5
const UPRIGHT_Y = 5

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
      const fell = maxDeviation < STILL_TOLERANCE && Math.abs(a.y) < UPRIGHT_Y
      impactAt = 0
      if (fell) onFall()
    }
  }).then(h => (handle = h))
  return () => void handle?.remove()
}
