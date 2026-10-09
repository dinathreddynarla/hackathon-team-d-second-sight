// Voice simulation harness for Second Sight.
// Runs the real app (vite preview on :4173) in headless Chromium with a fake camera, replaces the detector with
// scripted street scenarios, and records every sentence the app tries to speak with timestamps and whether it
// cut off the previous one. Usage: node voice-sim.cjs [scenario|all]  → prints JSON transcript.
// Playwright is not a dependency of the app; point PLAYWRIGHT_PATH at any installed copy (default: the apty-dap repo's).
const { chromium } = require(
  process.env.PLAYWRIGHT_PATH ||
    '/Users/dinathnarla/apty/projects/apty-dap-clone-1/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright'
)

// Frame is 640x480 (fake camera). Box height from the app's own formula: ratio = realH * K / distance, K = 1.3 default.
const K = 0.75 // must match DEFAULT_K in src/features/vision/distance.ts
const REAL = { person: 1.7, car: 1.5, motorcycle: 1.5, bus: 3.0, dog: 0.5 }
const W = 640,
  H = 480
function box(label, distance, side, score = 0.8) {
  const h = Math.min(H, ((REAL[label] * K) / distance) * H)
  const w = Math.min(W, h * (label === 'person' ? 0.3 : label === 'bus' ? 0.83 : label === 'dog' ? 0.8 : 1.2)) // real width/height per class // clipped at the frame edge like a real box
  const cx = side === 'left' ? W * 0.17 : side === 'right' ? W * 0.83 : W * 0.5
  return {
    categories: [{ categoryName: label, score }],
    boundingBox: { originX: cx - w / 2, originY: H - h, width: w, height: h },
  }
}

// The helpers above, as source, so scenario functions can run inside the page.
const PRELUDE = `const K = ${K}; const REAL = ${JSON.stringify(REAL)}; const W = ${W}, H = ${H}; ${box.toString()}`

// Each scenario: function of elapsed seconds → detections + ground truth for the nearest object.
const scenarios = {
  // A person walks towards the user from 10 m to 1 m over 9 s at walking pace (1 m/s).
  approachingPerson: t => {
    const d = Math.max(1, 10 - t)
    return {
      dets: t < 10 ? [box('person', d, 'ahead')] : [],
      truth: t < 10 ? { label: 'person', d, side: 'ahead' } : null,
    }
  },
  // A person stands still at exactly 3 m, ahead, for 6 s. The user's complaint: "says 5 metres".
  personAt3m: t => ({
    dets: t < 6 ? [box('person', 3, 'ahead')] : [],
    truth: t < 6 ? { label: 'person', d: 3, side: 'ahead' } : null,
  }),
  // A car passes left to right at 8 m, 6 s, while a person stands at 12 m ahead.
  carPassing: t => {
    const side = t < 2 ? 'left' : t < 4 ? 'ahead' : 'right'
    return {
      dets: t < 6 ? [box('car', 8, side), box('person', 12, 'ahead', 0.6)] : [],
      truth: t < 6 ? { label: 'car', d: 8, side } : null,
    }
  },
  // Bus stop: bus comes from 30 m to 2 m over 10 s, two people beside at 2 m left (static).
  busStop: t => {
    const d = Math.max(2, 30 - 2.8 * t)
    return {
      dets: [box('bus', d, 'right'), box('person', 2.2, 'left'), box('person', 2.4, 'left')],
      truth: { label: d <= 2.2 ? 'bus' : 'person', d: Math.min(d, 2.2), side: d <= 2.2 ? 'right' : 'left' },
    }
  },
  // Crowd: five people between 2 and 6 m, static, then a scan-once at t=3.
  crowd: t => ({
    dets: [
      box('person', 2, 'left'),
      box('person', 3, 'ahead'),
      box('person', 4, 'right'),
      box('person', 5, 'ahead'),
      box('person', 6, 'left'),
    ],
    truth: { label: 'person', d: 2, side: 'left' },
    scanAt: 3,
  }),
  // Empty street for 5 s, then a dog runs across at 4 m.
  dogDash: t => {
    if (t < 5) return { dets: [], truth: null }
    const side = t < 6 ? 'left' : t < 7 ? 'ahead' : 'right'
    return { dets: t < 8 ? [box('dog', 4, side)] : [], truth: t < 8 ? { label: 'dog', d: 4, side } : null }
  },
}

