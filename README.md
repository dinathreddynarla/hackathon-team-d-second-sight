# Second Sight

Offline Android app for blind pedestrians: on-device models watch the way ahead through the phone camera and the app
speaks short warnings. Capacitor 8 shell around a Vite + React 19 + MUI 9 + TypeScript page; models run with
MediaPipe and ONNX Runtime (WebAssembly) inside the APK.

## Download

**[SecondSight-v1.0.apk](https://github.com/dinathreddynarla/hackathon-team-d-second-sight/releases/download/v1.0/SecondSight-v1.0.apk)**
(about 80 MB, from the [v1.0 release](https://github.com/dinathreddynarla/hackathon-team-d-second-sight/releases/tag/v1.0)).

## Prerequisites

- Node 20 or newer, pnpm 10 (`corepack enable`)
- JDK 21 (Gradle 8.14 does not accept the Java 25 bundled with recent Android Studio); set `JAVA_HOME` to it
- Android SDK (compile and target SDK 36, minimum 24), `ANDROID_HOME` set, `adb` on the `PATH`
- An Android phone with USB debugging on, for anything native (speech voices, vibration, SMS, calls, volume keys)

## Commands

```bash
pnpm install            # once
pnpm vendor             # copies the MediaPipe and ONNX runtimes into public/vendor (before the first `pnpm dev`; `pnpm build` runs it itself)
pnpm dev                # browser on the laptop, http://localhost:5173 (laptop camera)
pnpm apk                # debug APK installed over USB (has INTERNET for live reload)
pnpm apk:release        # shareable APK: no INTERNET permission, signed with the debug key
pnpm lint && pnpm ts:check
node --test tests/*.test.ts                 # unit tests (fall rule, sentences, steering, traffic light, potholes)
node tests/voice-sim.cjs all                # scripted street scenes → what the app would say
node tests/safety-sim.cjs all               # battery, camera, crowd, SOS, alarm, traffic light
node tests/footage-sim.cjs <video.mp4>      # a real walk video through the real models, a frame per sentence
```

The simulations need `pnpm build` and `vite preview --port 4173` running first.

Testing on the laptop as if it were the phone: `pnpm dev`, open http://localhost:5173 in Chrome, allow the camera, then
DevTools → device toolbar → a phone size. Dimming, vibration, SMS, calls, the volume keys, text reading and fall
detection need the phone.

Live debugging inside the running APK: `adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof com.teamd.secondsight)`,
then `chrome://inspect` (debug builds). The page exposes `window.__ss`.

Every change goes through a pull request; only the repository owner merges (squash).

## How it works

```
Back camera, 640×480, portrait
  → EfficientDet-Lite0 on the phone's CPU, every 100 ms (300 ms after 10 s of empty street)
  → 8 hazard classes, score ≥ 0.45, seen 3 frames in a row
  → distance: real height × K ÷ (box height ÷ frame height), and the same by width; the nearer wins (K = 0.75)
  → side: left / ahead / right thirds;  "coming": closing faster than 1.5 m/s
  → choose one: the nearest, but anything coming within 10 m beats anything standing still
  → steering: within 3.5 m and on the centre line → "move left/right" toward a free side, else "stop"
  → warn(): urgent sentences cut in; a standing thing is repeated only when nearer or after 10 s
  → Android text-to-speech, offline voice;  within two steps: buzz the side

Workers beside it, each with its own model (ONNX Runtime, WebAssembly):
  signs     once a second,   seen twice → "Sign: give way"
  walls     every 1.5 s,     depth ahead vs the floor ≥ 0.8 twice → "stop, obstacle"  (off by default)
  potholes  about 2 a second, lower part of the picture → "pothole ahead, two steps"
```

Distances are spoken the way a cane user counts: up to 1.5 m "one step", up to 3 m "two steps", under 5 m "close",
then whole metres rounded down, and "far" from 20 m. Every rounding moves the number towards the user.
Real heights assumed: person 1.7 m, car 1.5, motorcycle 1.5, bicycle 1.6, bus 3.0, truck 3.0, dog 0.5, cow 1.4.

## Repository layout

```
src/
  App.tsx                          main screen: status, camera view, lane strip, scan / language, Start / Stop
  components/FallAlert.tsx         full-screen alert: countdown, calls, the emergency screen for helpers
  ui/                              bubble controls, icons, page pieces, English and Telugu labels
  features/camera/                 back camera
  features/vision/detector.ts      MediaPipe setup, CPU/GPU choice
  features/vision/distance.ts      distance, side, "coming", target choice, steering
  features/vision/useDetection.ts  100 ms loop, overlay, describe, calibration
  features/vision/trafficLight.ts  which lamp is lit
  features/vision/ground*.ts       potholes and manholes (worker)
  features/obstacles/              walls and obstacles from the depth model (worker)
  features/signs/                  Indian road signs (worker)
  features/speech/speech.ts        sentence tables in 5 languages, warn() rules, the speech queue, voice settings
  features/settings/               saved settings, first-run setup, settings screen
  features/safety/                 fall rule, SOS flow, alarm, battery / camera / crowd alerts
  native/                          bridges to the Java plugins; native vibration
android/app/src/main/java/com/teamd/secondsight/
  MainActivity.java                volume keys, autostart
  ShortcutActivity.java            accessibility-shortcut target: opens the app with the camera on
  SetupPlugin.java                 voice install screen, SMS with its "sent" verdict, screen on and dim, alarm volume, text reading
  EmergencyCallPlugin.java         places a call, waits for it to end, reads the call log to see if it was answered
tests/                             unit tests (node --test) and browser simulations (Playwright)
.claude/agents/surya.md            the blind-user reviewer persona
```

## Building and sharing the APK

`pnpm apk:release` builds `android/app/build/outputs/apk/release/app-release.apk`: no INTERNET permission, signed
with the debug key of the machine that built it. Share it renamed as `SecondSight-v<version>.apk`.

Installing it on a phone:

1. Download `SecondSight-v1.0.apk` from the link at the top, or get it from the team.
2. **If any earlier Second Sight is on the phone, uninstall it first.** An APK built on another laptop is signed with
   a different key, and Android then just says "App not installed".
3. Open the APK. Allow "install unknown apps" for the app you opened it from (WhatsApp, Files, Chrome).
   On vivo/iQOO also allow it under Settings → Security → Install unknown apps, and tap "Continue installing".
4. If Play Protect warns that the app "can request access to sensitive data", tap More details → Install anyway.
   If there is no such button: Play Store → profile → Play Protect → gear → turn off "Scan apps with Play Protect",
   install, then turn it back on. The warning is about the SMS, call and call-log permissions the SOS needs.
5. Open Second Sight. One-time setup: Install voices (needs Wi-Fi once), Test voice, the volume-key shortcut
   (optional), an emergency contact (optional). Allow SMS, location, phone and call log when asked.

If an install still fails, connect the phone and run `adb install -r <apk>`: the error code names the cause
(for example `INSTALL_FAILED_UPDATE_INCOMPATIBLE` for a signature mismatch).
