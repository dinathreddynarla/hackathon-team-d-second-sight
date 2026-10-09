import { setAlarmVolume } from '../../native/setup'

// An alarm through the phone's own speaker, for the people nearby when nobody could be reached by phone. It beeps
// S O S (three short, three long, three short): people read that as distress, where a plain siren passes for a car
// alarm. 2.5 kHz is where a small speaker is loudest and hearing is sharpest.
const UNIT_S = 0.2 // one Morse dot
const PATTERN: [on: number, off: number][] = [
  [1, 1],
  [1, 1],
  [1, 3],
  [3, 1],
  [3, 1],
  [3, 3],
  [1, 1],
  [1, 1],
  [1, 7],
]
export const SOS_MS = PATTERN.reduce((t, [on, off]) => t + on + off, 0) * UNIT_S * 1000
let context: AudioContext | null = null
let tone: OscillatorNode | null = null
let gate: GainNode | null = null
const timers: number[] = []

// True once it can sound (false: this phone or browser has no sound output to give).
export function startSiren(): boolean {
  if (tone) return true
  try {
    context ??= new AudioContext()
    void context.resume()
    tone = context.createOscillator()
    tone.type = 'square'
    tone.frequency.value = 2500
    gate = context.createGain()
    gate.gain.value = 0
    tone.connect(gate).connect(context.destination)
    tone.start()
    // Heard whatever the media volume was left at: full while it sounds, then back to where it was.
    void setAlarmVolume(true)
    return true
  } catch {
    return false
  }
}

// One S O S. `flash` (the torch) follows the beeps, so at night the alarm is seen as well as heard.
export function beepSos(flash?: (on: boolean) => void): void {
  if (!context || !gate) return
  let at = context.currentTime + 0.05
  let ms = 50
  for (const [on, off] of PATTERN) {
    gate.gain.setValueAtTime(1, at)
    gate.gain.setValueAtTime(0, at + on * UNIT_S)
    if (flash) {
      timers.push(window.setTimeout(() => flash(true), ms))
      timers.push(window.setTimeout(() => flash(false), ms + on * UNIT_S * 1000))
    }
    at += (on + off) * UNIT_S
    ms += (on + off) * UNIT_S * 1000
  }
}

export function stopSiren(): void {
  timers.splice(0).forEach(clearTimeout)
  if (!tone) return
  tone.stop()
  tone.disconnect()
  tone = null
  gate = null
  void setAlarmVolume(false)
}
