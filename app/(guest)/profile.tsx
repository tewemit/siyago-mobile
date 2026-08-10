import { useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { LOCALE_NAMES, type Locale } from '../../i18n/translations';
import { useRouter } from 'expo-router';
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const [showLangPicker, setShowLangPicker] = useState(false);

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 32 }}>
          <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primaryLight, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }}>
            <Ionicons name="person-outline" size={40} color={COLORS.primary} />
          </View>
          <Text style={{ fontSize: 20, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 8, textAlign: 'center' }}>{t.profile}</Text>
          <Text style={{ fontSize: 14, color: COLORS.textSecondary, textAlign: 'center', marginBottom: 28, lineHeight: 20 }}>Sign in to manage your profile, bookings and preferences</Text>
          <TouchableOpacity style={{ backgroundColor: COLORS.primary, borderRadius: RADIUS.full, paddingVertical: 14, paddingHorizontal: 40 }} onPress={() => router.push('/(auth)/sign-in')}>
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>{t.sign_in}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  async function handleLogout() {
    Alert.alert(t.sign_out, t.sign_out_confirm, [
      { text: t.cancel, style: 'cancel' },
      {
        text: t.sign_out,
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(auth)/sign-in');
        },
      },
    ]);
  }

  const initials = [user?.firstName?.[0], user?.lastName?.[0]]
    .filter(Boolean)
    .join('')
    .toUpperCase() || '?';

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <Text style={styles.heading}>{t.profile}</Text>
        </View>

        {/* Avatar card */}
        <View style={styles.avatarCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{user?.firstName} {user?.lastName}</Text>
          <Text style={styles.email}>{user?.email}</Text>
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{user?.role}</Text>
          </View>
        </View>

        {/* SiyaGo Partner promo */}
        {user?.role === 'guest' && (
          <TouchableOpacity
            style={styles.partnerCard}
            activeOpacity={0.9}
            onPress={() => router.push('/become-host')}
          >
            <View style={styles.partnerIconWrap}>
              <Ionicons name="business" size={24} color={COLORS.accentDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.partnerTitle}>{t.siyago_partner}</Text>
              <Text style={styles.partnerSub}>{t.siyago_partner_sub}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={COLORS.accentDark} />
          </TouchableOpacity>
        )}

        {/* Menu items */}
        <View style={styles.menuCard}>
          {(user?.role === 'host' || user?.role === 'admin') && (
            <MenuItem
              icon="business-outline"
              label={t.host_dashboard}
              onPress={() => router.push('/(host)')}
            />
          )}
          <MenuItem
            icon="create-outline"
            label={t.edit_profile}
            onPress={() => router.push('/edit-profile')}
          />
          <MenuItem
            icon="shield-checkmark-outline"
            label="Two-Factor Authentication"
            onPress={() => router.push('/two-factor-auth')}
          />
          <MenuItem
            icon="language-outline"
            label={t.language}
            value={LOCALE_NAMES[locale]}
            onPress={() => setShowLangPicker(true)}
          />
          <MenuItem
            icon="chatbubble-outline"
            label={t.inbox}
            onPress={() => router.push('/(guest)/inbox')}
          />
          <MenuItem
            icon="notifications-outline"
            label={t.notifications}
            onPress={() => router.push('/notifications')}
          />
          <MenuItem
            icon="help-circle-outline"
            label="Help & Support"
          />
          <MenuItem
            icon="log-out-outline"
            label={t.sign_out}
            labelColor={COLORS.error}
            iconColor={COLORS.error}
            onPress={handleLogout}
            noBorder
          />
        </View>
      </ScrollView>

      {/* Language Picker Modal */}
      <Modal
        visible={showLangPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowLangPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.change_language}</Text>
            {(Object.entries(LOCALE_NAMES) as [Locale, string][]).map(([loc, name]) => (
              <TouchableOpacity
                key={loc}
                style={styles.langItem}
                onPress={async () => {
                  await setLocale(loc);
                  setShowLangPicker(false);
                }}
              >
                <Text style={[styles.langText, loc === locale && styles.langTextActive]}>
                  {name}
                </Text>
                {loc === locale && (
                  <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowLangPicker(false)}>
              <Text style={styles.modalCloseText}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function MenuItem({
  icon,
  label,
  value,
  onPress,
  labelColor,
  iconColor,
  noBorder,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
  labelColor?: string;
  iconColor?: string;
  noBorder?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.menuItem, noBorder && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.menuIconBg, iconColor ? { backgroundColor: iconColor + '15' } : {}]}>
        <Ionicons name={icon} size={18} color={iconColor ?? COLORS.primary} />
      </View>
      <Text style={[styles.menuLabel, labelColor ? { color: labelColor } : {}]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {value ? <Text style={styles.menuValue}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} /> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary },

  avatarCard: {
    backgroundColor: COLORS.card,
    margin: 16,
    borderRadius: RADIUS.xl,
    alignItems: 'center',
    padding: 24,
    ...SHADOW.sm,
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
  name: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  email: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 10 },
  roleBadge: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  roleText: { color: COLORS.primary, fontWeight: '700', fontSize: 12 },

  partnerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.accentLight,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: RADIUS.xl,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.accent + '33',
  },
  partnerIconWrap: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  partnerTitle: { fontSize: 15, fontWeight: '800', color: COLORS.accentDark, marginBottom: 2 },
  partnerSub: { fontSize: 12, color: COLORS.accentDark, opacity: 0.85 },

  menuCard: {
    backgroundColor: COLORS.card,
    marginHorizontal: 16,
    borderRadius: RADIUS.xl,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: 12,
  },
  menuIconBg: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuLabel: { fontSize: 15, fontWeight: '600', color: COLORS.textPrimary },
  menuValue: { fontSize: 13, color: COLORS.textSecondary, marginRight: 8 },

  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: COLORS.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 20,
    paddingBottom: 40,
  },
  modalHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.full,
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 16 },
  langItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  langText: { fontSize: 16, color: COLORS.textPrimary },
  langTextActive: { fontWeight: '700', color: COLORS.primary },
  modalClose: {
    marginTop: 16,
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: COLORS.background,
    borderRadius: RADIUS.lg,
  },
  modalCloseText: { fontSize: 15, fontWeight: '600', color: COLORS.textSecondary },
});
