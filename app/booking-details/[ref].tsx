import { useI18n } from '../../context/I18nContext';
import { RADIUS, SHADOW, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { getBookingByRef, verifyEthSwitchPayment, type Booking } from '../../services/bookings';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  AppState,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const PENDING_POLL_INTERVAL_MS = 4000;
const PENDING_POLL_TIMEOUT_MS = 10 * 60 * 1000; // stop after 10 minutes either way

export default function BookingDetailsScreen() {
  const { ref } = useLocalSearchParams<{ ref: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { colors, statusColor } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [booking, setBooking] = useState<Booking | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  async function refresh() {
    try {
      const b = await getBookingByRef(ref);
      setBooking(b);
    } catch {
      // transient network hiccup — next poll tick or foreground event retries
    }
  }

  // For a PENDING booking, ask the gateway directly whether payment actually
  // went through instead of just re-reading whatever the DB currently says.
  // ETH-Switch's own success redirect lands on the web app (a fixed backend
  // config value, not something this app controls) rather than back in this
  // screen, and its background confirmation job only runs every 5 minutes —
  // this is the same fast synchronous check the web app fires the moment a
  // guest lands back on booking-details. A 404 just means this booking isn't
  // an ETH-Switch payment (e.g. Stripe/cash) — safe to ignore.
  async function checkForUpdate() {
    try {
      await verifyEthSwitchPayment(ref);
    } catch {
      // not an ETH-Switch booking, or the gateway call itself failed — the
      // plain refresh below still covers Stripe/webhook-confirmed bookings.
    }
    await refresh();
  }

  useEffect(() => {
    refresh().finally(() => setIsLoading(false));
  }, [ref]);

  // Keep a PENDING booking honest: check immediately, then keep polling in
  // the background and re-check the instant the app returns to the
  // foreground (e.g. the user switching back after paying in the external
  // browser) — there's no deep link or push telling the app payment
  // completed, so this is how we notice instead of leaving a stale PENDING
  // status on screen indefinitely.
  useEffect(() => {
    if (!booking || booking.status !== 'PENDING') return;
    checkForUpdate();
    const startedAt = Date.now();
    const interval = setInterval(() => {
      if (Date.now() - startedAt > PENDING_POLL_TIMEOUT_MS) {
        clearInterval(interval);
        return;
      }
      checkForUpdate();
    }, PENDING_POLL_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkForUpdate();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [booking?.status, ref]);

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.center}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={{ color: colors.textSecondary, marginTop: 80 }}>Booking not found.</Text>
      </SafeAreaView>
    );
  }

  const color = statusColor[booking.status] ?? colors.textSecondary;

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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t.booking_details}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {/* Status banner */}
        <View style={[styles.statusBanner, { backgroundColor: color + '18' }]}>
          <View style={[styles.statusDot, { backgroundColor: color }]} />
          <Text style={[styles.statusText, { color }]}>{statusLabel(booking.status)}</Text>
        </View>

        {/* Info card */}
        <View style={styles.infoCard}>
          <Row label={t.reference} value={booking.reference} mono />
          <Row label={t.property} value={booking.property?.name ?? booking.propertyId} />
          {booking.property?.city && <Row label={t.location} value={booking.property.city} />}
          <Row label={t.check_in} value={booking.checkIn} icon="log-in-outline" />
          <Row label={t.check_out} value={booking.checkOut} icon="log-out-outline" />
          <Row label={t.guests} value={String(booking.guests)} icon="people-outline" />
          <Row
            label={t.total}
            value={`${booking.currency} ${booking.totalAmount.toLocaleString()}`}
            bold
            noBorder
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({
  label,
  value,
  bold,
  mono,
  noBorder,
  icon,
}: {
  label: string;
  value: string;
  bold?: boolean;
  mono?: boolean;
  noBorder?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.row, noBorder && { borderBottomWidth: 0 }]}>
      <View style={styles.rowLabelWrap}>
        {icon && <Ionicons name={icon} size={13} color={colors.primary} />}
        <Text style={styles.rowLabel}>{label}</Text>
      </View>
      <Text style={[styles.rowValue, bold && styles.rowBold, mono && styles.rowMono]}>
        {value}
      </Text>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: RADIUS.full,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    topTitle: { fontWeight: '700', fontSize: 17, color: colors.textPrimary },

    body: { padding: 20 },

    statusBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      borderRadius: RADIUS.lg,
      paddingVertical: 14,
      marginBottom: 20,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontWeight: '800', fontSize: 16 },

    infoCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.xl,
      overflow: 'hidden',
      ...SHADOW.sm,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    rowLabelWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    rowLabel: { fontSize: 14, color: colors.textSecondary, fontWeight: '500' },
    rowValue: { fontSize: 14, color: colors.textPrimary, fontWeight: '600', maxWidth: '55%', textAlign: 'right' },
    rowBold: { fontSize: 16, fontWeight: '800', color: colors.primary },
    rowMono: { fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace', fontSize: 12 },
  });
}
