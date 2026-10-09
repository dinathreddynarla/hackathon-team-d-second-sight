import type { PluginListenerHandle } from '@capacitor/core'
import { Motion } from '@capacitor/motion'
import { useEffect, useRef, useState, type RefObject } from 'react'

import { warnGround, type Lang } from '../speech/speech'
import { loadK, type Side } from './distance'
import {
  createGroundTracker,
  GROUND_INPUT,
  groundCrop,
  locateGround,
  pitchDownOf,
  type Crop,
  type GroundHazard,
} from './ground'
import type { GroundReply, GroundRequest } from './groundWorker'

// off: switched off in Settings. missing: the model or its runtime could not start, which is spoken (see App.tsx).
export type GroundState = 'off' | 'loading' | 'ready' | 'missing'

const GROUND_MS = 400 // a pothole stays where it is: a few looks a second are enough
const STUCK_MS = 5000 // a picture with no answer after this long is given up on
const STUCK_LIMIT = 3 // this many in a row, and the model has stopped

// Looks at the road surface a few times a second while the camera is live, and speaks the nearest pothole or
// manhole within a few steps. The model runs in a worker, beside the people-and-vehicles detector, not after it.
// `hazards` always holds what is confirmed right now, for scan-once.
export function useGround(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  running: boolean,
  enabled: boolean,
  langRef: RefObject<Lang>,
  hazards: RefObject<GroundHazard[]>,
  onSaid: (text: string, side: Side) => void
): GroundState {
  const workerRef = useRef<Worker | null>(null)
  const onResultRef = useRef<((reply: Extract<GroundReply, { type: 'result' }>) => void) | null>(null)
  const onSaidRef = useRef(onSaid)
  onSaidRef.current = onSaid
  const [state, setState] = useState<GroundState>(enabled ? 'loading' : 'off')

  useEffect(() => {
    if (!enabled) {
      setState('off')
      return
    }
    setState('loading')
    let worker: Worker
    try {
      worker = new Worker(new URL('./groundWorker.ts', import.meta.url), { type: 'module' })
    } catch {
      setState('missing')
      return
    }
    worker.onmessage = (event: MessageEvent<GroundReply>) => {
      const reply = event.data
      if (reply.type === 'ready') setState('ready')
      else if (reply.type === 'failed') setState('missing')
      else onResultRef.current?.(reply)
    }
    worker.onerror = () => setState('missing')
    workerRef.current = worker
    const init: GroundRequest = { type: 'init', base: new URL('./', document.baseURI).href }
    worker.postMessage(init)
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [enabled])

  useEffect(() => {
    const video = videoRef.current
    const worker = workerRef.current
    const overlay = canvasRef.current
    if (!running || state !== 'ready' || !video || !worker) return
    const input = document.createElement('canvas')
    input.width = input.height = GROUND_INPUT
    const g = input.getContext('2d', { willReadFrequently: true })
    if (!g) return
    const track = createGroundTracker()
    let pitchDown = 0
    let handle: PluginListenerHandle | undefined
    let gone = false
    // Smoothed, because the phone swings with every step.
    void Motion.addListener('accel', ev => {
      pitchDown += 0.2 * (pitchDownOf(ev.accelerationIncludingGravity) - pitchDown)
    })
      .then(h => (gone ? void h.remove() : (handle = h)))
      .catch(() => undefined)

    // One picture at a time: the next is sent only once the last has been answered.
    let sent: { id: number; at: number; crop: Crop; w: number; h: number; pitchDown: number } | null = null
    let nextId = 1
    let unanswered = 0
    onResultRef.current = reply => {
      if (!sent || reply.id !== sent.id) return
      unanswered = 0
      const { crop, w, h } = sent
      // The lens constant is read each time, so a calibration made in Settings counts from the next picture.
      const found = locateGround(track(reply.found), crop, w, h, loadK(), sent.pitchDown)
      sent = null
      hazards.current = found
      draw(overlay, w, h, found)
      if (window.__ssGround) window.__ssGround = { last: found, ms: reply.ms, runs: window.__ssGround.runs + 1 }
      const nearest = found[0]
      if (!nearest) return
      const said = warnGround(nearest, langRef.current, performance.now())
      if (said) onSaidRef.current(said, nearest.side)
    }
    window.__ssGround = { last: [], ms: 0, runs: 0 }

    const id = window.setInterval(() => {
      const now = performance.now()
      if (sent) {
        if (now - sent.at < STUCK_MS) return
        // A model that has stopped answering is silence that sounds like a good road. It counts as missing, which
        // is spoken (see App.tsx).
        if (++unanswered >= STUCK_LIMIT) {
          setState('missing')
          return
        }
      }
      if (video.readyState < 2 || video.videoWidth === 0) return
      const w = video.videoWidth
      const h = video.videoHeight
      const crop = groundCrop(w, h)
      g.fillStyle = '#727272' // the grey the model was trained to ignore around a picture that is not square
      g.fillRect(0, 0, GROUND_INPUT, GROUND_INPUT)
      g.drawImage(
        video,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        crop.dx,
        crop.dy,
        crop.sw * crop.scale,
        crop.sh * crop.scale
      )
      const pixels = g.getImageData(0, 0, GROUND_INPUT, GROUND_INPUT).data.buffer
      sent = { id: nextId++, at: now, crop, w, h, pitchDown }
      const frame: GroundRequest = { type: 'frame', id: sent.id, pixels }
      worker.postMessage(frame, [pixels])
    }, GROUND_MS)

    return () => {
      gone = true
      clearInterval(id)
      void handle?.remove()
      onResultRef.current = null
      hazards.current = []
      draw(overlay, 0, 0, [])
    }
  }, [running, state, videoRef, canvasRef, langRef, hazards])

  return state
}

// A dashed outline, so it reads as a different kind of thing from the solid box around a person or a vehicle.
function draw(canvas: HTMLCanvasElement | null, w: number, h: number, found: GroundHazard[]) {
  if (!canvas) return
  if (w > 0 && canvas.width !== w) {
    canvas.width = w
    canvas.height = h
  }
  const g = canvas.getContext('2d')
  if (!g) return
  g.clearRect(0, 0, canvas.width, canvas.height)
  g.lineWidth = 5
  g.lineJoin = 'round'
  g.setLineDash([14, 10])
  g.strokeStyle = '#f2c230'
  for (const f of found) g.strokeRect(f.box.x, f.box.y, f.box.w, f.box.h)
}