async function run(name, scenario) {
  const b = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--use-gl=swiftshader',
      '--ignore-gpu-blocklist',
    ],
  })
  const ctx = await b.newContext({ permissions: ['camera'], viewport: { width: 420, height: 860 } })
  const p = await ctx.newPage()
  // speech recorder: logs each utterance, estimates its spoken duration (~2.6 words/s at rate 1), marks cut-offs
  await p.addInitScript(() => {
    // The scripted scenes test warnings and alerts: the depth and sign models would only react to the fake
    // camera's flat test pattern, so their workers are replaced with silent ones here (footage-sim runs them for real).
    window.Worker = class {
      constructor() {}
      postMessage() {}
      terminate() {}
    }
    window.__spoken = []
    let current = null
    const orig = speechSynthesis.speak.bind(speechSynthesis)
    speechSynthesis.cancel = () => {
      if (current && performance.now() < current.endsAt) {
        current.cutOff = true
      }
      current = null
    }
    speechSynthesis.speak = u => {
      const words = u.text.split(/\s+/).length
      const dur = ((words / 2.6) * 1000) / (u.rate || 1) + 300
      current = {
        t: 0,
        text: u.text,
        lang: u.lang,
        rate: u.rate,
        durMs: Math.round(dur),
        endsAt: performance.now() + dur,
        cutOff: false,
      }
      window.__spoken.push(current)
      orig(u)
    }
    try {
      localStorage.setItem('secondsight.settings', JSON.stringify({ lang: 'en', sosNumber: '', setupDone: true }))
    } catch {}
  })
  await p.goto('http://localhost:4173/')
  await p.waitForFunction(() => window.__ss, null, { timeout: 30000 })
  await p.getByRole('button', { name: /Start/ }).click()
  await p.waitForFunction(() => document.querySelector('video')?.readyState >= 2, null, { timeout: 10000 })
  // install the scripted detector
  await p.evaluate(
    ([src, prelude]) => {
      const fn = new Function(prelude + '; return ' + src)()
      const t0 = performance.now()
      window.__t0 = t0
      window.__truth = []
      window.__ss.detector.detectForVideo = () => {
        const t = (performance.now() - t0) / 1000
        const { dets, truth } = fn(t)
        window.__truth.push({ t: +t.toFixed(2), truth })
        return { detections: dets }
      }
      window.__spokenStart = window.__spoken.length
    },
    [scenario.toString(), PRELUDE]
  )
  const scanAt = scenario(0).scanAt
  if (scanAt) {
    await p.waitForTimeout(scanAt * 1000)
    await p.getByRole('button', { name: 'Scan once' }).click()
    await p.waitForTimeout(9000 - scanAt * 1000)
  } else await p.waitForTimeout(12000)
  const out = await p.evaluate(() => {
    const t0 = window.__t0
    const spoken = window.__spoken
      .slice(window.__spokenStart)
      .map(s => ({ ...s, t: +((s.endsAt - s.durMs - t0) / 1000).toFixed(2) }))
    // ground truth at the moment each sentence started
    const truthAt = t => {
      let best = null
      for (const r of window.__truth) if (r.t <= t) best = r.truth
      return best
    }
    return spoken.map(s => ({ t: s.t, text: s.text, durMs: s.durMs, cutOff: s.cutOff, truthWhenSpoken: truthAt(s.t) }))
  })
  await b.close()
  return out
}

;(async () => {
  const which = process.argv[2] && process.argv[2] !== 'all' ? [process.argv[2]] : Object.keys(scenarios)
  const result = {}
  for (const name of which) result[name] = await run(name, scenarios[name])
  console.log(JSON.stringify(result, null, 1))
})()
