import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { AppState, type AppStateStatus } from 'react-native';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { getMe, logout as authLogout, type AuthUser } from '../services/auth';
import { clearToken, setUnauthorizedHandler, TOKEN_KEY } from '../services/api';

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const refresh = useCallback(async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      if (!token) {
        setUser(null);
        return;
      }
      const me = await getMe();
      setUser(me);
    } catch {
      // Token existed but is expired/invalid — don't keep resending it.
      await clearToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // A 401 on any authenticated request means the session died server-side
  // (expiry, revocation). Drop local state and bounce to sign-in from
  // wherever the user happens to be.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      router.replace('/(auth)/sign-in');
    });
    return () => setUnauthorizedHandler(null);
  }, [router]);

  // The server now enforces a per-role idle timeout, and backgrounding the
  // app for a while is completely normal mobile usage (unlike a web tab
  // left open) — re-validate on resume so a session that died while
  // backgrounded is caught right away with a clean redirect, rather than
  // surfacing as a confusing error on whatever screen happens to fire the
  // next API call.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{ user, isLoading, isAuthenticated: !!user, refresh, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
