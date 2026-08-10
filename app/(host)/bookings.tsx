import { COLORS, RADIUS, SHADOW, STATUS_COLOR } from '../../constants/theme';
import { getHostBookings, type Booking } from '../../services/bookings';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

export default function HostBookingsScreen() {
  const router = useRouter();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getHostBookings();
      setBookings(data);
    } catch {
      setBookings([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No bookings yet.</Text>
          }
          renderItem={({ item }) => {
            const color = STATUS_COLOR[item.status] ?? COLORS.textSecondary;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() =>
                  router.push({
                    pathname: '/booking-details/[ref]',
                    params: { ref: item.reference },
                  })
                }
              >
                <View style={styles.cardTop}>
                  <Text style={styles.ref}>#{item.reference}</Text>
                  <View style={[styles.badge, { backgroundColor: color + '22' }]}>
                    <Text style={[styles.badgeText, { color }]}>{item.status}</Text>
                  </View>
                </View>
                <Text style={styles.name}>
                  {item.property?.name ?? item.propertyId}
                </Text>
                <Text style={styles.dates}>
                  {item.checkIn} → {item.checkOut}
                </Text>
                <Text style={styles.amount}>
                  {item.currency} {item.totalAmount.toLocaleString()}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 12,
    ...SHADOW.dark,
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  ref: { color: COLORS.textMuted, fontSize: 12 },
  badge: { borderRadius: RADIUS.sm, paddingHorizontal: 8, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '700' },
  name: { fontWeight: '700', fontSize: 15, marginBottom: 2, color: COLORS.textPrimary },
  dates: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 4 },
  amount: { fontWeight: '600', color: COLORS.primary },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
});
