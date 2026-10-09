// Safety simulation: battery alerts, camera view alerts (blocked lens, dark scene, washed-out view), the crowd alert,
// asking for help (message, then calls in turn), a traffic light changing colour, the torch on a night walk, and the
// alarm when nobody answers.
// Runs the real app (vite preview on :4173) headless and records every sentence with what the harness did at the time.
// Usage: node tests/safety-sim.cjs [battery|camera|crowd|sos|light|torch|alarm|all]  → prints JSON { scene: { actions, spoken } }; sos adds texts and calls
const { chromium } = require(
  process.env.PLAYWRIGHT_PATH ||
    '/Users/dinathnarla/apty/projects/apty-dap-clone-1/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright'
)

const RECORDER = () => {
  window.__spoken = []
  let current = null
  const orig = speechSynthesis.speak.bind(speechSynthesis)
  speechSynthesis.cancel = () => {
    if (current && performance.now() < current.endsAt) current.cutOff = true
    current = null
  }
  speechSynthesis.speak = u => {
    const dur = (u.text.split(/\s+/).length / 2.6) * 1000 + 300
    current = {
      at: performance.now(),
      text: u.text,
      durMs: Math.round(dur),
      endsAt: performance.now() + dur,
      cutOff: false,
    }
    window.__spoken.push(current)
    orig(u)
  }
  // A battery the harness can drain: level and charging are set from the test, events dispatched by hand.
  const battery = new EventTarget()
  battery.level = 0.25
  battery.charging = false
  window.__battery = battery
  navigator.getBattery = () => Promise.resolve(battery)
  // A browser cannot send an SMS or place a call. The stand-ins accept every message, ring for 3 s (a real
  // unanswered call rings 30 to 45 s), and only the second contact picks up.
  window.__texts = []
  window.__ssSms = async (to, text) => {
    window.__texts.push({ at: performance.now(), to, text })
    return true
  }
  window.__calls = []
  window.__ssCall = number =>
    new Promise(resolve => {
      window.__calls.push({ at: performance.now(), number })
      const answered = number.endsWith('2')
      setTimeout(() => resolve({ started: true, answered, seconds: answered ? 20 : 0 }), 3000)
    })
  try {
    localStorage.setItem(
      'secondsight.settings',
      JSON.stringify({ lang: 'en', sosNumbers: ['9999999991', '9999999992', '9999999993'], setupDone: true })
    )
  } catch {}
}

async function open() {
  const b = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] })
  const ctx = await b.newContext({
    permissions: ['camera', 'geolocation'],
    geolocation: { latitude: 17.4375, longitude: 78.4483 },
    viewport: { width: 420, height: 860 },
  })
  const p = await ctx.newPage()
  await p.addInitScript(RECORDER)
  await p.goto('http://localhost:4173/')
  await p.waitForFunction(() => window.__ss, null, { timeout: 30000 })
  const t0 = await p.evaluate(() => performance.now())
  const actions = []
  const act = async (label, fn, arg) => {
    const t = await p.evaluate(() => performance.now())
    actions.push({ t: +((t - t0) / 1000).toFixed(1), action: label })
    if (fn) await p.evaluate(fn, arg)
  }
  const spoken = async () =>
    p.evaluate(
      t0 =>
        window.__spoken
          .filter(s => s.at >= t0)
          .map(s => ({ t: +((s.at - t0) / 1000).toFixed(1), text: s.text, durMs: s.durMs, cutOff: s.cutOff })),
      t0
    )
  const calls = async () =>
    p.evaluate(
      t0 =>
        window.__calls.filter(c => c.at >= t0).map(c => ({ t: +((c.at - t0) / 1000).toFixed(1), number: c.number })),
      t0
    )
  const texts = async () =>
    p.evaluate(
      t0 =>
        window.__texts
          .filter(m => m.at >= t0)
          .map(m => ({ t: +((m.at - t0) / 1000).toFixed(1), to: m.to, text: m.text })),
      t0
    )
  return { b, p, act, spoken, calls, texts, actions }
}

