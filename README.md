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
phone vibrates. A second small network watches the road surface for potholes and manholes within a few steps.
No internet is used while it runs; the final APK does not even hold the INTERNET permission.

**Who it is for.** Blind and low-vision pedestrians who already use a cane, starting in Telangana. Secondary users:
their families, who receive an SOS SMS with a maps link, then a phone call, if a fall is detected or help is asked for.

**What it deliberately does not do.** It does not see behind the user, does not know stairs, kerbs or poles
(no model for them), and does not navigate. These are stated limits, not hidden ones.

## What has been built so far (9 Oct 2026)

| Area                   | Done                                                                                                                                                                                                                                                                                                                                                                                                            | Verified                                                                      |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Toolchain              | Vite + React 19 + MUI 9 + TypeScript, Capacitor 8 Android shell, JDK 21, lint and format rules mirrored from Apty's main repo                                                                                                                                                                                                                                                                                   | Builds on the Mac, APK installs on an iQOO Neo 10 (Android 16)                |
| Detection              | MediaPipe EfficientDet-Lite0 (4.6 MB, 80 COCO classes) bundled in the APK, 8 classes kept: person, car, motorcycle, bicycle, bus, truck, dog, cow                                                                                                                                                                                                                                                               | Live on the phone: boxes drawn, "person ahead, about 5 metres"                |
| Potholes and manholes  | A second model (YOLO11n trained on potholes and sewage manholes, 10.5 MB, bundled) looks at the lower part of the picture about twice a second, in a background worker so the first detector never waits. Distance comes from the camera's height above the ground (1.3 m) and the phone's tilt, not from an assumed object height. "pothole ahead, two steps"; listed first in scan once; a switch in Settings | Headless Chrome on the Mac with test pictures; not yet on a phone or a street |
| GPU vs CPU             | The GPU delegate runs inside this phone's WebView but returns zero boxes; CPU (XNNPACK) detects at about 5 fps. The APK defaults to CPU, browsers use GPU                                                                                                                                                                                                                                                       | Found by live-debugging the WebView over USB                                  |
| Distance and direction | `distance = real height × K ÷ (box height ÷ frame height)`, one K per phone set by a 5 m calibration; left / ahead / right by frame thirds; "approaching" when the box grows 20% in 0.7 s; only the nearest target is spoken                                                                                                                                                                                    | Phone caption and voice                                                       |
| Speech                 | English (India) and Telugu sentence tables (Telugu word order: side, object, range); Android text-to-speech through a Capacitor plugin; browser speech as fallback; 1.5 s gap between sentences, same sentence not repeated within 3 s; vibration under 3 m                                                                                                                                                     | Airplane mode on: engine used its embedded (offline) voice                    |
| Scan once              | One sentence for everything in view, grouped by kind and side: "2 people ahead, about 5 metres; car right, about 10 metres". Triggered by double-tapping the view, the Scan button, or pressing volume-up twice                                                                                                                                                                                                 | Browser; volume key pending on the phone                                      |
| Native glue            | Screen stays on while running; camera releases when the app is hidden and restarts when it returns; app name and id `com.teamd.secondsight`                                                                                                                                                                                                                                                                     | Phone                                                                         |
| Offline guarantee      | Both models and their WebAssembly runtimes inside the APK; no CDN, no analytics; main manifest has no INTERNET permission (a debug-only manifest adds it for live reload); release APK signed with the debug key so it installs anywhere                                                                                                                                                                        | `aapt dump permissions` on both APKs; installed package shows no INTERNET     |
| One-time setup         | First launch: "Install voices" opens Android's own Install voice data screen (the only moment internet is used, by Google's app, not ours), "Test voice", optional emergency number. Never shown again                                                                                                                                                                                                          | Phone: voices installed, test voice spoke                                     |
| Settings               | Language, calibrate K with a person at 5 m, install voices, test voice, emergency number, run setup again, test fall alert, CPU/GPU switch for debugging                                                                                                                                                                                                                                                        | Browser and phone                                                             |
| Fall detection and SOS | Impact above about 2.5 g then 4 s still and not upright, or a collapse then 30 s lying still → "Are you okay?" with a 15 or 30 s countdown and a full-screen cancel → SMS with a Google Maps link to up to three contacts, then calls to them in order until one answers                                                                                                                                        | APK compiles; calls simulated; phone run pending                              |
| Live debugging         | The page exposes `window.__ss`; with the phone on USB the WebView is reachable through Chrome DevTools Protocol, so the camera frame, detections and delegate can be read from the Mac while the app runs                                                                                                                                                                                                       | Used to find the GPU bug in minutes                                           |

