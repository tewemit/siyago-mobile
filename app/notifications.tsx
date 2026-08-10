import { useI18n } from '../context/I18nContext';
import { COLORS, RADIUS, SHADOW } from '../constants/theme';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// UI-only for now — toggles update local state only. Wiring these to a
// notification-preferences endpoint (and to actual push-token registration)
// is a follow-up once that backend support exists.
type Prefs = {
  push: boolean;
  bookingConfirmations: boolean;
  checkInReminders: boolean;
  checkOutReminders: boolean;
  bookingChanges: boolean;
  paymentUpdates: boolean;
  priceDrops: boolean;
  recommendations: boolean;
  promotions: boolean;
  messages: boolean;
  channelEmail: boolean;
  channelSms: boolean;
};

const DEFAULT_PREFS: Prefs = {
  push: true,
  bookingConfirmations: true,
  checkInReminders: true,
  checkOutReminders: true,
  bookingChanges: true,
  paymentUpdates: true,
  priceDrops: true,
  recommendations: true,
  promotions: false,
  messages: true,
  channelEmail: true,
  channelSms: false,
};

export default function NotificationsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);

  function toggle(key: keyof Prefs) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  const pushOff = !prefs.push;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t.notifications}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Master toggle */}
        <View style={styles.masterCard}>
          <View style={styles.masterIconWrap}>
            <Ionicons name="notifications" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.masterTitle}>Push Notifications</Text>
            <Text style={styles.masterSub}>
              {prefs.push ? 'Enabled on this device' : 'Turned off — you won\'t receive any alerts'}
            </Text>
          </View>
          <Switch
            value={prefs.push}
            onValueChange={() => toggle('push')}
            trackColor={{ false: COLORS.border, true: COLORS.primary }}
            thumbColor="#fff"
          />
        </View>

        <Section title="Booking Updates" dimmed={pushOff}>
          <Row
            icon="checkmark-circle-outline"
            label="Booking confirmations"
            sub="When a stay is confirmed or a payment is completed"
            value={prefs.bookingConfirmations}
            onToggle={() => toggle('bookingConfirmations')}
            disabled={pushOff}
          />
          <Row
            icon="log-in-outline"
            label="Check-in reminders"
            sub="A reminder the day before you check in"
            value={prefs.checkInReminders}
            onToggle={() => toggle('checkInReminders')}
            disabled={pushOff}
          />
          <Row
            icon="log-out-outline"
            label="Check-out reminders"
            sub="A reminder on your check-out day"
            value={prefs.checkOutReminders}
            onToggle={() => toggle('checkOutReminders')}
            disabled={pushOff}
          />
          <Row
            icon="refresh-outline"
            label="Changes & cancellations"
            sub="Updates if a booking is changed or cancelled"
            value={prefs.bookingChanges}
            onToggle={() => toggle('bookingChanges')}
            disabled={pushOff}
            noBorder
          />
        </Section>

        <Section title="Payments" dimmed={pushOff}>
          <Row
            icon="card-outline"
            label="Payment confirmations"
            sub="Receipts and payment status updates"
            value={prefs.paymentUpdates}
            onToggle={() => toggle('paymentUpdates')}
            disabled={pushOff}
            noBorder
          />
        </Section>

        <Section title="Deals & Offers" dimmed={pushOff}>
          <Row
            icon="trending-down-outline"
            label="Price drops"
            sub="When a property in your favorites gets cheaper"
            value={prefs.priceDrops}
            onToggle={() => toggle('priceDrops')}
            disabled={pushOff}
          />
          <Row
            icon="sparkles-outline"
            label="Recommended for you"
            sub="Personalized stay suggestions"
            value={prefs.recommendations}
            onToggle={() => toggle('recommendations')}
            disabled={pushOff}
          />
          <Row
            icon="pricetag-outline"
            label="Promotions & offers"
            sub="Discounts and limited-time deals"
            value={prefs.promotions}
            onToggle={() => toggle('promotions')}
            disabled={pushOff}
            noBorder
          />
        </Section>

        <Section title="Messages" dimmed={pushOff}>
          <Row
            icon="chatbubble-outline"
            label="Messages"
            sub="New messages from hosts and support"
            value={prefs.messages}
            onToggle={() => toggle('messages')}
            disabled={pushOff}
            noBorder
          />
        </Section>

        <Section title="Account & Security">
          <Row
            icon="shield-checkmark-outline"
            label="Security alerts"
            sub="New sign-ins and account changes — always on"
            value={true}
            onToggle={() => {}}
            disabled
            noBorder
          />
        </Section>

        <Section title="Also notify me via">
          <Row
            icon="mail-outline"
            label="Email"
            value={prefs.channelEmail}
            onToggle={() => toggle('channelEmail')}
          />
          <Row
            icon="chatbox-ellipses-outline"
            label="SMS"
            value={prefs.channelSms}
            onToggle={() => toggle('channelSms')}
            noBorder
          />
        </Section>

        <Text style={styles.footnote}>
          These preferences are stored on this device for now. Once notification delivery is fully connected, they'll sync to your account.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({
  title,
  dimmed,
  children,
}: {
  title: string;
  dimmed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <View style={[styles.section, dimmed && { opacity: 0.45 }]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  label,
  sub,
  value,
  onToggle,
  disabled,
  noBorder,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  value: boolean;
  onToggle: () => void;
  disabled?: boolean;
  noBorder?: boolean;
}) {
  return (
    <View style={[styles.row, noBorder && { borderBottomWidth: 0 }]}>
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon} size={17} color={COLORS.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: COLORS.border, true: COLORS.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: { fontWeight: '700', fontSize: 17, color: COLORS.textPrimary },

  body: { padding: 16, paddingBottom: 40 },

  masterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    padding: 16,
    marginBottom: 24,
    ...SHADOW.sm,
  },
  masterIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  masterTitle: { fontSize: 15, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  masterSub: { fontSize: 12, color: COLORS.textSecondary },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: { fontSize: 14, fontWeight: '600', color: COLORS.textPrimary },
  rowSub: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },

  footnote: {
    fontSize: 12,
    color: COLORS.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
    marginTop: 4,
  },
});
