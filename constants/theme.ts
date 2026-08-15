// Brand tokens mirrored 1:1 from siyago-ui/app/globals.css (navy + Ethiopian gold).
// Edit ONLY this file to retheme the app.
export const COLORS = {
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

export const STATUS_COLOR: Record<string, string> = {
  PENDING: '#F59E0B',
  CONFIRMED: '#12C064',
  CANCELLED: '#EF4444',
  EXPIRED: '#EF4444',
  CHECKED_IN: '#1E3A5F',
  CHECKED_OUT: '#64748B',
  // Legacy alias — kept in case older UI copy still references it.
  COMPLETED: '#64748B',
};
