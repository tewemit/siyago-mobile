import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

export default function Index() {
  const { user, isLoading } = useAuth();
  const { colors } = useTheme();

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (user?.role === 'host' || user?.role === 'admin') {
    return <Redirect href="/(host)" />;
  }
  return <Redirect href="/(guest)" />;
}
