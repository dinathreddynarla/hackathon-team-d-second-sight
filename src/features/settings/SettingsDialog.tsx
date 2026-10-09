import { Button, Dialog, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'

import { isNative, openVoiceInstall } from '../../native/setup'
import { phrase, speak, type Lang } from '../speech/speech'

type Props = {
  open: boolean
  lang: Lang
  sosNumber: string
  k: number
  running: boolean
  onClose: () => void
  onLang: (lang: Lang) => void
  onSosNumber: (n: string) => void
  onCalibrate: () => boolean
  onRunSetup: () => void
  onTestFall: () => void
}

export function SettingsDialog({
  open,
  lang,
  sosNumber,
  k,
  running,
  onClose,
  onLang,
  onSosNumber,
  onCalibrate,
  onRunSetup,
  onTestFall,
}: Props) {
  const delegate = (() => {
    try {
      return localStorage.getItem('secondsight.delegate') ?? 'auto'
    } catch {
      return 'auto'
    }
  })()
  const setDelegate = (value: 'CPU' | 'GPU' | 'auto') => {
    try {
      if (value === 'auto') localStorage.removeItem('secondsight.delegate')
      else localStorage.setItem('secondsight.delegate', value)
    } catch {
      /* storage blocked */
    }
    location.reload()
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth>
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Button variant="outlined" onClick={() => onLang(lang === 'en' ? 'te' : 'en')} sx={{ minHeight: 56 }}>
            Language: {lang === 'en' ? 'English' : 'తెలుగు'}
          </Button>
          <Button
            variant="outlined"
            disabled={!running}
            onClick={() => void speak(phrase(onCalibrate() ? 'calibrated' : 'noPerson', lang), lang)}
            sx={{ minHeight: 56 }}
          >
            Calibrate with a person at 5 m (K = {k.toFixed(2)})
          </Button>
          <Button
            variant="outlined"
            disabled={!isNative}
            onClick={() => void openVoiceInstall()}
            sx={{ minHeight: 56 }}
          >
            Install offline voices
          </Button>
          <Button variant="outlined" onClick={() => void speak(phrase('ready', lang), lang)} sx={{ minHeight: 56 }}>
            Test voice
          </Button>
          <TextField
            id="settings-sos-number"
            label="Emergency number for fall SOS"
            type="tel"
            value={sosNumber}
            onChange={e => onSosNumber(e.target.value)}
            slotProps={{ htmlInput: { inputMode: 'tel' } }}
          />
          <Button variant="outlined" onClick={onRunSetup} sx={{ minHeight: 56 }}>
            Run setup again
          </Button>
          <Button variant="outlined" color="error" onClick={onTestFall} sx={{ minHeight: 56 }}>
            Test fall alert (15 s countdown)
          </Button>
          <Typography variant="body2" color="text.secondary">
            Detector: {delegate}. Change only for debugging; the app reloads.
          </Typography>
          <Stack direction="row" spacing={1}>
            {(['auto', 'CPU', 'GPU'] as const).map(v => (
              <Button
                key={v}
                size="small"
                variant={delegate === v ? 'contained' : 'outlined'}
                onClick={() => setDelegate(v)}
              >
                {v}
              </Button>
            ))}
          </Stack>
          <Button variant="contained" onClick={onClose} sx={{ minHeight: 56 }}>
            Close
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
