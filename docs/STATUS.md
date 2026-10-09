# Status, 9 Oct 2026 13:30

## What works (verified)

| Piece                                                                                     | Where                                                                   | Verified how                                                                                            |
| ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Camera, Start/Stop, status chips                                                          | `src/App.tsx`, `src/features/camera/useCamera.ts`                       | On the iQOO Neo 10 over USB                                                                             |
| On-device detection, 8 classes (person, car, motorcycle, bicycle, bus, truck, dog, cow)   | `src/features/vision/detector.ts`                                       | Live on the phone: CPU delegate detects, GPU returns nothing in this WebView, so CPU is the APK default |
| Distance, direction, approaching, nearest-only                                            | `src/features/vision/distance.ts`                                       | Phone caption "person ahead, about 5 metres"                                                            |
| English + Telugu speech, cooldowns, vibration under 3 m                                   | `src/features/speech/speech.ts`                                         | Plugin path compiled; voice pack test pending on the phone                                              |
| Scan once (double-tap the view, Scan button, volume-up twice)                             | `useDetection.scan`, `MainActivity.onKeyDown`                           | Headless browser; volume key pending on the phone                                                       |
| Keep screen on, camera resumes after unlock                                               | `MainActivity.java`, `useCamera.ts`                                     | Compiled; pending on the phone                                                                          |
| First-run setup (install voices via Android's own TTS screen, test voice, SOS number)     | `src/features/settings/SetupDialog.tsx`, `SetupPlugin.java`             | Headless browser; intent pending on the phone                                                           |
| Settings (language, calibrate K, voices, SOS number, delegate switch)                     | `src/features/settings/SettingsDialog.tsx`                              | Headless browser                                                                                        |
| Fall detection (impact > 2.5 g, 4 s still, toppled) → 15 s countdown → SMS with maps link | `src/features/safety/fall.ts`, `useSos.ts`, `SetupPlugin.sendSms`       | Compiled only. Needs a mattress test and a SIM                                                          |
| Release APK without INTERNET permission                                                   | `android/app/src/main/AndroidManifest.xml`, debug-only manifest adds it | `aapt dump permissions` on both APKs                                                                    |

## How to analyse the app while it runs on the phone

The page exposes `window.__ss` (detector, delegate, last detections). With the phone on USB:

1. `adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof com.teamd.secondsight)`
2. Either open `chrome://inspect` on the Mac and click inspect, or connect Playwright with `chromium.connectOverCDP('http://localhost:9222')`.
3. From there: read chips and caption, grab the camera frame to a JPEG, call `__ss.detector.detectForVideo(video, performance.now())`, flip `localStorage.secondsight.delegate` and reload.

This is how the GPU-returns-nothing bug was found in under 5 minutes.

## Commands

| Command                                      | Use                                                                       |
| -------------------------------------------- | ------------------------------------------------------------------------- |
| `pnpm dev`                                   | Mac browser, fake or Mac camera                                           |
| `pnpm dev` + `adb reverse tcp:5173 tcp:5173` | Phone's Chrome, real camera, no APK                                       |
| `pnpm android:live`                          | Real APK with live reload over Wi-Fi (debug build, has INTERNET)          |
| `pnpm apk`                                   | Debug APK over USB                                                        |
| `pnpm apk:release`                           | Final APK, no INTERNET, signed with the debug key so it installs anywhere |

## Pending on the phone (when it is back on USB)

1. `pnpm apk:release`, airplane mode on: Start, detect, speak. Proves offline.
2. First-run setup: Install voices opens Android's TTS screen; download English (India) + Telugu; Test voice speaks.
3. Telugu: toggle language, point at a person, hear Telugu.
4. Volume-up twice: scan sentence spoken.
5. Power button, unlock: camera returns by itself.
6. Fall: drop the phone on a cushion screen up, then screen down, then on its side; each time the countdown starts and a tap cancels. After cancelling, the app must still detect and speak. With a SIM and a saved number, let it expire once to see the SMS.
7. Outdoor, daylight: calibrate at 5 m, fill the accuracy table (Phase 4 in the build guide).
8. Setup with an emergency number: the SMS and location prompts appear when Done is tapped, not at the first fall. Repeat with the APK installed from a downloaded file, where Android 15 and newer may restrict the SMS prompt.
9. Telugu without its voice installed: the app switches to English and says the voice is not installed. After installing the voice, Telugu works again.
10. Speech: a scan sentence is heard to the end, and the fall alert question is heard without warnings over it.
11. Camera permission refused: the app says the camera did not start.
12. TalkBack on: check warnings are not read twice (the caption is an `aria-live` region).
13. Release APK in airplane mode: check the Network chip says "Network off" (the manifest has no `ACCESS_NETWORK_STATE`).

## Known gaps

- Stairs, poles, potholes: not in the model. Say so.
- GPS first fix in flight mode can take 30 to 60 s.
- Fall thresholds are untuned. The rule assumes portrait wearing; someone slumped rather than lying down is missed.
- The SOS SMS is not confirmed as sent, and cannot send without mobile signal (flight mode).
- Voices are Google's packs, downloaded once during setup; bundled audio clips were discussed as a fallback and not built.
