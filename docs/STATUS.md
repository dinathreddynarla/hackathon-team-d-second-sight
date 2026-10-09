# Status, 9 Oct 2026 13:30

## What works (verified)

| Piece                                                                                                   | Where                                                                   | Verified how                                                                                                     |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Camera, Start/Stop, status chips                                                                        | `src/App.tsx`, `src/features/camera/useCamera.ts`                       | On the iQOO Neo 10 over USB                                                                                      |
| On-device detection, 8 classes (person, car, motorcycle, bicycle, bus, truck, dog, cow)                 | `src/features/vision/detector.ts`                                       | Live on the phone: CPU delegate detects, GPU returns nothing in this WebView, so CPU is the APK default          |
| Potholes and manholes: second model in a worker, found-twice rule, distance from camera height and tilt | `src/features/vision/ground.ts`, `groundWorker.ts`, `useGround.ts`      | Headless Chrome with test pictures, dev and production build; `node --test tests/ground.test.ts`. Not on a phone |
| Distance, direction, approaching, nearest-only                                                          | `src/features/vision/distance.ts`                                       | Phone caption "person ahead, about 5 metres"                                                                     |
| English + Telugu speech, cooldowns, vibration under 3 m                                                 | `src/features/speech/speech.ts`                                         | Plugin path compiled; voice pack test pending on the phone                                                       |
| Scan once (double-tap the view, Scan button, volume-up twice)                                           | `useDetection.scan`, `MainActivity.onKeyDown`                           | Headless browser; volume key pending on the phone                                                                |
| Keep screen on, camera resumes after unlock                                                             | `MainActivity.java`, `useCamera.ts`                                     | Compiled; pending on the phone                                                                                   |
| First-run setup (install voices via Android's own TTS screen, test voice, SOS number)                   | `src/features/settings/SetupDialog.tsx`, `SetupPlugin.java`             | Headless browser; intent pending on the phone                                                                    |
| Settings (language, calibrate K, voices, SOS number, delegate switch)                                   | `src/features/settings/SettingsDialog.tsx`                              | Headless browser                                                                                                 |
| Fall, lying still or Help → countdown → SMS with maps link to 3 contacts → calls in order               | `fall.ts`, `useSos.ts`, `SetupPlugin`, `EmergencyCallPlugin`            | Compiled only. Needs a mattress test and a SIM                                                                   |
| Release APK without INTERNET permission                                                                 | `android/app/src/main/AndroidManifest.xml`, debug-only manifest adds it | `aapt dump permissions` on both APKs                                                                             |

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
6. Fall: drop the phone on a cushion screen up, then screen down, then on its side; each time the countdown starts and a tap cancels. After cancelling, the app must still detect and speak. With a SIM and a saved contact, let it expire once: the SMS arrives, then the first contact is called.
7. Outdoor, daylight: calibrate at 5 m, fill the accuracy table (Phase 4 in the build guide).
8. Setup with an emergency contact: the SMS, location, phone and call-log prompts appear when Done is tapped, not at the first fall. Repeat with the APK installed from a downloaded file, where Android 15 and newer may restrict the SMS and call-log prompts.
9. Telugu without its voice installed: the app switches to English and says the voice is not installed. After installing the voice, Telugu works again.
10. Speech: a scan sentence is heard to the end, and the fall alert question is heard without warnings over it.
11. Camera permission refused: the app says the camera did not start.
12. TalkBack on: start and stop by double-tapping anywhere (focus rests on Start / Stop); a warning is heard once, not twice; cancel a fall alert by double-tapping anywhere; swipe through Settings and Setup; switch to Telugu and hear the labels in a Telugu voice.
13. Release APK in airplane mode: check the Network chip says "Network off" (the manifest has no `ACCESS_NETWORK_STATE`).
14. The redesigned screens on the phone: nothing sits under the status bar or the navigation bar; text is readable in sunlight; frames per second (Settings, Advanced) are no lower than on the previous build.
15. Back button: closes Settings and Setup; from the main screen it leaves the app.
16. A native Telugu speaker reads the on-screen labels in `src/ui/strings.ts`.
17. Emergency calls, three contacts saved, SIM in: press Help (or hold volume-down 2 s) and wait 10 s. All three get the SMS with the map link; then contact one is called on the phone's own call screen. Let it ring out: when the network ends the call, the app says "No answer" and calls contact two.
18. Answer on contact two, talk, hang up: the app says "Calls finished" and calls nobody else.
19. Nobody answers at all: the app goes through the three twice, then says "Nobody answered".
20. During a call, press the phone's end-call button, then "Stop calling" on the app's screen: no further calls.
21. Is the speaker on during the call? (Best effort; recent Android versions may refuse.)
22. Refuse the call-log permission and repeat 17: calls still go out; "answered" then falls back to "the call lasted over a minute".
23. No SIM, and flight mode: the app says "Could not send the help message" and "Could not call".
24. A contact with voicemail: the app treats voicemail as answered and stops. Decide whether that is acceptable.
25. How long from the end of the countdown to the first ring? The location lookup can take up to 15 s before the SMS goes.
26. Crowd: stand facing four or more people for a few seconds. "Crowd ahead." once, between warnings, not over them; not again until the crowd has gone and come back, and not straight after a Scan once.
27. Washed-out view: breathe on the lens, or hold thin white cloth or tracing paper over it: "Camera can't see. Warnings may be missed." Then point at a pale wall and at an overcast sky: does it fire wrongly? Note what `HAZY_STD` and `HAZY_MEAN` in `useDeviceAlerts.ts` should be. In real rain, does it fire at all?
28. Slow detection: on an old or hot phone, is "Detection is slow. Warnings may be late." said when frames per second (Settings, Advanced) fall below 2?
29. After the calls are over and the result is on screen, hold volume-down again without touching the screen: a new countdown starts at once.
30. Let the battery fall through 20% while the alert countdown is running: nothing about the battery is said until the alert is over, then it is said once.
31. Potholes, on a street in daylight: walk towards a real pothole and a real manhole cover. Is "pothole ahead" said, at what distance, and is "two steps" about right? Count the false ones over a 10 minute walk on a good road, on a patched road, across shadows and across wet patches. Decide from that whether it stays on by default.
32. Pothole speed: Settings, Advanced shows frames per second for the first detector. Is it lower than with Pothole warnings switched off? (The pothole model runs beside it, on another core.) Does the phone get hot over 20 minutes? In a busy scene, is "Pothole warnings are not available." ever said although the model is fine? (It is said when three pictures in a row get no answer within 5 s each.)
33. Tilt: with the phone hanging naturally, then tipped forward, is the spoken distance to the same pothole still right? The correction assumes the accelerometer reads positive on the screen axis when the camera tips towards the ground.
34. Flight mode, release APK: the pothole model loads (no "Pothole warnings are not available").
35. A native Telugu speaker checks "గుంత", "మ్యాన్‌హోల్" and the Pothole warnings text in Settings.

## Known gaps

- Stairs, kerbs, poles, barriers: no model. A ready-made footpath model was tried and rejected (it calls a staircase flat footpath). Say so.
- Potholes and manholes: checked only with pictures on the Mac. Distant, dark and rain-blurred potholes are missed; a dark or rough patch can be taken for one; an open manhole and a covered one are both just "manhole".
- The pothole model's licence is unsettled (its page says CC BY 4.0, the file says AGPL-3.0).
- GPS first fix in flight mode can take 30 to 60 s.
- Fall thresholds are untuned. The rule assumes portrait wearing; someone slumped rather than lying down is missed.
- The SOS SMS is not confirmed as sent, and cannot send without mobile signal (flight mode).
- Emergency calls are unproven until run on a phone with a SIM. A voicemail that picks up counts as answered. No calls in flight mode.
- Rain, puddles and smoke are not recognised. The washed-out-view check is an untuned contrast measure; the crowd count undercounts in a dense crowd.
- Voices are Google's packs, downloaded once during setup; bundled audio clips were discussed as a fallback and not built.
