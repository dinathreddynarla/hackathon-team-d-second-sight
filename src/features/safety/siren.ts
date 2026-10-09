import { setAlarmVolume } from '../../native/setup'

// An alarm through the phone's own speaker, for the people nearby when nobody could be reached by phone. It sweeps
// around 2.5 kHz, where a small speaker is loudest and hearing is sharpest.
let context: AudioContext | null = null
let stop: (() => void) | null = null

// True once it is sounding (false: this phone or browser has no sound output to give).
export function startSiren(): boolean {
  if (stop) return true
  try {
    context ??= new AudioContext()
    void context.resume()
    const tone = context.createOscillator()
    const sweep = context.createOscillator()
    const depth = context.createGain()
    tone.type = 'square'
    tone.frequency.value = 2500
    sweep.frequency.value = 2 // up and down twice a second
    depth.gain.value = 600
    sweep.connect(depth).connect(tone.frequency)
    tone.connect(context.destination)
    tone.start()
    sweep.start()
    // Heard whatever the media volume was left at: full while it sounds, then back to where it was.
    void setAlarmVolume(true)
    stop = () => {
      tone.stop()
      sweep.stop()
      tone.disconnect()
      void setAlarmVolume(false)
    }
    return true
  } catch {
    return false
  }
}

export function stopSiren(): void {
  stop?.()
  stop = null
}
