import { useI18n } from '../../context/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW, STATUS_COLOR } from '../../constants/theme';
import { cancelBooking, getErrorMessage, getMyBookings, type Booking } from '../../services/bookings';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function MiniCalendar({ bookedDates }: { bookedDates: string[] }) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  function isBooked(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return bookedDates.includes(dateStr);
  }

  function isToday(day: number) {
    return today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); } else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); } else setMonth(m => m + 1);
  }

  return (
    <View style={calStyles.container}>
      <View style={calStyles.header}>
        <TouchableOpacity onPress={prevMonth} style={calStyles.navBtn}>
          <Ionicons name="chevron-back" size={18} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={calStyles.monthTitle}>{MONTHS[month]} {year}</Text>
        <TouchableOpacity onPress={nextMonth} style={calStyles.navBtn}>
          <Ionicons name="chevron-forward" size={18} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>
      <View style={calStyles.dayRow}>
        {DAYS.map((d, i) => (
          <Text key={i} style={calStyles.dayLabel}>{d}</Text>
        ))}
      </View>
      <View style={calStyles.grid}>
        {cells.map((day, i) => (
          <View key={i} style={calStyles.cell}>
            {day ? (
              <View style={[
                calStyles.dayCell,
                isToday(day) && calStyles.todayCell,
                isBooked(day) && calStyles.bookedCell,
              ]}>
                <Text style={[
                  calStyles.dayText,
                  isToday(day) && calStyles.todayText,
                  isBooked(day) && calStyles.bookedText,
                ]}>{day}</Text>
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export default function BookingsScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getMyBookings();
      setBookings(data);
    } catch {
      setBookings([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCancel(id: string) {
    Alert.alert(t.cancel, t.cancel_booking_confirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.ok,
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelBooking(id);
            await load();
          } catch (err: any) {
            Alert.alert(t.error, getErrorMessage(err, 'Could not cancel booking'));
          }
        },
      },
    ]);
  }

  // Collect booked date ranges
  const bookedDates: string[] = [];
  bookings.forEach((b) => {
    if (b.status !== 'CANCELLED') {
      const start = new Date(b.checkIn);
      const end = new Date(b.checkOut);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        bookedDates.push(d.toISOString().slice(0, 10));
      }
    }
  });

  function statusLabel(s: string) {
    const map: Record<string, string> = {
      PENDING: t.status_PENDING,
      CONFIRMED: t.status_CONFIRMED,
      CANCELLED: t.status_CANCELLED,
      EXPIRED: t.status_EXPIRED,
      CHECKED_IN: t.status_CHECKED_IN,
      CHECKED_OUT: t.status_CHECKED_OUT,
    };
    return map[s] ?? s;
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            <Ionicons name="calendar-outline" size={36} color={COLORS.primary} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' }}>{t.bookings}</Text>
          <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 28, lineHeight: 20 }}>Sign in to view and manage your bookings</Text>
          <TouchableOpacity style={{ backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: 14, paddingHorizontal: 40 }} onPress={() => router.push('/(auth)/sign-in')}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t.sign_in}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>{t.bookings}</Text>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={COLORS.primary} />
      ) : (
        <FlatList
          data={bookings}
          keyExtractor={(b) => b.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={COLORS.primary}
            />
          }
          ListHeaderComponent={
            <>
              <MiniCalendar bookedDates={bookedDates} />
              <View style={styles.sectionRow}>
                <Text style={styles.sectionTitle}>{t.my_bookings}</Text>
                <Text style={styles.sectionCount}>{bookings.length}</Text>
              </View>
            </>
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="calendar-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.empty}>{t.no_bookings}</Text>
            </View>
          }
          contentContainerStyle={{ paddingBottom: 24 }}
          renderItem={({ item }) => {
            const color = STATUS_COLOR[item.status] ?? COLORS.textSecondary;
            return (
              <TouchableOpacity
                style={styles.card}
                activeOpacity={0.88}
                onPress={() =>
                  router.push({ pathname: '/booking-details/[ref]', params: { ref: item.reference } })
                }
              >
                {item.property?.thumbnail ? (
                  <Image source={{ uri: item.property.thumbnail }} style={styles.cardThumb} />
                ) : (
                  <View style={[styles.cardThumb, { backgroundColor: COLORS.primaryLight }]} />
                )}
                <View style={styles.cardBody}>
                  <Text style={styles.cardName} numberOfLines={1}>
                    {item.property?.name ?? item.propertyId}
                  </Text>
                  <View style={styles.dateRow}>
                    <Ionicons name="calendar-outline" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.dateText}>{item.checkIn} → {item.checkOut}</Text>
                  </View>
                  <Text style={styles.priceText}>
                    {item.currency} {item.totalAmount.toLocaleString()}
                    <Text style={styles.priceNight}> {item.status === 'PENDING' || item.status === 'CONFIRMED' ? '' : ''}</Text>
                  </Text>
                </View>
                <View style={styles.rightCol}>
                  <View style={[styles.badge, { backgroundColor: color + '22' }]}>
                    <Text style={[styles.badgeText, { color }]}>{statusLabel(item.status)}</Text>
                  </View>
                  {item.status === 'PENDING' && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => router.push({ pathname: '/payment', params: { bookingId: item.id } })}
                    >
                      <Text style={styles.payLinkText}>{t.complete_payment}</Text>
                    </TouchableOpacity>
                  )}
                  {(item.status === 'PENDING' || item.status === 'CONFIRMED') && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => handleCancel(item.id)}
                    >
                      <Text style={styles.cancelText}>{t.cancel}</Text>
                    </TouchableOpacity>
                  )}
                  {item.status === 'CHECKED_OUT' && (
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => router.push({ pathname: '/write-review', params: { propertyId: item.propertyId, bookingId: item.id } })}
                    >
                      <Text style={styles.payLinkText}>{t.write_a_review}</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const calStyles = StyleSheet.create({
  container: {
    backgroundColor: COLORS.card,
    margin: 16,
    borderRadius: RADIUS.lg,
    padding: 16,
    ...SHADOW.sm,
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  monthTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary },
  dayRow: { flexDirection: 'row', marginBottom: 8 },
  dayLabel: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600', color: COLORS.textMuted },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: '14.28%', alignItems: 'center', paddingVertical: 2 },
  dayCell: { width: 32, height: 32, borderRadius: RADIUS.full, justifyContent: 'center', alignItems: 'center' },
  todayCell: { backgroundColor: COLORS.primaryLight },
  bookedCell: { backgroundColor: COLORS.primary },
  dayText: { fontSize: 13, color: COLORS.textPrimary },
  todayText: { color: COLORS.primary, fontWeight: '700' },
  bookedText: { color: '#fff', fontWeight: '700' },
});

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  heading: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },

  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  sectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.primary,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
  },

  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    marginHorizontal: 16,
    marginBottom: 10,
    overflow: 'hidden',
    ...SHADOW.dark,
  },
  cardThumb: { width: 80, height: 90 },
  cardBody: { flex: 1, padding: 12, justifyContent: 'center' },
  cardName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  dateText: { fontSize: 12, color: COLORS.textSecondary },
  priceText: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  priceNight: { fontSize: 11, color: COLORS.textSecondary },
  rightCol: { padding: 10, justifyContent: 'space-between', alignItems: 'flex-end' },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { fontSize: 10, fontWeight: '700' },
  cancelBtn: { marginTop: 6 },
  cancelText: { fontSize: 11, fontWeight: '600', color: COLORS.error },
  payLinkText: { fontSize: 11, fontWeight: '600', color: COLORS.primary },

  emptyWrap: { alignItems: 'center', marginTop: 48, gap: 12 },
  empty: { fontSize: 14, color: COLORS.textMuted },
});
