import { Box } from '@mui/material'

import type { Lang } from '../features/speech/speech'
import type { Side } from '../features/vision/distance'
import { color, radius } from '../theme'
import { UI } from '../ui/strings'

const SIDES: Side[] = ['left', 'ahead', 'right']

// Where the thing last warned about is: left, ahead or right. The lane fills with warning dots, so it reads
// by pattern as well as by colour. A screen reader hears one sentence, not three boxes.
export function LaneStrip({ lane, lang }: { lane: Side | null; lang: Lang }) {
  const s = UI[lang]
  return (
    <Box
      role="img"
      aria-label={lane ? s.hazard[lane] : s.noHazard}
      data-testid="lanes"
      data-lane={lane ?? ''}
      sx={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '6px',
        p: '6px',
        borderRadius: radius.pill,
        bgcolor: color.kerb,
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.06)',
      }}
    >
      {SIDES.map(side => {
        const active = lane === side
        return (
          <Box
            key={side}
            aria-hidden
            data-active={active || undefined}
            sx={{
              minHeight: 44,
              display: 'grid',
              placeItems: 'center',
              borderRadius: radius.pill,
              fontSize: '1rem',
              fontWeight: active ? 750 : 550,
              color: active ? color.white : color.chalk,
              ...(active && {
                backgroundColor: color.cane,
                backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.22) 0 4px, transparent 5px), linear-gradient(180deg, ${color.caneTop}, ${color.cane})`,
                backgroundSize: '18px 18px, auto',
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.3), 0 6px 16px rgba(0,0,0,0.4)',
                // The label sits on a plain plate so the dots never run behind the letters.
                '& > span': { px: 1.25, borderRadius: radius.pill, bgcolor: color.cane },
              }),
            }}
          >
            <span>{s.lane[side]}</span>
          </Box>
        )
      })}
    </Box>
  )
}
