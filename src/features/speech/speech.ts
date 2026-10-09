import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { Capacitor } from '@capacitor/core'

import type { TargetClass } from '../vision/detector'
import type { Side, Target } from '../vision/distance'

export type Lang = 'en' | 'te'
export type Range = 'veryClose' | 'about5' | 'about10' | 'far'
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
    range: { veryClose: 'very close', about5: 'about 5 metres', about10: 'about 10 metres', far: 'far' },
    approaching: 'approaching',
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
    range: { veryClose: 'చాలా దగ్గరగా', about5: 'సుమారు ఐదు మీటర్లు', about10: 'సుమారు పది మీటర్లు', far: 'దూరంగా' },
    approaching: 'దగ్గరకు వస్తోంది',
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

export function rangeOf(metres: number): Range {
  return metres < 3 ? 'veryClose' : metres < 6 ? 'about5' : metres < 12 ? 'about10' : 'far'
}

// Telugu puts the side first; English puts the object first.
export function sentence(t: Target, lang: Lang): string {
  const w = WORDS[lang]
  const parts =
    lang === 'te'
      ? [w.side[t.side], w.label[t.label], w.range[rangeOf(t.distance)]]
      : [`${w.label[t.label]} ${w.side[t.side]}`, w.range[rangeOf(t.distance)]]
  if (t.approaching) parts.push(w.approaching)
  return parts.join(', ')
}

// One sentence for everything in view, grouped by kind and side, nearest first.
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
  return [...groups.values()]
    .map(({ t, n }) => {
      const noun = n > 1 ? `${n} ${w.plural[t.label]}` : w.label[t.label]
      return lang === 'te'
        ? `${w.side[t.side]} ${noun}, ${w.range[rangeOf(t.distance)]}`
        : `${noun} ${w.side[t.side]}, ${w.range[rangeOf(t.distance)]}`
    })
    .join('; ')
}

export function phrase(key: Phrase, lang: Lang): string {
  return WORDS[lang].phrase[key]
}

export async function speak(text: string, lang: Lang): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await TextToSpeech.speak({ text, lang: WORDS[lang].tag, rate: 1.1, category: 'ambient' })
    return
  }
  // Browser fallback for the Mac and the phone's Chrome; the WebView has no speechSynthesis.
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = WORDS[lang].tag
  speechSynthesis.speak(u)
}

let lastText = ''
let lastAt = 0
// Never talk over yourself, never repeat the same sentence within 3 s.
export function warn(t: Target, lang: Lang, now: number): string | null {
  const text = sentence(t, lang)
  if (now - lastAt < 1500 || (text === lastText && now - lastAt < 3000)) return null
  lastText = text
  lastAt = now
  void speak(text, lang)
  if (t.distance < 3) navigator.vibrate?.(200)
  return text
}
