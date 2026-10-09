import { Box } from '@mui/material'
import { useEffect, useState } from 'react'

import type { CameraState } from '../features/camera/useCamera'
import type { Lang } from '../features/speech/speech'
import type { ModelState } from '../features/vision/useDetection'
import { color } from '../theme'
import { Glass } from '../ui/bubbles'
import { WarningIcon } from '../ui/icons'
import { UI } from '../ui/strings'

type Props = { model: ModelState; camera: CameraState; lang: Lang }

// One line: what the app is doing, and the offline proof ("Offline", with the model already on the phone).
// Not a live region: the app speaks its own state, and a screen reader would say it a second time.
export function StatusBar({ model, camera, lang }: Props) {
  const s = UI[lang].status
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

  const problem = camera === 'error' ? s.cameraProblem : model === 'missing' ? s.modelMissing : null
  const state =
    problem ??
    (camera === 'starting' ? s.starting : model === 'loading' ? s.loading : camera === 'running' ? s.watching : s.ready)

  return (
    <Glass
      data-testid="status"
      data-camera={camera}
      data-model={model}
      data-network={online ? 'on' : 'off'}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        minHeight: 36,
        px: 1.75,
        fontSize: '0.9375rem',
        fontWeight: 600,
      }}
    >
      {problem ? (
        <Box sx={{ display: 'inline-flex', color: color.alarm }}>
          <WarningIcon />
        </Box>
      ) : (
        <Box
          aria-hidden
          sx={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            bgcolor: color.paving,
            // Solid while watching, a ring while idle: the difference is a shape, not only a colour.
            ...(camera !== 'running' && { bgcolor: 'transparent', boxShadow: `inset 0 0 0 2px ${color.paving}` }),
          }}
        />
      )}
      <span>{state}</span>
      <Box component="span" aria-hidden sx={{ width: '1px', height: 14, bgcolor: 'rgba(255,255,255,0.28)' }} />
      <span>{online ? s.online : s.offline}</span>
    </Glass>
  )
}
