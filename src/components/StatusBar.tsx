import { Chip, Stack } from '@mui/material'
import { useEffect, useState } from 'react'

type Props = { model: 'loading' | 'ready' | 'missing'; camera: string; fps: number }

// The two chips judges look at: the app must say "Network off" and "Model ready" in airplane mode.
export function StatusBar({ model, camera, fps }: Props) {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const update = () => setOnline(navigator.onLine)
    window.addEventListener('online', update)
    window.addEventListener('offline', update)
    return () => {
      window.removeEventListener('online', update)
      window.removeEventListener('offline', update)
    }
  }, [])
  return (
    <Stack direction="row" spacing={1} useFlexGap sx={{ justifyContent: 'center', flexWrap: 'wrap' }}>
      <Chip label={online ? 'Network on' : 'Network off'} color={online ? 'default' : 'primary'} variant="outlined" />
      <Chip label={`Model ${model}`} color={model === 'ready' ? 'primary' : 'default'} variant="outlined" />
      <Chip label={`Camera ${camera}`} variant="outlined" />
      <Chip label={`${fps} fps`} variant="outlined" />
    </Stack>
  )
}
