import { useAuth } from '../context/AuthContext';
import { COLORS } from '../constants/theme';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (user?.role === 'host' || user?.role === 'admin') {
    return <Redirect href="/(host)" />;
  }
  return <Redirect href="/(guest)" />;
}
