import type { Side } from './distance'

// Hazards in the road surface itself: potholes and manholes. A second model finds them (see groundWorker.ts);
// this file turns its raw output into "what, which side, how far". No stairs, kerbs or poles: no model for those.

// The model's classes, in its own order.
export const GROUND_KINDS = ['pothole', 'manhole'] as const
export type GroundKind = (typeof GROUND_KINDS)[number]
export const GROUND_INPUT = 320 // the model takes a 320 x 320 picture

export type Box = { x: number; y: number; w: number; h: number }
// As the model reports it: the box is in the 320 x 320 picture it was given.
export type RawGround = { kind: GroundKind; score: number; box: Box }
// As the app speaks it: the box is in camera-frame pixels.
export type GroundHazard = { kind: GroundKind; side: Side; distance: number; score: number; box: Box }

// The road is in the lower part of the picture. Above it are buildings and sky, where a "pothole" can only be a
// mistake, so the model is never shown them.
const GROUND_TOP = 0.45
export type Crop = { sx: number; sy: number; sw: number; sh: number; scale: number; dx: number; dy: number }
// The part of the camera frame the model looks at, and how it is fitted into the square input (scaled, then centred).
export function groundCrop(frameW: number, frameH: number): Crop {
  const sy = Math.round(frameH * GROUND_TOP)
  const sw = frameW
  const sh = frameH - sy
  const scale = GROUND_INPUT / Math.max(sw, sh)
  return { sx: 0, sy, sw, sh, scale, dx: (GROUND_INPUT - sw * scale) / 2, dy: (GROUND_INPUT - sh * scale) / 2 }
}

function iou(a: Box, b: Box): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y)
  if (w <= 0 || h <= 0) return 0
  return (w * h) / (a.w * a.h + b.w * b.h - w * h)
}

const DETECT_SCORE = 0.4 // below this the model is guessing
const SAME_BOX = 0.45

// The model's output is one table, [4 + classes] rows by N candidate boxes: centre x, centre y, width, height, then a
// score per class. Keeps the candidates worth a second look, strongest first, one box per hazard.
export function decodeGround(out: ArrayLike<number>): RawGround[] {
  const rows = 4 + GROUND_KINDS.length
  const n = Math.floor(out.length / rows)
  const found: RawGround[] = []
  for (let i = 0; i < n; i++) {
    let best = 0
    let score = 0
    for (let c = 0; c < GROUND_KINDS.length; c++) {
      const s = out[(4 + c) * n + i] ?? 0
      if (s > score) {
        score = s
        best = c
      }
    }
    const kind = GROUND_KINDS[best]
    if (score < DETECT_SCORE || !kind) continue
    const w = out[2 * n + i] ?? 0
    const h = out[3 * n + i] ?? 0
    found.push({ kind, score, box: { x: (out[i] ?? 0) - w / 2, y: (out[n + i] ?? 0) - h / 2, w, h } })
  }
  found.sort((a, b) => b.score - a.score)
  const kept: RawGround[] = []
  for (const f of found) if (kept.every(k => iou(k.box, f.box) < SAME_BOX)) kept.push(f)
  return kept
}

const CONFIRM_SCORE = 0.5 // one of the two sightings must be at least this sure

// A shadow or a wet patch can look like a pothole for one picture. A hazard counts only when it is found twice in a
// row, in about the same place. Call the returned function once per picture; it returns the confirmed ones.
export function createGroundTracker(): (found: RawGround[]) => RawGround[] {
  let last: RawGround[] = []
  return found => {
    const confirmed = found.filter(f =>
      last.some(p => p.kind === f.kind && Math.max(p.score, f.score) >= CONFIRM_SCORE && sameSpot(p.box, f.box))
    )
    last = found
    return confirmed
  }
}

// The user walks between two pictures, so the box moves and grows. Close enough is: centres within one box size.
function sameSpot(a: Box, b: Box): boolean {
  const reach = Math.max(a.w, a.h, b.w, b.h)
  return Math.hypot(a.x + a.w / 2 - (b.x + b.w / 2), a.y + a.h / 2 - (b.y + b.h / 2)) <= reach
}

export const CAMERA_HEIGHT = 1.3 // metres above the ground: a phone hanging at chest height
const MIN_ANGLE = 0.05 // radians below the horizon; flatter than this is too far to place

// How far along the ground a point in the picture is. Unlike a person or a car, a pothole has no known height to
// measure by; what is known is how high the camera hangs. `k` is the lens constant the rest of the app uses
// (focal length in frame heights) and `pitchDown` is how far the camera is tipped towards the ground, in radians.
export function groundDistance(y: number, frameH: number, k: number, pitchDown: number): number {
  const below = Math.atan((y - frameH / 2) / (k * frameH)) + pitchDown
  return below > MIN_ANGLE ? CAMERA_HEIGHT / Math.tan(below) : Infinity
}

const MAX_RANGE = 5 // metres: beyond this a pothole is a few pixels, and not yet the user's next step

// Places each confirmed hazard: its near edge gives the distance, and it is "ahead" as soon as a quarter of it
// lies in the middle of the frame, because a hole half in the user's path is in the user's path. Nearest first.
export function locateGround(
  found: RawGround[],
  crop: Crop,
  frameW: number,
  frameH: number,
  k: number,
  pitchDown: number
): GroundHazard[] {
  const out: GroundHazard[] = []
  for (const f of found) {
    const x = Math.max(0, (f.box.x - crop.dx) / crop.scale + crop.sx)
    const y = Math.max(0, (f.box.y - crop.dy) / crop.scale + crop.sy)
    const right = Math.min(frameW, (f.box.x + f.box.w - crop.dx) / crop.scale + crop.sx)
    const bottom = Math.min(frameH, (f.box.y + f.box.h - crop.dy) / crop.scale + crop.sy)
    if (right <= x || bottom <= y) continue
    const distance = groundDistance(bottom, frameH, k, pitchDown)
    if (distance >= MAX_RANGE) continue
    const inMiddle = Math.min(right, (2 * frameW) / 3) - Math.max(x, frameW / 3)
    const cx = (x + right) / 2
    const side: Side =
      inMiddle >= (right - x) / 4 ? 'ahead' : cx < frameW / 3 ? 'left' : cx > (2 * frameW) / 3 ? 'right' : 'ahead'
    out.push({ kind: f.kind, side, distance, score: f.score, box: { x, y, w: right - x, h: bottom - y } })
  }
  return out.sort((a, b) => a.distance - b.distance)
}

// How far the camera is tipped towards the ground, from the phone's accelerometer (gravity included), in radians.
// Worn upright in portrait, gravity lies along the phone's long side; tipped forward, part of it shows on the axis
// through the screen. Not upright (lying down, or sideways), or no sensor: no correction.
const MAX_PITCH = 0.45 // about 25 degrees; more than that is not "worn at chest height"
export function pitchDownOf(a: { x: number; y: number; z: number } | null | undefined): number {
  if (!a || a.y < 5 || Math.abs(a.x) > 5) return 0
  return Math.max(-MAX_PITCH, Math.min(MAX_PITCH, Math.atan2(a.z, a.y)))
}

const GROUND_KEY = 'secondsight.ground'
// On unless it was switched off in Settings.
export function loadGroundOn(): boolean {
  try {
    return localStorage.getItem(GROUND_KEY) !== 'off'
  } catch {
    return true
  }
}
export function saveGroundOn(on: boolean) {
  try {
    if (on) localStorage.removeItem(GROUND_KEY)
    else localStorage.setItem(GROUND_KEY, 'off')
  } catch {
    /* storage blocked: keep the in-memory value */
  }
}