const scenes = {
  // 25% → 19% (warn) → 15% (silent) → 9% (warn) → plugged in → unplugged at 19% (warn again: charging re-arms).
  async battery() {
    const { b, p, act, spoken, actions } = await open()
    const set = async (label, level, charging) => {
      await act(
        label,
        ([l, c]) => {
          const bat = window.__battery
          bat.level = l
          bat.charging = c
          bat.dispatchEvent(new Event('levelchange'))
          bat.dispatchEvent(new Event('chargingchange'))
        },
        [level, charging]
      )
      await p.waitForTimeout(3000)
    }
    await p.waitForTimeout(1000)
    await set('battery 19%, not charging', 0.19, false)
    await set('battery 15%, not charging', 0.15, false)
    await set('battery 9%, not charging', 0.09, false)
    await set('plugged in at 9%', 0.09, true)
    await set('unplugged at 19%', 0.19, false)
    const out = { actions, spoken: await spoken() }
    await b.close()
    return out
  },

  // Camera running: covered lens 10 s, clear 6 s, dark street 10 s, clear, washed-out view (rain, smoke) 10 s, clear.
  async camera() {
    const { b, p, act, spoken, actions } = await open()
    await p.getByTestId('start-stop').click()
    await p.waitForFunction(() => document.querySelector('video')?.readyState >= 2)
    await p.evaluate(() => {
      const v = document.querySelector('video')
      window.__realStream = v.srcObject
      // A canvas the harness paints: 'black' = finger over the lens, 'dark' = night street with some texture.
      const c = document.createElement('canvas')
      c.width = 320
      c.height = 240
      const g = c.getContext('2d')
      window.__paint = mode => {
        window.__mode = mode
      }
      const draw = () => {
        if (window.__mode === 'black') {
          g.fillStyle = '#060606'
          g.fillRect(0, 0, 320, 240)
        } else if (window.__mode === 'finger') {
          g.fillStyle = '#b07a5a'
          g.fillRect(0, 0, 320, 240)
        } else if (window.__mode === 'dark') {
          for (let y = 0; y < 240; y += 8)
            for (let x = 0; x < 320; x += 8) {
              const v = 5 + Math.floor(Math.random() * 40)
              g.fillStyle = `rgb(${v},${v},${v + 4})`
              g.fillRect(x, y, 8, 8)
            }
        } else if (window.__mode === 'haze') {
          // Bright, with only faint shapes left: what heavy rain, smoke or a wet lens does to the picture.
          for (let y = 0; y < 240; y += 40)
            for (let x = 0; x < 320; x += 40) {
              const v = 150 + Math.floor(Math.random() * 45)
              g.fillStyle = `rgb(${v},${v},${v})`
              g.fillRect(x, y, 40, 40)
            }
        }
        requestAnimationFrame(draw)
      }
      draw()
      window.__fakeStream = c.captureStream(15)
    })
    const use = mode => async () =>
      p.evaluate(mode => {
        const v = document.querySelector('video')
        if (mode === 'real') v.srcObject = window.__realStream
        else {
          window.__paint(mode)
          v.srcObject = window.__fakeStream
        }
        v.play()
      }, mode)
    await p.waitForTimeout(2000)
    await act('finger over the lens in daylight')
    await use('finger')()
    await p.waitForTimeout(10000)
    await act('lens clear again')
    await use('real')()
    await p.waitForTimeout(6000)
    await act('phone in a pocket (black)')
    await use('black')()
    await p.waitForTimeout(10000)
    await act('lens clear again')
    await use('real')()
    await p.waitForTimeout(6000)
    await act('dark street (night)')
    await use('dark')()
    await p.waitForTimeout(10000)
    await act('lens clear again')
    await use('real')()
    await p.waitForTimeout(6000)
    await act('washed-out view (heavy rain, smoke)')
    await use('haze')()
    await p.waitForTimeout(10000)
    await act('lens clear again')
    await use('real')()
    await p.waitForTimeout(6000)
    const out = { actions, spoken: await spoken() }
    await b.close()
    return out
  },

  // Camera running, detector scripted: one person, then five people for 12 s, then nobody, then five again.
  // "Crowd ahead." should come once per crowd, in a gap, never over a warning.
  async crowd() {
    const { b, p, act, spoken, actions } = await open()
    await p.getByTestId('start-stop').click()
    await p.waitForFunction(() => document.querySelector('video')?.readyState >= 2)
    await p.evaluate(() => {
      window.__people = 0
      // People standing 5 to 9 m away, spread across the frame. Boxes as in voice-sim.cjs: 640x480 fake camera,
      // height from the app's own formula with K = 0.75, feet on the bottom edge.
      window.__ss.detector.detectForVideo = () => ({
        detections: Array.from({ length: window.__people }, (_, i) => {
          const h = ((1.7 * 0.75) / (5 + i)) * 480
          const w = h * 0.3
          return {
            categories: [{ categoryName: 'person', score: 0.8 }],
            boundingBox: { originX: 60 + i * 120 - w / 2, originY: 480 - h, width: w, height: h },
          }
        }),
      })
    })
    const people = n => () => p.evaluate(n => void (window.__people = n), n)
    await p.waitForTimeout(2000)
    await act('one person in view')
    await people(1)()
    await p.waitForTimeout(6000)
    await act('five people in view')
    await people(5)()
    await p.waitForTimeout(12000)
    await act('nobody in view')
    await people(0)()
    await p.waitForTimeout(12000)
    await act('five people in view again, within a minute of the first crowd')
    await people(5)()
    await p.waitForTimeout(8000)
    const out = { actions, spoken: await spoken() }
    await b.close()
    return out
  },

  // Volume-down held → 10 s countdown → message to all three → contact one rings out → contact two answers.
  // Then again, cancelled at 2 s. Then the Help button, stopped while contact one is ringing.
  async sos() {
    const { b, p, act, spoken, calls, texts, actions } = await open()
    const screen = async () =>
      p.evaluate(() => ({
        title: document.querySelector('[data-testid="alert-title"]')?.textContent || null,
        button: document.querySelector('[data-testid="alert-cancel"]')?.getAttribute('aria-label') || null,
      }))
    await p.waitForTimeout(1000)
    await act('volume-down held 2 s', () => window.dispatchEvent(new Event('volumeDownHold')))
    await p.waitForTimeout(1500)
    actions.push({ t: null, action: 'screen during countdown', screen: await screen() })
    await p.waitForTimeout(13500)
    actions.push({ t: null, action: 'screen after the countdown', screen: await screen() })
    await p.waitForTimeout(4000)
    actions.push({ t: null, action: 'screen while calling', screen: await screen() })
    await p.waitForTimeout(14000)
    actions.push({ t: null, action: 'screen after contact two answered', screen: await screen() })
    await act('tap anywhere (back)', () => document.querySelector('[data-testid="alert-cancel"]').click())
    await p.waitForTimeout(1500)
    actions.push({ t: null, action: 'screen after tap', screen: await screen() })
    await act('volume-down held 2 s again', () => window.dispatchEvent(new Event('volumeDownHold')))
    await p.waitForTimeout(2000)
    await act('tap anywhere during countdown (cancel)', () =>
      document.querySelector('[data-testid="alert-cancel"]').click()
    )
    await p.waitForTimeout(3000)
    actions.push({ t: null, action: 'screen after cancel', screen: await screen() })
    await act('Help button on the screen', () => document.querySelector('[data-testid="help"]').click())
    await p.waitForTimeout(18000)
    actions.push({ t: null, action: 'screen while contact one is ringing', screen: await screen() })
    await act('tap anywhere (stop calling)', () => document.querySelector('[data-testid="alert-cancel"]').click())
    await p.waitForTimeout(6000)
    actions.push({ t: null, action: 'screen after stopping', screen: await screen() })
    const out = { actions, spoken: await spoken(), texts: await texts(), calls: await calls() }
    await b.close()
    return out
  },

  // A traffic light across the road (picture painted, detector scripted): unlit 3 s, then red, and 1.2 s later, while
  // "traffic light, red" is being said, a person steps out two steps ahead; amber 3 s, green 6 s, then "what is
  // around me", then amber and back to red.
  async light() {
    const { b, p, act, spoken, actions } = await open()
    await p.getByTestId('start-stop').click()
    await p.waitForFunction(() => document.querySelector('video')?.readyState >= 2)
    await p.evaluate(() => {
      const v = document.querySelector('video')
      const c = document.createElement('canvas')
      c.width = 640
      c.height = 480
      const g = c.getContext('2d')
      window.__lamp = 'unlit'
      window.__person = false
      const LAMP = { red: [110, 'rgb(235,40,30)'], amber: [155, 'rgb(250,180,30)'], green: [200, 'rgb(40,230,170)'] }
      const draw = () => {
        for (let y = 0; y < 480; y += 40)
          for (let x = 0; x < 640; x += 40) {
            const s = 60 + ((x * 7 + y * 13) % 150)
            g.fillStyle = `rgb(${s},${s},${s})`
            g.fillRect(x, y, 40, 40)
          }
        g.fillStyle = '#1c1c1e'
        g.fillRect(290, 80, 60, 150)
        const lit = LAMP[window.__lamp]
        if (lit) {
          g.fillStyle = lit[1]
          g.beginPath()
          g.arc(320, lit[0], 22, 0, 7)
          g.fill()
        }
        requestAnimationFrame(draw)
      }
      draw()
      v.srcObject = c.captureStream(15)
      v.play()
      const light = {
        categories: [{ categoryName: 'traffic light', score: 0.8 }],
        boundingBox: { originX: 290, originY: 80, width: 60, height: 150 },
      }
      // A person 2.5 m away, straight ahead, below the light in the picture.
      const person = {
        categories: [{ categoryName: 'person', score: 0.8 }],
        boundingBox: { originX: 283, originY: 235, width: 73, height: 245 },
      }
      window.__ss.detector.detectForVideo = () => ({ detections: window.__person ? [light, person] : [light] })
    })
    const lamp = colour => () => p.evaluate(colour => void (window.__lamp = colour), colour)
    await act('a traffic light comes into view, not lit')
    await p.waitForTimeout(3000)
    await act('its lamp turns red')
    await lamp('red')()
    await p.waitForTimeout(1200)
    await act('a person steps out two steps ahead', () => void (window.__person = true))
    await p.waitForTimeout(4000)
    await act('the person has gone', () => void (window.__person = false))
    await p.waitForTimeout(3000)
    await act('the lamp turns amber')
    await lamp('amber')()
    await p.waitForTimeout(3000)
    await act('the lamp turns green')
    await lamp('green')()
    await p.waitForTimeout(6000)
    await act('Scan once (what is around me)', () => document.querySelector('[data-testid="scan"]').click())
    await p.waitForTimeout(6000)
    await act('the lamp turns amber')
    await lamp('amber')()
    await p.waitForTimeout(3000)
    await act('the lamp turns red again')
    await lamp('red')()
    await p.waitForTimeout(5000)
    const out = { actions, spoken: await spoken() }
    await b.close()
    return out
  },

  // A night walk with a torch on the phone (a stand-in, which records when it is switched): a dark street 12 s, with
  // a person walking up from 6 m to 2 m just as the torch is due; a hand over the lens 10 s; the dark street again
  // 12 s; then a lit shop front 8 s.
  async torch() {
    const { b, p, act, spoken, actions } = await open()
    const t0 = await p.evaluate(() => {
      window.__torchLog = []
      window.__ssTorch = on => (window.__torchLog.push({ at: performance.now(), on }), true)
      return performance.now()
    })
    await p.getByTestId('start-stop').click()
    await p.waitForFunction(() => document.querySelector('video')?.readyState >= 2)
    await p.evaluate(() => {
      const v = document.querySelector('video')
      const c = document.createElement('canvas')
      c.width = 320
      c.height = 240
      const g = c.getContext('2d')
      window.__mode = 'lit'
      const blocks = (from, span) => {
        for (let y = 0; y < 240; y += 20)
          for (let x = 0; x < 320; x += 20) {
            const s = from + ((x * 7 + y * 13) % span)
            g.fillStyle = `rgb(${s},${s},${s})`
            g.fillRect(x, y, 20, 20)
          }
      }
      const draw = () => {
        if (window.__mode === 'hand') {
          g.fillStyle = '#000'
          g.fillRect(0, 0, 320, 240)
        } else if (window.__mode === 'dark') blocks(4, 37)
        else blocks(60, 150)
        requestAnimationFrame(draw)
      }
      draw()
      v.srcObject = c.captureStream(15)
      v.play()
    })
    const mode = m => () => p.evaluate(m => void (window.__mode = m), m)
    await p.evaluate(() => {
      // A person walking towards the user, 6 m to 2 m over 4 s, from the moment __walkAt is set (frame 320 x 240).
      window.__walkAt = null
      window.__ss.detector.detectForVideo = () => {
        const t = window.__walkAt === null ? -1 : (performance.now() - window.__walkAt) / 1000
        if (t < 0 || t > 6) return { detections: [] }
        const h = ((1.7 * 0.75) / Math.max(2, 6 - t)) * 240
        return {
          detections: [
            {
              categories: [{ categoryName: 'person', score: 0.8 }],
              boundingBox: { originX: 160 - 0.15 * h, originY: 240 - h, width: 0.3 * h, height: h },
            },
          ],
        }
      }
    })
    await p.waitForTimeout(5000)
    await act('walks into a dark street')
    await mode('dark')()
    await p.waitForTimeout(1500)
    await act('a person walks up from 6 m to 2 m ahead, over 4 s', () => void (window.__walkAt = performance.now()))
    await p.waitForTimeout(10500)
    await act('a hand covers the lens')
    await mode('hand')()
    await p.waitForTimeout(10000)
    await act('the hand is taken away: the dark street again')
    await mode('dark')()
    await p.waitForTimeout(12000)
    await act('reaches a lit shop front')
    await mode('lit')()
    await p.waitForTimeout(8000)
    const torch = await p.evaluate(
      t0 => window.__torchLog.map(e => ({ t: +((e.at - t0) / 1000).toFixed(1), torch: e.on ? 'on' : 'off' })),
      t0
    )
    const out = { actions, spoken: await spoken(), torch }
    await b.close()
    return out
  },

  // Help asked for with the camera watching and a person standing 4 m away on the left; nobody picks up (each call
  // rings 2 s here): the alarm for people nearby, stopped by a tap, after which the warnings come back.
  async alarm() {
    const { b, p, act, spoken, calls, actions } = await open()
    const screen = async () =>
      p.evaluate(() => ({
        title: document.querySelector('[data-testid="alert-title"]')?.textContent || null,
        button: document.querySelector('[data-testid="alert-cancel"]')?.getAttribute('aria-label') || null,
        alarm: document.querySelector('[data-testid="alert-cancel"]')?.getAttribute('data-alarm') === 'true',
      }))
    await p.evaluate(() => {
      window.__ssCall = number =>
        new Promise(resolve => {
          window.__calls.push({ at: performance.now(), number })
          setTimeout(() => resolve({ started: true, answered: false, seconds: 0 }), 2000)
        })
    })
    await p.getByTestId('start-stop').click()
    await p.waitForFunction(() => document.querySelector('video')?.readyState >= 2)
    await p.evaluate(() => {
      window.__ss.detector.detectForVideo = () => ({
        detections: [
          {
            categories: [{ categoryName: 'person', score: 0.8 }],
            boundingBox: { originX: 86, originY: 327, width: 46, height: 153 },
          },
        ],
      })
    })
    await act('camera watching, a person standing 4 m away on the left')
    await p.waitForTimeout(4000)
    await act('volume-down held 2 s', () => window.dispatchEvent(new Event('volumeDownHold')))
    await p.waitForSelector('[data-testid="alert-cancel"][data-alarm="true"]', { timeout: 120000 })
    await act('the alarm starts sounding')
    actions.push({ t: null, action: 'screen while the alarm sounds', screen: await screen() })
    await p.waitForTimeout(4000)
    await act('tap anywhere (stop the alarm)', () => document.querySelector('[data-testid="alert-cancel"]').click())
    await p.waitForTimeout(6000)
    actions.push({ t: null, action: 'screen after the tap', screen: await screen() })
    const out = { actions, spoken: await spoken(), calls: await calls() }
    await b.close()
    return out
  },
}

;(async () => {
  const which = process.argv[2] && process.argv[2] !== 'all' ? [process.argv[2]] : Object.keys(scenes)
  const result = {}
  for (const name of which) result[name] = await scenes[name]()
  console.log(JSON.stringify(result, null, 1))
})()
