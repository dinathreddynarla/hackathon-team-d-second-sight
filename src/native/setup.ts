import { Capacitor, registerPlugin } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

type SetupPlugin = {
  openVoiceInstall(): Promise<void>
  sendSms(options: { to: string; text: string }): Promise<void>
  call(options: { to: string }): Promise<void>
  // Inherited from Capacitor's Plugin class: asks for the SEND_SMS permission declared in SetupPlugin.java.
  requestPermissions(): Promise<unknown>
}

// Backed by android/app/src/main/java/com/teamd/secondsight/SetupPlugin.java. No-ops in the browser.
const Setup = registerPlugin<SetupPlugin>('Setup')
export const isNative = Capacitor.isNativePlatform()

export async function openVoiceInstall(): Promise<boolean> {
  if (!isNative) return false
  try {
    await Setup.openVoiceInstall()
    return true
  } catch {
    return false
  }
}

export async function sendSms(to: string, text: string): Promise<boolean> {
  if (!isNative) return false
  try {
    await Setup.sendSms({ to, text })
    return true
  } catch {
    return false
  }
}

// Places the call directly when CALL_PHONE is granted, otherwise opens the dialler with the number filled in.
export async function callNumber(to: string): Promise<boolean> {
  if (!isNative) return false
  try {
    await Setup.call({ to })
    return true
  } catch {
    return false
  }
}

// Asks for SMS, phone and location while someone can answer the prompts, not after a fall. A refusal is not final:
// sendSms and the location lookup ask again when they are needed.
export async function requestSosPermissions(): Promise<void> {
  if (!isNative) return
  try {
    await Setup.requestPermissions()
  } catch {
    /* asked again at send time */
  }
  try {
    await Geolocation.requestPermissions()
  } catch {
    /* location services off: the SMS goes without a maps link */
  }
}

// MainActivity fires this on a volume-up double press.
export function onVolumeDouble(handler: () => void): () => void {
  window.addEventListener('volumeDouble', handler)
  return () => window.removeEventListener('volumeDouble', handler)
}

// MainActivity fires this when volume-down is held for 2 s: ask for help.
export function onVolumeDownHold(handler: () => void): () => void {
  window.addEventListener('volumeDownHold', handler)
  return () => window.removeEventListener('volumeDownHold', handler)
}
