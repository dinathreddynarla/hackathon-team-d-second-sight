import { Capacitor, registerPlugin } from '@capacitor/core'

type SetupPlugin = {
  openVoiceInstall(): Promise<void>
  sendSms(options: { to: string; text: string }): Promise<void>
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

// MainActivity fires this on a volume-up double press.
export function onVolumeDouble(handler: () => void): () => void {
  window.addEventListener('volumeDouble', handler)
  return () => window.removeEventListener('volumeDouble', handler)
}
