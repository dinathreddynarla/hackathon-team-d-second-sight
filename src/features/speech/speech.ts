import { TextToSpeech } from '@capacitor-community/text-to-speech'
import { Capacitor } from '@capacitor/core'

import type { Side, Target } from '../vision/distance'
import type { TargetClass } from '../vision/detector'

export type Lang = 'en' | 'te'
export type Range = 'veryClose' | 'about5' | 'about10' | 'far'

const WORDS: Record<
  Lang,
  {
    label: Record<TargetClass, string>
    side: Record<Side, string>
    range: Record<Range, string>
    approaching: string
    ready: string
    stopped: string
    lang: string
  }
> = {
  en: {
    label: { person: 'person', car: 'car', motorcycle: 'motorcycle', bicycle: 'bicycle', bus: 'bus', truck: 'truck' },
    side: { left: 'left', ahead: 'ahead', right: 'right' },
    range: { veryClose: 'very close', about5: 'about 5 metres', about10: 'about 10 metres', far: 'far' },
    approaching: 'approaching',
    ready: 'Second Sight ready',
    stopped: 'stopped',
    lang: 'en-IN',
  },
  te: {
    label: { person: 'వ్యక్తి', car: 'కారు', motorcycle: 'బైక్', bicycle: 'సైకిల్', bus: 'బస్సు', truck: 'లారీ' },
    side: { left: 'ఎడమవైపు', ahead: 'ముందు', right: 'కుడివైపు' },
    range: { veryClose: 'చాలా దగ్గరగా', about5: 'సుమారు ఐదు మీటర్లు', about10: 'సుమారు పది మీటర్లు', far: 'దూరంగా' },
    approaching: 'దగ్గరకు వస్తోంది',
    ready: 'సెకండ్ సైట్ సిద్ధం',
    stopped: 'ఆగింది',
    lang: 'te-IN',
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

export function phrase(key: 'ready' | 'stopped', lang: Lang): string {
  return WORDS[lang][key]
}

export async function speak(text: string, lang: Lang): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    await TextToSpeech.speak({ text, lang: WORDS[lang].lang, rate: 1.1, category: 'ambient' })
    return
  }
  // Browser fallback for the Mac and the phone's Chrome; the WebView has no speechSynthesis.
  speechSynthesis.cancel()
  const u = new SpeechSynthesisUtterance(text)
  u.lang = WORDS[lang].lang
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
