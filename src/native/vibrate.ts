import { Capacitor } from '@capacitor/core'
import { Haptics } from '@capacitor/haptics'

// Android's WebView ignores navigator.vibrate, so inside the app the motor is driven natively.
export function vibrate(ms: number): void {
  if (Capacitor.isNativePlatform()) void Haptics.vibrate({ duration: ms }).catch(() => undefined)
  else navigator.vibrate?.(ms)
}
