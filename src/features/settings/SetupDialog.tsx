import { Button, Dialog, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material'
import { useEffect, useState } from 'react'

import { isNative, openVoiceInstall, requestSosPermissions } from '../../native/setup'
import { announce, type Lang } from '../speech/speech'

type Props = { open: boolean; lang: Lang; sosNumber: string; onDone: (sosNumber: string) => void }

// One-time setup, the only moment internet is allowed: Android's own TTS screen downloads the voices.
export function SetupDialog({ open, lang, sosNumber, onDone }: Props) {
  const [step, setStep] = useState(0)
  const [number, setNumber] = useState(sosNumber)

  useEffect(() => {
    if (open) {
      setStep(0)
      announce('setupIntro', lang)
    }
  }, [open, lang])

  const install = async () => {
    await openVoiceInstall()
    setStep(1)
    announce('voicesInstalled', lang)
  }
  const test = () => {
    announce('voiceTest', lang)
    setStep(2)
  }
  const finish = async () => {
    const saved = number.trim()
    // Save first, so setup is complete even if a system prompt is never answered.
    onDone(saved)
    if (saved) await requestSosPermissions()
    announce('setupDone', lang)
  }

  return (
    <Dialog open={open} fullScreen>
      <DialogTitle>One-time setup</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <Typography>1. Install the offline voices. Choose English (India) and Telugu, then come back.</Typography>
          <Button variant="contained" onClick={() => void install()} disabled={!isNative} sx={{ minHeight: 72 }}>
            Install voices
          </Button>
          {!isNative && <Typography color="text.secondary">Not needed in the browser.</Typography>}
          <Typography>2. Check the voice works.</Typography>
          <Button variant="contained" onClick={test} disabled={step < 1 && isNative} sx={{ minHeight: 72 }}>
            Test voice
          </Button>
          <Typography>3. Optional: a phone number to message if a fall is detected.</Typography>
          <TextField
            id="sos-number"
            label="Emergency number"
            type="tel"
            value={number}
            onChange={e => setNumber(e.target.value)}
            slotProps={{ htmlInput: { inputMode: 'tel' } }}
          />
          <Button
            variant="outlined"
            onClick={() => void finish()}
            disabled={step < 2 && isNative}
            sx={{ minHeight: 72 }}
          >
            Done
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  )
}
