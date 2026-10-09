# Second Sight

Offline Android app that watches the road through the phone camera and speaks warnings such as
"car, left, about 5 metres, approaching" in English or Telugu. Built for the Apty Hackathon 2026, Team D.
Theme: Industry, Innovation and Infrastructure, AI-powered assistant.

## Project overview

_Problem, who it is for, what it does, what it deliberately does not do (assists a white cane, never replaces it)._

## Business case

### Go-to-market (first 100 users)

### Unit economics

### Business model canvas

### 12-month business plan

## Key features

- Detects people, cars, motorcycles, bicycles, buses, trucks, dogs and cows on the phone, no internet
- Speaks distance and direction, warns when something approaches, vibrates under 3 m
- Scan once: double-tap the view or press volume-up twice to hear everything in front of you
- English (India) and Telugu voices
- Fall detection with a 15 s cancel window, then an SOS SMS with a maps link to a saved number
- Works in flight mode after a one-time setup (voices are downloaded by Android's own text-to-speech settings)

## Deployment

1. Download `second-sight.apk` from the Releases page (built with `pnpm apk:release`, no INTERNET permission).
2. On the phone open the file, allow "install unknown apps" when asked. If Play Protect warns, choose "Install anyway".
3. Open Second Sight. One-time setup: tap Install voices, download English (India) and Telugu (needs Wi-Fi once), tap Test voice, Done.
4. Allow the camera. Turn airplane mode on.
5. Hang the phone at chest height, camera facing forward. Tap the bottom half to start, the top half to stop. Double-tap the view to scan once.

## Team

| Name             | Role        |
| ---------------- | ----------- |
| Dinath Narla     | Development |
| Mounika          |             |
| Krishna          |             |
| Shubham          |             |
| Rohith           |             |
| Revanth Kuruhuri |             |

## Development

```bash
pnpm install          # once
pnpm vendor           # copies the MediaPipe runtime into public/vendor (once, and after upgrades)
pnpm dev              # browser on the Mac, http://localhost:5173
pnpm android:live     # real APK on the phone with live reload (same Wi-Fi)
pnpm apk              # build + install the debug APK over USB (has INTERNET for live reload)
pnpm apk:release      # final APK: no INTERNET permission, signed with the debug key
pnpm lint && pnpm ts:check
```

Build guide with every step: `docs/PLAN.md`. Current state and the live-debug recipe: `docs/STATUS.md`.
