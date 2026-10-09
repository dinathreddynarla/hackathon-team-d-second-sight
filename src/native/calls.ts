import { registerPlugin } from '@capacitor/core'

import { isNative, requestSosPermissions } from './setup'

// started: the phone actually went off hook. answered: the call log shows a duration above zero.
export type CallResult = { started: boolean; answered: boolean; seconds: number }

type EmergencyCallPlugin = {
  call(options: { number: string }): Promise<CallResult>
  // Inherited from Capacitor's Plugin class: asks for the phone and call-log permissions declared in the plugin.
  requestPermissions(): Promise<unknown>
}

// Backed by android/app/src/main/java/com/teamd/secondsight/EmergencyCallPlugin.java.
const EmergencyCall = registerPlugin<EmergencyCallPlugin>('EmergencyCall')
const NOT_PLACED: CallResult = { started: false, answered: false, seconds: 0 }

// A browser cannot place a call. window.__ssCall is a stand-in for demonstrations and automated checks.
export function canCall(): boolean {
  return isNative || typeof window.__ssCall === 'function'
}

// Places one call and resolves when it has ended. The phone's own call screen is in front while it lasts.
export async function placeCall(number: string): Promise<CallResult> {
  if (window.__ssCall) return window.__ssCall(number)
  if (!isNative) return NOT_PLACED
  try {
    return await EmergencyCall.call({ number })
  } catch {
    return NOT_PLACED
  }
}

// Everything the alert needs, asked while someone can answer the prompts, not after a fall: SMS and location for the
// message, then phone and call log for the calls. One after the other, so the prompts do not collide. A refusal is
// not final: each is asked again when it is needed.
export async function requestAlertPermissions(): Promise<void> {
  if (!isNative) return
  await requestSosPermissions()
  try {
    await EmergencyCall.requestPermissions()
  } catch {
    /* asked again when a call is placed */
  }
}
