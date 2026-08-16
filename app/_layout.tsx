import { AuthProvider } from '../context/AuthContext';
import { I18nProvider } from '../context/I18nContext';
import { RegionProvider } from '../context/RegionContext';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import BottomBar from '../components/BottomBar';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

function AppShell() {
  const { theme, colors } = useTheme();
  return (
    <AuthProvider>
      <StatusBar style={theme === 'navy' ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <Stack screenOptions={{ headerShown: false }} />
      </View>
      <BottomBar />
    </AuthProvider>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <I18nProvider>
          <RegionProvider>
            <ThemeProvider>
              <AppShell />
            </ThemeProvider>
          </RegionProvider>
        </I18nProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