## How it works

```
Back camera, 640×480, portrait
  → MediaPipe EfficientDet-Lite0 on the phone (CPU inside the APK), every 100 ms
  → keep person, car, motorcycle, bicycle, bus, truck, dog, cow (score ≥ 0.45)
  → distance = real height × K ÷ box ratio   |   direction = frame thirds
  → nearest target; "approaching" if its box grew 20% in 0.7 s
  → sentence in English or Telugu → Android text-to-speech (offline voice pack)
  → vibration under 3 m

Lower 55% of the same frame, about twice a second, in a worker
  → YOLO11n pothole / manhole model on ONNX Runtime (WebAssembly, one thread, inside the APK)
  → keep what is found twice in a row (score ≥ 0.4, one of the two ≥ 0.5)
  → distance = camera height 1.3 m ÷ tan(angle below the horizon, corrected by the phone's tilt), near edge of the box
  → within 5 m: "pothole ahead, two steps"; cuts in within two steps, but never over a "coming" sentence
```

Real heights assumed: person 1.7 m, car 1.5, motorcycle 1.5, bicycle 1.6, bus 3.0, truck 3.0, dog 0.5, cow 1.4.
Distances are spoken as ranges ("very close", "about 5 metres", "about 10 metres", "far") because the height guess
makes single numbers dishonest.

## Key features

- Detects people, cars, motorcycles, bicycles, buses, trucks, dogs and cows on the phone, no internet
- Warns about walls, doors, desks, plants and other solid things ahead that have no name in the object model (an on-device depth model, once a second): "obstacle ahead, one step, move right". Clear glass can be missed
- Reads Indian road signs while walking (37 types: stop, no entry, speed limits 20 to 80, school ahead, pedestrian crossing, speed breaker, give way, …): "Sign: stop", once per sign, never over a warning. Left/right sign pairs are spoken without the side because the model cannot tell them apart
- Speaks distance and direction, warns when something approaches, and within two steps buzzes the side: one short buzz for left, one long for right, two for straight ahead (Settings → Feel the buzzes plays all three)
- Says when a traffic light in view is red: "traffic light, red", once, and again each time it comes back to red. Green is given only when asked for (Describe: "traffic light, green"): left as the last word after the light had changed, it would be heard as leave to walk. The colour only, never whether to cross: the app cannot tell a pedestrian signal from one for vehicles, or which road a light belongs to. Amber is not said
- Voice speed: slow, normal or fast (Settings), heard at once when changed
- Warns about potholes and manholes in the road within about 5 m: "pothole ahead, two steps". It can be switched off
  in Settings. It misses some (see Known gaps), so it is an extra to the cane, never a replacement
