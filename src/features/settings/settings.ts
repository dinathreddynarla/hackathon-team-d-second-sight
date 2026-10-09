import { useCallback, useState } from 'react'

import type { Lang } from '../speech/speech'

export const MAX_CONTACTS = 3
// sosNumbers is one slot per contact, in calling order; an empty slot is an empty string.
// dim: screen at 5% brightness while watching. The user cannot see it; it is the biggest battery saving there is.
// walls: the depth model for obstacles. Off by default: it is the heaviest part (about 1.5 s per check on an iQOO Neo 10).
export type Settings = { lang: Lang; sosNumbers: string[]; setupDone: boolean; dim: boolean; walls: boolean }
const KEY = 'secondsight.settings'
const DEFAULTS: Settings = { lang: 'en', sosNumbers: [], setupDone: false, dim: true, walls: false }

function load(): Settings {
  try {
    const { sosNumber, sosNumbers, ...rest } = JSON.parse(localStorage.getItem(KEY) ?? '{}')
    // Before there could be three contacts there was one, saved as sosNumber. It becomes the first.
    const saved: unknown[] = Array.isArray(sosNumbers) ? sosNumbers : sosNumber ? [sosNumber] : []
    const numbers = saved.filter((n): n is string => typeof n === 'string').slice(0, MAX_CONTACTS)
    return { ...DEFAULTS, ...rest, sosNumbers: numbers }
  } catch {
    return DEFAULTS
  }
}

// The contacts to call, in order: the filled slots only.
export function contactsOf(sosNumbers: string[]): string[] {
  return sosNumbers.map(n => n.trim()).filter(Boolean)
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
