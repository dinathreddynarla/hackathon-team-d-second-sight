import { Geolocation } from '@capacitor/geolocation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { canCall, placeCall } from '../../native/calls'
import { sendSms } from '../../native/setup'
import { contactsOf } from '../settings/settings'
import { announce, phrase, speak, type Lang, type Phrase } from '../speech/speech'

export type SosState = 'idle' | 'countdown' | 'sending' | 'calling' | 'answered' | 'noAnswer' | 'failed'
// A fall gets 15 s to say "I'm fine". Lying still gets 30 s: it is a weaker signal (a nap on a bench looks the same).
// Asking for help on purpose gets 10 s, counted after the prompt: time to get the phone out of a bag.
export type SosReason = 'fall' | 'lyingStill' | 'manual'
const COUNTDOWN_S: Record<SosReason, number> = { fall: 15, lyingStill: 30, manual: 10 }
const RESULT_SHOWN_MS = 60000 // the result screen closes itself, so the main screen is not left covered
const PROMPT = { fall: 'sosPrompt', lyingStill: 'stillPrompt', manual: 'helpPrompt' } as const
const MESSAGE: Record<SosReason, string> = {
  fall: 'Second Sight: possible fall detected. I may need help.',
  lyingStill: 'Second Sight: I have been lying still for over 30 seconds. I may need help.',
  manual: 'Second Sight: I need help.',
}
// Someone who missed the first ring may pick up the second time round.
const ROUNDS = 2
// A call that rings out lasts 30 to 45 s. Longer than that and the line is not coming free by itself.
const WAIT_FOR_LINE_MS = 45000
const CALLING: Phrase[] = ['calling1', 'calling2', 'calling3']
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Speak, count down with vibration pulses, then SMS every saved contact with a maps link, then phone them in order
// until one answers.
export function useSos(lang: Lang, sosNumbers: string[]) {
  const [state, setState] = useState<SosState>('idle')
  const [reason, setReason] = useState<SosReason>('fall')
  const [secondsLeft, setSecondsLeft] = useState(COUNTDOWN_S.fall)
  const [contact, setContact] = useState(1)
  // Whether the message went out, once that is known: shown beside the result of the calls.
  const [messaged, setMessaged] = useState<boolean | null>(null)
  const timerRef = useRef<number | null>(null)
  // Bumped whenever a run starts or is cancelled: whatever an earlier run was waiting on, it stops there.
  const runRef = useRef(0)
  // The call on the line right now, if any. Stopping cannot hang it up, and the phone can only hold one call, so a
  // new run waits for it instead of having its first call refused.
  const onTheLineRef = useRef<Promise<unknown> | null>(null)
  const lineBusyRef = useRef(false)
  const langRef = useRef(lang)
  langRef.current = lang
  const contacts = contactsOf(sosNumbers)
  const contactsRef = useRef(contacts)
  contactsRef.current = contacts

  const clear = () => {
    if (timerRef.current !== null) clearInterval(timerRef.current)
    timerRef.current = null
  }

  const alertContacts = useCallback(async (why: SosReason) => {
    const run = ++runRef.current
    const live = () => run === runRef.current
    // Waited for: the phone's call screen, or the next sentence, would cut it short.
    const say = (key: Phrase) => speak(phrase(key, langRef.current), langRef.current, true)
    const list = contactsRef.current
    if (list.length === 0) {
      void say('noSosNumber')
      setState('failed')
      return
    }

    setState('sending')
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
    if (!live()) return
    // Everyone gets the message first, so whoever answers the call already knows what happened and where.
    let sent = false
    for (const to of list) {
      sent = (await sendSms(to, `${MESSAGE[why]} ${where}`)) || sent
      // Cancelled part-way: the text already handed to the phone has gone, the rest are not sent.
      if (!live()) return
    }
    setMessaged(sent)
    // The message is out (or has failed), so the screen moves on to the calls before that is spoken: "tap to
    // cancel, nobody will be messaged" must not stay up a moment longer than it is true.
    const phone = canCall()
    if (phone) {
      setContact(1)
      setState('calling')
    }
    await say(sent ? 'sosSent' : 'sosFailed')
    if (!live()) return
    if (!phone) {
      void say('callFailed')
      setState('failed')
      return
    }
    let anyStarted = false
    for (let round = 0; round < ROUNDS; round++) {
      for (let i = 0; i < list.length; i++) {
        if (lineBusyRef.current) {
          await say('waitingForCall')
          await Promise.race([onTheLineRef.current, pause(WAIT_FOR_LINE_MS)])
          if (!live()) return
        }
        setContact(i + 1)
        await say(CALLING[i] ?? 'calling1')
        if (!live()) return
        const call = placeCall(list[i] ?? '')
        onTheLineRef.current = call
        lineBusyRef.current = true
        // Only the newest call frees the line: an older one that ends late must not.
        void call.finally(() => {
          if (onTheLineRef.current === call) lineBusyRef.current = false
        })
        const result = await call
        if (!live()) return
        if (result.answered) {
          void say('callEnded')
          setState('answered')
          return
        }
        // A call that could not even start (a bad number) is skipped; the next contact may still be reachable.
        if (result.started) {
          anyStarted = true
          await say('noAnswer')
          if (!live()) return
        }
      }
    }
    void say(anyStarted ? 'nobodyAnswered' : 'callFailed')
    setState(anyStarted ? 'noAnswer' : 'failed')
  }, [])

  const start = useCallback(
    (why: SosReason = 'fall') => {
      // Not while one is under way. From a result screen it starts again at once: someone whose calls went
      // unanswered must not have to find and tap the screen first.
      if (state === 'countdown' || state === 'sending' || state === 'calling') return
      setReason(why)
      setState('countdown')
      setMessaged(null)
      setSecondsLeft(COUNTDOWN_S[why])
      const run = ++runRef.current
      let left = COUNTDOWN_S[why]
      // The seconds start once the question has been asked, so the prompt never eats the time to answer it.
      void speak(phrase(PROMPT[why], lang), lang, true).then(() => {
        if (run !== runRef.current) return // cancelled while it was speaking
        timerRef.current = window.setInterval(() => {
          left--
          setSecondsLeft(left)
          navigator.vibrate?.(150)
          if (left <= 0) {
            clear()
            void alertContacts(why)
          }
        }, 1000)
      })
    },
    [state, lang, alertContacts]
  )

  // The same control cancels the countdown, stops the message or the calling, and dismisses the result.
  // A call already on the line is not hung up: the phone's own end-call button does that.
  const cancel = useCallback(() => {
    runRef.current++
    clear()
    if (state === 'countdown' || state === 'sending') announce('sosCancelled', lang)
    else if (state === 'calling') announce('callingStopped', lang)
    setState('idle')
  }, [state, lang])

  useEffect(
    () => () => {
      clear()
      runRef.current++
    },
    []
  )

  useEffect(() => {
    if (state !== 'answered' && state !== 'noAnswer' && state !== 'failed') return
    const id = window.setTimeout(() => setState('idle'), RESULT_SHOWN_MS)
    return () => clearTimeout(id)
  }, [state])

  return { state, reason, secondsLeft, contact, total: contacts.length, messaged, start, cancel }
}
