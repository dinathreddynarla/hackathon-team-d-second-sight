# Second Sight

Offline Android app that watches the road through the phone camera and speaks warnings such as
"car, left, about 5 metres, approaching" in English or Telugu. Built for the Apty Hackathon 2026, Team D.
Theme: Industry, Innovation and Infrastructure, AI-powered assistant.

It assists a white cane. It never replaces it.

## Project overview

**Problem.** A white cane reaches about one metre. A moving vehicle, a person walking into you, a stray dog or a cow
on the footpath are all beyond that reach. Blind pedestrians in Indian cities depend on hearing, and electric vehicles,
traffic noise and crowds defeat hearing. Existing camera apps (Google Lookout, Seeing AI) describe scenes on demand,
need the internet for the best results, and do not speak Telugu.

**What Second Sight does.** The phone hangs at chest height, camera facing forward. Every 100 ms a small neural network
on the phone looks at the camera frame, finds people and vehicles, estimates how far and in which direction they are,
and speaks only what matters: the nearest thing, whether it is approaching, in the user's language. Under 3 m the
phone vibrates. No internet is used while it runs; the final APK does not even hold the INTERNET permission.

**Who it is for.** Blind and low-vision pedestrians who already use a cane, starting in Telangana. Secondary users:
their families, who receive an SOS SMS with a maps link if a fall is detected.

**What it deliberately does not do.** It does not see behind the user, does not know stairs, poles or potholes
(not in the model), and does not navigate. These are stated limits, not hidden ones.

## What has been built so far (9 Oct 2026)

| Area                   | Done                                                                                                                                                                                                                                                                     | Verified                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------- |
| Toolchain              | Vite + React 19 + MUI 9 + TypeScript, Capacitor 8 Android shell, JDK 21, lint and format rules mirrored from Apty's main repo                                                                                                                                            | Builds on the Mac, APK installs on an iQOO Neo 10 (Android 16)            |
| Detection              | MediaPipe EfficientDet-Lite0 (4.6 MB, 80 COCO classes) bundled in the APK, 8 classes kept: person, car, motorcycle, bicycle, bus, truck, dog, cow                                                                                                                        | Live on the phone: boxes drawn, "person ahead, about 5 metres"            |
| GPU vs CPU             | The GPU delegate runs inside this phone's WebView but returns zero boxes; CPU (XNNPACK) detects at about 5 fps. The APK defaults to CPU, browsers use GPU                                                                                                                | Found by live-debugging the WebView over USB                              |
| Distance and direction | `distance = real height × K ÷ (box height ÷ frame height)`, one K per phone set by a 5 m calibration; left / ahead / right by frame thirds; "approaching" when the box grows 20% in 0.7 s; only the nearest target is spoken                                             | Phone caption and voice                                                   |
| Speech                 | English (India) and Telugu sentence tables (Telugu word order: side, object, range); Android text-to-speech through a Capacitor plugin; browser speech as fallback; a sentence is not cut off unless urgent, same sentence not repeated within 3 s; vibration under 3 m  | Airplane mode on: engine used its embedded (offline) voice                |
| Scan once              | One sentence for everything in view, grouped by kind and side: "2 people ahead, about 5 metres; car right, about 10 metres". Triggered by double-tapping the view, the Scan button, or pressing volume-up twice                                                          | Browser; volume key pending on the phone                                  |
| Native glue            | Screen stays on while running; camera releases when the app is hidden and restarts when it returns; app name and id `com.teamd.secondsight`                                                                                                                              | Phone                                                                     |
| Offline guarantee      | Model and WebAssembly runtime inside the APK; no CDN, no analytics; main manifest has no INTERNET permission (a debug-only manifest adds it for live reload); release APK signed with the debug key so it installs anywhere                                              | `aapt dump permissions` on both APKs; installed package shows no INTERNET |
| One-time setup         | First launch: "Install voices" opens Android's own Install voice data screen (the only moment internet is used, by Google's app, not ours), "Test voice", optional emergency number. Never shown again                                                                   | Phone: voices installed, test voice spoke                                 |
| Settings               | Language, calibrate K with a person at 5 m, install voices, test voice, emergency number, run setup again, test fall alert, CPU/GPU switch for debugging                                                                                                                 | Browser and phone                                                         |
| Fall detection and SOS | Accelerometer impact above about 2.5 g, then 4 s of stillness and the phone not upright → "Are you okay?" with a 15 s countdown, vibration every second, a full-screen cancel button → SMS to the saved number with a Google Maps link from GPS (GPS works without data) | Compiled and wired; cushion test and SMS pending                          |
| Live debugging         | The page exposes `window.__ss`; with the phone on USB the WebView is reachable through Chrome DevTools Protocol, so the camera frame, detections and delegate can be read from the Mac while the app runs                                                                | Used to find the GPU bug in minutes                                       |

## How it works

```
Back camera, 640×480, portrait
  → MediaPipe EfficientDet-Lite0 on the phone (CPU inside the APK), every 100 ms
  → keep person, car, motorcycle, bicycle, bus, truck, dog, cow (score ≥ 0.45)
  → distance = real height × K ÷ box ratio   |   direction = frame thirds
  → nearest target; "approaching" if its box grew 20% in 0.7 s
  → sentence in English or Telugu → Android text-to-speech (offline voice pack)
  → vibration under 3 m
```

