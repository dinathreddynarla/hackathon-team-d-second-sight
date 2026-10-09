import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { Capacitor } from '@capacitor/core'

import type { TargetClass } from '../vision/detector'
import type { Side, Target } from '../vision/distance'

export type Lang = 'en' | 'te'
export type Range = 'oneStep' | 'twoSteps' | 'close' | 'metres' | 'far'
export type Phrase =
  | 'ready'
  | 'stopped'
  | 'nothingAround'
  | 'calibrated'
  | 'noPerson'
  | 'setupIntro'
  | 'voicesInstalled'
  | 'voiceTest'
  | 'setupDone'
  | 'sosPrompt'
  | 'sosSent'
  | 'sosFailed'
  | 'sosCancelled'
  | 'noSosNumber'

type Words = {
  tag: string
  label: Record<TargetClass, string>
  plural: Record<TargetClass, string>
  side: Record<Side, string>
  range: Record<Range, string>
  metres: (n: number) => string
  andMore: (n: number) => string
  guide: { left: string; right: string; stop: string }
  approaching: string
  phrase: Record<Phrase, string>
}

const WORDS: Record<Lang, Words> = {
  en: {
    tag: 'en-IN',
    label: {
      person: 'person',
      car: 'car',
      motorcycle: 'motorcycle',
      bicycle: 'bicycle',
      bus: 'bus',
      truck: 'truck',
      dog: 'dog',
      cow: 'cow',
    },
    plural: {
      person: 'people',
      car: 'cars',
      motorcycle: 'motorcycles',
      bicycle: 'bicycles',
      bus: 'buses',
      truck: 'trucks',
      dog: 'dogs',
      cow: 'cows',
    },
    side: { left: 'left', ahead: 'ahead', right: 'right' },
    range: { oneStep: 'one step', twoSteps: 'two steps', close: 'close', metres: '', far: 'far' },
    metres: n => `${n} metres`,
    andMore: n => `and ${n} more`,
    guide: { left: 'move left', right: 'move right', stop: 'stop' },
    approaching: 'coming',
    phrase: {
      ready: 'Second Sight ready',
      stopped: 'stopped',
      nothingAround: 'nothing detected around you',
      calibrated: 'calibrated',
      noPerson: 'no person in view',
      setupIntro: 'One time setup. Tap install voices, then choose English India and Telugu.',
      voicesInstalled: 'Now tap test voice.',
      voiceTest: 'The voice works. Setup done.',
      setupDone: 'Setup done. No internet is needed from now on.',
      sosPrompt: 'Are you okay? Tap the screen to cancel, or help will be messaged in 15 seconds.',
      sosSent: 'Help message sent with your location.',
      sosFailed: 'Could not send the help message.',
      sosCancelled: 'Cancelled.',
      noSosNumber: 'No emergency number saved. Add one in settings.',
    },
  },
  te: {
    tag: 'te-IN',
    label: {
      person: 'వ్యక్తి',
      car: 'కారు',
      motorcycle: 'బైక్',
      bicycle: 'సైకిల్',
      bus: 'బస్సు',
      truck: 'లారీ',
      dog: 'కుక్క',
      cow: 'ఆవు',
    },
    plural: {
      person: 'మంది',
      car: 'కార్లు',
      motorcycle: 'బైక్‌లు',
      bicycle: 'సైకిళ్ళు',
      bus: 'బస్సులు',
      truck: 'లారీలు',
      dog: 'కుక్కలు',
      cow: 'ఆవులు',
    },
    side: { left: 'ఎడమవైపు', ahead: 'ముందు', right: 'కుడివైపు' },
    range: { oneStep: 'ఒక అడుగు', twoSteps: 'రెండు అడుగులు', close: 'దగ్గరగా', metres: '', far: 'దూరంగా' },
    metres: n => `${n} మీటర్లు`,
    andMore: n => `ఇంకా ${n}`,
    guide: { left: 'ఎడమకు జరగండి', right: 'కుడికి జరగండి', stop: 'ఆగండి' },
    approaching: 'వస్తోంది',
    phrase: {
      ready: 'సెకండ్ సైట్ సిద్ధం',
      stopped: 'ఆగింది',
      nothingAround: 'చుట్టూ ఏమీ లేదు',
      calibrated: 'కాలిబ్రేట్ అయింది',
      noPerson: 'ఎవరూ కనిపించడం లేదు',
      setupIntro: 'ఒకసారి సెటప్. ఇన్‌స్టాల్ వాయిసెస్ నొక్కి, ఇంగ్లీష్ ఇండియా మరియు తెలుగు ఎంచుకోండి.',
      voicesInstalled: 'ఇప్పుడు టెస్ట్ వాయిస్ నొక్కండి.',
      voiceTest: 'వాయిస్ పనిచేస్తోంది. సెటప్ పూర్తయింది.',
      setupDone: 'సెటప్ పూర్తయింది. ఇకపై ఇంటర్నెట్ అవసరం లేదు.',
      sosPrompt:
        'మీరు బాగున్నారా? రద్దు చేయడానికి స్క్రీన్ నొక్కండి, లేకపోతే పదిహేను సెకన్లలో సహాయం కోసం సందేశం వెళ్తుంది.',
      sosSent: 'మీ లొకేషన్‌తో సహాయ సందేశం పంపబడింది.',
      sosFailed: 'సహాయ సందేశం పంపలేకపోయాం.',
      sosCancelled: 'రద్దు చేయబడింది.',
      noSosNumber: 'అత్యవసర నంబర్ సేవ్ కాలేదు. సెట్టింగ్స్‌లో జోడించండి.',
    },
  },
}

