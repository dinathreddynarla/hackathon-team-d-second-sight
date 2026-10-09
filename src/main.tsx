import { CssBaseline, ThemeProvider } from '@mui/material'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { App } from './App'
import { theme } from './theme'

// See focusVisible in theme.ts: rings follow the keyboard, not the app's own focus moves.
window.addEventListener('keydown', () => (document.documentElement.dataset.keys = ''))
window.addEventListener('pointerdown', () => delete document.documentElement.dataset.keys)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>
)
