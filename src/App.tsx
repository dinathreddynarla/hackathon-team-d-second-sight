import { Box, Stack, Typography } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import { useEffect, useRef, useState } from 'react'

import { FallAlert } from './components/FallAlert'
import { LaneStrip } from './components/LaneStrip'
import { StatusBar } from './components/StatusBar'
import { useCamera } from './features/camera/useCamera'
import { watchFalls } from './features/safety/fall'
import { useSos } from './features/safety/useSos'
import { SettingsDialog } from './features/settings/SettingsDialog'
import { SetupDialog } from './features/settings/SetupDialog'
import { useSettings } from './features/settings/settings'
import { phrase, setVoiceFailureHandler, speak, type Lang } from './features/speech/speech'
import { useDetection } from './features/vision/useDetection'
import { isNative, onVolumeDouble, requestSosPermissions } from './native/setup'
import { color, radius } from './theme'
import { Bubble, Glass } from './ui/bubbles'
import { GlobeIcon, ScanIcon, SettingsIcon, WearFigure } from './ui/icons'
import { UI } from './ui/strings'

// The one authored moment: the label settles in when Start becomes Stop and back.
const settle = keyframes({
  from: { opacity: 0.5, transform: 'scale(0.94)' },
  to: { opacity: 1, transform: 'scale(1)' },
})

