/** Design tokens, mirrored from tokens.css for use in JS/TS (inline styles, canvas, SVG fills, etc). */

export const COLORS = {
  anchor: '#004F50',
  energy: '#B7E915',
  signals: '#E8836A',
  cycle: '#EEE5FF',
  ground: '#FDFCF9',
  pink: '#FFA7AA',
} as const

export type ColorToken = keyof typeof COLORS

export const FONTS = {
  display: "'Bricolage Grotesque Variable', 'Bricolage Grotesque', system-ui, sans-serif",
  body: "'Instrument Sans Variable', 'Instrument Sans', system-ui, sans-serif",
} as const

export const TYPE = {
  display: {
    fontFamily: FONTS.display,
    fontWeight: 800,
    fontStyle: 'italic',
    letterSpacing: '-0.05em',
    skew: '-4deg',
  },
  body: {
    fontFamily: FONTS.body,
    fontSize: '16px',
    lineHeight: 1.5,
  },
} as const
