import { useAuth } from '../../context/AuthContext';
import { COLORS } from '../../constants/theme';
import { Stack } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

// The bottom nav is now rendered globally in the root layout (see
// components/BottomBar.tsx) so it stays pinned on every screen, not just
// these four — this group is a plain Stack, not a Tabs navigator.
export default function GuestLayout() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

const styles = StyleSheet.create({
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },
});
