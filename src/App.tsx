import { Box, Stack, Typography } from '@mui/material'
import { keyframes } from '@mui/material/styles'
import { useEffect, useRef, useState } from 'react'

import { FallAlert } from './components/FallAlert'
import { LaneStrip } from './components/LaneStrip'
import { StatusBar } from './components/StatusBar'
import { useCamera } from './features/camera/useCamera'
import { watchFalls } from './features/safety/fall'
import { useBatteryAlerts, useCameraViewAlerts } from './features/safety/useDeviceAlerts'
import { useCrowdAlerts, useDetectionSpeedAlerts } from './features/safety/useSceneAlerts'
import { useSos } from './features/safety/useSos'
import { SettingsDialog } from './features/settings/SettingsDialog'
import { SetupDialog } from './features/settings/SetupDialog'
import { contactsOf, MAX_CONTACTS, useSettings } from './features/settings/settings'
import { announce, installedLangs, phrase, setVoiceFailureHandler, speak, type Lang } from './features/speech/speech'
import { useObstacles } from './features/obstacles/useObstacles'
import { useSigns } from './features/signs/useSigns'
import { useDetection } from './features/vision/useDetection'
import { requestAlertPermissions } from './native/calls'
import { isNative, onAutostart, onVolumeDouble, onVolumeDownHold, setWatching } from './native/setup'
import { color, radius } from './theme'
import { Bubble, Glass } from './ui/bubbles'
import { GlobeIcon, ScanIcon, SettingsIcon, WearFigure } from './ui/icons'
import { UI } from './ui/strings'

// The one authored moment: the label settles in when Start becomes Stop and back.
const settle = keyframes({
  from: { opacity: 0.5, transform: 'scale(0.94)' },
  to: { opacity: 1, transform: 'scale(1)' },
})

