import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { Redirect, Stack } from 'expo-router';

export default function HostLayout() {
  const { user, isLoading } = useAuth();
  const { colors } = useTheme();

  if (!isLoading && user?.role !== 'host' && user?.role !== 'admin') {
    return <Redirect href="/(guest)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.primary },
        headerTintColor: '#fff',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'Host Dashboard' }} />
      <Stack.Screen name="bookings" options={{ title: 'Bookings' }} />
      <Stack.Screen name="properties" options={{ title: 'Properties' }} />
    </Stack>
  );
}
