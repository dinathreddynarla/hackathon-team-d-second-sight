import type { Detection } from '@mediapipe/tasks-vision'

import type { TargetClass } from './detector'

export type Side = 'left' | 'ahead' | 'right'
export type Guidance = 'left' | 'right' | 'stop' | null
export type Target = {
  label: TargetClass
  distance: number
  count: number
  guidance: Guidance
  side: Side
  approaching: boolean
  box: { x: number; y: number; w: number; h: number }
}

// Typical real-world widths in metres, a second estimate that survives seated people and legs cut off by the frame.
const REAL_WIDTH: Record<TargetClass, number> = {
  person: 0.5,
  car: 1.8,
  motorcycle: 0.8,
  bicycle: 0.6,
  bus: 2.5,
  truck: 2.4,
  dog: 0.4,
  cow: 0.8,
}

// Typical real-world heights in metres. The whole distance estimate rests on these guesses.
const REAL_HEIGHT: Record<TargetClass, number> = {
  person: 1.7,
  car: 1.5,
  motorcycle: 1.5,
  bicycle: 1.6,
  bus: 3.0,
  truck: 3.0,
  dog: 0.5,
  cow: 1.4,
}

const K_KEY = 'secondsight.k'
// K = 1 / (2·tan(vertical FOV / 2)). A phone's portrait rear camera is about 65 to 75 degrees → 0.7 to 0.78.
// The old 1.3 came from a laptop webcam and read every distance 1.8x too far on real footage.
export const DEFAULT_K = 0.75
export function loadK(): number {
  try {
    const k = Number(localStorage.getItem(K_KEY))
    return k > 0 ? k : DEFAULT_K
  } catch {
    return DEFAULT_K
  }
}
export function saveK(k: number) {
  try {
    localStorage.setItem(K_KEY, String(k))
  } catch {
    /* storage blocked: keep the in-memory value */
  }
}

// One number per phone lens: a person at a known 5 m sets it.
export function calibrateK(personBoxRatio: number, trueDistance = 5): number {
  return (trueDistance * personBoxRatio) / REAL_HEIGHT.person
}

const history: Record<string, { t: number; d: number }[]> = {}
const CLOSING_SPEED = 1.5 // m/s: faster than the user's own walk, so a seated person never "comes"

// Closing speed over the last ~0.7 s. Keyed by object and side.
function isApproaching(key: string, distance: number, now: number): boolean {
  const h = (history[key] ?? []).filter(e => now - e.t < 1500)
  h.push({ t: now, d: distance })
  history[key] = h
  const old = h.find(e => now - e.t >= 700)
  if (!old) return false
  return (old.d - distance) / ((now - old.t) / 1000) > CLOSING_SPEED
}

// A box must be seen in 3 consecutive frames before it can be spoken; reflections and decals rarely survive that.
const seen = new Map<string, { n: number; t: number }>()
const PERSIST_FRAMES = 3
function persisted(key: string, now: number): boolean {
  const e = seen.get(key)
  const n = e && now - e.t < 400 ? e.n + 1 : 1
  seen.set(key, { n, t: now })
  return n >= PERSIST_FRAMES
}

// Every kept detection with its distance and side, for the scan-once summary.
export function analyseAll(detections: Detection[], frameW: number, frameH: number, k: number): Target[] {
  const out: Target[] = []
  for (const d of detections) {
    const label = d.categories[0]?.categoryName as TargetClass | undefined
    const bb = d.boundingBox
    if (!label || !bb || !(label in REAL_HEIGHT)) continue
    const ratio = bb.height / frameH
    const wRatio = bb.width / frameW
    if (ratio < 0.04) continue
    // Short slivers touching a frame edge are half-seen things or reflections; a tall one is someone brushing past.
    const touchesEdge = bb.originX <= 1 || bb.originX + bb.width >= frameW - 1
    if (touchesEdge && wRatio < 0.08 && ratio < 0.4) continue
    // Two estimates, keep the NEARER: height (standing, full body) and width (seated, legs cut off). Errors go the safe way.
    const byHeight = (REAL_HEIGHT[label] * k) / ratio
    const byWidth = (REAL_WIDTH[label] * k * (frameH / frameW)) / wRatio
    let distance = Math.min(byHeight, byWidth)
    // Something filling most of the frame is within reach, whatever the formula says.
    if (ratio >= 0.6 || wRatio >= 0.8) distance = Math.min(distance, 1.4)
    else if (ratio >= 0.4) distance = Math.min(distance, 2.9)
    const cx = bb.originX + bb.width / 2
    const side: Side = cx < frameW / 3 ? 'left' : cx > (2 * frameW) / 3 ? 'right' : 'ahead'
    const target: Target = {
      label,
      distance,
      count: 1,
      guidance: null,
      side,
      approaching: false,
      box: { x: bb.originX, y: bb.originY, w: bb.width, h: bb.height },
    }
    out.push(target)
  }
  return out
}

// The thing to warn about: the nearest MOVING object beats any static one; otherwise the nearest.
export function analyse(
  detections: Detection[],
  frameW: number,
  frameH: number,
  k: number,
  now: number
): Target | null {
  const all = analyseAll(detections, frameW, frameH, k).filter(t => persisted(`${t.label}:${t.side}`, now))
  for (const t of all) t.approaching = isApproaching(`${t.label}:${t.side}`, t.distance, now)
  // Nearest wins; a moving object overrides only while it is within 10 m.
  let best: Target | null = null
  for (const t of all) {
    if (!best) best = t
    else if (t.approaching !== best.approaching)
      best =
        (t.approaching ? t : best).distance < 10 ? (t.approaching ? t : best) : t.distance < best.distance ? t : best
    else if (t.distance < best.distance) best = t
  }
  if (best) {
    const b = best
    b.count = all.filter(t => t.label === b.label && t.side === b.side && sameBucket(t.distance, b.distance)).length
    b.guidance = guidanceFor(b, all)
  }
  return best
}

// Something ahead within 5 m: steer towards the third of the frame with nothing in it. Moving things: stop.
function guidanceFor(b: Target, all: Target[]): Guidance {
  if (b.side !== 'ahead' || b.distance >= 5) return null
  if (b.approaching) return 'stop'
  const blocked = (side: Side) => all.some(t => t.side === side && t.distance < 5)
  if (!blocked('left')) return 'left'
  if (!blocked('right')) return 'right'
  return 'stop'
}

function sameBucket(a: number, b: number): boolean {
  const step = (m: number) => (m <= 1.5 ? 0 : m <= 3 ? 1 : m < 5 ? 2 : Math.floor(m))
  return step(a) === step(b)
}
