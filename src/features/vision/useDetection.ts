import type { Detection, ObjectDetector } from '@mediapipe/tasks-vision'
import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

import { pauseWarnings, scanSentence, setCurrentTarget, speak, warn, type Lang } from '../speech/speech'
import { createDetector, preferredDelegate } from './detector'
import { analyse, analyseAll, calibrateK, loadK, saveK, type Target } from './distance'

export type ModelState = 'loading' | 'ready' | 'missing'

// Runs the detector every 100 ms while the camera is live, draws boxes, speaks the nearest target.
export function useDetection(
  videoRef: RefObject<HTMLVideoElement | null>,
  canvasRef: RefObject<HTMLCanvasElement | null>,
  running: boolean,
  lang: Lang
) {
  const detectorRef = useRef<ObjectDetector | null>(null)
  const kRef = useRef(loadK())
  const langRef = useRef(lang)
  langRef.current = lang
  const lastRatioRef = useRef(0)
  const lastDetectionsRef = useRef<Detection[]>([])
  const [model, setModel] = useState<ModelState>('loading')
  const [lastSaid, setLastSaid] = useState('')
  const [fps, setFps] = useState(0)

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
    const tick = () => {
      if (video.readyState < 2 || video.videoWidth === 0) return
      const now = performance.now()
      if (now <= lastTs) return // MediaPipe needs strictly increasing timestamps
      lastTs = now
      const { detections } = detector.detectForVideo(video, now)
      lastDetectionsRef.current = detections
      if (window.__ss)
        window.__ss.last = { n: detections.length, labels: detections.map(d => d.categories[0]?.categoryName ?? '?') }
      const target = analyse(detections, video.videoWidth, video.videoHeight, kRef.current, now)
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
        const said = warn(target, langRef.current, now)
        if (said) setLastSaid(said)
      }
      frames++
      if (now - fpsAt > 1000) {
        setFps(Math.round((frames * 1000) / (now - fpsAt)))
        frames = 0
        fpsAt = now
      }
    }
    const id = setInterval(tick, 100)
    return () => {
      clearInterval(id)
      lastDetectionsRef.current = []
    }
  }, [running, model, videoRef, canvasRef])

  const calibrate = () => {
    if (lastRatioRef.current === 0) return false
    kRef.current = calibrateK(lastRatioRef.current)
    saveK(kRef.current)
    return true
  }

  // "Scan once": one sentence for everything in the current frame, on demand.
  const scan = useCallback(() => {
    const video = videoRef.current
    // No loop means no detections to report: stay quiet rather than claim there is nothing around.
    if (!running || model !== 'ready' || !video || video.videoWidth === 0) return ''
    const targets = analyseAll(lastDetectionsRef.current, video.videoWidth, video.videoHeight, kRef.current)
    const text = scanSentence(targets, langRef.current)
    pauseWarnings(true)
    void speak(text, langRef.current).finally(() => pauseWarnings(false))
    setLastSaid(text)
    return text
  }, [videoRef, running, model])

  return { model, lastSaid, fps, calibrate, scan, k: kRef.current }
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
  g.lineWidth = 4
  g.strokeStyle = '#f2c230'
  g.strokeRect(target.box.x, target.box.y, target.box.w, target.box.h)
  g.fillStyle = '#f2c230'
  g.font = 'bold 22px system-ui'
  g.fillText(`${target.label} ${target.distance.toFixed(1)} m`, target.box.x + 6, Math.max(26, target.box.y - 8))
}
