import assert from 'node:assert/strict'
import { test } from 'node:test'

import { steer, type Target } from '../src/features/vision/distance.ts'

const W = 480
const t = (label: Target['label'], side: Target['side'], distance: number, x = 200, approaching = false): Target => ({
  label,
  side,
  distance,
  count: 1,
  guidance: null,
  approaching,
  box: { x, y: 100, w: 80, h: 300 },
})

test('a person standing ahead, leaning right, left side free: move left', () => {
  const p = t('person', 'ahead', 2, 220) // centre 260 > 240
  assert.equal(steer(p, [p], W), 'left')
})

test('leaning left: move right', () => {
  const p = t('person', 'ahead', 2, 160) // centre 200 < 240
  assert.equal(steer(p, [p], W), 'right')
})

test('the nearer side is taken by someone within 5 m: the other side', () => {
  const p = t('person', 'ahead', 2, 220)
  const q = t('person', 'left', 4, 20)
  assert.equal(steer(p, [p, q], W), 'right')
})

test('both sides taken: stop', () => {
  const p = t('person', 'ahead', 2, 220)
  assert.equal(steer(p, [p, t('person', 'left', 4, 20), t('car', 'right', 3, 400)], W), 'stop')
})

test('a wall beside (depth): not sent into it', () => {
  const p = t('person', 'ahead', 2, 220)
  assert.equal(
    steer(p, [p], W, side => side === 'left'),
    'right'
  )
  assert.equal(
    steer(p, [p], W, () => true),
    'stop'
  )
})

test('something coming at the user: stop', () => {
  const c = t('car', 'ahead', 2.5, 220, true)
  assert.equal(steer(c, [c], W), 'stop')
})

test('beyond 3 m, or to one side: no direction', () => {
  assert.equal(steer(t('person', 'ahead', 4, 220), [], W), null)
  assert.equal(steer(t('person', 'left', 2, 20), [], W), null)
})

test('someone farther than 5 m on a side does not block it', () => {
  const p = t('person', 'ahead', 2, 220)
  assert.equal(steer(p, [p, t('person', 'left', 8, 20)], W), 'left')
})
