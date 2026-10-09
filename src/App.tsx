import { Box, Button, IconButton, Stack, Typography } from '@mui/material'
import { useEffect, useRef, useState } from 'react'

import { StatusBar } from './components/StatusBar'
import { useCamera } from './features/camera/useCamera'
import { watchFalls } from './features/safety/fall'
import { useSos } from './features/safety/useSos'
import { SettingsDialog } from './features/settings/SettingsDialog'
import { SetupDialog } from './features/settings/SetupDialog'
import { useSettings } from './features/settings/settings'
import { phrase, speak } from './features/speech/speech'
import { useDetection } from './features/vision/useDetection'
import { isNative, onVolumeDouble } from './native/setup'

// Layout rule: Stop is the top half, Start is the bottom half. A blind user finds them by touch alone.
export function App() {
  const [settings, update] = useSettings()
  const { lang } = settings
  const camera = useCamera()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const running = camera.state === 'running'
  const detection = useDetection(camera.videoRef, canvasRef, running, lang)
  const sos = useSos(lang, settings.sosNumber)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(!settings.setupDone)
  const lastTapRef = useRef(0)

  const start = async () => {
    await camera.start()
    void speak(phrase('ready', lang), lang)
  }
  const stop = () => {
    camera.stop()
    void speak(phrase('stopped', lang), lang)
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

  if (sos.state !== 'idle') {
    return (
      <Stack sx={{ height: '100%', p: 2, gap: 2 }}>
        <Typography variant="h4" component="h1" sx={{ textAlign: 'center' }}>
          {sos.state === 'countdown'
            ? `Help in ${sos.secondsLeft} s`
            : sos.state === 'sending'
              ? 'Sending…'
              : sos.state === 'sent'
                ? 'Help message sent'
                : 'Could not send'}
        </Typography>
        <Button
          variant="contained"
          color="error"
          aria-label="I am okay, cancel"
          onClick={sos.cancel}
          sx={{ flex: 1, fontSize: '2rem' }}
        >
          {sos.state === 'countdown' ? "I'm OK, cancel" : 'Back'}
        </Button>
      </Stack>
    )
  }

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
      <StatusBar model={detection.model} camera={camera.state} fps={detection.fps} />
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
          onClick={() => update({ lang: lang === 'en' ? 'te' : 'en' })}
          sx={{ flex: 1, fontSize: '1rem' }}
        >
          {lang === 'en' ? 'English' : 'తెలుగు'}
        </Button>
        <Button variant="outlined" disabled={!running} onClick={() => scan()} sx={{ flex: 1, fontSize: '1rem' }}>
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
        onClose={() => setSettingsOpen(false)}
        onLang={l => update({ lang: l })}
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
    </Stack>
  )
}
