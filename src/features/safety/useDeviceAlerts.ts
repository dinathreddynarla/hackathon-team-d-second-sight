import { useEffect, useRef, type RefObject } from 'react'

import { announce, isSpeaking, phrase, speak, type Lang } from '../speech/speech'

// The user cannot see a dead battery icon or a finger over the lens, so both are spoken.

type BatteryManager = EventTarget & { level: number; charging: boolean }
type NavigatorWithBattery = Navigator & { getBattery?: () => Promise<BatteryManager> }

// Spoken once each per discharge, at 20% and 10%; plugging in re-arms them. While `hold` is true (the fall or help
// alert is up) nothing is said, so the alert's own sentences are not talked over; it is said once the alert is over.
export function useBatteryAlerts(langRef: RefObject<Lang>, hold: boolean) {
  const holdRef = useRef(hold)
  holdRef.current = hold
  const checkRef = useRef<() => void>(() => undefined)
  useEffect(() => {
    const getBattery = (navigator as NavigatorWithBattery).getBattery
    if (!getBattery) return
    let battery: BatteryManager | null = null
    let gone = false
    let warned = 1 // highest level already warned about; 1 = none
    const check = () => {
      if (!battery) return
      if (battery.charging) {
        warned = 1
        return
      }
      if (holdRef.current) return
      // The real level, never the threshold: starting the app at 5% must not say "10 percent".
      const pct = String(Math.round(battery.level * 100))
      const say = (key: 'batteryLow' | 'batteryCritical', level: number) => {
        const before = warned
        warned = level
        void speak(phrase(key, langRef.current).replace('{n}', pct), langRef.current, true).then(heard => {
          // Cut off before it was heard: not done. It is said at the next change in the level, or after the alert.
          if (!heard && warned === level) warned = before
        })
      }
      if (battery.level <= 0.1 && warned > 0.1) say('batteryCritical', 0.1)
      else if (battery.level <= 0.2 && warned > 0.2) say('batteryLow', 0.2)
    }
    checkRef.current = check
    getBattery
      .call(navigator)
      .then(b => {
        // Cleaned up before the battery arrived (React's development double-mount does this): a second set of
        // listeners would say every level twice.
        if (gone) return
        battery = b
        b.addEventListener('levelchange', check)
        b.addEventListener('chargingchange', check)
        check()
      })
      .catch(() => undefined)
    return () => {
      gone = true
      checkRef.current = () => undefined
      battery?.removeEventListener('levelchange', check)
      battery?.removeEventListener('chargingchange', check)
    }
  }, [langRef])
  useEffect(() => {
    if (hold) return
    // The alert's last word ("Cancelled.", "Calls finished.") is heard out first.
    const id = window.setInterval(() => {
      if (isSpeaking()) return
      clearInterval(id)
      checkRef.current()
    }, 300)
    return () => clearInterval(id)
  }, [hold])
}

export type ViewState = 'clear' | 'blocked' | 'dark' | 'unclear'

// Mean brightness and contrast of a 32x24 thumbnail. A finger or pocket gives a flat image; night gives a dark one.
// ponytail: fixed thresholds from office footage; tune on a real street at dusk, make them settings if needed.
const FLAT_STD = 8
const DARK_MEAN = 35
// Heavy rain, smoke, fog or a wet lens wash the picture out: bright enough, but with little contrast left. The app
// cannot tell which of them it is (or a pale wall).
const HAZY_STD = 18
const HAZY_MEAN = 90
export function classifyView(pixels: Uint8ClampedArray): ViewState {
  let sum = 0
  let sumSq = 0
  const n = pixels.length / 4
  for (let i = 0; i < pixels.length; i += 4) {
    const y = 0.299 * (pixels[i] ?? 0) + 0.587 * (pixels[i + 1] ?? 0) + 0.114 * (pixels[i + 2] ?? 0)
    sum += y
    sumSq += y * y
  }
  const mean = sum / n
  const std = Math.sqrt(Math.max(0, sumSq / n - mean * mean))
  // A dark frame is "too dark or covered": a pocket and a night lane look the same, and both make warnings unreliable.
  if (mean < DARK_MEAN) return 'dark'
  if (std < FLAT_STD) return 'blocked'
  if (std < HAZY_STD && mean > HAZY_MEAN) return 'unclear'
  return 'clear'
}

const CHECK_MS = 2000
// A blocked lens is fixable, so it is repeated every 30 s. A dark street is not, so every 2.5 minutes.
const REPEAT_MS: Record<'blocked' | 'dark', number> = { blocked: 30000, dark: 150000 }
// "Warnings may be missed" must not itself be missed: cut off by a warning, it is said again after this long.
const RETRY_MS = 5000

// While the camera runs: a problem must hold for two checks (4 s) before it is spoken, is repeated every 30 s
// (blocked) or 2.5 minutes (dark) while it lasts, and its end is spoken once.
export function useCameraViewAlerts(
  videoRef: RefObject<HTMLVideoElement | null>,
  running: boolean,
  langRef: RefObject<Lang>
) {
  useEffect(() => {
    if (!running) return
    const canvas = document.createElement('canvas')
    canvas.width = 32
    canvas.height = 24
    const g = canvas.getContext('2d', { willReadFrequently: true })
    let last: ViewState = 'clear'
    let streak = 0
    let spoken: 'clear' | 'blocked' | 'dark' = 'clear'
    let spokenAt = 0
    const id = window.setInterval(() => {
      const video = videoRef.current
      if (!g || !video || video.readyState < 2) return
      g.drawImage(video, 0, 0, canvas.width, canvas.height)
      const seen = classifyView(g.getImageData(0, 0, canvas.width, canvas.height).data)
      // A washed-out view is spoken like a dark one: "Camera can't see" is true of both, and "unclear" would sound
      // too much like "clear". While "blocked" is the last thing said it counts as that still going on, so a view
      // hovering between the two is not announced back and forth.
      const state = seen !== 'unclear' ? seen : spoken === 'blocked' ? 'blocked' : 'dark'
      streak = state === last ? streak + 1 : 1
      last = state
      const now = performance.now()
      if (state === 'clear') {
        if (spoken !== 'clear' && streak >= 2) {
          spoken = 'clear'
          announce('cameraClear', langRef.current)
        }
        return
      }
      if (streak < 2) return
      if (state !== spoken || now - spokenAt > REPEAT_MS[state]) {
        spoken = state
        spokenAt = now
        const text = phrase(state === 'blocked' ? 'cameraBlocked' : 'tooDark', langRef.current)
        void speak(text, langRef.current, true).then(heard => {
          if (!heard && spoken === state) spokenAt = performance.now() - REPEAT_MS[state] + RETRY_MS
        })
      }
    }, CHECK_MS)
    return () => clearInterval(id)
  }, [videoRef, running, langRef])
}
