import { useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import { RADIUS, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useRouter } from 'expo-router';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function getTiles(colors: ThemeColors) {
  return [
    {
      label: 'Bookings',
      icon: 'calendar-outline' as const,
      route: '/(host)/bookings',
      color: colors.primary,
      bg: colors.primaryLight,
    },
    {
      label: 'Properties',
      icon: 'business-outline' as const,
      route: '/(host)/properties',
      color: colors.accentDark,
      bg: colors.accentLight,
    },
  ];
}

export default function HostDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const tiles = useMemo(() => getTiles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.greeting}>
          Host Dashboard
        </Text>
        <Text style={styles.sub}>
          Welcome back, {user?.firstName}
        </Text>

        <View style={styles.grid}>
          {tiles.map((tile) => (
            <TouchableOpacity
              key={tile.label}
              style={[styles.tile, { backgroundColor: tile.bg }]}
              onPress={() => router.push(tile.route as any)}
            >
              <Ionicons name={tile.icon} size={32} color={tile.color} />
              <Text style={[styles.tileLabel, { color: tile.color }]}>
                {tile.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    body: { padding: 20 },
    greeting: { fontSize: 26, fontWeight: '800', marginBottom: 4, color: colors.textPrimary },
    sub: { color: colors.textSecondary, marginBottom: 32 },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 14,
    },
    tile: {
      width: '47%',
      borderRadius: RADIUS.lg,
      padding: 20,
      alignItems: 'center',
      gap: 10,
      shadowColor: '#000',
      shadowOpacity: 0.04,
      shadowRadius: 4,
      elevation: 1,
    },
    tileLabel: { fontWeight: '700', fontSize: 15 },
  });
}
