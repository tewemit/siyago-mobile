import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { I18nManager } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {
  Locale,
  RTL_LOCALES,
  T,
  translations,
} from '../i18n/translations';

const LOCALE_KEY = 'siyago_locale';

type I18nContextType = {
  locale: Locale;
  t: T;
  isRTL: boolean;
  setLocale: (locale: Locale) => Promise<void>;
};

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  t: translations.en,
  isRTL: false,
  setLocale: async () => {},
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  useEffect(() => {
    SecureStore.getItemAsync(LOCALE_KEY).then((saved) => {
      if (saved && saved in translations) {
        applyLocale(saved as Locale);
      }
    });
  }, []);

  function applyLocale(loc: Locale) {
    const rtl = RTL_LOCALES.includes(loc);
    I18nManager.forceRTL(rtl);
    setLocaleState(loc);
  }

  const setLocale = useCallback(async (loc: Locale) => {
    await SecureStore.setItemAsync(LOCALE_KEY, loc);
    applyLocale(loc);
  }, []);

  const isRTL = RTL_LOCALES.includes(locale);

  return (
    <I18nContext.Provider
      value={{
        locale,
        t: translations[locale],
        isRTL,
        setLocale,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
