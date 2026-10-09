import { Box, Dialog, Stack, TextField, Typography } from '@mui/material'
import { useEffect, useId, useState } from 'react'

import { isNative, openVoiceInstall, requestSosPermissions } from '../../native/setup'
import { color } from '../../theme'
import { Bubble } from '../../ui/bubbles'
import { Group, PageHeader, Segmented } from '../../ui/page'
import { LANGUAGE_NAME, UI } from '../../ui/strings'
import { useBackToClose } from '../../ui/useBackToClose'
import { phrase, speak, type Lang } from '../speech/speech'

type Props = {
  open: boolean
  lang: Lang
  sosNumber: string
  onLang: (lang: Lang) => void
  onClose: () => void
  onDone: (sosNumber: string) => void
}

// The order matters here, so the steps are numbered. Hidden from the eye's reading order, spoken as "Step 1".
function StepBadge({ n, label }: { n: number; label: string }) {
  return (
    <Box
      aria-label={label}
      role="img"
      sx={{
        width: 28,
        height: 28,
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        borderRadius: '50%',
        bgcolor: color.paving,
        color: color.pavingInk,
        fontSize: '0.9375rem',
        fontWeight: 800,
      }}
    >
      {n}
    </Box>
  )
}

// One-time setup, the only moment internet is allowed: Android's own TTS screen downloads the voices.
export function SetupDialog({ open, lang, sosNumber, onLang, onClose, onDone }: Props) {
  const s = UI[lang].setup
  const titleId = useId()
  const [step, setStep] = useState(0)
  const [number, setNumber] = useState(sosNumber)
  useBackToClose(open, onClose)

  useEffect(() => {
    if (open) setStep(0)
  }, [open])
  useEffect(() => {
    if (open) void speak(phrase('setupIntro', lang), lang)
  }, [open, lang])

  const install = async () => {
    await openVoiceInstall()
    setStep(1)
    void speak(phrase('voicesInstalled', lang), lang)
  }
  const test = () => {
    void speak(phrase('voiceTest', lang), lang)
    setStep(2)
  }
  const finish = async () => {
    const saved = number.trim()
    // Save first, so setup is complete even if a system prompt is never answered.
    onDone(saved)
    if (saved) await requestSosPermissions()
    void speak(phrase('setupDone', lang), lang)
  }

  return (
    <Dialog fullScreen open={open} disableRestoreFocus aria-labelledby={titleId}>
      <Stack data-testid="setup" sx={{ height: '100%', overflowY: 'auto', p: 2, gap: 3 }}>
        <PageHeader
          titleId={titleId}
          title={s.title}
          closeLabel={UI[lang].close}
          closeTestId="setup-close"
          onClose={onClose}
        />

        <Group title={s.languageStep} badge={<StepBadge n={1} label={s.step(1)} />}>
          <Box sx={{ p: 1.5 }}>
            <Segmented
              label={s.languageStep}
              value={lang}
              onChange={onLang}
              options={[
                { value: 'en', label: LANGUAGE_NAME.en, testId: 'setup-lang-en' },
                { value: 'te', label: LANGUAGE_NAME.te, testId: 'setup-lang-te' },
              ]}
            />
          </Box>
        </Group>

        <Group title={s.voiceStep} badge={<StepBadge n={2} label={s.step(2)} />}>
          <Stack sx={{ p: 2, gap: 1.5 }}>
            <Typography sx={{ color: color.chalk }}>{isNative ? s.voiceBody : s.browserNote}</Typography>
            <Bubble data-testid="setup-install" disabled={!isNative} onClick={() => void install()}>
              {s.installVoices}
            </Bubble>
            <Bubble data-testid="setup-test" disabled={step < 1 && isNative} onClick={test}>
              {s.testVoice}
            </Bubble>
          </Stack>
        </Group>

        <Group title={s.numberStep} badge={<StepBadge n={3} label={s.step(3)} />}>
          <Stack sx={{ p: 2, gap: 1.5 }}>
            <Typography sx={{ color: color.chalk }}>{s.numberBody}</Typography>
            <TextField
              id="sos-number"
              fullWidth
              label={s.number}
              type="tel"
              value={number}
              onChange={e => setNumber(e.target.value)}
              slotProps={{ htmlInput: { inputMode: 'tel' } }}
            />
          </Stack>
        </Group>

        <Bubble
          tone="go"
          data-testid="setup-done"
          disabled={step < 2 && isNative}
          onClick={() => void finish()}
          sx={{ minHeight: 64, flexShrink: 0, fontSize: '1.25rem', fontWeight: 750 }}
        >
          {s.done}
        </Bubble>
      </Stack>
    </Dialog>
  )
}
