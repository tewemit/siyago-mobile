import { useMemo, useState } from 'react';
import Constants from 'expo-constants';
import { useI18n } from '../../context/I18nContext';
import { RADIUS, SHADOW, type ThemeColors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useRegion } from '../../context/RegionContext';
import { useCurrency, CURRENCIES, type CurrencyCode } from '../../context/CurrencyContext';
import { useTheme, type ThemeName } from '../../context/ThemeContext';
import { LOCALE_NAMES, type Locale } from '../../i18n/translations';
import { COUNTRIES } from '../../constants/countries';
import GradientButton from '../../components/GradientButton';
import { WEBSITE_URL } from '../../constants/config';
import { getSiteContact, type SiteContact } from '../../services/master';
import { useRouter } from 'expo-router';
import {
  Alert,
  FlatList,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function ProfileScreen() {
  const { user, logout, isAuthenticated } = useAuth();
  const router = useRouter();
  const { t, locale, setLocale } = useI18n();
  const { region, setRegion } = useRegion();
  const { currency, setCurrency, ratesAvailable } = useCurrency();
  const { theme, colors, setTheme } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showRegionPicker, setShowRegionPicker] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);
  const [regionSearch, setRegionSearch] = useState('');

  async function handleSelectCurrency(code: CurrencyCode) {
    if (code !== 'ETB' && !ratesAvailable) {
      Alert.alert(t.currency, t.currency_conversion_unavailable);
      return;
    }
    await setCurrency(code);
    setShowCurrencyPicker(false);
  }

  const THEME_NAMES: Record<ThemeName, string> = { light: t.theme_light, navy: t.theme_navy };

  const filteredCountries = useMemo(() => {
    const q = regionSearch.trim().toLowerCase();
    if (!q) return COUNTRIES;
    return COUNTRIES.filter((c) => c.toLowerCase().includes(q));
  }, [regionSearch]);

  async function handleHelpSupport() {
    const contact = await getSiteContact().catch((): SiteContact => ({}));
    if (!contact.email && !contact.phone) {
      Alert.alert(t.help_support, 'Contact us at support@siyago.com');
      return;
    }
    const buttons: { text: string; onPress?: () => void; style?: 'cancel' }[] = [
      { text: t.cancel, style: 'cancel' },
    ];
    if (contact.email) {
      buttons.push({ text: `Email ${contact.email}`, onPress: () => Linking.openURL(`mailto:${contact.email}`) });
    }
    if (contact.phone) {
      buttons.push({ text: `Call ${contact.phone}`, onPress: () => Linking.openURL(`tel:${contact.phone}`) });
    }
    Alert.alert(t.help_support, 'How would you like to reach us?', buttons);
  }

  function handleHelpCenter() {
    Linking.openURL(`${WEBSITE_URL}/faqs`);
  }

  async function handleShareFeedback() {
    const contact = await getSiteContact().catch((): SiteContact => ({}));
    const email = contact.email || 'support@siyago.com';
    Linking.openURL(`mailto:${email}?subject=${encodeURIComponent('SiyaGo App Feedback')}`);
  }

  function handleRateApp() {
    Alert.alert(t.rate_app, t.rate_app_unavailable);
  }

  // The web app currently has a single combined Terms & Privacy Policy
  // document (no separate cookie policy page) — all three legal entries
  // point at it until those get split out into dedicated pages.
  function openLegal() {
    Linking.openURL(`${WEBSITE_URL}/terms`);
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

  const appVersion = Constants.expoConfig?.version ?? '1.0.0';
  const copyrightYear = new Date().getFullYear();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={styles.header}>
          <Text style={styles.heading}>{t.profile}</Text>
        </View>

        {isAuthenticated ? (
          <>
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
                  <Ionicons name="business" size={24} color={colors.accentDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.partnerTitle}>{t.siyago_partner}</Text>
                  <Text style={styles.partnerSub}>{t.siyago_partner_sub}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.accentDark} />
              </TouchableOpacity>
            )}

            {/* Account menu items */}
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
                icon="log-out-outline"
                label={t.sign_out}
                labelColor={colors.error}
                iconColor={colors.error}
                onPress={handleLogout}
                noBorder
              />
            </View>
          </>
        ) : (
          <>
            <View style={styles.signInCard}>
              <View style={styles.signInIconWrap}>
                <Ionicons name="person-outline" size={36} color={colors.primary} />
              </View>
              <Text style={styles.signInTitle}>{t.profile}</Text>
              <Text style={styles.signInSub}>Sign in to manage your profile, bookings and preferences</Text>
              <GradientButton
                label={t.sign_in}
                onPress={() => router.push('/(auth)/sign-in')}
                size="compact"
                style={{ borderRadius: RADIUS.full }}
              />
            </View>

            {/* SiyaGo Partner promo — signed-out visitors don't have an
                account yet, so this goes to the full host registration form
                rather than the "apply with my existing account" flow used
                by the equivalent card above for signed-in guests. */}
            <TouchableOpacity
              style={styles.partnerCard}
              activeOpacity={0.9}
              onPress={() => router.push('/(auth)/register-host')}
            >
              <View style={styles.partnerIconWrap}>
                <Ionicons name="business" size={24} color={colors.accentDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.partnerTitle}>{t.siyago_partner}</Text>
                <Text style={styles.partnerSub}>{t.siyago_partner_sub}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.accentDark} />
            </TouchableOpacity>
          </>
        )}

        {/* Settings */}
        <SectionLabel label={t.settings} />
        <View style={styles.menuCard}>
          <MenuItem
            icon="color-palette-outline"
            label={t.appearance}
            value={THEME_NAMES[theme]}
            onPress={() => setShowThemePicker(true)}
          />
          <MenuItem
            icon="earth-outline"
            label={t.region}
            value={region ?? undefined}
            onPress={() => setShowRegionPicker(true)}
          />
          <MenuItem
            icon="cash-outline"
            label={t.currency}
            value={currency}
            onPress={() => setShowCurrencyPicker(true)}
          />
          <MenuItem
            icon="language-outline"
            label={t.language}
            value={LOCALE_NAMES[locale]}
            onPress={() => setShowLangPicker(true)}
            noBorder
          />
        </View>

        {/* Legal */}
        <SectionLabel label={t.legal} />
        <View style={styles.menuCard}>
          <MenuItem icon="document-text-outline" label={t.terms_conditions} onPress={openLegal} />
          <MenuItem icon="lock-closed-outline" label={t.privacy_policy} onPress={openLegal} />
          <MenuItem icon="information-circle-outline" label={t.cookie_statement} onPress={openLegal} noBorder />
        </View>

        {/* Help & Feedback */}
        <SectionLabel label={t.help_feedback} />
        <View style={styles.menuCard}>
          <MenuItem icon="help-circle-outline" label={t.help_support} onPress={handleHelpSupport} />
          <MenuItem icon="book-outline" label={t.help_center} onPress={handleHelpCenter} />
          <MenuItem icon="chatbox-ellipses-outline" label={t.share_feedback} onPress={handleShareFeedback} />
          <MenuItem icon="star-outline" label={t.rate_app} onPress={handleRateApp} noBorder />
        </View>

        {/* Version + copyright */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{t.app_version} {appVersion}</Text>
          <Text style={styles.footerText}>© {copyrightYear} SiyaGo. {t.all_rights_reserved}</Text>
        </View>
      </ScrollView>

      {/* Appearance Picker Modal */}
      <Modal
        visible={showThemePicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowThemePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.change_appearance}</Text>
            {(Object.entries(THEME_NAMES) as [ThemeName, string][]).map(([name, label]) => (
              <TouchableOpacity
                key={name}
                style={styles.langItem}
                onPress={async () => {
                  await setTheme(name);
                  setShowThemePicker(false);
                }}
              >
                <Text style={[styles.langText, name === theme && styles.langTextActive]}>
                  {label}
                </Text>
                {name === theme && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowThemePicker(false)}>
              <Text style={styles.modalCloseText}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Currency Picker Modal */}
      <Modal
        visible={showCurrencyPicker}
        animationType="slide"
        transparent
        onRequestClose={() => setShowCurrencyPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.change_currency}</Text>
            {CURRENCIES.map((code) => (
              <TouchableOpacity
                key={code}
                style={styles.langItem}
                onPress={() => handleSelectCurrency(code)}
              >
                <Text style={[styles.langText, code === currency && styles.langTextActive]}>
                  {code}
                </Text>
                {code === currency && (
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowCurrencyPicker(false)}>
              <Text style={styles.modalCloseText}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
                  <Ionicons name="checkmark" size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
            <TouchableOpacity style={styles.modalClose} onPress={() => setShowLangPicker(false)}>
              <Text style={styles.modalCloseText}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Region Picker Modal */}
      <Modal
        visible={showRegionPicker}
        animationType="slide"
        transparent
        onRequestClose={() => {
          setShowRegionPicker(false);
          setRegionSearch('');
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, { maxHeight: '80%' }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t.change_region}</Text>
            <TextInput
              style={styles.searchInput}
              placeholder={t.search}
              placeholderTextColor={colors.textMuted}
              value={regionSearch}
              onChangeText={setRegionSearch}
              autoCorrect={false}
            />
            <FlatList
              data={filteredCountries}
              keyExtractor={(item) => item}
              style={{ maxHeight: 340 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.langItem}
                  onPress={async () => {
                    await setRegion(item);
                    setShowRegionPicker(false);
                    setRegionSearch('');
                  }}
                >
                  <Text style={[styles.langText, item === region && styles.langTextActive]}>
                    {item}
                  </Text>
                  {item === region && (
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
                  )}
                </TouchableOpacity>
              )}
            />
            <TouchableOpacity
              style={styles.modalClose}
              onPress={() => {
                setShowRegionPicker(false);
                setRegionSearch('');
              }}
            >
              <Text style={styles.modalCloseText}>{t.cancel}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function SectionLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <Text style={styles.sectionLabel}>{label}</Text>;
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TouchableOpacity
      style={[styles.menuItem, noBorder && { borderBottomWidth: 0 }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.menuIconBg, iconColor ? { backgroundColor: iconColor + '15' } : {}]}>
        <Ionicons name={icon} size={18} color={iconColor ?? colors.primary} />
      </View>
      <Text style={[styles.menuLabel, labelColor ? { color: labelColor } : {}]}>{label}</Text>
      <View style={{ flex: 1 }} />
      {value ? <Text style={styles.menuValue}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={16} color={colors.textMuted} /> : null}
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
    heading: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },

    avatarCard: {
      backgroundColor: colors.card,
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
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    avatarText: { color: '#fff', fontSize: 28, fontWeight: '800' },
    name: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
    email: { fontSize: 13, color: colors.textSecondary, marginBottom: 10 },
    roleBadge: {
      backgroundColor: colors.primaryLight,
      borderRadius: RADIUS.full,
      paddingHorizontal: 14,
      paddingVertical: 4,
    },
    roleText: { color: colors.primary, fontWeight: '700', fontSize: 12 },

    signInCard: {
      backgroundColor: colors.card,
      margin: 16,
      borderRadius: RADIUS.xl,
      alignItems: 'center',
      padding: 24,
      ...SHADOW.sm,
    },
    signInIconWrap: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    signInTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 6, textAlign: 'center' },
    signInSub: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginBottom: 18, lineHeight: 19 },

    partnerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      backgroundColor: colors.accentLight,
      marginHorizontal: 16,
      marginBottom: 16,
      borderRadius: RADIUS.xl,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.accent + '33',
    },
    partnerIconWrap: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.full,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    partnerTitle: { fontSize: 15, fontWeight: '800', color: colors.accentDark, marginBottom: 2 },
    partnerSub: { fontSize: 12, color: colors.accentDark, opacity: 0.85 },

    sectionLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginHorizontal: 20,
      marginTop: 20,
      marginBottom: 8,
    },

    menuCard: {
      backgroundColor: colors.card,
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
      borderBottomColor: colors.border,
      gap: 12,
    },
    menuIconBg: {
      width: 36,
      height: 36,
      borderRadius: RADIUS.md,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuLabel: { fontSize: 15, fontWeight: '600', color: colors.textPrimary },
    menuValue: { fontSize: 13, color: colors.textSecondary, marginRight: 8 },

    footer: { alignItems: 'center', paddingVertical: 24, gap: 4 },
    footerText: { fontSize: 12, color: colors.textMuted },

    // Modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      padding: 20,
      paddingBottom: 40,
    },
    modalHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: RADIUS.full,
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.textPrimary, marginBottom: 16 },
    searchInput: {
      backgroundColor: colors.background,
      borderRadius: RADIUS.lg,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 14,
      color: colors.textPrimary,
      marginBottom: 8,
    },
    langItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    langText: { fontSize: 16, color: colors.textPrimary },
    langTextActive: { fontWeight: '700', color: colors.primary },
    modalClose: {
      marginTop: 16,
      alignItems: 'center',
      paddingVertical: 14,
      backgroundColor: colors.background,
      borderRadius: RADIUS.lg,
    },
    modalCloseText: { fontSize: 15, fontWeight: '600', color: colors.textSecondary },
  });
}
