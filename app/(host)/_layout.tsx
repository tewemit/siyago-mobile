import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';
import { Redirect, Stack } from 'expo-router';

export default function HostLayout() {
  const { user, isLoading } = useAuth();

  if (!isLoading && user?.role !== 'host' && user?.role !== 'admin') {
    return <Redirect href="/(guest)" />;
  }

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: COLORS.primary },
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
