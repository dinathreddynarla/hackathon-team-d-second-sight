import type { PluginListenerHandle } from '@capacitor/core'
import { Motion } from '@capacitor/motion'

import { createFallRule, type FallKind } from './fallRule'

export type { FallKind }

// Feeds the phone's accelerometer into the fall rule (see fallRule.ts) while the app is in use.
export function watchFalls(onFall: (kind: FallKind) => void): () => void {
  const rule = createFallRule(onFall)
  let handle: PluginListenerHandle | undefined
  void Motion.addListener('accel', ev => rule(ev.accelerationIncludingGravity, Date.now())).then(h => (handle = h))
  return () => void handle?.remove()
}
