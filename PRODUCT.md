# Product

Second Sight: an offline Android app that watches the road through the phone camera and speaks short warnings
("car left, two steps") in English or Telugu. It assists a white cane. It never replaces it.

## Platform

Android phone, portrait, as a Capacitor WebView app. No tablet, no iOS build.

## Stack

Vite, React 19, MUI 9 with Emotion, TypeScript. System fonts only. No network at run time.

## Users

- Blind and low-vision cane users in Hyderabad. They count steps, not metres.
- A family member or helper who sets the app up once.
- Hackathon judges, who see a demo.

## Product Purpose

Tell the user the one thing ahead that matters next: what it is, which side, how near.

## Operating Context

Outdoors on a footpath, the phone hanging at chest height, camera forward. The screen stays on for the whole walk
and is handled without looking. Speech is the main channel; the screen confirms it for anyone who can see.

## Capabilities and Constraints

- Detects people, cars, motorcycles, bicycles, buses, trucks, dogs and cows. Not stairs, poles or potholes.
- Start / Stop is one large control at the bottom of the screen, found by touch.
- The screen shows the offline proof: "Offline", with the model already on the phone.
- Detection keeps the main thread busy, so the interface avoids heavy animation and large blurred areas.

## Brand Commitments

- Tactile paving is the visual language: bars mean go, blister dots mean stop or hazard.
- Controls are rounded "bubble" shapes in the style of current iOS, at the team's request, on an Android app.
  Android behaviour is kept: the Back button, screen insets, 48 px targets.

## Product Principles

- Never reassure when something has failed. A failure is spoken, not only shown.
- Shorter and rarer speech beats more speech.
- Meaning is never carried by colour alone.

## Accessibility & Inclusion

- Usable with TalkBack: every control has a spoken name in the chosen language, and focus rests on the control
  the user most likely needs.
- One voice at a time: the app speaks warnings, the screen reader speaks controls.
- Text contrast of at least 4.5:1 everywhere, and 7:1 for Start, Stop, the caption and the fall alert.
- Labels and screen-reader names in English and Telugu.
