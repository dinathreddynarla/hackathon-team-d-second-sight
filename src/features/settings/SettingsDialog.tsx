import { Box, Collapse, Dialog, Stack, TextField, Typography } from '@mui/material'
import { useId, useState } from 'react'

import { isNative, openAccessibilitySettings, openVoiceInstall } from '../../native/setup'
import { color } from '../../theme'
import { Group, PageHeader, Row, Segmented } from '../../ui/page'
import { LANGUAGE_NAME, UI } from '../../ui/strings'
import { useBackToClose } from '../../ui/useBackToClose'
import { announce, demoBuzz, PITCHES, RATES, type Lang, type SpeechPitch, type SpeechRate } from '../speech/speech'
import { DEFAULT_SOS_MESSAGE } from './settings'

type Props = {
  open: boolean
  lang: Lang
  langs: Lang[]
  dim: boolean
  rate: SpeechRate
  pitch: SpeechPitch
  // The offline voices of the current language, and the chosen one (null: the language's default voice).
  voiceList: string[]
  voice: string | null
  sosMessages: string[]
  siren: boolean
  sosNumbers: string[]
  k: number
  fps: number
  running: boolean
  onClose: () => void
  onLang: (lang: Lang) => void
  onDim: (dim: boolean) => void
  onRate: (rate: SpeechRate) => void
  onPitch: (pitch: SpeechPitch) => void
  onVoice: (voice: string | null) => void
  onSosMessage: (slot: number, message: string) => void
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
  pitch,
  voiceList,
  voice,
  sosMessages,
  siren,
  sosNumbers,
  k,
  fps,
  running,
  onClose,
  onLang,
  onDim,
  onRate,
  onPitch,
  onVoice,
  onSosMessage,
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
          <Box sx={{ p: 1.5 }}>
            <Segmented
              label={s.pitch}
              value={pitch}
              onChange={onPitch}
              options={(Object.keys(PITCHES) as SpeechPitch[]).map(p => ({
                value: p,
                label: s.pitches[p],
                testId: `pitch-${p}`,
              }))}
            />
          </Box>
          {/* Only when there is a choice. Engine names ("kn-in-x-knf-local") mean nothing read aloud, so voices are
              numbered; each press says a sentence in that voice. */}
          {voiceList.length > 1 && (
            <Box sx={{ p: 1.5 }}>
              <Segmented
                label={s.voice}
                value={voice && voiceList.includes(voice) ? voice : 'default'}
                onChange={v => onVoice(v === 'default' ? null : v)}
                options={[
                  { value: 'default', label: s.voiceDefault, testId: 'voice-default' },
                  ...voiceList.map((v, i) => ({ value: v, label: s.voiceN(i + 1), testId: `voice-${i + 1}` })),
                ]}
              />
            </Box>
          )}
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
            trailing={s.kNow(k)}
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
              <Stack key={slot} sx={{ gap: 1 }}>
                <TextField
                  id={`settings-contact-${slot + 1}`}
                  fullWidth
                  label={label}
                  type="tel"
                  value={sosNumbers[slot] ?? ''}
                  onChange={e => onSosNumber(slot, e.target.value)}
                  slotProps={{ htmlInput: { inputMode: 'tel' } }}
                />
                {/* Only for a number that is there: an empty slot gets no message. */}
                {sosNumbers[slot]?.trim() && (
                  <TextField
                    id={`settings-message-${slot + 1}`}
                    fullWidth
                    multiline
                    minRows={2}
                    label={s.message[slot]}
                    placeholder={DEFAULT_SOS_MESSAGE}
                    helperText={s.messageHint}
                    value={sosMessages[slot] ?? DEFAULT_SOS_MESSAGE}
                    onChange={e => onSosMessage(slot, e.target.value)}
                  />
                )}
              </Stack>
            ))}
          </Stack>
          <Row
            label={s.siren}
            hint={siren ? s.sirenOn : s.sirenOff}
            checked={siren}
            testId="siren"
            onClick={() => onSiren(!siren)}
          />
          <Row label={s.testFall} hint={s.testFallHint} alarm testId="test-fall" onClick={onTestFall} />
        </Group>

        <Group title={s.batteryGroup}>
          <Row
            label={s.walls}
            hint={walls ? s.wallsOn : s.wallsOff}
            checked={walls}
            testId="walls"
            onClick={() => onWalls(!walls)}
          />
          <Row label={s.dim} hint={dim ? s.dimOn : s.dimOff} checked={dim} testId="dim" onClick={() => onDim(!dim)} />
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
