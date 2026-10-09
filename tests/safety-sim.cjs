// Safety simulation: battery alerts, camera view alerts (blocked lens, dark scene) and the manual SOS gesture.
// Runs the real app (vite preview on :4173) headless and records every sentence with what the harness did at the time.
// Usage: node tests/safety-sim.cjs [battery|camera|sos|all]  → prints JSON { scene: { actions, spoken } }
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
  try {
    localStorage.setItem(
      'secondsight.settings',
      JSON.stringify({ lang: 'en', sosNumber: '9999999999', setupDone: true })
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
  return { b, p, act, spoken, actions }
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

  // Camera running: covered lens 10 s, clear 6 s, dark street 10 s, clear again.
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
    const out = { actions, spoken: await spoken() }
    await b.close()
    return out
  },

  // Volume-down held → 10 s countdown → message (fails in a browser: no SIM) → call offer. Then again, cancelled at 2 s.
  async sos() {
    const { b, p, act, spoken, actions } = await open()
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
    actions.push({ t: null, action: 'screen after sending', screen: await screen() })
    await act('tap anywhere (call)', () => document.querySelector('[data-testid="alert-cancel"]').click())
    await p.waitForTimeout(1500)
    actions.push({ t: null, action: 'screen after tap', screen: await screen() })
    await act('volume-down held 2 s again', () => window.dispatchEvent(new Event('volumeDownHold')))
    await p.waitForTimeout(2000)
    await act('tap anywhere during countdown (cancel)', () =>
      document.querySelector('[data-testid="alert-cancel"]').click()
    )
    await p.waitForTimeout(3000)
    actions.push({ t: null, action: 'screen after cancel', screen: await screen() })
    const out = { actions, spoken: await spoken() }
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