// Steps when near (a cane user counts steps), whole metres rounded DOWN beyond, so an error is always on the safe side.
export function rangeOf(metres: number): Range {
  // Boundaries are inclusive downward: exactly 3.0 m is "two steps". When in doubt, say nearer.
  return metres <= 1.5 ? 'oneStep' : metres <= 3 ? 'twoSteps' : metres < 5 ? 'close' : metres < 20 ? 'metres' : 'far'
}
export function bucketIndex(metres: number): number {
  const r = rangeOf(metres)
  return r === 'metres'
    ? 10 + Math.floor(metres)
    : ['oneStep', 'twoSteps', 'close'].indexOf(r) >= 0
      ? ['oneStep', 'twoSteps', 'close'].indexOf(r)
      : 99
}
function rangeWords(metres: number, lang: Lang): string {
  const w = WORDS[lang]
  const r = rangeOf(metres)
  return r === 'metres' ? w.metres(Math.floor(metres)) : w.range[r]
}

// Motion first, then where, then how far. Under 1.5 s to say. Telugu keeps side first.
export function sentence(t: Target, lang: Lang): string {
  const w = WORDS[lang]
  const range = rangeWords(t.distance, lang)
  if (lang === 'te')
    return t.approaching
      ? `${w.side[t.side]} ${w.label[t.label]} ${w.approaching}, ${range}`
      : `${w.side[t.side]} ${w.label[t.label]}, ${range}`
  return t.approaching
    ? `${w.label[t.label]} ${w.approaching}, ${w.side[t.side]}, ${range}`
    : `${w.label[t.label]} ${w.side[t.side]}, ${range}`
}

// Asked-for summary: groups by object and side with the nearest range, at most three groups, "and N more" for the rest.
export function scanSentence(targets: Target[], lang: Lang): string {
  const w = WORDS[lang]
  if (targets.length === 0) return w.phrase.nothingAround
  const groups = new Map<string, { t: Target; n: number }>()
  for (const t of [...targets].sort((a, b) => a.distance - b.distance)) {
    const key = `${t.label}:${t.side}`
    const g = groups.get(key)
    if (g) g.n++
    else groups.set(key, { t, n: 1 })
  }
  const all = [...groups.values()]
  const shown = all.slice(0, 3)
  const rest = all.slice(3).reduce((n, g) => n + g.n, 0)
  const parts = shown.map(({ t, n }) => {
    const noun = n > 1 ? `${n} ${w.plural[t.label]}` : w.label[t.label]
    const range = rangeWords(t.distance, lang)
    return lang === 'te' ? `${w.side[t.side]} ${noun}, ${range}` : `${noun} ${w.side[t.side]}, ${range}`
  })
  if (rest > 0) parts.push(w.andMore(rest))
  return parts.join('. ')
}

