// Impact above ~2.5 g, then 4 s of near-stillness no longer upright, reads as a fall.
// Worn in portrait on the chest, gravity runs along the phone's long axis (y); lying on the back, the front or
// either side it does not. Assumes portrait wearing. A phone put down flat with a thump can also trigger it, and
// someone left slumped less than about 60° from upright is missed.
// ponytail: fixed thresholds; tune on a mattress in Phase 4, make them settings if false triggers persist.
const IMPACT = 25
const STILL_WINDOW_MS = 4000
const STILL_TOLERANCE = 2.5
const UPRIGHT_Y = 5
// A collapse or faint has no impact spike. Not upright AND not moving for 30 s is the second rule. Standing still
// at a signal does not count: the phone is still upright on the chest.
const LYING_STILL_MS = 30000
const LYING_TOLERANCE = 1.5
// Going down has to look like going down: within the 3 s before the stillness began, the phone swung hard
// (|g - 9.8| > 4: a slump, a drop, a stumble). Setting the phone on a table or a bed by hand stays gentler.
const DISTURBANCE = 4
const DISTURBANCE_WINDOW_MS = 3000

export type FallKind = 'impact' | 'lyingStill'

export type Accel = { x: number; y: number; z: number }

// Pure rule: feed it accelerometer samples (with gravity) and timestamps; it calls onFall at most once per event.
export function createFallRule(onFall: (kind: FallKind) => void): (a: Accel, now: number) => void {
  let impactAt = 0
  let maxDeviation = 0
  let lyingSince = 0
  let lyingFired = false
  let lyingArmed = false
  let lastDisturbanceAt = -Infinity
  return (a, now) => {
    const mag = Math.hypot(a.x, a.y, a.z)
    if (Math.abs(mag - 9.8) > DISTURBANCE) lastDisturbanceAt = now
    const lyingStill = Math.abs(a.y) < UPRIGHT_Y && Math.abs(mag - 9.8) < LYING_TOLERANCE
    if (!lyingStill) {
      lyingSince = 0
      if (Math.abs(a.y) >= UPRIGHT_Y) lyingFired = false // upright again re-arms the rule
    } else if (!lyingSince) {
      lyingSince = now
      lyingArmed = now - lastDisturbanceAt < DISTURBANCE_WINDOW_MS
    } else if (lyingArmed && !lyingFired && now - lyingSince > LYING_STILL_MS) {
      lyingFired = true
      onFall('lyingStill')
    }
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
      if (fell) {
        lyingFired = true // the impact rule already asked; do not ask again 30 s later
        onFall('impact')
      }
    }
  }
}
