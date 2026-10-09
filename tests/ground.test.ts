// node --test tests/ground.test.ts  (Node 22.6+ strips the types)
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  createGroundTracker,
  decodeGround,
  groundCrop,
  groundDistance,
  locateGround,
  pitchDownOf,
  type RawGround,
} from '../src/features/vision/ground.ts'

// The model's output table for a few candidate boxes: [cx, cy, w, h, pothole score, manhole score] per box.
function table(boxes: number[][]): Float32Array {
  const n = boxes.length
  const out = new Float32Array(6 * n)
  boxes.forEach((b, i) => b.forEach((v, row) => (out[row * n + i] = v)))
  return out
}

test('decode keeps one box per hazard, strongest first, and drops guesses', () => {
  const found = decodeGround(
    table([
      [160, 200, 80, 40, 0.9, 0.05], // a pothole
      [162, 202, 82, 42, 0.7, 0.05], // the same pothole again
      [60, 250, 50, 30, 0.1, 0.8], // a manhole
      [280, 100, 30, 30, 0.3, 0.2], // a guess
    ])
  )
  assert.deepEqual(
    found.map(f => [f.kind, +f.score.toFixed(2)]),
    [
      ['pothole', 0.9],
      ['manhole', 0.8],
    ]
  )
  assert.deepEqual(found[0]?.box, { x: 120, y: 180, w: 80, h: 40 })
})

test('a hazard counts only when it is found twice in a row in about the same place', () => {
  const at = (x: number, y: number, score = 0.8): RawGround => ({ kind: 'pothole', score, box: { x, y, w: 60, h: 30 } })
  const track = createGroundTracker()
  assert.equal(track([at(100, 200)]).length, 0, 'first sighting')
  assert.equal(track([at(110, 215)]).length, 1, 'second sighting, a little nearer')
  assert.equal(track([]).length, 0, 'gone')
  assert.equal(track([at(110, 215)]).length, 0, 'seen again: starts over')
  assert.equal(track([at(250, 60)]).length, 0, 'somewhere else entirely')
  const weak = createGroundTracker()
  weak([at(100, 200, 0.42)])
  assert.equal(weak([at(100, 200, 0.45)]).length, 0, 'never sure enough')
  const manhole = createGroundTracker()
  manhole([at(100, 200)])
  assert.equal(manhole([{ ...at(100, 200), kind: 'manhole' }]).length, 0, 'a different kind of thing')
})

test('distance along the ground from a camera at chest height', () => {
  const H = 640
  const K = 0.75
  // Level camera: the bottom edge of the picture is about 2 m ahead, and the horizon is out of range.
  assert.ok(Math.abs(groundDistance(H, H, K, 0) - 1.95) < 0.05)
  assert.ok(Math.abs(groundDistance(0.825 * H, H, K, 0) - 3) < 0.1)
  assert.equal(groundDistance(H / 2, H, K, 0), Infinity)
  // Tipped 10 degrees towards the ground, the same point in the picture is nearer.
  assert.ok(groundDistance(0.825 * H, H, K, (10 * Math.PI) / 180) < 2.1)
})

test('placing a hazard: side, distance, and nothing beyond 5 m', () => {
  const W = 480
  const H = 640
  const crop = groundCrop(W, H)
  // A box given in frame pixels, turned into the model's 320 x 320 picture.
  const raw = (x: number, y: number, w: number, h: number): RawGround => ({
    kind: 'pothole',
    score: 0.9,
    box: {
      x: (x - crop.sx) * crop.scale + crop.dx,
      y: (y - crop.sy) * crop.scale + crop.dy,
      w: w * crop.scale,
      h: h * crop.scale,
    },
  })
  const [ahead] = locateGround([raw(200, 500, 80, 40)], crop, W, H, 0.75, 0)
  assert.equal(ahead?.side, 'ahead')
  assert.ok(ahead && ahead.distance > 2.5 && ahead.distance < 3, `two steps, got ${ahead?.distance}`)
  assert.ok(ahead && Math.abs(ahead.box.x - 200) < 1 && Math.abs(ahead.box.y - 500) < 1, 'box back in frame pixels')
  assert.equal(locateGround([raw(20, 560, 90, 40)], crop, W, H, 0.75, 0)[0]?.side, 'left')
  assert.equal(locateGround([raw(380, 560, 90, 40)], crop, W, H, 0.75, 0)[0]?.side, 'right')
  // Mostly on the left, but a quarter of it reaches into the middle of the path: ahead.
  assert.equal(locateGround([raw(60, 560, 140, 40)], crop, W, H, 0.75, 0)[0]?.side, 'ahead')
  // Near the horizon: too far to matter yet.
  assert.equal(locateGround([raw(200, 330, 40, 12)], crop, W, H, 0.75, 0).length, 0)
  // Nearest first.
  const two = locateGround([raw(200, 460, 60, 20), raw(200, 580, 80, 40)], crop, W, H, 0.75, 0)
  assert.ok(two.length === 2 && (two[0]?.distance ?? 9) < (two[1]?.distance ?? 0))
})

test('camera tilt from the accelerometer, only when the phone is worn upright', () => {
  assert.equal(pitchDownOf(null), 0)
  assert.equal(pitchDownOf({ x: 0, y: 9.8, z: 0 }), 0)
  assert.ok(Math.abs(pitchDownOf({ x: 0, y: 9.65, z: 1.7 }) - (10 * Math.PI) / 180) < 0.01, 'tipped forward 10 degrees')
  assert.ok(pitchDownOf({ x: 0, y: 9.65, z: -1.7 }) < 0, 'tipped back')
  assert.equal(pitchDownOf({ x: 0, y: 0.4, z: 9.8 }), 0, 'lying flat')
  assert.equal(pitchDownOf({ x: 9.8, y: 0.5, z: 0 }), 0, 'on its side')
})
