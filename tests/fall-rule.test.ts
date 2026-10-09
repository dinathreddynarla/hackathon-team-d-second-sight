// node --test tests/fall-rule.test.ts  (Node 22.6+ strips the types)
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createFallRule, type FallKind } from '../src/features/safety/fallRule.ts'

const UPRIGHT = { x: 0, y: 9.8, z: 0.3 } // portrait on the chest
const ON_BACK = { x: 0, y: 0.4, z: 9.8 } // lying face up, camera to the sky
const WALKING = (t: number) => ({ x: 0.5 * Math.sin(t / 90), y: 9.8 + 2.5 * Math.sin(t / 150), z: 1 })

function run(samples: (t: number) => { x: number; y: number; z: number }, ms: number) {
  const fired: { kind: FallKind; t: number }[] = []
  const rule = createFallRule(kind => fired.push({ kind, t }))
  let t = 0
  for (; t <= ms; t += 50) rule(samples(t), t)
  return fired
}

test('impact then lying still: fall, once', () => {
  const fired = run(t => (t < 1000 ? UPRIGHT : t < 1100 ? { x: 20, y: 18, z: 10 } : ON_BACK), 60000)
  assert.deepEqual(
    fired.map(f => f.kind),
    ['impact']
  )
})

// A slump: the body drops (the phone feels lighter, ~4 m/s²), lands softly (~16 m/s²), then nothing.
const SLUMP = (t: number) =>
  t < 2000 ? UPRIGHT : t < 2300 ? { x: 1, y: 3, z: 2.5 } : t < 2500 ? { x: 2, y: 4, z: 15 } : ON_BACK

test('collapse without impact: lying still after 30 s, once', () => {
  const fired = run(SLUMP, 90000)
  assert.deepEqual(
    fired.map(f => f.kind),
    ['lyingStill']
  )
  assert.ok(fired[0]!.t > 32000 && fired[0]!.t < 33000)
})

test('standing still at a signal for 2 minutes: nothing', () => {
  assert.deepEqual(
    run(() => UPRIGHT, 120000),
    []
  )
})

test('walking for a minute: nothing', () => {
  assert.deepEqual(run(WALKING, 60000), [])
})

test('collapses, sits up, collapses again: asks twice', () => {
  const fired = run(t => (t < 40000 ? SLUMP(t) : t < 45000 ? UPRIGHT : SLUMP(t - 43000)), 120000)
  assert.deepEqual(
    fired.map(f => f.kind),
    ['lyingStill', 'lyingStill']
  )
})

test('phone put down flat on a table by hand: nothing', () => {
  // Lowered over a second; the reading never strays more than ~2 m/s² from gravity.
  const PUT_DOWN = (t: number) =>
    t < 2000 ? UPRIGHT : t < 3000 ? { x: 0, y: 9.8 * (1 - (t - 2000) / 1000), z: 9.8 * ((t - 2000) / 1000) } : ON_BACK
  assert.deepEqual(run(PUT_DOWN, 120000), [])
})

test('lying down calmly on a bed with the app running: nothing', () => {
  assert.deepEqual(
    run(t => (t < 2000 ? UPRIGHT : ON_BACK), 120000),
    []
  )
})