// Layout rule: one large Start / Stop bubble fills the bottom of the screen. A blind user finds it by touch alone.
export function App() {
  const [settings, update] = useSettings()
  // English for this session only, when the chosen language's voice cannot speak. The saved choice is kept.
  const [voiceFallback, setVoiceFallback] = useState(false)
  const lang: Lang = voiceFallback ? 'en' : settings.lang
  const langRef = useRef(lang)
  langRef.current = lang
  const s = UI[lang]
  const camera = useCamera()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const running = camera.state === 'running'
  const sos = useSos(lang, settings.sosNumber)
  // Detection keeps quiet while the fall alert is asking or sending, and resumes once the result is showing.
  const alertBusy = sos.state === 'countdown' || sos.state === 'sending'
  const detection = useDetection(camera.videoRef, canvasRef, running && !alertBusy, lang)
  const { model } = detection
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(!settings.setupDone)
  const lastTapRef = useRef(0)
  const primaryRef = useRef<HTMLButtonElement>(null)

  const start = async () => {
    if ((await camera.start()) && model !== 'missing') void speak(phrase('ready', lang), lang)
  }
  const stop = () => {
    camera.stop()
    void speak(phrase('stopped', lang), lang)
  }

  // Failures are spoken, not only shown: on Start, and when the camera restarts after the app was hidden.
  useEffect(() => {
    if (camera.state === 'error') void speak(phrase('cameraFailed', langRef.current), langRef.current)
    else if (camera.state === 'running' && model === 'missing')
      void speak(phrase('modelMissing', langRef.current), langRef.current)
  }, [camera.state, model])

  // A voice that cannot speak must not mean silence: fall back to English and say why.
  useEffect(() => {
    setVoiceFailureHandler(() => {
      setVoiceFallback(true)
      void speak(phrase('voiceMissing', 'en'), 'en')
    })
    return () => setVoiceFailureHandler(null)
  }, [])

  // Saying the language's name in its own voice confirms the switch, and shows up a missing voice at once.
  const changeLang = (next: Lang) => {
    setVoiceFallback(false)
    update({ lang: next })
    void speak(phrase('languageName', next), next)
  }
  // A screen reader pronounces the labels with the right voice only if the page says which language it is in.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // Scan once: double tap the camera view, or press volume-up twice (native only).
  const scan = detection.scan
  useEffect(() => onVolumeDouble(() => void scan()), [scan])
  const onVideoTap = () => {
    const now = performance.now()
    if (now - lastTapRef.current < 400) scan()
    lastTapRef.current = now
  }

  // Fall watch runs only while the app is in use; a fall starts the SOS countdown.
  const startSos = sos.start
  useEffect(() => {
    if (!running || !isNative) return
    return watchFalls(startSos)
  }, [running, startSos])

  // Whenever the main screen is what the user is on, focus rests on Start / Stop, so a screen reader's
  // double-tap anywhere starts or stops without hunting for the control.
  const alertOpen = sos.state !== 'idle'
  useEffect(() => {
    if (!setupOpen && !settingsOpen && !alertOpen) primaryRef.current?.focus({ preventScroll: true })
  }, [setupOpen, settingsOpen, alertOpen])

  return (
    <Stack component="main" sx={{ height: '100%', p: 2, gap: 1.5 }}>
      <Stack direction="row" sx={{ alignItems: 'center', minHeight: 48 }}>
        <Typography variant="h1" sx={{ flex: 1 }}>
          {s.appName}
        </Typography>
        <Bubble
          aria-label={s.settings}
          data-testid="settings-open"
          onClick={() => setSettingsOpen(true)}
          sx={{ width: 48, minWidth: 48, minHeight: 48, p: 0 }}
        >
          <SettingsIcon />
        </Bubble>
      </Stack>

      <Box
        onClick={onVideoTap}
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          borderRadius: `${radius.card}px`,
          overflow: 'hidden',
          bgcolor: color.kerb,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
        }}
      >
        <video
          ref={camera.videoRef}
          playsInline
          muted
          aria-hidden
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <canvas
          ref={canvasRef}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />
        {!running && (
          <Stack
            data-testid="idle-panel"
            sx={{
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              px: 3,
              pt: 7.5,
              pb: 2,
              textAlign: 'center',
              bgcolor: color.kerb,
            }}
          >
            {/* Shrinks before anything else does: on a short screen the words keep their room. */}
            <Box
              sx={{
                flex: '0 1 132px',
                minHeight: 0,
                aspectRatio: '1',
                color: color.paving,
                '@media (max-height: 600px)': { display: 'none' },
              }}
            >
              <WearFigure />
            </Box>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700 }}>{s.wearTitle}</Typography>
            <Typography sx={{ color: color.chalk }}>{s.wearBody}</Typography>
            {camera.error && (
              <Typography data-testid="camera-error" variant="body2" sx={{ color: color.alarm }}>
                {camera.error}
              </Typography>
            )}
          </Stack>
        )}
        <Box sx={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex' }}>
          <StatusBar model={model} camera={camera.state} lang={lang} />
        </Box>
        {running && (
          <Glass
            data-testid="caption"
            sx={{
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: 12,
              minHeight: 52,
              display: 'grid',
              placeItems: 'center',
              px: 2.5,
              py: 1,
              borderRadius: '26px',
              textAlign: 'center',
              fontSize: '1.25rem',
              fontWeight: 650,
              lineHeight: 1.25,
            }}
          >
            {detection.lastSaid || s.watchingHint}
          </Glass>
        )}
      </Box>

      <LaneStrip lane={detection.lane} lang={lang} />

      <Stack direction="row" sx={{ gap: 1.5 }}>
        <Bubble
          data-testid="scan"
          aria-label={s.scanLabel}
          disabled={!running || model !== 'ready'}
          onClick={() => scan()}
          sx={{ flex: 1 }}
        >
          <ScanIcon />
          {s.scan}
        </Bubble>
        <Bubble
          data-testid="lang-toggle"
          aria-label={s.switchLanguage}
          onClick={() => changeLang(lang === 'en' ? 'te' : 'en')}
          sx={{ flex: 1 }}
        >
          <GlobeIcon />
          {s.languageName}
        </Bubble>
      </Stack>

      <Bubble
        ref={primaryRef}
        tone={running ? 'stop' : 'go'}
        texture={running ? 'dots' : 'bars'}
        data-testid="start-stop"
        data-state={camera.state}
        aria-label={running ? s.stopLabel : s.startLabel}
        onClick={running ? stop : start}
        sx={{ minHeight: '26vh', borderRadius: `${radius.hero}px`, fontSize: '2.25rem', fontWeight: 800 }}
      >
        <Box
          component="span"
          key={running ? 'stop' : 'go'}
          sx={{
            animation: `${settle} 260ms cubic-bezier(0.16, 1, 0.3, 1)`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          {running ? s.stop : s.start}
        </Box>
      </Bubble>

      <SetupDialog
        open={setupOpen}
        lang={lang}
        sosNumber={settings.sosNumber}
        onLang={changeLang}
        onClose={() => setSetupOpen(false)}
        onDone={sosNumber => {
          update({ sosNumber, setupDone: true })
          setSetupOpen(false)
        }}
      />
      <SettingsDialog
        open={settingsOpen}
        lang={lang}
        sosNumber={settings.sosNumber}
        k={detection.k}
        fps={detection.fps}
        running={running}
        onClose={() => {
          setSettingsOpen(false)
          // Ask for SMS and location now, while someone can answer, not when a fall has already happened.
          if (settings.sosNumber) void requestSosPermissions()
        }}
        onLang={changeLang}
        onSosNumber={n => update({ sosNumber: n })}
        onCalibrate={detection.calibrate}
        onRunSetup={() => {
          setSettingsOpen(false)
          setSetupOpen(true)
        }}
        onTestFall={() => {
          setSettingsOpen(false)
          sos.start()
        }}
      />
      <FallAlert state={sos.state} secondsLeft={sos.secondsLeft} lang={lang} onCancel={sos.cancel} />
    </Stack>
  )
}
