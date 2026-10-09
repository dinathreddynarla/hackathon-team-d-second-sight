import { Geolocation } from '@capacitor/geolocation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { sendSms } from '../../native/setup'
import { phrase, speak, type Lang } from '../speech/speech'

export type SosState = 'idle' | 'countdown' | 'sending' | 'sent' | 'failed'
const COUNTDOWN_S = 15

// After a suspected fall: speak, count down with vibration pulses, then SMS the saved contact with a maps link.
export function useSos(lang: Lang, sosNumber: string) {
  const [state, setState] = useState<SosState>('idle')
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_S)
  const timerRef = useRef<number | null>(null)

  const clear = () => {
    if (timerRef.current !== null) clearInterval(timerRef.current)
    timerRef.current = null
  }

  const send = useCallback(async () => {
    setState('sending')
    if (!sosNumber) {
      void speak(phrase('noSosNumber', lang), lang)
      setState('failed')
      return
    }
    let where = 'location unknown'
    try {
      const pos = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 15000 })
      where = `https://maps.google.com/?q=${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`
    } catch {
      /* no fix: send without it */
    }
    const ok = await sendSms(sosNumber, `Second Sight: possible fall detected. I may need help. ${where}`)
    void speak(phrase(ok ? 'sosSent' : 'sosFailed', lang), lang)
    setState(ok ? 'sent' : 'failed')
  }, [lang, sosNumber])

  const start = useCallback(() => {
    if (state !== 'idle') return
    setState('countdown')
    setSecondsLeft(COUNTDOWN_S)
    void speak(phrase('sosPrompt', lang), lang)
    let left = COUNTDOWN_S
    timerRef.current = window.setInterval(() => {
      left--
      setSecondsLeft(left)
      navigator.vibrate?.(150)
      if (left <= 0) {
        clear()
        void send()
      }
    }, 1000)
  }, [state, lang, send])

  const cancel = useCallback(() => {
    clear()
    if (state === 'countdown') void speak(phrase('sosCancelled', lang), lang)
    setState('idle')
  }, [state, lang])

  useEffect(() => clear, [])

  return { state, secondsLeft, start, cancel }
}
