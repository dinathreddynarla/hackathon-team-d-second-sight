// node --test tests/sentence.test.ts — guards the warning wording (a silent edit once dropped guidance and counts).
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { sentence } from '../src/features/speech/speech.ts'

const base = {
  distance: 2.2,
  count: 1,
  side: 'ahead',
  approaching: false,
  guidance: null,
  box: { x: 0, y: 0, w: 0, h: 0 },
}

test('plain warning', () =>
  assert.equal(sentence({ ...base, label: 'person' } as never, 'en'), 'person ahead, two steps'))
test('count', () =>
  assert.equal(sentence({ ...base, label: 'person', count: 2 } as never, 'en'), '2 people ahead, two steps'))
test('guidance', () =>
  assert.equal(
    sentence({ ...base, label: 'obstacle', distance: 1.2, guidance: 'right' } as never, 'en'),
    'stop, obstacle, move right'
  ))
test('approaching', () =>
  assert.equal(
    sentence({ ...base, label: 'bus', side: 'right', distance: 9, approaching: true } as never, 'en'),
    'bus coming, right, 9 metres'
  ))
test('Telugu keeps side first and adds guidance', () =>
  assert.equal(
    sentence({ ...base, label: 'obstacle', distance: 1.2, guidance: 'stop' } as never, 'te'),
    'ఆగండి, అడ్డంకి'
  ))
