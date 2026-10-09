import { createTheme } from '@mui/material'

// The footpath's own palette. Yellow and red are fields that own whole regions, not accents on grey.
// Dark ground: the screen stays on for the whole walk (AMOLED), and white or yellow on black is the
// high-contrast scheme low-vision users already rely on.
export const color = {
  asphalt: '#0B0D10', // ground
  kerb: '#171A1F', // raised surfaces: cards, groups, tracks
  kerbHigh: '#242932', // pressed rows, selected segments
  hairline: 'rgba(255,255,255,0.12)',
  white: '#FFFFFF',
  chalk: '#C4CAD4', // secondary text on asphalt and kerb
  paving: '#F2C230', // tactile-paving yellow: go, brand
  pavingTop: '#FFD95A',
  pavingInk: '#1A1400', // text on yellow
  cane: '#981515', // white-cane red: stop, hazard, alert. White text on it is above 7:1.
  caneTop: '#AE1B1B',
  caneDeep: '#7C1010',
  alarm: '#FF8A7A', // red that stays readable as text on the dark ground
}

export const radius = { pill: 999, card: 32, group: 24, hero: 44 }

// Rings are drawn only while a keyboard or switch is in use (main.tsx sets data-keys). The app also moves focus
// itself, to Start / Stop and to the alert's cancel, and a ring then would be noise for someone using touch.
export const focusVisible = 'html[data-keys] &.Mui-focusVisible'
// One ring that shows on yellow, red and black alike: white, then a dark gap.
export const focusRing = {
  outline: `3px solid ${color.white}`,
  outlineOffset: 3,
  boxShadow: `0 0 0 8px ${color.asphalt}`,
}

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: color.paving, contrastText: color.pavingInk },
    error: { main: color.alarm },
    background: { default: color.asphalt, paper: color.asphalt },
    text: { primary: color.white, secondary: color.chalk },
    divider: color.hairline,
  },
  // System faces only: nothing is fetched, and Telugu falls through to the platform's Telugu face.
  typography: {
    fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Telugu", sans-serif',
    h1: { fontSize: '1.75rem', fontWeight: 750, letterSpacing: '-0.02em', lineHeight: 1.15 },
    h2: { fontSize: '0.9375rem', fontWeight: 650, letterSpacing: 0, lineHeight: 1.3 },
    body1: { fontSize: '1.0625rem', lineHeight: 1.4 },
    body2: { fontSize: '0.9375rem', lineHeight: 1.4 },
    button: { fontSize: '1.0625rem', fontWeight: 650, textTransform: 'none', letterSpacing: '-0.01em' },
  },
  shape: { borderRadius: 16 },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        // The parts the browser draws still belong to the design.
        '::selection': { background: color.paving, color: color.pavingInk },
        html: { caretColor: color.paving, scrollbarColor: `${color.kerbHigh} transparent`, scrollbarWidth: 'thin' },
        body: { WebkitTapHighlightColor: 'transparent', overscrollBehavior: 'none' },
        'h1, h2': { textWrap: 'balance' },
        p: { textWrap: 'pretty' },
      },
    },
    // Dialogs are full-screen pages on the same ground, not grey overlays.
    MuiDialog: { styleOverrides: { paper: { backgroundColor: color.asphalt, backgroundImage: 'none' } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          borderRadius: 16,
          backgroundColor: color.asphalt,
          '& .MuiOutlinedInput-notchedOutline': { borderColor: 'rgba(255,255,255,0.32)' },
        },
      },
    },
  },
})
