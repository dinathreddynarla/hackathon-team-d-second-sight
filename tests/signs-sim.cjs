// Road-sign check: plays sign photos as the camera (y4m), runs the real app and its sign model, records what is spoken.
// Usage: node tests/signs-sim.cjs <video.y4m>   (preview server on :4173)
const { chromium } = require(
  process.env.PLAYWRIGHT_PATH ||
    '/Users/dinathnarla/apty/projects/apty-dap-clone-1/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright'
)
;(async () => {
  const b = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${process.argv[2]}`,
    ],
  })
  const ctx = await b.newContext({ permissions: ['camera'], viewport: { width: 420, height: 860 } })
  const p = await ctx.newPage()
  const errs = []
  p.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 200))
  })
  await p.addInitScript(() => {
    window.__spoken = []
    const orig = speechSynthesis.speak.bind(speechSynthesis)
    speechSynthesis.speak = u => {
      window.__spoken.push({ at: performance.now(), text: u.text })
      orig(u)
    }
    const gum = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
    navigator.mediaDevices.getUserMedia = c => gum({ ...c, video: true })
    localStorage.setItem(
      'secondsight.settings',
      JSON.stringify({ lang: 'en', sosNumber: '', setupDone: true, dim: true })
    )
    localStorage.setItem('secondsight.delegate', 'CPU')
  })
  await p.goto('http://localhost:4173/')
  await p.waitForFunction(() => window.__ss, null, { timeout: 60000 })
  await p.getByTestId('start-stop').click()
  const t0 = await p.evaluate(() => performance.now())
  const samples = []
  for (let i = 0; i < 22; i++) {
    await p.waitForTimeout(1000)
    samples.push(await p.evaluate(() => window.__ss.signs))
  }
  const spoken = await p.evaluate(
    t0 => window.__spoken.map(s => ({ t: +((s.at - t0) / 1000).toFixed(1), text: s.text })),
    t0
  )
  console.log(
    JSON.stringify(
      {
        spoken,
        inferenceMs: samples.filter(Boolean).map(s => s.ms),
        lastHits: samples.filter(Boolean).map(s => s.hits.map(h => h.key).join(',')),
        errs,
      },
      null,
      1
    )
  )
  await b.close()
})()