// Layout rule: one large Start / Stop bubble fills the bottom of the screen. A blind user finds it by touch alone.
export function App() {
  const [settings, update] = useSettings()
  // English for this session only, when the chosen language's voice cannot speak. The saved choice is kept.
  const [voiceFallback, setVoiceFallback] = useState(false)
  const lang: Lang = voiceFallback ? 'en' : settings.lang
  const langRef = useRef(lang)
  langRef.current = lang
  const s = UI[lang]
  const camera = useCamera()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const running = camera.state === 'running'
  const sos = useSos(lang, settings.sosNumbers)
  // Detection keeps quiet while the alert is asking, sending or calling, and resumes once the result is showing.
  const alertBusy = sos.state === 'countdown' || sos.state === 'sending' || sos.state === 'calling'
  const detection = useDetection(camera.videoRef, canvasRef, running && !alertBusy, lang)
  const { model } = detection
  useSigns(camera.videoRef, running && !alertBusy, lang)
  useObstacles(camera.videoRef, running && !alertBusy && settings.walls, lang, detection.targetRef)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [setupOpen, setSetupOpen] = useState(!settings.setupDone)
  const lastTapRef = useRef(0)
  const primaryRef = useRef<HTMLButtonElement>(null)

  const start = async () => {
    if ((await camera.start()) && model !== 'missing') announce('ready', lang)
  }
  const stop = () => {
    camera.stop()
    announce('stopped', lang)
  }

  // Failures are spoken, not only shown: on Start, and when the camera restarts after the app was hidden.
  // Two effects, so a model finishing its load cannot re-speak a camera failure.
  useEffect(() => {
    if (camera.state === 'error') announce('cameraFailed', langRef.current)
  }, [camera.state])
  useEffect(() => {
    if (camera.state === 'running' && model === 'missing') announce('modelMissing', langRef.current)
  }, [camera.state, model])

  // A voice that cannot speak must not mean silence: say the lost sentence in English, then why, and fall back.
  useEffect(() => {
    setVoiceFailureHandler((_lang, lost) => {
      setVoiceFallback(true)
      void speak(lost, 'en', true)
      void speak(phrase('voiceMissing', 'en'), 'en')
    })
    return () => setVoiceFailureHandler(null)
  }, [])

  // Languages whose voice is installed on this phone (rechecked when returning from Android's voice download screen).
  const [langs, setLangs] = useState<Lang[]>(['en', settings.lang])
  useEffect(() => {
    const refresh = () =>
      void installedLangs().then(found => setLangs(found.includes(settings.lang) ? found : [...found, settings.lang]))
    refresh()
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [settings.lang])
  const nextLang = langs[(langs.indexOf(lang) + 1) % langs.length] ?? 'en'

  // Screen on (and dimmed) only while the camera is watching; the phone's own timeout applies otherwise.
  useEffect(() => {
    void setWatching(running, settings.dim)
  }, [running, settings.dim])

  // Saying the language's name in its own voice confirms the switch, and shows up a missing voice at once.
  const changeLang = (next: Lang) => {
    setVoiceFallback(false)
    update({ lang: next })
    announce('languageName', next)
  }
  // A screen reader pronounces the labels with the right voice only if the page says which language it is in.
  useEffect(() => {
    document.documentElement.lang = lang
  }, [lang])

  // Scan once: double tap the camera view, or press volume-up twice (native only).
  const scan = detection.scan
  useEffect(() => onVolumeDouble(() => void scan()), [scan])
  const onVideoTap = () => {
    const now = performance.now()
    if (now - lastTapRef.current < 400) void scan()
    lastTapRef.current = now
  }

  // Fall watch runs only while the app is in use; a fall starts the SOS countdown.
  const startSos = sos.start
  useEffect(() => {
    if (!running || !isNative) return
    return watchFalls(kind => startSos(kind === 'impact' ? 'fall' : 'lyingStill'))
  }, [running, startSos])

  // Opened by the accessibility shortcut: start straight away, unless setup still needs a sighted helper.
  const startRef = useRef(start)
  startRef.current = start
  const runningRef = useRef(running)
  runningRef.current = running
  const scanRef = useRef(detection.scan)
  scanRef.current = detection.scan
  useEffect(
    () =>
      onAutostart(() => {
        if (!settings.setupDone) return
        // Already watching: the same shortcut asks "what is around me".
        if (runningRef.current) void scanRef.current()
        else void startRef.current()
      }),
    [settings.setupDone]
  )

  // Asking for help on purpose: hold volume-down for 2 s, or the Help button, whether or not the camera is running.
  useEffect(() => onVolumeDownHold(() => startSos('manual')), [startSos])

  // What the user cannot see: a low battery, a covered lens, a scene too dark or too washed out to read. The battery
  // waits while the alert is up, so it cannot talk over "Are you okay?" or the calls.
  useBatteryAlerts(langRef, sos.state !== 'idle')
  useCameraViewAlerts(camera.videoRef, running && !alertBusy, langRef)
  // And what the app can tell about its own work: a crowd in view, and detection that has fallen behind.
  const watching = running && !alertBusy && model === 'ready'
  useCrowdAlerts(detection.people, detection.scannedAt, watching, langRef)
  useDetectionSpeedAlerts(detection.fps, detection.lastTickAt, watching, langRef)

  // Whenever the main screen is what the user is on, focus rests on Start / Stop, so a screen reader's
  // double-tap anywhere starts or stops without hunting for the control.
  const alertOpen = sos.state !== 'idle'
  useEffect(() => {
    if (!setupOpen && !settingsOpen && !alertOpen) primaryRef.current?.focus({ preventScroll: true })
  }, [setupOpen, settingsOpen, alertOpen])

  return (
    <Stack component="main" sx={{ height: '100%', p: 2, gap: 1.5 }}>
      <Stack direction="row" sx={{ alignItems: 'center', minHeight: 48, gap: 1 }}>
        <Typography variant="h1" sx={{ flex: 1, minWidth: 0 }}>
          {s.appName}
        </Typography>
        {/* The same as holding volume-down, for someone who can find it on the screen: a countdown first, so a
            stray touch can be cancelled. */}
        <Bubble
          tone="stop"
          aria-label={s.helpLabel}
          data-testid="help"
          onClick={() => sos.start('manual')}
          sx={{ minHeight: 48, px: 2.25, flexShrink: 0, fontWeight: 750 }}
        >
          {s.help}
        </Bubble>
        <Bubble
          aria-label={s.settings}
          data-testid="settings-open"
          onClick={() => setSettingsOpen(true)}
          sx={{ width: 48, minWidth: 48, minHeight: 48, p: 0 }}
        >
          <SettingsIcon />
        </Bubble>
      </Stack>

      <Box
        onClick={onVideoTap}
        sx={{
          position: 'relative',
          flex: 1,
          minHeight: 0,
          borderRadius: `${radius.card}px`,
          overflow: 'hidden',
          bgcolor: color.kerb,
          boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
        }}
      >
        <video
          ref={camera.videoRef}
          playsInline
          muted
          aria-hidden
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <canvas
          ref={canvasRef}
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
          }}
        />
        {!running && (
          <Stack
            data-testid="idle-panel"
            sx={{
              position: 'absolute',
              inset: 0,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 1,
              px: 3,
              pt: 7.5,
              pb: 2,
              textAlign: 'center',
              bgcolor: color.kerb,
            }}
          >
            {/* Shrinks before anything else does: on a short screen the words keep their room. */}
            <Box
              sx={{
                flex: '0 1 132px',
                minHeight: 0,
                aspectRatio: '1',
                color: color.paving,
                '@media (max-height: 600px)': { display: 'none' },
              }}
            >
              <WearFigure />
            </Box>
            <Typography sx={{ fontSize: '1.25rem', fontWeight: 700 }}>{s.wearTitle}</Typography>
            <Typography sx={{ color: color.chalk }}>{s.wearBody}</Typography>
            {camera.error && (
              <Typography data-testid="camera-error" variant="body2" sx={{ color: color.alarm }}>
                {camera.error}
              </Typography>
            )}
          </Stack>
        )}
        <Box sx={{ position: 'absolute', top: 12, left: 12, right: 12, display: 'flex' }}>
          <StatusBar model={model} camera={camera.state} lang={lang} />
        </Box>
        {running && (
          <Glass
            data-testid="caption"
            sx={{
              position: 'absolute',
              left: 12,
              right: 12,
              bottom: 12,
              minHeight: 52,
              display: 'grid',
              placeItems: 'center',
              px: 2.5,
              py: 1,
              borderRadius: '26px',
              textAlign: 'center',
              fontSize: '1.25rem',
              fontWeight: 650,
              lineHeight: 1.25,
            }}
          >
            {detection.lastSaid || s.watchingHint}
          </Glass>
        )}
      </Box>

      <LaneStrip lane={detection.lane} lang={lang} />

      <Stack direction="row" sx={{ gap: 1.5 }}>
        <Bubble
          data-testid="scan"
          aria-label={s.scanLabel}
          disabled={!running || model !== 'ready'}
          onClick={() => void scan()}
          sx={{ flex: 1, px: 1.5 }}
        >
          <ScanIcon />
          {s.scan}
        </Bubble>
        <Bubble
          data-testid="lang-toggle"
          aria-label={s.switchLanguage}
          onClick={() => changeLang(nextLang)}
          sx={{ flex: 1, px: 1.5 }}
        >
          <GlobeIcon />
          {s.languageName}
        </Bubble>
      </Stack>

      <Bubble
        ref={primaryRef}
        tone={running ? 'stop' : 'go'}
        texture={running ? 'dots' : 'bars'}
        data-testid="start-stop"
        data-state={camera.state}
        aria-label={running ? s.stopLabel : s.startLabel}
        onClick={running ? stop : start}
        sx={{ minHeight: '26vh', borderRadius: `${radius.hero}px`, fontSize: '2.25rem', fontWeight: 800 }}
      >
        <Box
          component="span"
          key={running ? 'stop' : 'go'}
          sx={{
            animation: `${settle} 260ms cubic-bezier(0.16, 1, 0.3, 1)`,
            '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
          }}
        >
          {running ? s.stop : s.start}
        </Box>
      </Bubble>

      <SetupDialog
        open={setupOpen}
        lang={lang}
        sosNumber={settings.sosNumbers[0] ?? ''}
        onLang={changeLang}
        onClose={() => setSetupOpen(false)}
        onDone={first => {
          update({ sosNumbers: [first, ...settings.sosNumbers.slice(1)], setupDone: true })
          setSetupOpen(false)
        }}
      />
      <SettingsDialog
        open={settingsOpen}
        lang={lang}
        langs={langs}
        dim={settings.dim}
        onDim={dim => update({ dim })}
        walls={settings.walls}
        onWalls={walls => update({ walls })}
        sosNumbers={settings.sosNumbers}
        k={detection.k}
        fps={detection.fps}
        running={running}
        onClose={() => {
          setSettingsOpen(false)
          // Ask for the permissions now, while someone can answer, not when a fall has already happened.
          if (contactsOf(settings.sosNumbers).length > 0) void requestAlertPermissions()
        }}
        onLang={changeLang}
        onSosNumber={(slot, number) =>
          update({
            sosNumbers: Array.from({ length: MAX_CONTACTS }, (_, i) =>
              i === slot ? number : (settings.sosNumbers[i] ?? '')
            ),
          })
        }
        onCalibrate={detection.calibrate}
        onRunSetup={() => {
          setSettingsOpen(false)
          setSetupOpen(true)
        }}
        onTestFall={() => {
          setSettingsOpen(false)
          sos.start('fall')
        }}
      />
      <FallAlert
        state={sos.state}
        reason={sos.reason}
        secondsLeft={sos.secondsLeft}
        contact={sos.contact}
        total={sos.total}
        messaged={sos.messaged}
        lang={lang}
        onCancel={sos.cancel}
      />
    </Stack>
  )
}
