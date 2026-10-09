# Second Sight

Offline Android app that watches the way ahead through the phone camera and speaks short warnings such as
"bus coming, right, two steps" or "stop, person ahead, one step", in English, Telugu, Hindi, Tamil or Kannada.
Built for the Apty Hackathon 2026, Team D. Theme: Industry, Innovation and Infrastructure, AI-powered assistant.

It assists a white cane. It never replaces it.

## Project overview

**Problem.** A white cane reaches about one metre. A moving vehicle, a person walking into you, a stray dog or a cow
on the footpath are all beyond that reach. Blind pedestrians in Indian cities depend on hearing, and electric vehicles,
traffic noise and crowds defeat hearing. Existing camera apps (Google Lookout, Seeing AI) describe scenes on demand,
need the internet for the best results, and do not speak Telugu.

**What Second Sight does.** The phone hangs at chest height, camera facing forward. Small neural networks on the phone
find people, vehicles, animals, road signs, potholes and (optionally) walls; the app works out how far away each is and
on which side, and speaks only what matters, in the user's language. Within two steps the phone also buzzes the side.
If something stands on the user's walking line it says which way to step, or "stop". No internet is used while it
runs; the shared APK does not even hold the INTERNET permission.

**Who it is for.** Blind and low-vision pedestrians who already use a cane, starting in Telangana. Secondary users:
their families, who receive an SOS SMS with a maps link, then a phone call, if a fall is detected or help is asked for.

**What it deliberately does not do.** It does not see behind the user, does not know stairs, kerbs or poles
(no model for them), and does not navigate. These are stated limits, not hidden ones.

## Status (10 Oct 2026)

