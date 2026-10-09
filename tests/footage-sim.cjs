// Real-footage simulation: plays a phone video into the real app as the camera, runs the REAL detector,
// records every spoken sentence and saves the camera frame (with the app's box overlay) at that moment,
// so a reviewer can look at what was in front of the lens when each sentence was spoken.
// Usage: node tests/footage-sim.cjs <video.mp4|.y4m> [outDir]
// Needs: ffmpeg on PATH (mp4 → y4m conversion), a preview server on http://localhost:4173.
const { chromium } = require(
  process.env.PLAYWRIGHT_PATH ||
    '/Users/dinathnarla/apty/projects/apty-dap-clone-1/node_modules/.pnpm/playwright@1.59.1/node_modules/playwright'
)
const { execFileSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const input = process.argv[2]
const outDir = process.argv[3] || path.join(path.dirname(input), path.basename(input, path.extname(input)) + '-sim')
fs.mkdirSync(outDir, { recursive: true })

// Chromium's fake camera only reads .y4m (or .mjpeg). Portrait 480x640 matches what the phone app requests.
let y4m = input
if (!input.endsWith('.y4m')) {
  y4m = path.join(outDir, 'input.y4m')
  if (!fs.existsSync(y4m)) {
    const probe = JSON.parse(
      execFileSync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_streams', input]).toString()
    )
    const v = probe.streams.find(s => s.codec_type === 'video')
    const rotated =
      (v.side_data_list || []).some(d => Math.abs(d.rotation || 0) === 90) ||
      (v.tags && /90|270/.test(v.tags.rotate || ''))
    console.error(`converting ${input} (${v.width}x${v.height}${rotated ? ', rotated' : ''}) → ${y4m}`)
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-v',
        'error',
        '-i',
        input,
        '-vf',
        'scale=480:640:force_original_aspect_ratio=increase,crop=480:640,fps=15',
        '-pix_fmt',
        'yuv420p',
        y4m,
      ],
      { stdio: 'inherit' }
    )
  }
}

;(async () => {
  const b = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      `--use-file-for-fake-video-capture=${y4m}`,
      '--use-gl=swiftshader',
      '--ignore-gpu-blocklist',
    ],
  })
  const ctx = await b.newContext({ permissions: ['camera'], viewport: { width: 420, height: 860 } })
  const p = await ctx.newPage()
  await p.addInitScript(() => {
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
    try {
      localStorage.setItem('secondsight.settings', JSON.stringify({ lang: 'en', sosNumber: '', setupDone: true }))
      localStorage.setItem('secondsight.delegate', 'CPU') // same delegate as the APK
    } catch {}
  })
  await p.goto('http://localhost:4173/')
  await p.waitForFunction(() => window.__ss, null, { timeout: 60000 })
  await p.getByRole('button', { name: /Start/ }).click()
  await p.waitForFunction(() => document.querySelector('video')?.readyState >= 2, null, { timeout: 15000 })
  const t0 = await p.evaluate(() => performance.now())
  const durationS =
    Number(
      execFileSync('ffprobe', ['-v', 'quiet', '-show_entries', 'format=duration', '-of', 'csv=p=0', y4m]).toString()
    ) || 120
  console.error(`running the real detector over ${durationS.toFixed(0)} s of footage…`)

  // Poll: whenever a new sentence appears, grab the frame + overlay at that moment.
  const seen = new Set()
  const rows = []
  const deadline = Date.now() + durationS * 1000 + 3000
  while (Date.now() < deadline) {
    const fresh = await p.evaluate(() =>
      window.__spoken.map((s, i) => ({ i, at: s.at, text: s.text, durMs: s.durMs, cutOff: s.cutOff }))
    )
    for (const s of fresh) {
      if (seen.has(s.i)) continue
      seen.add(s.i)
      const t = +((s.at - t0) / 1000).toFixed(1)
      const file = `${String(rows.length + 1).padStart(2, '0')}-t${t}s.jpg`
      const jpg = await p.evaluate(() => {
        const v = document.querySelector('video'),
          ov = document.querySelector('canvas')
        const c = document.createElement('canvas')
        c.width = v.videoWidth
        c.height = v.videoHeight
        const g = c.getContext('2d')
        g.drawImage(v, 0, 0)
        if (ov) g.drawImage(ov, 0, 0, c.width, c.height)
        return c.toDataURL('image/jpeg', 0.7).split(',')[1]
      })
      fs.writeFileSync(path.join(outDir, file), Buffer.from(jpg, 'base64'))
      const chosen = await p.evaluate(() => window.__ss.chosen)
      rows.push({ t, text: s.text, durMs: s.durMs, cutOff: s.cutOff, chosen, frame: file })
      console.error(`${t}s  "${s.text}"  → ${file}`)
    }
    await p.waitForTimeout(150)
  }
  const fps = await p.evaluate(() => [...document.querySelectorAll('.MuiChip-label')].map(e => e.textContent))
  fs.writeFileSync(
    path.join(outDir, 'transcript.json'),
    JSON.stringify({ video: input, chips: fps, sentences: rows }, null, 1)
  )
  console.log(
    JSON.stringify({ outDir, sentences: rows.length, cutOffs: rows.filter(r => r.cutOff).length, chips: fps })
  )
  await b.close()
})()
