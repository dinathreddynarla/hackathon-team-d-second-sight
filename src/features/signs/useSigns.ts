import { useEffect, useRef, type RefObject } from 'react'

import { isSpeaking, speak, type Lang } from '../speech/speech'
import { signKey, signSentence } from './signs'
import type { SignHit } from './signWorker'

const EVERY_MS = 1000 // signs do not move; once a second is plenty and keeps the CPU for the hazard loop
const CONFIRM_RUNS = 2 // seen in two consecutive frames before it is spoken
const REPEAT_MS = 30000 // the same sign is not repeated for 30 s

// Reads Indian road signs while watching: "Sign: stop", "Sign: speed limit 40". Never talks over a warning.
export function useSigns(videoRef: RefObject<HTMLVideoElement | null>, running: boolean, lang: Lang) {
  const langRef = useRef(lang)
  langRef.current = lang

  useEffect(() => {
    if (!running) return
    const worker = new Worker(new URL('./signWorker.ts', import.meta.url), { type: 'module' })
    const base = document.baseURI
    worker.postMessage({
      type: 'init',
      model: new URL('./models/signs-416-int8.onnx', base).href,
      wasm: new URL('./vendor/ort/', base).href,
    })
    let busy = true // until the model has loaded
    let run = 0
    const streak = new Map<string, { run: number; n: number }>()
    const spokenAt = new Map<string, number>()

    worker.onmessage = (e: MessageEvent) => {
      const msg = e.data
      if (msg.type === 'ready') busy = false
      if (msg.type === 'error') {
        busy = true // stop asking; the hazard warnings carry on without signs
        console.warn('road signs off:', msg.message)
      }
      if (msg.type !== 'result') return
      busy = false
      run++
      const hits = msg.hits as SignHit[]
      if (window.__ss)
        window.__ss.signs = { ms: msg.ms, hits: hits.map(h => ({ key: signKey(h.cls), score: +h.score.toFixed(2) })) }
      const now = performance.now()
      for (const h of hits) {
        const key = signKey(h.cls)
        if (!key) continue
        const s = streak.get(key)
        const n = s && s.run === run - 1 ? s.n + 1 : 1
        streak.set(key, { run, n })
        if (n < CONFIRM_RUNS || now - (spokenAt.get(key) ?? -Infinity) < REPEAT_MS || isSpeaking()) continue
        spokenAt.set(key, now)
        void speak(signSentence(key, langRef.current), langRef.current)
        break // one sign per second at most
      }
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
  }, [running, videoRef])
}
