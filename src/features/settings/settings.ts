import { useCallback, useState } from 'react'

import type { Lang } from '../speech/speech'

export type Settings = { lang: Lang; sosNumber: string; setupDone: boolean }
const KEY = 'secondsight.settings'
const DEFAULTS: Settings = { lang: 'en', sosNumber: '', setupDone: false }

function load(): Settings {
  try {
    return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }
  } catch {
    return DEFAULTS
  }
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
