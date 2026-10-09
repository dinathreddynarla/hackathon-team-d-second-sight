import type { Detection, ObjectDetector } from '@mediapipe/tasks-vision'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import { readText } from '../../native/setup'
import {
  describeSentence,
  EXTRA_CLASSES,
  isSpeaking,
  lightSentence,
  pauseWarnings,
  setCurrentTarget,
  speak,
  warn,
  type ExtraClass,
  type Lang,
} from '../speech/speech'
import { createDetector, preferredDelegate } from './detector'
import { analyse, analyseAll, calibrateK, loadK, saveK, type Side, type Target } from './distance'
import { wallNear } from '../obstacles/useObstacles'
import { createLightWatch, lightColour, type LightColour } from './trafficLight'
import type { GroundHazard } from './ground'

export type ModelState = 'loading' | 'ready' | 'missing'

// Runs the detector while the camera is live, draws boxes, speaks the nearest target. Every 100 ms while anything is
// in view; after 10 s of an empty view every 300 ms, which roughly halves the CPU (and battery) on a quiet street.
// The first detection brings the fast rate back, so the extra delay is at most 0.2 s for something new.
const FAST_MS = 100
const IDLE_MS = 300
const IDLE_AFTER_MS = 10000
// A traffic light's colour is read a few times a second: looks further apart are more independent of each other.
const LIGHT_EVERY_MS = 250
const LIGHT_FRESH_MS = 1500
export function useDetection(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  running: boolean,
  lang: Lang,
  // What the road-surface model has confirmed right now (see useGround), so scan-once can list it.
  ground?: RefObject<GroundHazard[]>
) {
  const detectorRef = useRef<ObjectDetector | null>(null)
  const kRef = useRef(loadK())
  const targetRef = useRef<Target | null>(null)
  const langRef = useRef(lang)
  langRef.current = lang
  const lastRatioRef = useRef(0)
  const lastDetectionsRef = useRef<Detection[]>([])
  const [model, setModel] = useState<ModelState>('loading')
  const [lastSaid, setLastSaid] = useState('')
  const [lane, setLane] = useState<Side | null>(null)
  const [fps, setFps] = useState(0)
  // The caption and lane stay up only while they are still true: until this time, then they clear.
  const shownRef = useRef(false)
  // For the alerts that watch the loop itself: when it last ran, and the most people seen in one frame since the
  // crowd alert last looked (it resets the count when it reads it).
  const lastTickAtRef = useRef(0)
  const peopleRef = useRef(0)
  const scannedAtRef = useRef(-Infinity)
  const showUntilRef = useRef(0)
  // The colour of the traffic light in view, once three looks have agreed on it, for "what is around me".
  const lightRef = useRef<{ colour: LightColour | null; at: number }>({ colour: null, at: -Infinity })

  useEffect(() => {
    let cancelled = false
    createDetector()
      .then(d => {
        if (cancelled) return
        detectorRef.current = d
        // ponytail: debug handle for chrome://inspect and the USB live-debug bridge
        window.__ss = { detector: d, delegate: preferredDelegate(), last: null }
        setModel('ready')
      })
      .catch(() => setModel('missing'))
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const detector = detectorRef.current
    if (!running || model !== 'ready' || !video || !canvas || !detector) return
    let frames = 0
    let fpsAt = performance.now()
    let lastTs = 0
    let lastSeenAt = performance.now()
    let timer = 0
    let lightLookAt = 0
    const lightWatch = createLightWatch()
    const loop = () => {
      tick()
      timer = window.setTimeout(loop, performance.now() - lastSeenAt > IDLE_AFTER_MS ? IDLE_MS : FAST_MS)
    }
    const tick = () => {
      if (video.readyState < 2 || video.videoWidth === 0) return
      const now = performance.now()
      if (now <= lastTs) return // MediaPipe needs strictly increasing timestamps
      lastTs = now
      const { detections } = detector.detectForVideo(video, now)
      lastTickAtRef.current = now
      if (detections.length) lastSeenAt = now
      lastDetectionsRef.current = detections
      const people = detections.filter(d => d.categories[0]?.categoryName === 'person').length
      if (people > peopleRef.current) peopleRef.current = people
      if (window.__ss)
        window.__ss.last = { n: detections.length, labels: detections.map(d => d.categories[0]?.categoryName ?? '?') }
      const target = analyse(detections, video.videoWidth, video.videoHeight, kRef.current, now, wallNear)
      targetRef.current = target
      setCurrentTarget(target ? `${target.label}:${target.side}` : null)
      if (window.__ss)
        window.__ss.chosen = target && {
          label: target.label,
          side: target.side,
          distance: +target.distance.toFixed(1),
          approaching: target.approaching,
        }
      lastRatioRef.current = target?.label === 'person' ? target.box.h / video.videoHeight : 0
      draw(canvas, video, target)
      if (target) {
        showUntilRef.current = Math.max(showUntilRef.current, now + 2000)
        const said = warn(target, langRef.current, now)
        if (said) {
          setLastSaid(said)
          setLane(target.side)
          shownRef.current = true
        }
      } else if (shownRef.current && now > showUntilRef.current) {
        setLastSaid('')
        setLane(null)
        shownRef.current = false
      }
      // A traffic light in view. Red is said, once sure of it and again each time the light comes back to red, in a
      // gap in the speech only, after the warning above has had its turn. Green is noted in silence and given only
      // when asked for: a "green" left as the last word after the light has changed would be heard as leave to walk.
      const light = now - lightLookAt >= LIGHT_EVERY_MS ? nearestLight(detections) : null
      if (light) {
        lightLookAt = now
        const colour = lightColour(boxPixels(video, light))
        if (window.__ss) window.__ss.light = colour
        const due = lightWatch.look(colour, now)
        lightRef.current = { colour: lightWatch.sure(now), at: now }
        if (due === 'green') lightWatch.spoken(due)
        else if (due && !isSpeaking()) {
          lightWatch.spoken(due)
          const text = lightSentence(due, langRef.current)
          // Cut off by a warning, it is still red and still worth knowing: said again in the next gap.
          void speak(text, langRef.current).then(heard => {
            if (!heard) lightWatch.unheard(due)
          })
          setLastSaid(text)
          setLane(null)
          shownRef.current = true
          showUntilRef.current = now + 4000
        }
      }
      frames++
      if (now - fpsAt > 1000) {
        setFps(Math.round((frames * 1000) / (now - fpsAt)))
        frames = 0
        fpsAt = now
      }
    }
    loop()
    return () => {
      clearTimeout(timer)
      lastDetectionsRef.current = []
      shownRef.current = false
      setLastSaid('')
      setLane(null)
      setFps(0)
    }
  }, [running, model, videoRef, canvasRef])

  const calibrate = () => {
    if (lastRatioRef.current === 0) return false
    kRef.current = calibrateK(lastRatioRef.current)
    saveK(kRef.current)
    return true
  }

  // "What is around me" (Scan button, volume-up twice, or the accessibility shortcut while watching): the warning
  // objects with where and how far, other recognisable things by name, then any printed text in view.
  const scan = useCallback(async () => {
    const video = videoRef.current
    // No loop means no detections to report: stay quiet rather than claim there is nothing around.
    if (!running || model !== 'ready' || !video || video.videoWidth === 0) return ''
    const detections = lastDetectionsRef.current
    const targets = analyseAll(detections, video.videoWidth, video.videoHeight, kRef.current)
    const extras = [
      ...new Set(
        detections
          .filter(d => (d.categories[0]?.score ?? 0) >= 0.5)
          .map(d => d.categories[0]?.categoryName as ExtraClass)
          .filter(name => (EXTRA_CLASSES as readonly string[]).includes(name))
      ),
    ]
    scannedAtRef.current = performance.now()
    const light = scannedAtRef.current - lightRef.current.at < LIGHT_FRESH_MS ? lightRef.current.colour : null
    pauseWarnings(true)
    const text = await readText(frameJpeg(video))
    const sentence = describeSentence(targets, extras, text, langRef.current, light, ground?.current ?? [])
    void speak(sentence, langRef.current, true).finally(() => pauseWarnings(false))
    setLastSaid(sentence)
    setLane(null)
    shownRef.current = true
    showUntilRef.current = performance.now() + 8000
    return sentence
  }, [videoRef, running, model, ground])

  // For a warning spoken from outside this loop (the road surface): put it on the caption and the lane strip.
  const show = useCallback((text: string, side: Side) => {
    setLastSaid(text)
    setLane(side)
    shownRef.current = true
    showUntilRef.current = Math.max(showUntilRef.current, performance.now() + 3000)
  }, [])

  return {
    targetRef,
    model,
    lastSaid,
    lane,
    fps,
    lastTickAt: lastTickAtRef,
    people: peopleRef,
    scannedAt: scannedAtRef,
    calibrate,
    scan,
    show,
    k: kRef.current,
  }
}

