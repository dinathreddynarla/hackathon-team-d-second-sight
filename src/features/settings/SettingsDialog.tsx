import { Box, Collapse, Dialog, Stack, TextField, Typography } from '@mui/material'
import { useId, useState } from 'react'

import { isNative, openAccessibilitySettings, openVoiceInstall } from '../../native/setup'
import { color } from '../../theme'
import { Group, PageHeader, Row, Segmented } from '../../ui/page'
import { LANGUAGE_NAME, UI } from '../../ui/strings'
import { useBackToClose } from '../../ui/useBackToClose'
import { announce, demoBuzz, RATES, type Lang, type SpeechRate } from '../speech/speech'

type Props = {
  open: boolean
  lang: Lang
  langs: Lang[]
  dim: boolean
  rate: SpeechRate
  torch: boolean
  siren: boolean
  sosNumbers: string[]
  k: number
  fps: number
  running: boolean
  onClose: () => void
  onLang: (lang: Lang) => void
  onDim: (dim: boolean) => void
  onRate: (rate: SpeechRate) => void
  onTorch: (torch: boolean) => void
  onSiren: (siren: boolean) => void
  walls: boolean
  onWalls: (walls: boolean) => void
  onSosNumber: (slot: number, number: string) => void
  onCalibrate: () => boolean
  groundOn: boolean
  onGround: (on: boolean) => void
  onRunSetup: () => void
  onTestFall: () => void
}

type DelegateChoice = 'auto' | 'CPU' | 'GPU'

export function SettingsDialog({
  open,
  lang,
  langs,
  dim,
  rate,
  torch,
  siren,
  sosNumbers,
  k,
  fps,
  running,
  onClose,
  onLang,
  onDim,
  onRate,
  onTorch,
  onSiren,
  walls,
  onWalls,
  onSosNumber,
  onCalibrate,
  groundOn,
  onGround,
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
              // Only languages whose voice is installed on this phone; install more below.
              options={langs.map(l => ({ value: l, label: LANGUAGE_NAME[l], testId: `settings-lang-${l}` }))}
            />
          </Box>
          <Box sx={{ p: 1.5 }}>
            <Segmented
              label={s.speed}
              value={rate}
              onChange={onRate}
              options={(Object.keys(RATES) as SpeechRate[]).map(r => ({
                value: r,
                label: s.speeds[r],
                testId: `speed-${r}`,
              }))}
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
          <Row label={s.buzz} hint={s.buzzHint} testId="buzz-demo" onClick={() => void demoBuzz(lang)} />
        </Group>

        <Group title={s.groundGroup}>
          <Stack sx={{ p: 1.5, gap: 1.25 }}>
            <Segmented
              label={s.ground}
              value={groundOn ? 'on' : 'off'}
              onChange={value => onGround(value === 'on')}
              options={[
                { value: 'on', label: s.on, testId: 'ground-on' },
                { value: 'off', label: s.off, testId: 'ground-off' },
              ]}
            />
            <Typography variant="body2" sx={{ color: color.chalk, px: 0.5 }}>
              {s.groundHint}
            </Typography>
          </Stack>
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
          <Row
            label={s.siren}
            hint={siren ? s.sirenOn : s.sirenOff}
            trailing={siren ? '✓' : ''}
            testId="siren"
            onClick={() => onSiren(!siren)}
          />
          <Row label={s.testFall} hint={s.testFallHint} alarm testId="test-fall" onClick={onTestFall} />
        </Group>

        <Group title={s.batteryGroup}>
          <Row
            label={s.walls}
            hint={walls ? s.wallsOn : s.wallsOff}
            trailing={walls ? '✓' : ''}
            testId="walls"
            onClick={() => onWalls(!walls)}
          />
          <Row
            label={s.dim}
            hint={dim ? s.dimOn : s.dimOff}
            trailing={dim ? '✓' : ''}
            testId="dim"
            onClick={() => onDim(!dim)}
          />
          <Row
            label={s.torch}
            hint={torch ? s.torchOn : s.torchOff}
            trailing={torch ? '✓' : ''}
            testId="torch"
            onClick={() => onTorch(!torch)}
          />
        </Group>

        <Group title={s.setupGroup}>
          <Row
            label={s.shortcut}
            hint={s.shortcutHint}
            disabled={!isNative}
            chevron="right"
            testId="shortcut"
            onClick={() => {
              announce('shortcutHelp', lang)
              void openAccessibilitySettings()
            }}
          />
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
