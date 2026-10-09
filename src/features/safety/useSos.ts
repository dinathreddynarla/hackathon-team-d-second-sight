import { Geolocation } from '@capacitor/geolocation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { callNumber, sendSms } from '../../native/setup'
import { announce, phrase, speak, stopSpeaking, type Lang } from '../speech/speech'

export type SosState = 'idle' | 'countdown' | 'sending' | 'sent' | 'failed'
// A fall gets 15 s to say "I'm fine". Lying still gets 30 s: it is a weaker signal (a nap on a bench looks the same).
// Asking for help on purpose gets 10 s, counted after the prompt: time to get the phone out of a bag.
export type SosReason = 'fall' | 'lyingStill' | 'manual'
const COUNTDOWN_S: Record<SosReason, number> = { fall: 15, lyingStill: 30, manual: 10 }
const CALL_OFFER_MS = 60000 // the call screen closes itself, so a later brush cannot call the contact
const PROMPT = { fall: 'sosPrompt', lyingStill: 'stillPrompt', manual: 'helpPrompt' } as const
const MESSAGE: Record<SosReason, string> = {
  fall: 'Second Sight: possible fall detected. I may need help.',
  lyingStill: 'Second Sight: I have been lying still for over 30 seconds. I may need help.',
  manual: 'Second Sight: I need help.',
}

// Speak, count down with vibration pulses, then SMS the saved contact with a maps link, then offer a call.
export function useSos(lang: Lang, sosNumber: string) {
  const [state, setState] = useState<SosState>('idle')
  const [reason, setReason] = useState<SosReason>('fall')
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_S.fall)
  const timerRef = useRef<number | null>(null)
  const tokenRef = useRef(0)

  const clear = () => {
    if (timerRef.current !== null) clearInterval(timerRef.current)
    timerRef.current = null
  }

  const send = useCallback(
    async (why: SosReason) => {
      setState('sending')
      if (!sosNumber) {
        announce('noSosNumber', lang)
        setState('failed')
        return
      }
      let where = 'location unknown'
      try {
        // A fix from the last 5 minutes is good enough and instant; GPS is not kept running between alerts.
        const pos = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 300000,
        })
        where = `https://maps.google.com/?q=${pos.coords.latitude.toFixed(5)},${pos.coords.longitude.toFixed(5)}`
      } catch {
        /* no fix: send without it */
      }
      const ok = await sendSms(sosNumber, `${MESSAGE[why]} ${where}`)
      // One sentence, so the call offer cannot be dropped behind the result.
      void speak(`${phrase(ok ? 'sosSent' : 'sosFailed', lang)} ${phrase('callOffer', lang)}`, lang, true)
      setState(ok ? 'sent' : 'failed')
    },
    [lang, sosNumber]
  )

  const start = useCallback(
    (why: SosReason = 'fall') => {
      if (state !== 'idle') return
      setReason(why)
      setState('countdown')
      setSecondsLeft(COUNTDOWN_S[why])
      const token = ++tokenRef.current
      let left = COUNTDOWN_S[why]
      // The seconds start once the question has been asked, so the prompt never eats the time to answer it.
      void speak(phrase(PROMPT[why], lang), lang, true).then(() => {
        if (token !== tokenRef.current) return // cancelled while it was speaking
        timerRef.current = window.setInterval(() => {
          left--
          setSecondsLeft(left)
          navigator.vibrate?.(150)
          if (left <= 0) {
            clear()
            void send(why)
          }
        }, 1000)
      })
    },
    [state, lang, send]
  )

  // After the message (sent or not), the whole alert screen calls the contact.
  const call = useCallback(() => {
    void stopSpeaking() // the call offer should not keep talking over the dialler
    if (sosNumber) void callNumber(sosNumber)
    setState('idle')
  }, [sosNumber])

  const cancel = useCallback(() => {
    tokenRef.current++
    clear()
    if (state === 'countdown') announce('sosCancelled', lang)
    setState('idle')
  }, [state, lang])

  useEffect(() => clear, [])

  useEffect(() => {
    if (state !== 'sent' && state !== 'failed') return
    const id = window.setTimeout(() => setState('idle'), CALL_OFFER_MS)
    return () => clearTimeout(id)
  }, [state])

  return { state, reason, secondsLeft, start, cancel, call, canCall: Boolean(sosNumber) }
}
