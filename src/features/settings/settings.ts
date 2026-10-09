import { useCallback, useState } from 'react'

import { PITCHES, RATES, type Lang, type SpeechPitch, type SpeechRate } from '../speech/speech'

export const MAX_CONTACTS = 3
// What a contact's message starts with until the user writes their own. What happened and where is always added.
export const DEFAULT_SOS_MESSAGE = 'I may need help. Please call me.'
// sosNumbers is one slot per contact, in calling order; an empty slot is an empty string.
// dim: screen at 5% brightness while watching. The user cannot see it; it is the biggest battery saving there is.
// walls: the depth model for obstacles. Off by default: it is the heaviest part (about 1.5 s per check on an iQOO Neo 10).
// rate: how fast the voice talks. torch: light the flashlight when the camera finds it dark. siren: sound an alarm
// for the people nearby when no emergency contact could be reached.
export type Settings = {
  lang: Lang
  sosNumbers: string[]
  setupDone: boolean
  dim: boolean
  rate: SpeechRate
  pitch: SpeechPitch
  // The chosen offline voice per language, by the engine's name for it; none means the language's default voice.
  voices: Partial<Record<Lang, string>>
  // One per contact slot, beside sosNumbers. Empty means DEFAULT_SOS_MESSAGE.
  sosMessages: string[]
  torch: boolean
  siren: boolean
  walls: boolean
}
const KEY = 'secondsight.settings'
const DEFAULTS: Settings = {
  lang: 'en',
  sosNumbers: [],
  setupDone: false,
  dim: true,
  rate: 'normal',
  pitch: 'normal',
  voices: {},
  sosMessages: [],
  torch: true,
  siren: true,
  walls: false,
}

function load(): Settings {
  try {
    const { sosNumber, sosNumbers, ...rest } = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    // Before there could be three contacts there was one, saved as sosNumber. It becomes the first.
    const saved: unknown[] = Array.isArray(sosNumbers) ? sosNumbers : sosNumber ? [sosNumber] : []
    const numbers = saved.filter((n): n is string => typeof n === 'string').slice(0, MAX_CONTACTS)
    const merged: Settings = { ...DEFAULTS, ...rest, sosNumbers: numbers }
    if (!Object.hasOwn(RATES, merged.rate)) merged.rate = DEFAULTS.rate
    if (!Object.hasOwn(PITCHES, merged.pitch)) merged.pitch = DEFAULTS.pitch
    if (!Array.isArray(merged.sosMessages)) merged.sosMessages = []
    if (typeof merged.voices !== 'object' || merged.voices === null) merged.voices = {}
    return merged
  } catch {
    return DEFAULTS
  }
}

// The contacts to call, in order: the filled slots only.
export function contactsOf(sosNumbers: string[]): string[] {
  return sosNumbers.map(n => n.trim()).filter(Boolean)
}

// The filled slots with each one's own message, in calling order.
export function contactsWithMessages(
  sosNumbers: string[],
  sosMessages: string[]
): { number: string; message: string }[] {
  return sosNumbers
    .map((n, slot) => ({ number: n.trim(), message: sosMessages[slot]?.trim() || DEFAULT_SOS_MESSAGE }))
    .filter(c => c.number)
}

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(load)
  const update = useCallback((patch: Partial<Settings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        /* storage blocked: keep in memory */
      }
      return next
    })
  }, [])
  return [settings, update] as const
}
