import { useEffect, useRef, type RefObject } from 'react'

import { isSpeaking, phrase, speak, type Lang, type Phrase } from '../speech/speech'

// Worth knowing, but not hazards: a crowd ahead, and detection that has fallen behind. Unlike a warning these wait
// for a gap in the speech instead of cutting in, and a warning may cut them off. They count as said only once they
// have been heard: 'noGap' is tried again at the next check, 'cut' a few seconds later.
type Said = 'heard' | 'cut' | 'noGap'
const RETRY_MS = 5000
async function sayInAGap(key: Phrase, lang: Lang): Promise<Said> {
  if (isSpeaking()) return 'noGap'
  return (await speak(phrase(key, lang), lang)) ? 'heard' : 'cut'
}

// ponytail: starting values, not tuned on a street.
const CHECK_MS = 1000
const CROWD_PEOPLE = 4 // this many people in one frame is a crowd; the detector misses far and overlapping ones
const CROWD_HOLD = 3 // checks in a row (seconds) before it is believed
const CROWD_GONE = 10 // checks in a row without one before it can be said again
const CROWD_GAP_MS = 60000 // and never more often than this
const AFTER_SCAN_MS = 15000 // a scan has just listed everyone in view: that counts as having said it

// "Crowd ahead": the detector already finds people, so this is a count, not a new model. It never says a number,
// because in a dense crowd it undercounts. Said once per crowd, not for as long as it lasts.
export function useCrowdAlerts(
  people: RefObject<number>,
  scannedAt: RefObject<number>,
  active: boolean,
  langRef: RefObject<Lang>
) {
  useEffect(() => {
    if (!active) return
    people.current = 0
    let crowded = 0
    let gone = 0
    let armed = true
    let saying = false
    let notBefore = -Infinity
    const id = window.setInterval(() => {
      const seen = people.current
      people.current = 0
      if (seen >= CROWD_PEOPLE) {
        crowded++
        gone = 0
      } else {
        gone++
        crowded = 0
        if (gone >= CROWD_GONE) armed = true
      }
      if (crowded < CROWD_HOLD || !armed || saying || performance.now() < notBefore) return
      if (performance.now() - scannedAt.current < AFTER_SCAN_MS) {
        armed = false
        notBefore = performance.now() + CROWD_GAP_MS
        return
      }
      saying = true
      void sayInAGap('crowded', langRef.current).then(said => {
        saying = false
        if (said === 'heard') armed = false
        if (said !== 'noGap') notBefore = performance.now() + (said === 'heard' ? CROWD_GAP_MS : RETRY_MS)
      })
    }, CHECK_MS)
    return () => clearInterval(id)
  }, [people, scannedAt, active, langRef])
}

const SLOW_FPS = 2 // below this the warnings arrive late
const STALLED_MS = 3000 // no detection at all for this long
const SLOW_HOLD = 5 // checks in a row (seconds) before it is believed
const SLOW_REPEAT_MS = 30000
const SETTLE_MS = 4000

// Detection that has fallen behind, or stopped, is silence that sounds like a clear path. Said once it has lasted
// 5 s, and every 30 s while it does.
export function useDetectionSpeedAlerts(
  fps: number,
  lastTickAt: RefObject<number>,
  active: boolean,
  langRef: RefObject<Lang>
) {
  const fpsRef = useRef(fps)
  fpsRef.current = fps
  useEffect(() => {
    if (!active) return
    const startedAt = performance.now()
    let slow = 0
    let saying = false
    let notBefore = -Infinity
    const id = window.setInterval(() => {
      const now = performance.now()
      // The first seconds after Start are the camera adjusting and the loop warming up, not a fault.
      if (now - startedAt < SETTLE_MS) return
      const stalled = now - Math.max(lastTickAt.current, startedAt) > STALLED_MS
      slow = stalled || fpsRef.current < SLOW_FPS ? slow + 1 : 0
      if (slow < SLOW_HOLD || saying || now < notBefore) return
      saying = true
      void sayInAGap('detectionSlow', langRef.current).then(said => {
        saying = false
        if (said !== 'noGap') notBefore = performance.now() + (said === 'heard' ? SLOW_REPEAT_MS : RETRY_MS)
      })
    }, CHECK_MS)
    return () => clearInterval(id)
  }, [lastTickAt, active, langRef])
}
