// node --test tests/traffic-light.test.ts  (Node 22.6+ strips the types)
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createLightWatch, lightColour } from '../src/features/vision/trafficLight.ts'

type Rgb = [number, number, number]
const HOUSING: Rgb = [28, 28, 30]
const RED: Rgb = [235, 40, 30]
const AMBER: Rgb = [250, 180, 30]
const GREEN: Rgb = [40, 230, 170] // signal green photographs blue-green
const LEAF: Rgb = [150, 210, 60] // sunlit leaves: yellow-green
const SKY: Rgb = [140, 180, 235]
const GLARE: Rgb = [255, 250, 245] // the blown-out middle of a lamp

// A 24x48 box: a background, and discs of the given colours and radii at the given heights.
function box(background: Rgb, lamps: { at: number; r: number; colour: Rgb }[] = []): Uint8ClampedArray {
  const w = 24
  const h = 48
  const px = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      let c = background
      for (const lamp of lamps) if (Math.hypot(x - 12, y - lamp.at) <= lamp.r) c = lamp.colour
      px.set([c[0], c[1], c[2], 255], (y * w + x) * 4)
    }
  return px
}

test('the top lamp lit red', () => {
  assert.equal(lightColour(box(HOUSING, [{ at: 8, r: 6, colour: RED }])), 'red')
})

test('the bottom lamp lit green', () => {
  assert.equal(lightColour(box(HOUSING, [{ at: 40, r: 6, colour: GREEN }])), 'green')
})

test('a lamp blown out to white in the middle still reads by its rim', () => {
  const lit = [
    { at: 8, r: 7, colour: RED },
    { at: 8, r: 4, colour: GLARE },
  ]
  assert.equal(lightColour(box(HOUSING, lit)), 'red')
})

test('amber is not said', () => {
  assert.equal(lightColour(box(HOUSING, [{ at: 24, r: 6, colour: AMBER }])), null)
})

test('nothing lit, sky behind the pole, leaves behind the pole: no colour', () => {
  assert.equal(lightColour(box(HOUSING)), null)
  assert.equal(lightColour(box(SKY)), null)
  assert.equal(lightColour(box(LEAF)), null)
})

test('red and green both lit (two signals in one box): no colour', () => {
  const both = [
    { at: 8, r: 6, colour: RED },
    { at: 40, r: 6, colour: GREEN },
  ]
  assert.equal(lightColour(box(HOUSING, both)), null)
})

test('a speck of red (a tail light behind the pole) is not a red light', () => {
  assert.equal(lightColour(box(HOUSING, [{ at: 30, r: 1, colour: RED }])), null)
})

test('a colour is due after three looks in a row, once, and again when it changes', () => {
  const watch = createLightWatch()
  const due: (string | null)[] = []
  const look = (colour: 'red' | 'green' | null, t: number) => {
    const d = watch.look(colour, t)
    if (d) watch.spoken(d)
    due.push(d)
  }
  look('red', 0)
  look('red', 250)
  look('red', 500) // sure now
  look('red', 750)
  look('green', 1000)
  look('red', 1250) // one stray look does not make it green
  look('red', 1500)
  look('green', 1750)
  look('green', 2000)
  look('green', 2250) // changed
  look('green', 2500)
  assert.deepEqual(due, [null, null, 'red', null, null, null, null, null, null, 'green', null])
})

test('a colour waits for a gap in the speech, and an unread look starts the count again', () => {
  const watch = createLightWatch()
  assert.equal(watch.look('red', 0), null)
  assert.equal(watch.look('red', 250), null)
  assert.equal(watch.look('red', 500), 'red')
  assert.equal(watch.look('red', 750), 'red') // not spoken yet (the voice was busy): still due
  watch.spoken('red')
  assert.equal(watch.look('red', 1000), null)
  assert.equal(watch.look(null, 1250), null)
  assert.equal(watch.look('green', 1500), null)
  assert.equal(watch.look('green', 1750), null)
  assert.equal(watch.look('green', 2000), 'green')
})

test('asked for, the colour is the one three looks agreed on, and only while it is fresh', () => {
  const watch = createLightWatch()
  watch.look('green', 0)
  watch.look('green', 250)
  assert.equal(watch.sure(250), null) // two looks are not enough to say "green"
  watch.look('green', 500)
  assert.equal(watch.sure(500), 'green')
  watch.look('red', 750)
  assert.equal(watch.sure(750), null) // it has just changed: not sure of the new colour yet
  watch.look('red', 1000)
  watch.look('red', 1250)
  assert.equal(watch.sure(1250), 'red')
  assert.equal(watch.sure(4000), null) // not looked at for a while
})

test('a colour that was cut off before it was heard is due again', () => {
  const watch = createLightWatch()
  for (const t of [0, 250, 500]) watch.look('red', t)
  watch.spoken('red')
  assert.equal(watch.look('red', 750), null)
  watch.unheard('red')
  assert.equal(watch.look('red', 1000), 'red')
})

test('a light out of view for 10 s is a new light: its colour is said again', () => {
  const watch = createLightWatch()
  for (const t of [0, 250, 500]) {
    const d = watch.look('red', t)
    if (d) watch.spoken(d)
  }
  assert.equal(watch.look('red', 750), null)
  assert.equal(watch.look('red', 12000), null)
  assert.equal(watch.look('red', 12250), null)
  assert.equal(watch.look('red', 12500), 'red')
})
