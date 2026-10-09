import { Box, Button, Stack, Typography } from '@mui/material'
import { useRef, useState } from 'react'

import { StatusBar } from './components/StatusBar'
import { useCamera } from './features/camera/useCamera'
import { phrase, speak, type Lang } from './features/speech/speech'
import { useDetection } from './features/vision/useDetection'

// Layout rule: Stop is the top half, Start is the bottom half. A blind user finds them by touch alone.
export function App() {
  const camera = useCamera()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [lang, setLang] = useState<Lang>('en')
  const running = camera.state === 'running'
  const detection = useDetection(camera.videoRef, canvasRef, running, lang)

  const start = async () => {
    await camera.start()
    void speak(phrase('ready', lang), lang)
  }
  const stop = () => {
    camera.stop()
    void speak(phrase('stopped', lang), lang)
  }

  return (
    <Stack sx={{ height: '100dvh', p: 2, gap: 2 }}>
      <Typography variant="h5" component="h1" sx={{ textAlign: 'center' }}>
        Second Sight
      </Typography>
      <StatusBar model={detection.model} camera={camera.state} fps={detection.fps} />
      <Box
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
          {detection.lastSaid || (running ? 'Watching…' : camera.error || 'Tap Start')}
        </Typography>
      </Box>
      <Stack direction="row" spacing={1}>
        <Button
          variant="outlined"
          onClick={() => setLang(l => (l === 'en' ? 'te' : 'en'))}
          sx={{ flex: 1, fontSize: '1rem' }}
        >
          {lang === 'en' ? 'English' : 'తెలుగు'}
        </Button>
        <Button
          variant="outlined"
          disabled={!running}
          onClick={() => void speak(detection.calibrate() ? 'calibrated' : 'no person in view', lang)}
          sx={{ flex: 1, fontSize: '1rem' }}
        >
          Calibrate at 5 m
        </Button>
      </Stack>
      <Button
        variant={running ? 'outlined' : 'contained'}
        color={running ? 'error' : 'primary'}
        aria-label={running ? 'Stop Second Sight' : 'Start Second Sight'}
        onClick={running ? stop : start}
        sx={{ minHeight: '28vh' }}
      >
        {running ? 'Stop' : 'Start'}
      </Button>
    </Stack>
  )
}
