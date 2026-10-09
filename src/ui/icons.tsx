import type { ReactNode } from 'react'

// One small icon set, drawn to one grid and one stroke. Decorative: the control carries the name.
function Icon({ children, size = 24 }: { children: ReactNode; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const SettingsIcon = () => (
  <Icon>
    <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h9M17 17h3" />
    <circle cx="15" cy="7" r="2" />
    <circle cx="9" cy="12" r="2" />
    <circle cx="15" cy="17" r="2" />
  </Icon>
)
export const CloseIcon = () => (
  <Icon>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
)
export const ScanIcon = () => (
  <Icon>
    <path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16M4 12h16" />
  </Icon>
)
export const GlobeIcon = () => (
  <Icon>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M3.5 12h17M12 3.5c2.6 2.4 3.9 5.2 3.9 8.5s-1.3 6.1-3.9 8.5c-2.6-2.4-3.9-5.2-3.9-8.5S9.4 5.9 12 3.5z" />
  </Icon>
)
export const ChevronIcon = ({ down = false }: { down?: boolean }) => (
  <Icon size={20}>
    <path d={down ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'} />
  </Icon>
)
export const WarningIcon = () => (
  <Icon size={20}>
    <path d="M12 4.2L21 19.5H3L12 4.2zM12 10v4.2M12 17h.01" />
  </Icon>
)

// How to wear it: a figure with the phone on the chest and what the camera sees ahead.
export const WearFigure = () => (
  <svg width="100%" height="100%" viewBox="0 0 132 132" fill="none" aria-hidden="true" focusable="false">
    <path d="M78 58l44-22v60L78 74z" fill="currentColor" opacity="0.16" />
    <circle cx="52" cy="26" r="13" stroke="currentColor" strokeWidth="4" />
    <path
      d="M30 122V70a22 22 0 0 1 44 0v52"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="64" y="54" width="14" height="24" rx="4" fill="currentColor" />
  </svg>
)