Everything below is merged into `main` (PRs #1 to #18).

| Area                   | What it does                                                                                                                                                                                                                                              | How it was checked                                                    |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Object detection       | MediaPipe EfficientDet-Lite0 (4.6 MB, bundled), CPU inside the APK. Warns about person, car, motorcycle, bicycle, bus, truck, dog, cow. A kind must be seen in 3 frames in a row                                                                          | Live on an iQOO Neo 10; 96 s office-walk video through the real model |
| Distance and side      | Height and width estimates, the nearer wins; spoken as steps near the user; left / ahead / right by frame thirds; "coming" above 1.5 m/s closing speed                                                                                                    | Scripted scenes and office-walk video                                 |
| Steering               | Only on a collision course (within about five steps and on the walking line): "move left" / "move right" toward a free side, else "stop"; the action word first                                                                                           | 9 unit tests, scenes, office walk                                     |
| Walls and obstacles    | Depth Anything V2 Small (27 MB) in a worker every 1.5 s: "stop, obstacle". **Off by default** (Settings), because it is the heaviest model                                                                                                                | Office walk: 7 real walls and glass doors caught                      |
| Potholes and manholes  | YOLO11n (10.5 MB) on the lower part of the picture, in a worker, only while watching. **On by default**, unproven on a street                                                                                                                             | 69 street photos; office walk                                         |
| Road signs             | YOLOv8n trained on Indian signs (37 types, 3.3 MB): "Sign: stop", once per sign, never over a warning                                                                                                                                                     | Sign photo sequence through the real model                            |
| Traffic-light colour   | "traffic light, red" when it turns red; green only when asked for                                                                                                                                                                                         | Scripted scene                                                        |
| Speech                 | Android text-to-speech, offline voices. One sentence at a time; urgent warnings cut in; status lines wait for a gap. Choice of voice per language, 5 speeds, 3 pitches                                                                                    | Phone: voices, speeds; scenes                                         |
| Vibration              | Native (Capacitor Haptics): left one short buzz, right one long, ahead two                                                                                                                                                                                | Phone vibration log                                                   |
| Describe               | Double-tap, Scan button or volume-up twice: everything in view plus printed English text (ML Kit, offline)                                                                                                                                                | Phone                                                                 |
| Fall detection and SOS | Fall or lying-still rules, or Help / hold volume-down → countdown → one SMS per contact (own message + what happened + map link) → calls in turn                                                                                                          | Unit tests; full sequence in browser with stand-in SMS and calls      |
| Alarm for bystanders   | Nobody reached, or no contact saved: S O S beeps at full volume, "Emergency. This person needs help. Please call one one two." in English and the user's language, torch flashing, Call 112 / Call family on screen. Stops only after three separate taps | Browser scenes; sound and torch not yet on a phone                    |
| Status alerts          | Battery 20% / 10%, camera blocked, too dark, crowd ahead, detection slow; torch in the dark                                                                                                                                                               | Browser scenes                                                        |
| Screen readers         | Every control named; on/off settings are switches; the language button names the current language                                                                                                                                                         | Accessibility tree in a browser; TalkBack on the phone pending        |
| Offline                | All models and runtimes inside the APK, no INTERNET permission in the shared APK                                                                                                                                                                          | `aapt dump permissions`                                               |

Measured on the iQOO Neo 10: all models ready about 6 s after Start; per frame about 300 ms (signs), 800 ms (walls),
135 ms (potholes); the object detector runs about 5 times a second.

Our blind-user reviewer (an AI role-play of a Hyderabad cane user that judges every transcript) says: **would not
trust it on a footpath yet**. The safety and alarm side is ready; the collision words are not. People seen through
glass are still announced, steering is untested outdoors, and there is no street footage yet.

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

## Key features

- Warns about people, vehicles, dogs and cows, with distance and side: "car left, 8 metres", "bus coming, right, two steps"
- Steers only when a collision is possible: "move left, person ahead, two steps"; "stop" when there is no free side
  or something is coming straight at the user
- Walls, doors, glass and furniture ahead with the walls model on (Settings): "stop, obstacle"
- Potholes and manholes: "pothole ahead, two steps" (can be switched off)
- Indian road signs (37 types) and the colour of a traffic light
- Describe on demand: everything in view, and printed English text
- English, Telugu, Hindi, Tamil, Kannada; only languages whose voice is installed are offered
- Voice settings: voice per language (offline voices only), 5 speeds, 3 pitches, each heard at once
- Fall detection, a Help button and hold-volume-down for help: an SMS to up to three contacts (each with their own
  message, what happened and a map link), then calls in turn until one answers
- If nobody can be reached: a loud S O S alarm with a spoken request to call 112, torch flashing, until three taps
- Open with the camera on by holding both volume keys (Android accessibility shortcut; vivo/iQOO: phone unlocked)
- Screen stays on and dims to 5% while watching; switch "Dim the screen while watching" off in Settings
- Battery, camera blocked, too dark, crowd ahead and detection-slow alerts; torch in the dark
- One large Start / Stop button at the bottom, found by touch; every control works with TalkBack

## Business case

### Go-to-market (first 100 users)

_To be written by the business team._

### Unit economics

_To be written._

### Business model canvas

_To be written._

### 12-month business plan

_To be written._

## Install

1. Get `SecondSight-v1.0.apk` from the team (WhatsApp or Drive) or from the Releases page.
2. **If any earlier Second Sight is on the phone, uninstall it first.** An APK built on another laptop is signed with
   a different key, and Android then just says "App not installed".
3. Open the APK. Allow "install unknown apps" for the app you opened it from (WhatsApp, Files, Chrome).
   On vivo/iQOO also allow it under Settings → Security → Install unknown apps, and tap "Continue installing".
4. If Play Protect warns that the app "can request access to sensitive data", tap More details → Install anyway.
   If there is no such button: Play Store → profile → Play Protect → gear → turn off "Scan apps with Play Protect",
   install, then turn it back on. The warning is about the SMS, call and call-log permissions the SOS needs.
5. Open Second Sight. One-time setup: Install voices (needs Wi-Fi once), Test voice, the volume-key shortcut
   (optional), an emergency contact (optional). Allow SMS, location, phone and call log when asked.
6. Hang the phone at chest height, camera facing forward. Tap the large button at the bottom to start and stop.
   Double-tap the picture, or press volume-up twice, to hear everything in view.

Permissions and why: camera (seeing), location (map link in the SOS), send SMS and phone calls (SOS),
phone state and call log (knowing when a call ended and whether it was answered), vibrate, audio settings
(alarm volume). No internet.

Tested on: iQOO Neo 10 (Android 16). Needs Android 7 or newer and a WebView from 2021 or later.

## Repository layout

```
src/
  App.tsx                          main screen: status, camera view, lane strip, scan / language, Start / Stop
  components/FallAlert.tsx         full-screen alert: countdown, calls, the emergency screen for helpers
  ui/                              bubble controls, icons, page pieces, English and Telugu labels
  features/camera/                 back camera; torch through the open camera
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

## Development

```bash
pnpm install            # once
pnpm dev                # browser on the laptop, http://localhost:5173 (laptop camera)
pnpm apk                # debug APK installed over USB (has INTERNET for live reload)
pnpm apk:release        # shareable APK: no INTERNET permission, signed with the debug key
pnpm lint && pnpm ts:check
node --test tests/*.test.ts                 # unit tests (fall rule, sentences, steering, traffic light, potholes)
node tests/voice-sim.cjs all                # scripted street scenes → what the app would say
node tests/safety-sim.cjs all               # battery, camera, crowd, SOS, alarm, torch, traffic light
node tests/footage-sim.cjs <video.mp4>      # a real walk video through the real models, a frame per sentence
```

The simulations need `pnpm build` and `vite preview --port 4173` running first.

Testing on the laptop as if it were the phone: `pnpm dev`, open http://localhost:5173 in Chrome, allow the camera, then
DevTools → device toolbar → a phone size. Dimming, vibration, SMS, calls, the volume keys, text reading and fall
detection need the phone.

Live debugging inside the running APK: `adb forward tcp:9222 localabstract:webview_devtools_remote_$(adb shell pidof com.teamd.secondsight)`,
then `chrome://inspect` (debug builds). The page exposes `window.__ss`.

Every change goes through a pull request; only the repository owner merges (squash).

## Known gaps and next steps

- **Not yet tested on a street.** All footage so far is an office walk. Outdoor calibration and an accuracy table
  (true vs spoken distance at 3, 5, 10 m) are pending daylight.
- People seen through glass walls are announced as if they were in the way, sometimes with "stop".
- Steering says "move left" to someone walking slowly straight at the user (below the 1.5 m/s "coming" threshold).
- Warnings take about 2 s to say; urgent ones sometimes cut each other off.
- Stairs, kerbs, poles, barriers and open drains are not detected. Clear glass can be missed by the walls model.
- Potholes: on six street photos with a real pothole, two found, one weakly, three missed. The model cannot tell an
  open manhole from a covered one. Its licence is unsettled (page CC BY 4.0, file AGPL-3.0); settle it or train our
  own before any release. The sign model's repository has no licence file (dataset CC BY 4.0).
- Night: detection range halves; the torch helps for a few metres.
- The alarm's loudness, the torch flashing, TalkBack and the voice list are not yet checked on the phone.
- SMS and calls have not been sent from a phone with a SIM. A voicemail counts as answered. A false fall alarm that
  is not cancelled texts and calls up to three people.
- The call permissions (`CALL_PHONE`, `READ_CALL_LOG`) are restricted on Google Play and make Play Protect warn on
  install; fine for an APK installed by hand, needs another approach for a Play Store release.
- The shared APK is signed with a development key. Before any wider release: a real release key.
- A small on-device language model (Gemma 3 270M) was tried for warmer wording and rejected: it dropped or invented
  facts in up to 12 of 30 sentences and would add about 290 MB. Hand-written warmer templates are the next step.

## Team

- Dinath Narla
- Mounika
- Krishna
- Shubham
- Rohith
- Revanth Kuruhuri

Feasibility spike (plain HTML page, MediaPipe in the browser) done on 6 Oct 2026. All code in this repository was written during the event.
