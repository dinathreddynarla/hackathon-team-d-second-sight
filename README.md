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

- Detects people, cars, motorcycles, bicycles, buses, trucks on the phone, no internet
- Speaks distance and direction, warns when something approaches, vibrates under 3 m
- English (India) and Telugu voices
- Works in flight mode after a one-time setup

## Deployment

_How a judge installs and runs it. Filled in at Phase 6._

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
pnpm apk              # build + install the debug APK over USB
pnpm lint && pnpm ts:check
```

Build guide with every step: see `docs/PLAN.md`.
