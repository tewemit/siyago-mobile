import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';

const CURRENCY_KEY = 'siyago_currency';

export type CurrencyCode = 'ETB' | 'USD' | 'EUR' | 'GBP';

export const CURRENCIES: CurrencyCode[] = ['ETB', 'USD', 'EUR', 'GBP'];

type Rates = Record<CurrencyCode, number>;

type CurrencyContextType = {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => Promise<void>;
  ratesAvailable: boolean;
  /** Converts an ETB-denominated amount to the currently selected currency. */
  convert: (etbAmount: number) => number;
  /** Converts + formats an ETB-denominated amount, e.g. "1,234 ETB" / "45.67 USD". */
  format: (etbAmount: number) => string;
  /**
   * Rough, DISPLAY-ONLY estimate of a foreign-currency amount in ETB — e.g.
   * showing a host's USD-priced room line converted through to whatever
   * currency the guest is browsing in (convertToEtb -> convert() -> their
   * currency). Uses the same free rate source as everything else here, NOT
   * the server-side authoritative rate the backend actually charges/
   * converts with — the real ETB amount a guest is charged is always
   * computed server-side at booking time, this is only ever an estimate.
   */
  convertToEtb: (amount: number, fromCurrency: CurrencyCode) => number;
};

const CurrencyContext = createContext<CurrencyContextType>({
  currency: 'ETB',
  setCurrency: async () => {},
  ratesAvailable: false,
  convert: (amount) => amount,
  format: (amount) => `${amount.toLocaleString()} ETB`,
  convertToEtb: (amount) => amount,
});

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const [currency, setCurrencyState] = useState<CurrencyCode>('ETB');
  const [rates, setRates] = useState<Rates | null>(null);
  const [ratesAvailable, setRatesAvailable] = useState(false);

  useEffect(() => {
    SecureStore.getItemAsync(CURRENCY_KEY).then((saved) => {
      if (saved && (CURRENCIES as string[]).includes(saved)) {
        setCurrencyState(saved as CurrencyCode);
      }
    });
  }, []);

  // Live rates from the same free, no-key-required source siyago-ui uses,
  // base=ETB so `rates[code]` is directly "1 ETB in `code`".
  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/ETB')
      .then((r) => r.json())
      .then((data) => {
        if (data?.result === 'success' && data?.rates) {
          setRates({ ETB: 1, USD: data.rates.USD, EUR: data.rates.EUR, GBP: data.rates.GBP });
          setRatesAvailable(true);
        } else {
          setRatesAvailable(false);
        }
      })
      .catch(() => {
        setRatesAvailable(false);
        // A previously-saved non-ETB preference is meaningless without live
        // rates to convert with, so fall back to the one currency that's
        // always correct without conversion.
        setCurrencyState('ETB');
      });
  }, []);

  const setCurrency = useCallback(async (value: CurrencyCode) => {
    await SecureStore.setItemAsync(CURRENCY_KEY, value);
    setCurrencyState(value);
  }, []);

  const convert = useCallback(
    (etbAmount: number) => {
      if (!etbAmount) return 0;
      if (!ratesAvailable || !rates) return etbAmount;
      return etbAmount * (rates[currency] ?? 1);
    },
    [currency, rates, ratesAvailable],
  );

  const format = useCallback(
    (etbAmount: number) => {
      const converted = convert(etbAmount);
      const activeCurrency = ratesAvailable ? currency : 'ETB';
      const decimals = activeCurrency === 'ETB' ? 0 : 2;
      return `${converted.toLocaleString('en-US', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })} ${activeCurrency}`;
    },
    [convert, currency, ratesAvailable],
  );

  const convertToEtb = useCallback(
    (amount: number, fromCurrency: CurrencyCode) => {
      if (!amount) return 0;
      if (fromCurrency === 'ETB' || !ratesAvailable || !rates) return amount;
      const rate = rates[fromCurrency];
      if (!rate) return amount;
      return amount / rate;
    },
    [rates, ratesAvailable],
  );

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, ratesAvailable, convert, format, convertToEtb }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  return useContext(CurrencyContext);
}