- Describe what is around: double-tap the view, press volume-up twice, or use the volume-key shortcut while watching. Speaks the warning objects with where and how far, other recognisable things by name (chair, bench, traffic light, stop sign, …), and any printed English text in view (read on the phone, offline)
- Speaks English, Telugu, Hindi, Tamil and Kannada; the app offers only the languages whose voice is installed on the phone
- Fall detection, two rules: an impact then stillness (15 s to cancel), or a collapse then 30 s lying still (30 s to cancel); then an SOS SMS with a maps link to up to three emergency contacts, then phone calls to them in order until one answers
- **Open and start without finding anything:** assign Second Sight to Android's accessibility shortcut, then hold both volume keys for 3 s (on vivo/iQOO phones: once the phone is unlocked). The camera starts by itself
- Ask for help on purpose: hold volume-down for 2 s, or press Help on the screen (10 s to cancel)
- "Help message sent" is said only when Android reports that the message left the phone; with no signal or in flight mode it says "Could not send the help message" within 15 s and goes on to the calls
- If nobody answers, the calls cannot be placed, or no contact is saved, the phone says "Alarm on. Tap to stop." and sounds a loud alarm for people nearby (at full media volume, for up to 3 minutes; warnings stay quiet under it; a tap stops it; can be switched off in Settings)
- In the dark the phone's torch comes on by itself ("Dark. Torch on."), so the camera can see a few metres and drivers can see the user. It stays on until Stop. If it is only lighting a covered lens it goes out again and "Camera blocked. Clear the lens." is said. Can be switched off in Settings
- Spoken status: battery at 20% and 10% with the real level, "Camera blocked. Clear the lens.", "Camera can't see. Warnings may be missed." (too dark, or a washed-out picture: heavy rain, smoke, fog), "Detection is slow. Warnings may be late."
- "Crowd ahead." when four or more people stay in view
- Screen stays on and dims to 5% while watching (saves battery); a quiet street drops detection from 10 to about 3 checks a second
- Works in flight mode after a one-time setup (voices are downloaded by Android's own text-to-speech settings).
  The SOS is the exception: the SMS and the calls need mobile signal, so they cannot go out in flight mode
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
3. Optional, recommended: Settings → Accessibility → Second Sight → turn on its shortcut (choose "volume keys"). Holding both volume keys then opens it with the camera on.
4. Open Second Sight. One-time setup: tap Install voices, download your language and English (India) (needs Wi-Fi once), tap Test voice, Done. If you enter an emergency contact, allow SMS, location, phone calls and the call log when asked.
5. Allow the camera. Detection and speech work with airplane mode on. Keep it off if you rely on the SOS, which needs mobile signal for its SMS and its calls.
6. Hang the phone at chest height, camera facing forward. Tap the large button at the bottom to start, and again to stop. Double-tap the view to scan once.

Tested on: iQOO Neo 10 (Android 16). Needs Android 7 or newer and a WebView from 2021 or later.

## Repository layout

```
src/
  App.tsx                         page: status bubble, camera view, lane strip, scan / language, Start / Stop
  theme.ts                        colours, shapes and type scale (see DESIGN.md)
  components/StatusBar.tsx        status bubble: what the app is doing, and Offline / Network on (the offline proof)
  components/LaneStrip.tsx        left / ahead / right: where the thing last warned about is
  components/FallAlert.tsx        full-screen alert: countdown, message, calls; the whole screen cancels or stops
  ui/                             bubble controls, icons, page pieces, English and Telugu labels, Back-to-close
  features/camera/useCamera.ts    back camera, releases on hide, restarts on return
  features/camera/torch.ts        the flashlight, through the open camera
  features/vision/trafficLight.ts which lamp of a traffic light is lit, and when that is worth saying
  features/vision/detector.ts     MediaPipe setup, class allowlist, CPU/GPU choice
  features/vision/distance.ts     height table, K, frame thirds, approach rule, nearest target
  features/vision/useDetection.ts 100 ms loop, box overlay, scan-once, calibration
  features/vision/ground.ts       potholes and manholes: reading the model's output, found-twice rule, distance from camera height
  features/vision/groundWorker.ts runs the pothole model in a worker (ONNX Runtime, WebAssembly)
  features/vision/useGround.ts    sends the lower part of the frame to the worker, speaks the nearest hazard
  features/speech/speech.ts       English and Telugu tables, sentence builders, cooldowns, TTS
  features/settings/              persisted settings, first-run setup dialog, settings dialog
  features/safety/fall.ts         accelerometer fall rule
  features/safety/useSos.ts       countdown, GPS, SMS to every contact, then calls them in turn
  features/safety/useSceneAlerts.ts  crowd ahead, detection slow: said in a gap, never over a warning
  features/safety/siren.ts        the alarm for people nearby when no contact could be reached
  native/setup.ts                 bridge to the Java plugin (voice install screen, SMS, volume key event)
  native/calls.ts                 bridge to the calling plugin; a stand-in call for demos and checks
public/models/                    efficientdet_lite0.tflite, pothole_yolo11n_320.onnx
public/vendor/wasm/               MediaPipe runtime (copied by `pnpm vendor`, git-ignored)
android/app/src/main/java/com/teamd/secondsight/
  MainActivity.java               keep screen on, volume-up double press
  SetupPlugin.java                INSTALL_TTS_DATA intent, SmsManager with its "sent" verdict, alarm volume
  EmergencyCallPlugin.java        places one call, waits for it to end, reads the call log to see if it was answered
android/app/src/debug/AndroidManifest.xml   INTERNET only for debug builds (live reload)
docs/STATUS.md                    current state, live-debug recipe, pending phone tests
docs/PLAN.md                      links to the build guide and the 3D build map
PRODUCT.md                        who the app is for and what must stay true
DESIGN.md                         the visual system: tactile-paving textures, bubble controls, screen-reader rules
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

- Stairs, kerbs, poles, barriers, open drains: still not detected. A ready-made footpath model (SegFormer-B0 trained
  on European pavements) was tried on photos of Indian streets and rejected: it marks a staircase as flat footpath,
  which is worse than saying nothing. These need a model trained on Indian street footage.
- Potholes and manholes are unproven outside the Mac. On 69 photos of Indian streets the model found clear, close
  potholes and missed distant, dark or rain-blurred ones (of six photos with a real pothole: two found, one found
  weakly, three missed); it took a dark or rough patch of road for a pothole in three of about fifty photos without
  one. From chest height the nearest ground in view is about 2 m ahead, so the warning comes two steps early, not at
  the feet. Speed on the phone, the tilt correction and the distances all need a street test.
- The model cannot tell an open manhole from a covered one, so it only ever says "manhole".
- The pothole model is from huggingface.co/tahaUgan/pothole-yolo11n. Its page says CC BY 4.0; the file itself says
  AGPL-3.0 (it was trained with Ultralytics YOLO). Fine for the hackathon; settle the licence, or train our own
  model, before any release. It and its runtime add about 13 MB to the APK (debug build: 23 MB before, 37 MB after).
- Night: detection range halves. The torch helps for a few metres only. When it comes on, and when it decides the
  lens is covered, rest on brightness thresholds that have not been tried on a phone at night.
- Traffic-light colour is read from the box the detector draws, with colour thresholds that have not been tuned on a
  real junction. The detector misses small, distant lights; a red tail light or signboard inside the box could be
  read as a red light; with several lights in view the largest is read, which may be for another road.
- The torch, the buzz patterns, the alarm's loudness and the voice speed on Android's own voices have not been tried
  on a phone.
- The camera faces forward only; a vehicle from behind is not seen. Stated in the demo.
- Fall thresholds are untuned; the SMS path needs a SIM test. The rule assumes the phone is worn upright in portrait,
  and someone left slumped rather than lying down is missed.
- "Help message sent" now waits for Android's "sent" report (the network took the message). That is not proof the
  contact's phone received it, and a message the network takes after more than 15 s is spoken as not sent. Unproven
  until run on a phone with a SIM.
- Emergency calls have not been run on a phone. The sequence is checked in a browser with the calls simulated, and
  the APK compiles; a real call needs an Android phone with a SIM.
- A call counts as answered when the call log shows a duration above zero. A voicemail that picks up looks the same,
  and the app then stops. An app cannot tell ringing from talking, so an unanswered call lasts until the network ends
  it (30 to 45 s) before the next contact is tried.
- A false fall alarm that is not cancelled now texts and phones up to three people.
- Calling needs `CALL_PHONE`, `READ_PHONE_STATE` and `READ_CALL_LOG`. Google Play restricts the first and last to a
  few kinds of app, so this works for an APK installed by hand and would need another approach for a Play Store release.
- Rain, puddles and smoke are not recognised: the model has no such classes. A washed-out picture is spoken as
  "Camera can't see", from a contrast measure with untuned thresholds; it cannot tell rain from fog from a pale wall,
  and a wet road is not detected at all.
- "Crowd ahead" counts the people the detector finds. It undercounts in a dense crowd, so it never says a number.
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
