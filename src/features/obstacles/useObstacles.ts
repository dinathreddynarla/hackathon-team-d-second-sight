import { useEffect, useRef, type RefObject } from 'react'

import { forgetWarning, warn, type Lang } from '../speech/speech'
import type { Target } from '../vision/distance'
import type { Nearness } from './depthWorker'

const EVERY_MS = 1000
const NEAR = 0.8 // ahead zone at least 80% as near as the floor one metre away: something within ~1.6 m
// A side counts as free only when clearly open (an open office reads 0.1 to 0.25) and far less near than ahead,
// twice in a row. Glass, blur and low furniture fooled a looser rule 2 times in 5, so otherwise the word is 'stop'.
const CLEAR = 0.3
const FLOOR_M = 1.3 // the floor at the bottom of the picture, worn at chest height

// When something solid was last near ahead: a plain wall at the lens looks flat, and must not be called a covered lens.
let nearAt = -Infinity
export function obstacleNearRecently(ms = 3000): boolean {
  return performance.now() - nearAt < ms
}
// ponytail: fixed ratios from one office walk; tune outdoors, and per camera height if worn lower.

// Walls, doors, plants, poles, parked carts: anything solid ahead that the object detector has no name for.
// Spoken through warn(), so it follows the same priority, repeat and interrupt rules as people and vehicles.
export function useObstacles(
  videoRef: RefObject<HTMLVideoElement | null>,
  running: boolean,
  lang: Lang,
  hazardRef: RefObject<Target | null>
) {
  const langRef = useRef(lang)
  langRef.current = lang

  useEffect(() => {
    if (!running) return
    const worker = new Worker(new URL('./depthWorker.ts', import.meta.url), { type: 'module' })
    const base = document.baseURI
    worker.postMessage({
      type: 'init',
      model: new URL('./models/depth-small-int8.onnx', base).href,
      wasm: new URL('./vendor/ort/', base).href,
    })
    let busy = true
    let streak = 0
    let freeSide: 'left' | 'right' | null = null
    let freeStreak = 0
    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data
      if (msg.type === 'ready') busy = false
      if (msg.type === 'error') {
        busy = true
        console.warn('obstacles off:', msg.message)
      }
      if (msg.type !== 'result') return
      busy = false
      const n = msg.nearness as Nearness
      if (window.__ss) window.__ss.depth = n
      if (n.ahead >= NEAR) {
        streak++
        nearAt = performance.now()
      } else {
        if (streak >= 2) forgetWarning('obstacle') // the way cleared: the next obstacle is a new one
        streak = 0
      }
      const side = n.left <= n.right ? 'left' : 'right'
      const open = Math.min(n.left, n.right)
      const clearlyFree = open < CLEAR && open < n.ahead / 3
      freeStreak = clearlyFree && side === freeSide ? freeStreak + 1 : clearlyFree ? 1 : 0
      freeSide = clearlyFree ? side : null
      if (streak < 2) return // two readings in a row, so one odd frame says nothing
      // A person or vehicle close ahead is already being announced by name; do not also call it an obstacle.
      // ...unless the obstacle is nearer than that person (a desk between the user and someone behind it).
      const distance = FLOOR_M / n.ahead
      const hazard = hazardRef.current
      if (hazard && hazard.side === 'ahead' && hazard.distance < 3 && hazard.distance <= distance + 0.5) return
      const guidance = freeStreak >= 2 && freeSide ? freeSide : 'stop'
      const target: Target = {
        label: 'obstacle',
        distance,
        count: 1,
        guidance,
        side: 'ahead',
        approaching: false,
        box: { x: 0, y: 0, w: 0, h: 0 },
      }
      warn(target, langRef.current, performance.now())
    }
    const id = window.setInterval(() => {
      const v = videoRef.current
      if (busy || !v || v.readyState < 2 || v.videoWidth === 0) return
      busy = true
      createImageBitmap(v)
        .then(bitmap => worker.postMessage({ type: 'detect', bitmap }, [bitmap]))
        .catch(() => (busy = false))
    }, EVERY_MS)
    return () => {
      clearInterval(id)
      worker.terminate()
    }
  }, [running, videoRef, hazardRef])
}
