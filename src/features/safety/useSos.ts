import { Geolocation } from '@capacitor/geolocation'
import { useCallback, useEffect, useRef, useState } from 'react'

import { canCall, placeCall } from '../../native/calls'
import { sendSmsToAll } from '../../native/setup'
import { contactsWithMessages } from '../settings/settings'
import { announce, isSpeaking, phrase, speak, type Lang, type Phrase } from '../speech/speech'
import { beepSos, SOS_MS, startSiren, stopSiren } from './siren'
import { vibrate } from '../../native/vibrate.ts'

export type SosState = 'idle' | 'countdown' | 'sending' | 'calling' | 'answered' | 'noAnswer' | 'failed'
// A fall gets 15 s to say "I'm fine". Lying still gets 30 s: it is a weaker signal (a nap on a bench looks the same).
// Asking for help on purpose gets 10 s, counted after the prompt: time to get the phone out of a bag.
export type SosReason = 'fall' | 'lyingStill' | 'manual'
const COUNTDOWN_S: Record<SosReason, number> = { fall: 15, lyingStill: 30, manual: 10 }
const RESULT_SHOWN_MS = 60000 // the result screen closes itself, so the main screen is not left covered
// The alarm sounds until stopped. After this long it gives one round a minute: the battery has to last until
// someone comes.
const LOUD_MS = 600000
// Stopping the alarm takes three separate taps within this time. A phone lying screen-down on the road touches the
// ground once, and a bump is one more: it must not silence the one thing calling for help.
const TAPS_TO_STOP = 3
const TAPS_WINDOW_MS = 10000
const PROMPT = { fall: 'sosPrompt', lyingStill: 'stillPrompt', manual: 'helpPrompt' } as const
// Added after each contact's own message: what happened. The location follows it.
const WHAT_HAPPENED: Record<SosReason, string> = {
  fall: 'Second Sight: possible fall detected.',
  lyingStill: 'Second Sight: lying still for over 30 seconds.',
  manual: 'Second Sight: help button pressed.',
}
// Someone who missed the first ring may pick up the second time round.
const ROUNDS = 2
// A call that rings out lasts 30 to 45 s. Longer than that and the line is not coming free by itself.
const WAIT_FOR_LINE_MS = 45000
const CALLING: Phrase[] = ['calling1', 'calling2', 'calling3']
const pause = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Speak, count down with vibration pulses, then SMS every saved contact (their own message, what happened, a maps
// link), then phone them in order until one answers. If nobody could be reached, sound an alarm for the people nearby
// (`siren`: the setting), with `flash` (the torch) blinking along.
export function useSos(
  lang: Lang,
  sosNumbers: string[],
  sosMessages: string[],
  siren: boolean,
  flash?: (on: boolean) => void
) {
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
  const contacts = contactsWithMessages(sosNumbers, sosMessages)
  const contactsRef = useRef(contacts)
  const flashRef = useRef(flash)
  flashRef.current = flash
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
    // Everyone gets the message first, so whoever answers the call already knows what happened and where. All are
    // handed to the phone together, and each is counted only once the network has taken it: the wait is one
    // message long, not three, and "sent" is not said of a message that never left.
    const results = await sendSmsToAll(
      list.map(c => ({ to: c.number, text: `${c.message}\n${WHAT_HAPPENED[why]}\n${where}` }))
    )
    // Cancelled meanwhile: the messages have gone, nobody is called.
    if (!live()) return
    const sent = results.some(Boolean)
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
        const call = placeCall(list[i]?.number ?? '')
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
          vibrate(150)
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
  const tapsRef = useRef<number[]>([])
  const alarmDueRef = useRef(false)
  const cancel = useCallback(() => {
    if (alarmDueRef.current) {
      const now = performance.now()
      const taps = [...tapsRef.current.filter(t => now - t < TAPS_WINDOW_MS), now]
      tapsRef.current = taps
      if (taps.length < TAPS_TO_STOP) {
        announce(taps.length === TAPS_TO_STOP - 1 ? 'alarmOneMore' : 'alarmTwoMore', lang)
        return
      }
    }
    tapsRef.current = []
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

  // Nobody could be reached by phone, so the phone calls out to whoever is near. The result ("Nobody answered.") is
  // heard out first, then what the noise is and how to stop it, then the alarm. Tapping the screen, asking for help
  // again, or the screen closing by itself ends it.
  const [alarm, setAlarm] = useState(false)
  const unreached = state === 'noAnswer' || state === 'failed'
  alarmDueRef.current = unreached && siren
  useEffect(() => {
    if (!unreached || !siren) return
    let on = true
    const started = performance.now()
    void (async () => {
      while (on && isSpeaking()) await pause(300)
      if (!on) return
      await speak(phrase('alarmOn', langRef.current), langRef.current, true)
      if (!on || !startSiren()) return
      setAlarm(true)
      while (on) {
        for (let i = 0; i < 2 && on; i++) {
          beepSos(flashRef.current)
          await pause(SOS_MS)
        }
        // A beep brings people; words tell them what to do. English, then the user's own language for anyone
        // nearby who speaks it.
        if (on) await speak(phrase('bystander', 'en'), 'en', true)
        if (on && langRef.current !== 'en') await speak(phrase('bystander', langRef.current), langRef.current, true)
        if (on && performance.now() - started > LOUD_MS) await pause(60000)
      }
    })()
    return () => {
      on = false
      stopSiren()
      flashRef.current?.(false)
      setAlarm(false)
    }
  }, [unreached, siren])

  useEffect(() => {
    if (state !== 'answered' && state !== 'noAnswer' && state !== 'failed') return
    // The alarm is not timed out: it stops only when someone stops it.
    if (siren && state !== 'answered') return
    const id = window.setTimeout(() => setState('idle'), RESULT_SHOWN_MS)
    return () => clearTimeout(id)
  }, [state, siren])

  return {
    state,
    reason,
    secondsLeft,
    contact,
    total: contacts.length,
    family: contacts[0]?.number ?? null,
    messaged,
    alarm,
    alarmDue: unreached && siren,
    start,
    cancel,
  }
}