export function phrase(key: Phrase, lang: Lang): string {
  return WORDS[lang].phrase[key]
}

// One mouth: a sentence always finishes. While it plays, only the newest request is kept and spoken next.
let busy = false
let pending: { text: string; lang: Lang } | null = null

async function stopSpeaking(): Promise<void> {
  if (Capacitor.isNativePlatform()) await TextToSpeech.stop().catch(() => undefined)
  else speechSynthesis.cancel()
}

async function speakRaw(text: string, lang: Lang): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await TextToSpeech.speak({ text, lang: WORDS[lang].tag, rate: 1.0, category: 'ambient' })
    return
  }
  // Browser fallback for the Mac and the phone's Chrome; the WebView has no speechSynthesis.
  await new Promise<void>(resolve => {
    const u = new SpeechSynthesisUtterance(text)
    u.lang = WORDS[lang].tag
    const words = text.split(/\s+/).length
    const guard = window.setTimeout(resolve, (words / 2.6) * 1000 + 800) // headless engines never fire onend
    u.onend = u.onerror = () => {
      clearTimeout(guard)
      resolve()
    }
    speechSynthesis.speak(u)
  })
}

// Routine sentences wait their turn. An urgent one (something moving, or within two steps) cuts in at once.
let generation = 0
export async function speak(text: string, lang: Lang, urgent = false): Promise<void> {
  if (busy && !urgent) {
    pending = { text, lang }
    return
  }
  if (busy) {
    generation++
    pending = null
    await stopSpeaking()
  }
  const mine = ++generation
  busy = true
  try {
    await speakRaw(text, lang)
  } finally {
    if (mine === generation) {
      busy = false
      const next = pending
      pending = null
      if (next) void speak(next.text, next.lang)
    }
  }
}
export function isSpeaking(): boolean {
  return busy
}

// What was last announced per object kind, so a static thing is not repeated every few seconds.
const announced = new Map<string, { side: string; bucket: number; tier: number; t: number }>()
let paused = false
export function pauseWarnings(on: boolean) {
  paused = on
  if (on) announced.clear()
}

// Threat tier: 0 static and far, 1 moving beyond 5 m, 2 within 5 m, 3 within two steps, 4 one step.
function tierOf(t: Target): number {
  return t.distance <= 1.5 ? 4 : t.distance <= 3 ? 3 : t.distance < 5 ? 2 : t.approaching ? 1 : 0
}

// Interrupt the voice only for a jump to within two steps, or something that was far/static and is suddenly moving close.
// Otherwise sentences wait their turn: a side change after 1.5 s, a moving object every 2.5 s,
// a static one only if it gets a bucket closer or after 10 s.
export function warn(t: Target, lang: Lang, now: number): string | null {
  if (paused) return null
  const bucket = bucketIndex(t.distance)
  const tier = tierOf(t)
  const prev = announced.get(t.label)
  const escalated = prev ? tier > prev.tier : tier >= 2
  const urgent = escalated && (tier >= 3 || (tier === 2 && t.approaching && (!prev || prev.tier === 0)))
  const due =
    !prev ||
    escalated ||
    (prev.side !== t.side && now - prev.t >= 1500) ||
    (t.approaching ? now - prev.t >= 2500 : bucket < prev.bucket || now - prev.t > 10000)
  if (!due) return null
  if (busy && !urgent) return null
  announced.set(t.label, { side: t.side, bucket, tier, t: now })
  const text = sentence(t, lang)
  void speak(text, lang, urgent)
  if (t.distance < 3) navigator.vibrate?.(200)
  return text
}
