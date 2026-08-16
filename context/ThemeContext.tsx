import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import {
  LIGHT_COLORS,
  NAVY_COLORS,
  LIGHT_STATUS_COLOR,
  NAVY_STATUS_COLOR,
  type ThemeColors,
} from '../constants/theme';

const THEME_KEY = 'siyago_theme';

export type ThemeName = 'light' | 'navy';

type ThemeContextType = {
  theme: ThemeName;
  colors: ThemeColors;
  statusColor: Record<string, string>;
  setTheme: (theme: ThemeName) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  colors: LIGHT_COLORS,
  statusColor: LIGHT_STATUS_COLOR,
  setTheme: async () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('light');

  useEffect(() => {
    SecureStore.getItemAsync(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'navy') setThemeState(saved);
    });
  }, []);

  const setTheme = useCallback(async (value: ThemeName) => {
    await SecureStore.setItemAsync(THEME_KEY, value);
    setThemeState(value);
  }, []);

  const colors = theme === 'navy' ? NAVY_COLORS : LIGHT_COLORS;
  const statusColor = theme === 'navy' ? NAVY_STATUS_COLOR : LIGHT_STATUS_COLOR;

  return (
    <ThemeContext.Provider value={{ theme, colors, statusColor, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
