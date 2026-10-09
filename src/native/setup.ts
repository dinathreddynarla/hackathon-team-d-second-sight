import { Capacitor, registerPlugin } from '@capacitor/core'
import { Geolocation } from '@capacitor/geolocation'

type SetupPlugin = {
  openVoiceInstall(): Promise<void>
  // Resolves once the network has taken the message; rejects when it could not be sent, or nothing is heard in time.
  sendSms(options: { to: string; text: string }): Promise<void>
  alarmVolume(options: { on: boolean }): Promise<void>
  call(options: { to: string }): Promise<void>
  consumeAutostart(): Promise<{ autostart: boolean }>
  setWatching(options: { on: boolean; dim: boolean }): Promise<void>
  openAccessibilitySettings(): Promise<void>
  readText(options: { image: string }): Promise<{ text: string }>
  // Inherited from Capacitor's Plugin class: the SEND_SMS permission declared in SetupPlugin.java.
  checkPermissions(): Promise<{ sms?: string }>
  requestPermissions(): Promise<{ sms?: string }>
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

// Each contact's own text, all handed to the phone together. One answer per message: true only when the network has
// taken it, so "sent" is never said of a message still sitting in the phone (flight mode, no signal).
// A browser cannot send an SMS. window.__ssSms is a stand-in for demonstrations and automated checks.
export async function sendSmsToAll(messages: { to: string; text: string }[]): Promise<boolean[]> {
  const standIn = window.__ssSms
  if (standIn) return Promise.all(messages.map(m => standIn(m.to, m.text)))
  const none = messages.map(() => false)
  if (!isNative) return none
  try {
    // Asked once, here: three messages asking at the same moment would put up three prompts.
    let sms = (await Setup.checkPermissions()).sms
    if (sms !== 'granted') sms = (await Setup.requestPermissions()).sms
    if (sms !== 'granted') return none
  } catch {
    return none
  }
  return Promise.all(
    messages.map(({ to, text }) =>
      Setup.sendSms({ to, text }).then(
        () => true,
        () => false
      )
    )
  )
}

// The alarm sound uses the media volume, which may have been left low: full while it sounds, then as it was.
export async function setAlarmVolume(on: boolean): Promise<void> {
  if (!isNative) return
  try {
    await Setup.alarmVolume({ on })
  } catch {
    /* Do Not Disturb can refuse: the alarm sounds at the volume it finds */
  }
}

// Asks for SMS and location while someone can answer the prompts, not after a fall. A refusal is not final:
// the message and the location lookup ask again when they are needed. The calls ask for theirs in calls.ts.
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

// Opened by Android's accessibility shortcut (hold both volume keys): start watching without a tap.
// Covers both cases: a cold start (asked once on load) and the app already open (a window event from MainActivity).
export function onAutostart(handler: () => void): () => void {
  if (!isNative) return () => undefined
  // The request is held natively and collected once, so a load and an event racing each other start only once.
  const collect = () =>
    void Setup.consumeAutostart()
      .then(r => r.autostart && handler())
      .catch(() => undefined)
  window.addEventListener('autostart', collect)
  collect()
  return () => window.removeEventListener('autostart', collect)
}

// Screen on (and dimmed) only while the camera is watching.
export async function setWatching(on: boolean, dim: boolean): Promise<void> {
  if (!isNative) return
  try {
    await Setup.setWatching({ on, dim })
  } catch {
    /* the default screen timeout applies */
  }
}

export async function openAccessibilitySettings(): Promise<boolean> {
  if (!isNative) return false
  try {
    await Setup.openAccessibilitySettings()
    return true
  } catch {
    return false
  }
}

// Printed text in a JPEG frame (base64, no data: prefix), or null when nothing is readable or this is a browser.
export async function readText(jpegBase64: string): Promise<string | null> {
  if (!isNative) return null
  try {
    const { text } = await Setup.readText({ image: jpegBase64 })
    const clean = text.replace(/\s+/g, ' ').trim()
    return clean ? clean.slice(0, 160) : null
  } catch {
    return null
  }
}
