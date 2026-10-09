import { Box, Button, Dialog, IconButton, Stack, Typography } from '@mui/material'
import { useEffect, useRef, useState } from 'react'

import { StatusBar } from './components/StatusBar'
import { useCamera } from './features/camera/useCamera'
import { watchFalls } from './features/safety/fall'
import { useSos } from './features/safety/useSos'
import { SettingsDialog } from './features/settings/SettingsDialog'
import { SetupDialog } from './features/settings/SetupDialog'
import { useSettings } from './features/settings/settings'
import { announce, setVoiceFailureHandler, type Lang } from './features/speech/speech'
import { useDetection } from './features/vision/useDetection'
import { isNative, onVolumeDouble, requestSosPermissions } from './native/setup'

// Layout rule: one large Start / Stop button fills the bottom of the screen. A blind user finds it by touch alone.
export function App() {
  const [settings, update] = useSettings()
  // English for this session only, when the chosen language's voice cannot speak. The saved choice is kept.
  const [voiceFallback, setVoiceFallback] = useState(false)
  const lang: Lang = voiceFallback ? 'en' : settings.lang
  const langRef = useRef(lang)
  langRef.current = lang
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

  const start = async () => {
    if ((await camera.start()) && model !== 'missing') announce('ready', lang)
  }
  const stop = () => {
    camera.stop()
    announce('stopped', lang)
  }

  // Failures are spoken, not only shown: on Start, and when the camera restarts after the app was hidden.
  useEffect(() => {
    if (camera.state === 'error') announce('cameraFailed', langRef.current)
    else if (camera.state === 'running' && model === 'missing') announce('modelMissing', langRef.current)
  }, [camera.state, model])

  // A voice that cannot speak must not mean silence: fall back to English and say why.
  useEffect(() => {
    setVoiceFailureHandler(() => {
      setVoiceFallback(true)
      announce('voiceMissing', 'en')
    })
    return () => setVoiceFailureHandler(null)
  }, [])

  // Saying the language's name in its own voice confirms the switch, and shows up a missing voice at once.
  const changeLang = (next: Lang) => {
    setVoiceFallback(false)
    update({ lang: next })
    announce('languageName', next)
  }

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

  return (
    <Stack sx={{ height: '100%', p: 2, gap: 2 }}>
      <Stack direction="row" sx={{ alignItems: 'center' }}>
        <Typography variant="h5" component="h1" sx={{ flex: 1, textAlign: 'center' }}>
          Second Sight
        </Typography>
        <IconButton aria-label="Settings" onClick={() => setSettingsOpen(true)} sx={{ fontSize: '1.6rem' }}>
          ⚙
        </IconButton>
      </Stack>
      <StatusBar model={model} camera={camera.state} fps={detection.fps} />
      <Box
        onClick={onVideoTap}
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          borderRadius: 3,
          overflow: 'hidden',
          bgcolor: 'background.paper',
        }}
      >
        <video ref={camera.videoRef} playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />
        <Typography
          variant="h6"
          aria-live="polite"
          sx={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            p: 1.5,
            textAlign: 'center',
            bgcolor: 'rgba(0,0,0,.6)',
          }}
        >
          {detection.lastSaid || (running ? 'Watching… double-tap to scan' : camera.error || 'Tap Start')}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          onClick={() => changeLang(lang === 'en' ? 'te' : 'en')}
          sx={{ flex: 1, fontSize: '1rem' }}
        >
          {lang === 'en' ? 'English' : 'తెలుగు'}
        </Button>
        <Button
          variant="outlined"
          disabled={!running || model !== 'ready'}
          onClick={() => scan()}
          sx={{ flex: 1, fontSize: '1rem' }}
        >
          Scan once
        </Button>
      </Stack>
      <Button
        variant={running ? 'outlined' : 'contained'}
        color={running ? 'error' : 'primary'}
        aria-label={running ? 'Stop Second Sight' : 'Start Second Sight'}
        onClick={running ? stop : start}
        sx={{ minHeight: '26vh' }}
      >
        {running ? 'Stop' : 'Start'}
      </Button>
      <SetupDialog
        open={setupOpen}
        lang={lang}
        sosNumber={settings.sosNumber}
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
      {/* An overlay, not a replacement screen: the camera view underneath must stay mounted or detection dies. */}
      <Dialog fullScreen open={sos.state !== 'idle'} transitionDuration={0} aria-labelledby="sos-title">
        <Stack sx={{ height: '100%', p: 2, gap: 2 }}>
          <Typography id="sos-title" variant="h4" component="h1" sx={{ textAlign: 'center' }}>
            {sos.state === 'countdown'
              ? `Help in ${sos.secondsLeft} s`
              : sos.state === 'sending'
                ? 'Sending…'
                : sos.state === 'sent'
                  ? 'Help message sent'
                  : sos.state === 'failed'
                    ? 'Could not send'
                    : ''}
          </Typography>
          <Button
            variant="contained"
            color="error"
            aria-label={sos.state === 'countdown' ? 'I am okay, cancel' : 'Back'}
            onClick={sos.cancel}
            sx={{ flex: 1, fontSize: '2rem' }}
          >
            {sos.state === 'countdown' ? "I'm OK, cancel" : 'Back'}
          </Button>
        </Stack>
      </Dialog>
    </Stack>
  )
}
