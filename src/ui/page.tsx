import { Box, ButtonBase, Stack, Typography } from '@mui/material'
import { useId, type ReactNode } from 'react'

import { color, focusRing, focusVisible, radius } from '../theme'
import { Bubble } from './bubbles'
import { ChevronIcon, CloseIcon } from './icons'

// The pieces a full-screen page is made of: a large title with a close bubble, and grouped rows.

export function PageHeader(props: {
  titleId: string
  title: string
  closeLabel: string
  closeTestId: string
  onClose: () => void
}) {
  return (
    <Stack direction="row" sx={{ alignItems: 'center', minHeight: 48, gap: 1.5 }}>
      <Typography id={props.titleId} variant="h1" sx={{ flex: 1 }}>
        {props.title}
      </Typography>
      <Bubble
        aria-label={props.closeLabel}
        data-testid={props.closeTestId}
        onClick={props.onClose}
        sx={{ width: 48, minWidth: 48, minHeight: 48, p: 0 }}
      >
        <CloseIcon />
      </Bubble>
    </Stack>
  )
}

// A titled group of rows on one raised surface, separated by hairlines.
export function Group({ title, badge, children }: { title: string; badge?: ReactNode; children: ReactNode }) {
  const id = useId()
  return (
    <Box component="section" aria-labelledby={id}>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1.25, mb: 1, px: 0.5 }}>
        {badge}
        <Typography
          id={id}
          variant="h2"
          sx={{ color: badge ? color.white : color.chalk, ...(badge && { fontSize: '1.125rem', fontWeight: 700 }) }}
        >
          {title}
        </Typography>
      </Stack>
      <Box
        sx={{
          borderRadius: `${radius.group}px`,
          bgcolor: color.kerb,
          boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 0 0 1px rgba(255,255,255,0.05)',
          overflow: 'hidden',
          '& > * + *': { borderTop: `1px solid ${color.hairline}` },
        }}
      >
        {children}
      </Box>
    </Box>
  )
}

type RowProps = {
  label: string
  hint?: string
  trailing?: ReactNode
  chevron?: 'right' | 'down'
  alarm?: boolean
  disabled?: boolean
  expanded?: boolean
  testId?: string
  onClick: () => void
}
// A row that does something when pressed. The hint says what will happen, or why it cannot yet.
export function Row({ label, hint, trailing, chevron, alarm, disabled, expanded, testId, onClick }: RowProps) {
  return (
    <ButtonBase
      data-testid={testId}
      disabled={disabled}
      aria-expanded={expanded}
      onClick={onClick}
      sx={{
        width: '100%',
        minHeight: 64,
        px: 2,
        py: 1.25,
        gap: 1.5,
        justifyContent: 'space-between',
        textAlign: 'left',
        font: 'inherit',
        '&:active': { bgcolor: color.kerbHigh },
        [focusVisible]: { ...focusRing, outlineOffset: -4, boxShadow: 'none' },
        // A row that cannot be pressed yet dims its label, never the hint that says why.
        '&.Mui-disabled .row-label': { opacity: 0.55 },
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography className="row-label" sx={{ fontWeight: 600, color: alarm ? color.alarm : color.white }}>
          {label}
        </Typography>
        {hint && (
          <Typography variant="body2" sx={{ color: color.chalk, mt: 0.25 }}>
            {hint}
          </Typography>
        )}
      </Box>
      {(trailing || chevron) && (
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            color: color.chalk,
            fontVariantNumeric: 'tabular-nums',
            flexShrink: 0,
          }}
        >
          {trailing}
          {chevron && <ChevronIcon down={chevron === 'down'} />}
        </Box>
      )}
    </ButtonBase>
  )
}

type SegmentedProps<T extends string> = {
  label: string
  value: T
  options: ReadonlyArray<{ value: T; label: string; testId?: string }>
  onChange: (value: T) => void
}
// A small set of choices, one of them on. Each choice is a toggle a screen reader can read as pressed or not.
export function Segmented<T extends string>({ label, value, options, onChange }: SegmentedProps<T>) {
  return (
    <Box
      role="group"
      aria-label={label}
      sx={{
        display: 'grid',
        // Wraps to a second row when there are more choices than fit (five languages on a phone).
        gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))',
        gap: '6px',
        p: '6px',
        borderRadius: radius.pill,
        bgcolor: color.asphalt,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
      }}
    >
      {options.map(option => {
        const on = option.value === value
        return (
          <ButtonBase
            key={option.value}
            data-testid={option.testId}
            aria-pressed={on}
            onClick={() => onChange(option.value)}
            sx={{
              minHeight: 48,
              px: 2,
              borderRadius: radius.pill,
              font: 'inherit',
              fontWeight: on ? 750 : 550,
              color: on ? color.pavingInk : color.chalk,
              ...(on && {
                backgroundColor: color.paving,
                backgroundImage: `linear-gradient(180deg, ${color.pavingTop}, ${color.paving})`,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6), 0 4px 12px rgba(0,0,0,0.35)',
              }),
              [focusVisible]: focusRing,
            }}
          >
            {option.label}
          </ButtonBase>
        )
      })}
    </Box>
  )
}
