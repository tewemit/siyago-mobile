// Brand tokens mirrored 1:1 from siyago-ui/app/globals.css (navy + Ethiopian gold).
// Edit ONLY this file to retheme the app.
//
// Two palettes: LIGHT_COLORS (default) and NAVY_COLORS (dark navy mode, see
// context/ThemeContext.tsx). `COLORS` stays a static alias for LIGHT_COLORS
// so screens not yet converted to theme-aware styles keep compiling and
// rendering correctly — only screens that call `useTheme()` react to the
// Navy toggle. Both palettes share the same key set (`ThemeColors`).
export const LIGHT_COLORS = {
  primary: '#1E3A5F',
  primaryDark: '#162D4F',
  primarySoft: '#2A5298',
  primaryLight: '#E8EEF6',

  accent: '#C9A227',
  accentDark: '#A47E1B',
  accentLight: '#FEF3C7',
  // Legacy alias — several screens already reference COLORS.star for ratings.
  star: '#C9A227',

  background: '#F8FAFC',
  card: '#FFFFFF',
  backgroundAlt: '#F1F5F9',

  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',

  success: '#12C064',
  warning: '#F59E0B',
  error: '#EF4444',
  border: '#E2E8F0',
  overlay: 'rgba(15,23,42,0.4)',
  // Soft navy tint (not pure white) so the bar reads as a distinct surface
  // against the page's off-white background instead of blending into it.
  tabBar: '#EEF3F9',
};

export const NAVY_COLORS: typeof LIGHT_COLORS = {
  // Brightened vs. the light theme's primary so buttons/links stay legible
  // against a dark surface instead of nearly matching the background.
  primary: '#3B6EA5',
  primaryDark: '#2A5298',
  primarySoft: '#4C81BA',
  primaryLight: '#24466E',

  // Brand gold, unchanged — Navy mode reads as "SiyaGo, but dark," not a
  // different app.
  accent: '#C9A227',
  accentDark: '#A47E1B',
  accentLight: '#3A2F12',
  star: '#C9A227',

  background: '#111F33',
  card: '#1B2F4D',
  backgroundAlt: '#22395C',

  textPrimary: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',

  // Brightened for contrast against dark surfaces.
  success: '#22D67D',
  warning: '#FBBF24',
  error: '#F87171',
  border: '#2E4568',
  overlay: 'rgba(0,0,0,0.5)',
  tabBar: '#142842',
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
  PENDING: '#F59E0B',
  CONFIRMED: '#12C064',
  CANCELLED: '#EF4444',
  EXPIRED: '#EF4444',
  CHECKED_IN: '#1E3A5F',
  CHECKED_OUT: '#64748B',
  // Legacy alias — kept in case older UI copy still references it.
  COMPLETED: '#64748B',
};

export const NAVY_STATUS_COLOR: Record<string, string> = {
  PENDING: '#FBBF24',
  CONFIRMED: '#22D67D',
  CANCELLED: '#F87171',
  EXPIRED: '#F87171',
  // Brightened vs. LIGHT_STATUS_COLOR's navy — that value would render
  // near-invisible as navy-on-navy against the Navy theme's page background.
  CHECKED_IN: '#3B6EA5',
  CHECKED_OUT: '#94A3B8',
  COMPLETED: '#94A3B8',
};

// Static alias — see file header comment.
export const STATUS_COLOR = LIGHT_STATUS_COLOR;
