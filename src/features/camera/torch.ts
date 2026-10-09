// The phone's flashlight, switched through the camera that is already open: Android gives the LED to whoever holds
// the camera, so a separate torch call would be refused while the app is watching. Not every phone or browser offers
// it; then nothing happens. It goes out by itself when the camera stops.
type Torch = { torch?: boolean }

function trackOf(video: HTMLVideoElement | null): MediaStreamTrack | null {
  const stream = video?.srcObject
  return stream instanceof MediaStream ? (stream.getVideoTracks()[0] ?? null) : null
}

// The camera the torch was lit on. Kept here rather than read back from the camera, which not every phone reports:
// a torch wrongly believed to be off would be lit, and announced, over and over.
let lit: MediaStreamTrack | null = null

export function hasTorch(video: HTMLVideoElement | null): boolean {
  const track = trackOf(video)
  if (!track) return false
  // window.__ssTorch is a stand-in for demonstrations and automated checks.
  if (window.__ssTorch) return true
  return Boolean((track.getCapabilities?.() as Torch | undefined)?.torch)
}

export function torchOn(video: HTMLVideoElement | null): boolean {
  const track = trackOf(video)
  return track !== null && track === lit && track.readyState === 'live'
}

// Resolves true when the torch is now as asked.
export async function setTorch(video: HTMLVideoElement | null, on: boolean): Promise<boolean> {
  const track = trackOf(video)
  if (!track || !hasTorch(video)) return false
  try {
    if (window.__ssTorch) {
      if (!window.__ssTorch(on)) return false
    } else await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
  } catch {
    return false
  }
  lit = on ? track : null
  return true
}
