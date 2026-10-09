import { createTheme } from '@mui/material'

// Single dark theme: the user may have low vision, so maximum contrast and one accent (tactile-paving yellow).
export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#f2c230', contrastText: '#1a1400' },
    error: { main: '#ef6b6b' },
    background: { default: '#0f1114', paper: '#171a1f' },
  },
  typography: { fontFamily: 'system-ui, sans-serif', button: { fontSize: '1.5rem', fontWeight: 700 } },
  shape: { borderRadius: 12 },
})
