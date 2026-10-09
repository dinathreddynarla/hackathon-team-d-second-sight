// Reads the colour of a traffic light the detector has found: how much of its box is brightly lit in red, and how
// much in green. Amber is left unsaid: it lasts about three seconds, less than it takes to be sure of it and say it.
// ponytail: thresholds reasoned from how lamps photograph, not yet tuned on a Hyderabad junction.
export type LightColour = 'red' | 'green'

const MIN_VALUE = 0.6 // a lit lamp is bright …
const MIN_SATURATION = 0.45 // … and coloured; a white sky and a grey housing are neither
const MIN_SHARE = 0.02 // of the box. Less than that is a reflection, or a tail light behind the pole
const MARGIN = 2 // the winning colour needs twice the pixels of any other

// pixels: RGBA of the light's box, any size.
export function lightColour(pixels: Uint8ClampedArray): LightColour | null {
  let red = 0
  let amber = 0
  let green = 0
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i] ?? 0
    const g = pixels[i + 1] ?? 0
    const b = pixels[i + 2] ?? 0
    const max = Math.max(r, g, b)
    const spread = max - Math.min(r, g, b)
    if (max < 255 * MIN_VALUE || spread < max * MIN_SATURATION) continue
    const sixth = max === r ? (g - b) / spread : max === g ? (b - r) / spread + 2 : (r - g) / spread + 4
    const hue = (sixth * 60 + 360) % 360
    if (hue < 20 || hue >= 330) red++
    else if (hue < 70) amber++
    // Signal green photographs blue-green (above 110°); sunlit leaves behind the pole are yellow-green and do not count.
    else if (hue >= 110 && hue < 200) green++
  }
  const needed = (pixels.length / 4) * MIN_SHARE
  if (red >= needed && red >= MARGIN * Math.max(amber, green)) return 'red'
  if (green >= needed && green >= MARGIN * Math.max(amber, red)) return 'green'
  return null
}

const CONFIRM_LOOKS = 3 // a wrong "green" is the costly mistake, so three looks in a row must agree
const IN_A_ROW_MS = 2000 // looks further apart than this are not "in a row": the count starts again
const FORGET_MS = 10000 // out of view this long, the next light is a new light

// Decides when a colour is worth saying: when it is first sure, and again only when it changes.
export function createLightWatch() {
  let last: LightColour | null = null
  let streak = 0
  let said: LightColour | null = null
  let readAt = -Infinity
  return {
    // One look at the traffic light in view (null: its colour cannot be read). Returns the colour that is due to be
    // spoken, if any. It stays due at every look until spoken() is called, so it can wait for a gap in the speech.
    look(colour: LightColour | null, now: number): LightColour | null {
      if (now - readAt > FORGET_MS) said = null
      if (now - readAt > IN_A_ROW_MS) streak = 0
      if (!colour) {
        last = null
        streak = 0
        return null
      }
      readAt = now
      streak = colour === last && streak > 0 ? streak + 1 : 1
      last = colour
      return streak >= CONFIRM_LOOKS && colour !== said ? colour : null
    },
    spoken(colour: LightColour) {
      said = colour
    },
    // It was cut off before it was heard: due again.
    unheard(colour: LightColour) {
      if (said === colour) said = null
    },
    // The colour the last three looks agreed on, if the last of them was moments ago: what is given when asked.
    sure(now: number): LightColour | null {
      return streak >= CONFIRM_LOOKS && now - readAt <= IN_A_ROW_MS ? last : null
    },
  }
}
