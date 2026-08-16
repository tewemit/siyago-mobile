import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { RADIUS, SHADOW, type ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { getErrorMessage } from '../services/api';
import { updateMe, type NotificationChannel } from '../services/auth';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// The categorized toggles below (Booking Updates, Deals & Offers, etc.) are
// still UI-only — the API has no per-category notification model, only a
// single account-wide EMAIL/SMS delivery-channel preference (see the
// "Notification Channels" section, which IS wired to PUT /users/me).
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
};

export default function NotificationsScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [channels, setChannels] = useState<NotificationChannel[]>(
    user?.notificationChannels?.length ? user.notificationChannels : ['EMAIL', 'SMS'],
  );
  const [savingChannel, setSavingChannel] = useState<NotificationChannel | null>(null);

  useEffect(() => {
    if (user?.notificationChannels?.length) setChannels(user.notificationChannels);
  }, [user?.notificationChannels]);

  function toggle(key: keyof Prefs) {
    setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function toggleChannel(ch: NotificationChannel) {
    const isOn = channels.includes(ch);
    if (isOn && channels.length === 1) {
      Alert.alert('At least one channel required', 'Turn on another channel before turning this one off.');
      return;
    }
    const previous = channels;
    const next = isOn ? channels.filter((c) => c !== ch) : [...channels, ch];
    setChannels(next);
    setSavingChannel(ch);
    try {
      await updateMe({ notificationChannels: next });
      await refresh();
    } catch (err: any) {
      setChannels(previous);
      Alert.alert(t.error, getErrorMessage(err, 'Could not update notification settings'));
    } finally {
      setSavingChannel(null);
    }
  }

  const pushOff = !prefs.push;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t.notifications}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        {/* Real, API-backed section */}
        <View style={styles.syncedRow}>
          <Ionicons name="cloud-done-outline" size={13} color={colors.success} />
          <Text style={styles.syncedText}>Synced to your account</Text>
        </View>
        <Text style={styles.sectionTitle}>Notification Channels</Text>
        <View style={styles.sectionCard}>
          <ChannelRow
            icon="mail-outline"
            label="Email"
            sub={user?.email}
            active={channels.includes('EMAIL')}
            saving={savingChannel === 'EMAIL'}
            onToggle={() => toggleChannel('EMAIL')}
          />
          <ChannelRow
            icon="chatbox-ellipses-outline"
            label="SMS"
            sub={user?.phoneNumber ?? 'No phone number on file'}
            active={channels.includes('SMS')}
            saving={savingChannel === 'SMS'}
            onToggle={() => toggleChannel('SMS')}
            noBorder
          />
        </View>
        <Text style={styles.channelHint}>
          Booking confirmations and verification codes are sent through whichever channel(s) you enable here. SMS delivery is still being rolled out on our end — we recommend keeping email on as a backup.
        </Text>

        {/* Local-only categorized toggles */}
        <View style={styles.masterCard}>
          <View style={styles.masterIconWrap}>
            <Ionicons name="notifications" size={22} color={colors.primary} />
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
            trackColor={{ false: colors.border, true: colors.primary }}
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

        <Text style={styles.footnote}>
          Categories above (Booking Updates, Deals & Offers, etc.) aren't connected to your account yet — only the Notification Channels section at the top is a real, saved setting.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function ChannelRow({
  icon,
  label,
  sub,
  active,
  saving,
  onToggle,
  noBorder,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  sub?: string;
  active: boolean;
  saving: boolean;
  onToggle: () => void;
  noBorder?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.row, noBorder && { borderBottomWidth: 0 }]}>
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub} numberOfLines={1}>{sub}</Text> : null}
      </View>
      {saving ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Switch
          value={active}
          onValueChange={onToggle}
          trackColor={{ false: colors.border, true: colors.primary }}
          thumbColor="#fff"
        />
      )}
    </View>
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={[styles.row, noBorder && { borderBottomWidth: 0 }]}>
      <View style={styles.rowIconWrap}>
        <Ionicons name={icon} size={17} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        disabled={disabled}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
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
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: { fontWeight: '700', fontSize: 17, color: colors.textPrimary },

  body: { padding: 16, paddingBottom: 40 },

  syncedRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6, marginLeft: 4 },
  syncedText: { fontSize: 11, fontWeight: '700', color: colors.success },
  channelHint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 17,
    marginTop: 8,
    marginBottom: 24,
    paddingHorizontal: 4,
  },

  masterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: RADIUS.xl,
    padding: 16,
    marginBottom: 24,
    ...SHADOW.sm,
  },
  masterIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  masterTitle: { fontSize: 15, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  masterSub: { fontSize: 12, color: colors.textSecondary },

  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: colors.card,
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
    borderBottomColor: colors.border,
  },
  rowIconWrap: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowLabel: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  rowSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },

  footnote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 20,
    marginTop: 4,
  },
  });
}
