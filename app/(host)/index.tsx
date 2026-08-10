import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS } from '../../constants/theme';
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

const TILES = [
  {
    label: 'Bookings',
    icon: 'calendar-outline' as const,
    route: '/(host)/bookings',
    color: COLORS.primary,
    bg: COLORS.primaryLight,
  },
  {
    label: 'Properties',
    icon: 'business-outline' as const,
    route: '/(host)/properties',
    color: COLORS.accentDark,
    bg: COLORS.accentLight,
  },
];

export default function HostDashboard() {
  const { user } = useAuth();
  const router = useRouter();

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
          {TILES.map((tile) => (
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  body: { padding: 20 },
  greeting: { fontSize: 26, fontWeight: '800', marginBottom: 4, color: COLORS.textPrimary },
  sub: { color: COLORS.textSecondary, marginBottom: 32 },
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
