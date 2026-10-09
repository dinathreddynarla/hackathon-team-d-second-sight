import { Box, Button, Stack, Typography } from '@mui/material'

import { StatusBar } from './components/StatusBar'
import { useCamera } from './features/camera/useCamera'

// Layout rule: Stop is the top half, Start is the bottom half. A blind user finds them by touch alone.
export function App() {
  const camera = useCamera()
  const running = camera.state === 'running'

  return (
    <Stack sx={{ height: '100dvh', p: 2, gap: 2 }}>
      <Typography variant="h5" component="h1" sx={{ textAlign: 'center' }}>
        Second Sight
      </Typography>
      <StatusBar model="missing" camera={camera.state} />
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
        {camera.error && (
          <Typography
            color="error"
            sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', p: 2 }}
          >
            {camera.error}
          </Typography>
        )}
      </Box>
      <Button
        variant={running ? 'outlined' : 'contained'}
        color={running ? 'error' : 'primary'}
        aria-label={running ? 'Stop Second Sight' : 'Start Second Sight'}
        onClick={running ? camera.stop : camera.start}
        sx={{ minHeight: '30vh' }}
      >
        {running ? 'Stop' : 'Start'}
      </Button>
    </Stack>
  )
}
