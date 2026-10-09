import type { Detection } from '@mediapipe/tasks-vision'

import type { TargetClass } from './detector'

export type Side = 'left' | 'ahead' | 'right'
export type Target = {
  label: TargetClass
  distance: number
  side: Side
  approaching: boolean
  box: { x: number; y: number; w: number; h: number }
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
export const DEFAULT_K = 1.3
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

const history: Record<string, { t: number; ratio: number }[]> = {}

// Box grew more than 20% versus ~0.7 s ago means the object is coming closer.
function isApproaching(key: string, ratio: number, now: number): boolean {
  const h = (history[key] ?? []).filter(e => now - e.t < 1500)
  h.push({ t: now, ratio })
  history[key] = h
  const old = h.find(e => now - e.t >= 700)
  return old !== undefined && ratio / old.ratio > 1.2
}

// Every kept detection with its distance and side, for the scan-once summary.
export function analyseAll(detections: Detection[], frameW: number, frameH: number, k: number): Target[] {
  const out: Target[] = []
  for (const d of detections) {
    const label = d.categories[0]?.categoryName as TargetClass | undefined
    const bb = d.boundingBox
    if (!label || !bb || !(label in REAL_HEIGHT)) continue
    const ratio = bb.height / frameH
    if (ratio < 0.04) continue
    const distance = (REAL_HEIGHT[label] * k) / ratio
    const cx = bb.originX + bb.width / 2
    const side: Side = cx < frameW / 3 ? 'left' : cx > (2 * frameW) / 3 ? 'right' : 'ahead'
    const target: Target = {
      label,
      distance,
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
  const all = analyseAll(detections, frameW, frameH, k)
  for (const t of all) t.approaching = isApproaching(`${t.label}:${t.side}`, t.box.h / frameH, now)
  let best: Target | null = null
  for (const t of all) {
    if (!best) best = t
    else if (t.approaching !== best.approaching) best = t.approaching ? t : best
    else if (t.distance < best.distance) best = t
  }
  return best
}
