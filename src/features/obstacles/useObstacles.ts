import { useEffect, useRef, type RefObject } from 'react'

import { warn, type Lang } from '../speech/speech'
import type { Target } from '../vision/distance'
import type { Nearness } from './depthWorker'

const EVERY_MS = 1000
const NEAR = 0.8 // ahead zone at least 80% as near as the floor one metre away: something within ~1.6 m
const CLEAR = 0.6 // a side this far is free to step into
const FLOOR_M = 1.3 // the floor at the bottom of the picture, worn at chest height
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
      streak = n.ahead >= NEAR ? streak + 1 : 0
      if (streak < 2) return // two readings in a row, so one odd frame says nothing
      // A person or vehicle close ahead is already being announced by name; do not also call it an obstacle.
      const hazard = hazardRef.current
      if (hazard && hazard.side === 'ahead' && hazard.distance < 3) return
      const distance = FLOOR_M / n.ahead
      const free = n.left <= n.right ? 'left' : 'right'
      const guidance = Math.min(n.left, n.right) < CLEAR ? free : 'stop'
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