Real heights assumed: person 1.7 m, car 1.5, motorcycle 1.5, bicycle 1.6, bus 3.0, truck 3.0, dog 0.5, cow 1.4.
Distances are spoken as ranges ("very close", "about 5 metres", "about 10 metres", "far") because the height guess
makes single numbers dishonest.

## Key features

- Detects people, cars, motorcycles, bicycles, buses, trucks, dogs and cows on the phone, no internet
- Speaks distance and direction, warns when something approaches, vibrates under 3 m
- Scan once: double-tap the view or press volume-up twice to hear everything in front of you
- English (India) and Telugu voices
- Fall detection with a 15 s cancel window, then an SOS SMS with a maps link to a saved number
- Works in flight mode after a one-time setup (voices are downloaded by Android's own text-to-speech settings).
  The fall SOS is the exception: an SMS needs mobile signal, so it cannot send in flight mode
- One large Start / Stop button fills the bottom of the screen and confirms by voice, so it is found by touch alone

## Business case

### Go-to-market (first 100 users)

_To be written by the business team._

### Unit economics

_To be written._

### Business model canvas

_To be written._

### 12-month business plan

_To be written._

## Deployment

1. Download `second-sight.apk` from the Releases page (built with `pnpm apk:release`, no INTERNET permission).
2. On the phone open the file, allow "install unknown apps" when asked. If Play Protect warns, choose "Install anyway".
3. Open Second Sight. One-time setup: tap Install voices, download English (India) and Telugu (needs Wi-Fi once), tap Test voice, Done. If you enter an emergency number, allow SMS and location when asked.
4. Allow the camera. Detection and speech work with airplane mode on. Keep it off if you rely on the fall SOS, which needs mobile signal to send its SMS.
5. Hang the phone at chest height, camera facing forward. Tap the large button at the bottom to start, and again to stop. Double-tap the view to scan once.

Tested on: iQOO Neo 10 (Android 16). Needs Android 7 or newer and a WebView from 2021 or later.

## Repository layout

```
src/
  App.tsx                         page: status chips, camera view, language / scan, Start / Stop, dialogs
  theme.ts                        one dark theme, tactile-paving yellow accent
  components/StatusBar.tsx        Network / Model / Camera / fps chips (the offline proof on screen)
  features/camera/useCamera.ts    back camera, releases on hide, restarts on return
  features/vision/detector.ts     MediaPipe setup, class allowlist, CPU/GPU choice
  features/vision/distance.ts     height table, K, frame thirds, approach rule, nearest target
  features/vision/useDetection.ts 100 ms loop, box overlay, scan-once, calibration
  features/speech/speech.ts       English and Telugu tables, sentence builders, cooldowns, TTS
  features/settings/              persisted settings, first-run setup dialog, settings dialog
  features/safety/fall.ts         accelerometer fall rule
  features/safety/useSos.ts       countdown, GPS, SMS
  native/setup.ts                 bridge to the Java plugin (voice install screen, SMS, volume key event)
public/models/                    efficientdet_lite0.tflite
public/vendor/wasm/               MediaPipe runtime (copied by `pnpm vendor`, git-ignored)
android/app/src/main/java/com/teamd/secondsight/
  MainActivity.java               keep screen on, volume-up double press
  SetupPlugin.java                INSTALL_TTS_DATA intent, SmsManager
android/app/src/debug/AndroidManifest.xml   INTERNET only for debug builds (live reload)
docs/STATUS.md                    current state, live-debug recipe, pending phone tests
docs/PLAN.md                      links to the build guide and the 3D build map
```

## Development

```bash
pnpm install          # once
pnpm vendor           # copies the MediaPipe runtime into public/vendor (before the first `pnpm dev`; `pnpm build` runs it itself)
pnpm dev              # browser on the Mac, http://localhost:5173
pnpm android:live     # real APK on the phone with live reload (same Wi-Fi, debug build)
pnpm apk              # build + install the debug APK over USB (has INTERNET for live reload)
pnpm apk:release      # final APK: no INTERNET permission, signed with the debug key
pnpm lint && pnpm ts:check
```

Phone's Chrome without an APK: `pnpm dev`, then `adb reverse tcp:5173 tcp:5173` and open `http://localhost:5173` on the phone.

Live debugging inside the running APK: `adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof com.teamd.secondsight)`,
then `chrome://inspect` on the Mac (debug builds only).

Branches and merges: every change goes through a pull request; only the repository owner merges (squash). See `.github/pull_request_template.md`.

## Known gaps and next steps

- Stairs, poles, potholes, open drains: not in the model. A drop-off heuristic is on the add-on list.
- Night: detection range halves. A low-light warning is on the add-on list.
- The camera faces forward only; a vehicle from behind is not seen. Stated in the demo.
- Fall thresholds are untuned; the SMS path needs a SIM test. The rule assumes the phone is worn upright in portrait,
  and someone left slumped rather than lying down is missed.
- The SOS says "Help message sent" without confirmation that the SMS left the phone. Confirming delivery needs a
  sent-result receiver in `SetupPlugin.java`.
- Outdoor calibration and the accuracy table (3, 5, 10 m) are pending daylight.

## Team

| Name             | Role        |
| ---------------- | ----------- |
| Dinath Narla     | Development |
| Mounika          |             |
| Krishna          |             |
| Shubham          |             |
| Rohith           |             |
| Revanth Kuruhuri |             |

Feasibility spike (plain HTML page, MediaPipe in the browser) done on 6 Oct 2026. All code in this repository was written during the event.
