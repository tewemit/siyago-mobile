// Brand tokens derived from the SiyaGo "SG" logo mark — blue (S), orange (G),
// green (middle dot) — kept to exactly those three brand hues plus the
// universal semantic red for errors. NOT currently mirrored from
// siyago-ui/app/globals.css (that repo still runs the old navy/gold theme —
// ask before touching it if cross-platform parity is wanted).
// Edit ONLY this file to retheme the app.
//
// Two palettes: LIGHT_COLORS (default) and NAVY_COLORS (dark navy mode, see
// context/ThemeContext.tsx). `COLORS` stays a static alias for LIGHT_COLORS
// so screens not yet converted to theme-aware styles keep compiling and
// rendering correctly — only screens that call `useTheme()` react to the
// Navy toggle. Both palettes share the same key set (`ThemeColors`).
export const LIGHT_COLORS = {
  // Logo blue (the "S").
  primary: '#1A56B0',
  primaryDark: '#123F82',
  primarySoft: '#3672C4',
  primaryLight: '#E7EFFA',
  // Two-stop gradient for primary CTA buttons (bright → deep blue), reusing
  // the tokens above rather than inventing new hex values.
  primaryGradient: ['#3672C4', '#123F82'] as [string, string],

  // Logo orange (the "G") — also doubles as `warning`, so pending/caution
  // states use the same hue as the brand accent instead of a 4th color.
  accent: '#E2661F',
  accentDark: '#B84F14',
  accentLight: '#FCE7D6',
  // Legacy alias — several screens already reference COLORS.star for ratings.
  star: '#E2661F',

  background: '#F7FAFC',
  card: '#FFFFFF',
  backgroundAlt: '#EEF3FA',

  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',

  // Logo green (the middle dot).
  success: '#4A9E2F',
  warning: '#E2661F',
  // Error stays a plain semantic red — the one hue outside the 3-color
  // brand palette, kept because red-for-destructive is a near-universal
  // convention that a brand color would only make more confusing.
  error: '#EF4444',
  border: '#E2E8F0',
  overlay: 'rgba(15,23,42,0.4)',
  // Soft blue tint (not pure white) so the bar reads as a distinct surface
  // against the page's off-white background instead of blending into it.
  tabBar: '#EEF3FA',
};

export const NAVY_COLORS: typeof LIGHT_COLORS = {
  // Brightened vs. the light theme's primary so buttons/links stay legible
  // against a dark surface instead of nearly matching the background.
  primary: '#3B82D6',
  primaryDark: '#1A56B0',
  primarySoft: '#5B98E0',
  primaryLight: '#16294A',
  // Bright → deep blue, matching the glowing gradient CTA in the brand's
  // splash mockup — reuses primarySoft/primaryDark above.
  primaryGradient: ['#5B98E0', '#1A56B0'] as [string, string],

  // Brightened logo orange for contrast against the dark surface.
  accent: '#F0853D',
  accentDark: '#E2661F',
  accentLight: '#3D2510',
  star: '#F0853D',

  // Deep, near-black navy — richer/darker than a "lightened for readability"
  // dark mode so the app matches the brand's splash-screen mood instead of
  // reading as a plain inverted light theme.
  background: '#0A1628',
  card: '#12213C',
  backgroundAlt: '#1A2F52',

  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Brightened for contrast against dark surfaces.
  success: '#5CC93F',
  warning: '#F0853D',
  error: '#F87171',
  border: '#213655',
  overlay: 'rgba(0,0,0,0.6)',
  tabBar: '#0D1A2E',
};

export type ThemeColors = typeof LIGHT_COLORS;

// Static alias — see file header comment.
export const COLORS = LIGHT_COLORS;

export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  full: 999,
};

export const SHADOW = {
  sm: {
    shadowColor: COLORS.primary,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  md: {
    shadowColor: COLORS.primary,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  dark: {
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
};

export const LIGHT_STATUS_COLOR: Record<string, string> = {
  PENDING: '#E2661F',
  CONFIRMED: '#4A9E2F',
  CANCELLED: '#EF4444',
  EXPIRED: '#EF4444',
  CHECKED_IN: '#1A56B0',
  CHECKED_OUT: '#64748B',
  // Legacy alias — kept in case older UI copy still references it.
  COMPLETED: '#64748B',
};

export const NAVY_STATUS_COLOR: Record<string, string> = {
  PENDING: '#F0853D',
  CONFIRMED: '#5CC93F',
  CANCELLED: '#F87171',
  EXPIRED: '#F87171',
  // Brightened vs. LIGHT_STATUS_COLOR's blue — that value would render
  // near-invisible as blue-on-navy against the Navy theme's page background.
  CHECKED_IN: '#3B82D6',
  CHECKED_OUT: '#94A3B8',
  COMPLETED: '#94A3B8',
};

// Static alias — see file header comment.
export const STATUS_COLOR = LIGHT_STATUS_COLOR;