// The largest traffic light the detector is sure of: the nearest one, as far as a picture can tell.
type Box = NonNullable<Detection['boundingBox']>
function nearestLight(detections: Detection[]): Box | null {
  let best: Box | null = null
  for (const d of detections) {
    const c = d.categories[0]
    const box = d.boundingBox
    if (!box || c?.categoryName !== 'traffic light' || c.score < 0.5) continue
    if (!best || box.width * box.height > best.width * best.height) best = box
  }
  return best
}

// The pixels inside a box of the camera frame, shrunk to a thumbnail: enough to tell which lamp is lit.
const LIGHT_W = 24
const LIGHT_H = 48
let lightCanvas: HTMLCanvasElement | null = null
function boxPixels(video: HTMLVideoElement, box: Box): Uint8ClampedArray {
  if (!lightCanvas) {
    lightCanvas = document.createElement('canvas')
    lightCanvas.width = LIGHT_W
    lightCanvas.height = LIGHT_H
  }
  const g = lightCanvas.getContext('2d', { willReadFrequently: true })
  if (!g) return new Uint8ClampedArray(0)
  g.drawImage(video, box.originX, box.originY, box.width, box.height, 0, 0, LIGHT_W, LIGHT_H)
  return g.getImageData(0, 0, LIGHT_W, LIGHT_H).data
}

// The current camera frame as base64 JPEG (no data: prefix), for text reading.
function frameJpeg(video: HTMLVideoElement): string {
  const c = document.createElement('canvas')
  c.width = video.videoWidth
  c.height = video.videoHeight
  c.getContext('2d')?.drawImage(video, 0, 0)
  return c.toDataURL('image/jpeg', 0.9).split(',')[1] ?? ''
}

function draw(canvas: HTMLCanvasElement, video: HTMLVideoElement, target: Target | null) {
  if (canvas.width !== video.videoWidth) {
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
  }
  const g = canvas.getContext('2d')
  if (!g) return
  g.clearRect(0, 0, canvas.width, canvas.height)
  if (!target) return
  // The outline only. What it is and how far is on the lane strip and the caption, where it cannot be cut off.
  g.lineWidth = 5
  g.lineJoin = 'round'
  g.strokeStyle = '#f2c230'
  g.strokeRect(target.box.x, target.box.y, target.box.w, target.box.h)
}
