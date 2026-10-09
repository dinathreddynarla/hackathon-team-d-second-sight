import { Box, Collapse, Dialog, Stack, TextField, Typography } from '@mui/material'
import { useId, useState } from 'react'

import { isNative, openVoiceInstall } from '../../native/setup'
import { color } from '../../theme'
import { Group, PageHeader, Row, Segmented } from '../../ui/page'
import { LANGUAGE_NAME, UI } from '../../ui/strings'
import { useBackToClose } from '../../ui/useBackToClose'
import { announce, type Lang } from '../speech/speech'

type Props = {
  open: boolean
  lang: Lang
  sosNumbers: string[]
  k: number
  fps: number
  running: boolean
  onClose: () => void
  onLang: (lang: Lang) => void
  onSosNumber: (slot: number, number: string) => void
  onCalibrate: () => boolean
  onRunSetup: () => void
  onTestFall: () => void
}

type DelegateChoice = 'auto' | 'CPU' | 'GPU'

export function SettingsDialog({
  open,
  lang,
  sosNumbers,
  k,
  fps,
  running,
  onClose,
  onLang,
  onSosNumber,
  onCalibrate,
  onRunSetup,
  onTestFall,
}: Props) {
  const s = UI[lang].set
  const titleId = useId()
  const [advanced, setAdvanced] = useState(false)
  useBackToClose(open, onClose)

  const delegate = ((): DelegateChoice => {
    try {
      const saved = localStorage.getItem('secondsight.delegate')
      return saved === 'CPU' || saved === 'GPU' ? saved : 'auto'
    } catch {
      return 'auto'
    }
  })()
  const setDelegate = (value: DelegateChoice) => {
    try {
      if (value === 'auto') localStorage.removeItem('secondsight.delegate')
      else localStorage.setItem('secondsight.delegate', value)
    } catch {
      /* storage blocked */
    }
    location.reload()
  }

  return (
    <Dialog fullScreen open={open} onClose={onClose} disableRestoreFocus aria-labelledby={titleId}>
      <Stack data-testid="settings" sx={{ height: '100%', overflowY: 'auto', p: 2, gap: 3 }}>
        <PageHeader
          titleId={titleId}
          title={s.title}
          closeLabel={UI[lang].close}
          closeTestId="settings-close"
          onClose={onClose}
        />

        <Group title={s.languageGroup}>
          <Box sx={{ p: 1.5 }}>
            <Segmented
              label={s.language}
              value={lang}
              onChange={onLang}
              options={[
                { value: 'en', label: LANGUAGE_NAME.en, testId: 'settings-lang-en' },
                { value: 'te', label: LANGUAGE_NAME.te, testId: 'settings-lang-te' },
              ]}
            />
          </Box>
          <Row label={s.testVoice} hint={s.testVoiceHint} testId="test-voice" onClick={() => announce('ready', lang)} />
          <Row
            label={s.installVoices}
            hint={isNative ? s.installVoicesHint : s.installVoicesBrowser}
            disabled={!isNative}
            chevron="right"
            onClick={() => void openVoiceInstall()}
          />
        </Group>

        <Group title={s.distanceGroup}>
          <Row
            label={s.calibrate}
            hint={running ? s.calibrateHint : s.calibrateStopped}
            trailing={`K ${k.toFixed(2)}`}
            disabled={!running}
            testId="calibrate"
            onClick={() => announce(onCalibrate() ? 'calibrated' : 'noPerson', lang)}
          />
        </Group>

        <Group title={s.emergencyGroup}>
          <Stack sx={{ p: 2, gap: 1.5 }}>
            <Typography variant="body2" sx={{ color: color.chalk }}>
              {s.contactsHint}
            </Typography>
            {s.contact.map((label, slot) => (
              <TextField
                key={slot}
                id={`settings-contact-${slot + 1}`}
                fullWidth
                label={label}
                type="tel"
                value={sosNumbers[slot] ?? ''}
                onChange={e => onSosNumber(slot, e.target.value)}
                slotProps={{ htmlInput: { inputMode: 'tel' } }}
              />
            ))}
          </Stack>
          <Row label={s.testFall} hint={s.testFallHint} alarm testId="test-fall" onClick={onTestFall} />
        </Group>

        <Group title={s.setupGroup}>
          <Row label={s.runSetup} chevron="right" testId="run-setup" onClick={onRunSetup} />
        </Group>

        <Group title={s.advancedGroup}>
          <Row
            label={s.advanced}
            chevron={advanced ? 'down' : 'right'}
            expanded={advanced}
            testId="advanced"
            onClick={() => setAdvanced(v => !v)}
          />
          <Collapse in={advanced} unmountOnExit>
            <Stack sx={{ p: 2, gap: 1.25 }}>
              <Segmented
                label={s.detector}
                value={delegate}
                onChange={setDelegate}
                options={[
                  { value: 'auto', label: s.auto },
                  { value: 'CPU', label: 'CPU' },
                  { value: 'GPU', label: 'GPU' },
                ]}
              />
              <Typography variant="body2" sx={{ color: color.chalk }}>
                {s.detectorHint}
              </Typography>
              <Typography data-testid="fps" variant="body2" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {s.fps(fps)}
              </Typography>
            </Stack>
          </Collapse>
        </Group>
      </Stack>
    </Dialog>
  )
}
