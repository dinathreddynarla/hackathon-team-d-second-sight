import { Box, ButtonBase, Dialog, Stack, Typography } from '@mui/material'

import type { SosState } from '../features/safety/useSos'
import type { Lang } from '../features/speech/speech'
import { color, focusRing, focusVisible, radius } from '../theme'
import { UI } from '../ui/strings'

type Props = { state: SosState; secondsLeft: number; lang: Lang; onCancel: () => void }

const CANCEL_HEIGHT = 72

// Fills the screen over the main view (which must stay mounted underneath, or detection dies). The whole
// screen is the cancel button and takes focus, so one tap, or a screen reader's double-tap anywhere, cancels.
export function FallAlert({ state, secondsLeft, lang, onCancel }: Props) {
  const s = UI[lang].alert
  const counting = state === 'countdown'
  const title = counting
    ? s.question
    : state === 'sending'
      ? s.sending
      : state === 'sent'
        ? s.sent
        : state === 'failed'
          ? s.failed
          : ''

  return (
    <Dialog
      fullScreen
      open={state !== 'idle'}
      transitionDuration={0}
      disableRestoreFocus
      aria-labelledby="alert-title"
      slotProps={{
        paper: {
          sx: {
            color: color.white,
            backgroundColor: color.cane,
            backgroundImage: `linear-gradient(180deg, ${color.cane}, ${color.caneDeep})`,
          },
        },
      }}
    >
      <ButtonBase
        autoFocus
        data-testid="alert-cancel"
        data-state={state}
        aria-label={counting ? s.cancelLabel : s.back}
        onClick={onCancel}
        sx={{
          position: 'absolute',
          inset: 0,
          alignItems: 'flex-end',
          p: 2.5,
          pb: 4,
          font: 'inherit',
          [focusVisible]: { ...focusRing, outlineOffset: -10, boxShadow: 'none' },
        }}
      >
        <Box
          component="span"
          sx={{
            width: '100%',
            minHeight: CANCEL_HEIGHT,
            display: 'grid',
            placeItems: 'center',
            px: 3,
            py: 1,
            borderRadius: radius.pill,
            bgcolor: color.white,
            color: color.cane,
            fontSize: '1.375rem',
            fontWeight: 800,
            lineHeight: 1.2,
            textAlign: 'center',
            textWrap: 'balance',
            boxShadow: 'inset 0 -10px 22px rgba(152,21,21,0.1), 0 12px 28px rgba(0,0,0,0.4)',
          }}
        >
          {counting ? s.tapAnywhere : s.back}
        </Box>
      </ButtonBase>
      {/* Above the button for the eye, transparent to touch. */}
      <Stack
        sx={{ position: 'relative', height: '100%', pointerEvents: 'none', textAlign: 'center', pt: 7, px: 2.5, pb: 4 }}
      >
        <Typography
          id="alert-title"
          data-testid="alert-title"
          component="h1"
          sx={{ fontSize: '2rem', fontWeight: 800 }}
        >
          {title}
        </Typography>
        {counting && (
          <>
            <Box
              aria-hidden
              data-testid="alert-count"
              sx={{
                mt: 3,
                fontSize: 'clamp(7rem, 44vw, 13rem)',
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: '-0.04em',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {secondsLeft}
            </Box>
            <Typography sx={{ mt: 1, fontSize: '1.25rem', fontWeight: 600 }}>{s.helpIn(secondsLeft)}</Typography>
          </>
        )}
        {/* The warning strip: blister dots across the path. It takes whatever room is left between the words and
            the button, so it can never run behind either. */}
        <Box
          aria-hidden
          sx={{
            flex: 1,
            minHeight: 0,
            my: 3,
            borderRadius: `${radius.group}px`,
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.26) 0 7px, transparent 8px)',
            backgroundSize: '34px 34px',
            backgroundRepeat: 'round',
          }}
        />
        <Box sx={{ flexShrink: 0, height: CANCEL_HEIGHT }} />
      </Stack>
    </Dialog>
  )
}
