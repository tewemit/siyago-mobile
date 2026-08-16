import { RADIUS, SHADOW, type ThemeColors } from '../constants/theme';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
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

// UI-only for now. The backend already stores a per-user `twoFactorMethod`
// (EMAIL or SMS, single choice) and reads it at login, but there's no
// endpoint yet to let a user change it, and SMS delivery itself is an
// unfinished stub server-side that never actually sends a text — so SMS is
// shown but locked here rather than offered as if it worked. Swap the
// local state below for a real fetch/save once both of those land.
export default function TwoFactorAuthScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);

  function handleToggleEmail() {
    if (emailEnabled && !smsEnabled) {
      Alert.alert('At least one method required', 'Turn on another verification method before turning this one off.');
      return;
    }
    setEmailEnabled((v) => !v);
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>Two-Factor Authentication</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.introCard}>
          <View style={styles.introIconWrap}>
            <Ionicons name="shield-checkmark" size={24} color={colors.primary} />
          </View>
          <Text style={styles.introTitle}>Extra security on every sign-in</Text>
          <Text style={styles.introSub}>
            We'll send a 6-digit code to verify it's really you whenever you sign in. Choose where you'd like to receive it.
          </Text>
        </View>

        <Text style={styles.sectionTitle}>Verification methods</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="mail-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowLabel}>Email</Text>
              <Text style={styles.rowSub}>{user?.email ?? 'Code sent to your account email'}</Text>
            </View>
            <Switch
              value={emailEnabled}
              onValueChange={handleToggleEmail}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>

          <View style={[styles.row, { borderBottomWidth: 0, opacity: 0.55 }]}>
            <View style={styles.rowIconWrap}>
              <Ionicons name="chatbox-ellipses-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.smsLabelRow}>
                <Text style={styles.rowLabel}>SMS</Text>
                <Text style={styles.comingSoonBadge}>Coming soon</Text>
              </View>
              <Text style={styles.rowSub}>
                {user?.phoneNumber ? `Code sent to ${user.phoneNumber}` : 'Requires a verified phone number'}
              </Text>
            </View>
            <Switch
              value={smsEnabled}
              onValueChange={setSmsEnabled}
              disabled
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        <Text style={styles.footnote}>
          Your preference isn't connected to your account yet — for now, verification codes are always sent to your email.
        </Text>
      </ScrollView>
    </SafeAreaView>
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

  introCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.xl,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    ...SHADOW.sm,
  },
  introIconWrap: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.full,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  introTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 6, textAlign: 'center' },
  introSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', lineHeight: 19 },

  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 8,
    marginLeft: 4,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    marginBottom: 16,
    ...SHADOW.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
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
  smsLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  comingSoonBadge: {
    backgroundColor: colors.accentLight,
    color: colors.accentDark,
    fontSize: 10,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    overflow: 'hidden',
  },

  footnote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: 12,
  },
  });
}
