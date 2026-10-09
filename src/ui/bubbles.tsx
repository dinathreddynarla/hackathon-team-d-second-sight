import { ButtonBase } from '@mui/material'
import { styled } from '@mui/material/styles'

import { color, focusRing, focusVisible, radius } from '../theme'

// The two tactile-paving textures. Bars run along the direction of travel and mean "go"; blister dots mean
// "stop" or "hazard". They carry the meaning without colour.
const TEXTURE = {
  bars: (ink: string) => ({
    backgroundImage: `repeating-linear-gradient(90deg, ${ink} 0 10px, transparent 10px 28px)`,
  }),
  dots: (ink: string) => ({
    backgroundImage: `radial-gradient(circle, ${ink} 0 5.5px, transparent 6.5px)`,
    backgroundSize: '28px 28px',
    backgroundPosition: 'center',
  }),
}
// Keeps the texture off the middle of a control, so its label always sits on plain colour.
const CLEAR_MIDDLE = 'radial-gradient(ellipse 54% 66% at 50% 50%, transparent 60%, #000 100%)'

const TONE = {
  go: {
    base: color.paving,
    top: color.pavingTop,
    ink: color.pavingInk,
    shine: 'rgba(255,255,255,0.6)',
    mark: 'rgba(26,20,0,0.18)',
  },
  stop: {
    base: color.cane,
    top: color.caneTop,
    ink: color.white,
    shine: 'rgba(255,255,255,0.3)',
    mark: 'rgba(255,255,255,0.2)',
  },
  plain: {
    base: color.kerb,
    top: color.kerbHigh,
    ink: color.white,
    shine: 'rgba(255,255,255,0.18)',
    mark: 'rgba(255,255,255,0.1)',
  },
}
export type Tone = keyof typeof TONE
type BubbleProps = { tone?: Tone; texture?: keyof typeof TEXTURE }

// Every control is a bubble: fully rounded, lit from above, lifted off the ground by a soft shadow.
export const Bubble = styled(ButtonBase, {
  shouldForwardProp: prop => prop !== 'tone' && prop !== 'texture',
})<BubbleProps>(({ tone = 'plain', texture }) => {
  const t = TONE[tone]
  return {
    position: 'relative',
    isolation: 'isolate',
    overflow: 'hidden',
    minHeight: 56,
    padding: '0 22px',
    gap: 10,
    borderRadius: radius.pill,
    font: 'inherit',
    fontSize: '1.0625rem',
    fontWeight: 650,
    letterSpacing: '-0.01em',
    color: t.ink,
    backgroundColor: t.base,
    backgroundImage: `linear-gradient(180deg, ${t.top}, ${t.base})`,
    boxShadow: `inset 0 1px 0 ${t.shine}, inset 0 -14px 26px rgba(0,0,0,0.12), 0 10px 26px rgba(0,0,0,0.42)`,
    transition: 'transform 160ms cubic-bezier(0.16, 1, 0.3, 1), filter 160ms',
    '&:active': { transform: 'scale(0.975)', filter: 'brightness(0.93)' },
    '&.Mui-disabled': { opacity: 0.5 },
    [focusVisible]: focusRing,
    '@media (prefers-reduced-motion: reduce)': { transition: 'none', '&:active': { transform: 'none' } },
    ...(texture && {
      '&::before': {
        content: '""',
        position: 'absolute',
        inset: 0,
        zIndex: -1,
        ...TEXTURE[texture](t.mark),
        WebkitMaskImage: CLEAR_MIDDLE,
        maskImage: CLEAR_MIDDLE,
      },
    }),
  }
})

// A dark bubble for text that floats over the camera picture. Nearly opaque on purpose: a see-through panel
// over a sunlit street cannot hold readable contrast. The glass is in the rim, the highlight and the blur.
export const Glass = styled('div')({
  borderRadius: radius.pill,
  color: color.white,
  backgroundColor: 'rgba(11,13,16,0.92)',
  backgroundImage: 'linear-gradient(180deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02))',
  backdropFilter: 'blur(18px) saturate(1.6)',
  WebkitBackdropFilter: 'blur(18px) saturate(1.6)',
  border: '1px solid rgba(255,255,255,0.16)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 8px 22px rgba(0,0,0,0.45)',
  '@media (prefers-reduced-transparency: reduce)': {
    backgroundColor: color.asphalt,
    backdropFilter: 'none',
    WebkitBackdropFilter: 'none',
  },
})
