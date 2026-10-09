# Design

The screen speaks the footpath's own language. Written from what was built; `src/theme.ts` and `src/ui/` are the
source of truth.

## The world

Tactile paving. Two textures carry meaning without colour:

| Texture       | Means           | Where                                         |
| ------------- | --------------- | --------------------------------------------- |
| Guidance bars | go              | Start                                         |
| Blister dots  | stop, or hazard | Stop, the active lane, the fall alert's strip |

Textures never run behind text. Controls clear the texture from their middle; the fall alert lays its dots out as
a strip between the words and the button.

## Colour

Yellow and red are fields that own a whole control or screen, not accents on grey.

| Role          | Value     | Use                                                |
| ------------- | --------- | -------------------------------------------------- |
| asphalt       | `#0B0D10` | ground                                             |
| kerb          | `#171A1F` | raised surfaces: cards, groups, tracks             |
| kerb high     | `#242932` | pressed rows                                       |
| white         | `#FFFFFF` | primary text                                       |
| chalk         | `#C4CAD4` | secondary text on asphalt and kerb                 |
| paving yellow | `#F2C230` | go, selected, brand. Text on it is `#1A1400`       |
| cane red      | `#981515` | stop, hazard, alert. White text on it is above 7:1 |
| alarm         | `#FF8A7A` | red that stays readable as text on the dark ground |

Dark, because the screen stays on for a whole walk and because white or yellow on black is the scheme low-vision
users already rely on.

## Shape and depth

- Every control is a bubble: fully rounded, lit from above by an inset highlight, lifted by a soft offset shadow.
- Radii: pill for controls, 44 px for Start / Stop, 32 px for the camera card, 24 px for groups.
- "Glass" bubbles (status, caption) float over the camera picture. They are 92% opaque on purpose: a see-through
  panel over a sunlit street cannot hold readable contrast. The glass is in the rim, the highlight and the blur.
- `prefers-reduced-transparency` and `prefers-reduced-motion` are honoured.

## Type

System faces only. Sentence case everywhere; Telugu has no capitals. Sizes are in `rem`, so they follow the
system text size. Numbers that change (countdown, frames per second) use tabular figures.

## Screens

- **Main:** title and settings bubble; camera card with the status bubble and caption floating on it; lane strip;
  Scan once and language; Start / Stop across the bottom.
- **Settings and setup:** full-screen pages of grouped rows. The Back button closes them.
- **Fall alert:** a red field, the question, a very large countdown, a strip of warning dots, and one white bubble.
  The whole screen cancels.

## Screen reader rules

- Names come from `src/ui/strings.ts`, in the selected language, and say what a control does.
- A spoken name must contain the visible label, or voice control cannot find the control.
- No live regions for warnings: the app speaks them itself.
- Focus rests on Start / Stop on the main screen and on the cancel button in the fall alert.
- Focus rings are drawn only while a keyboard or switch is in use.
- Textures, the camera picture and illustrations are hidden from the reader. The lane strip is one sentence.
- `data-testid` attributes are the stable hooks for automated checks; labels are localized and are not.

## Not verified on a phone

Built and checked in desktop Chrome at 360 by 640. TalkBack, real insets, sunlight and frame rate with the two
blurred bubbles still need a pass on the Android phone.
