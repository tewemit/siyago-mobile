import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import { COUNTRIES } from '../constants/countries';

const REGION_KEY = 'siyago_region';

type RegionContextType = {
  /** null until the user picks one — no country is silently assumed. */
  region: string | null;
  setRegion: (region: string) => Promise<void>;
};

const RegionContext = createContext<RegionContextType>({
  region: null,
  setRegion: async () => {},
});

export function RegionProvider({ children }: { children: React.ReactNode }) {
  const [region, setRegionState] = useState<string | null>(null);

  useEffect(() => {
    SecureStore.getItemAsync(REGION_KEY).then((saved) => {
      if (saved && COUNTRIES.includes(saved)) setRegionState(saved);
    });
  }, []);

  const setRegion = useCallback(async (value: string) => {
    await SecureStore.setItemAsync(REGION_KEY, value);
    setRegionState(value);
  }, []);

  return (
    <RegionContext.Provider value={{ region, setRegion }}>
      {children}
    </RegionContext.Provider>
  );
}

export function useRegion() {
  return useContext(RegionContext);
}
