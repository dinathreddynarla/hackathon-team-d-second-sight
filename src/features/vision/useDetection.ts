import type { Detection, ObjectDetector } from '@mediapipe/tasks-vision'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import { readText } from '../../native/setup'
import {
  describeSentence,
  EXTRA_CLASSES,
  pauseWarnings,
  setCurrentTarget,
  speak,
  warn,
  type ExtraClass,
  type Lang,
} from '../speech/speech'
import { createDetector, preferredDelegate } from './detector'
import { analyse, analyseAll, calibrateK, loadK, saveK, type Side, type Target } from './distance'
import type { GroundHazard } from './ground'

export type ModelState = 'loading' | 'ready' | 'missing'

// Runs the detector while the camera is live, draws boxes, speaks the nearest target. Every 100 ms while anything is
// in view; after 10 s of an empty view every 300 ms, which roughly halves the CPU (and battery) on a quiet street.
// The first detection brings the fast rate back, so the extra delay is at most 0.2 s for something new.
const FAST_MS = 100
const IDLE_MS = 300
const IDLE_AFTER_MS = 10000
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
      const target = analyse(detections, video.videoWidth, video.videoHeight, kRef.current, now)
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
    pauseWarnings(true)
    const text = await readText(frameJpeg(video))
    const sentence = describeSentence(targets, extras, text, langRef.current, ground?.current ?? [])
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
