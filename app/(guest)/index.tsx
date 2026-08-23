import { useI18n } from '../../context/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { useCurrency } from '../../context/CurrencyContext';
import { RADIUS, SHADOW, type ThemeColors } from '../../constants/theme';
import {
  formatLocation,
  getFeaturedProperties,
  getNearbyProperties,
  getPropertyBadge,
  type Property,
  type PropertyBadge,
} from '../../services/properties';
import { getPropertyTypes, type MasterOption } from '../../services/master';
import DateField, { toISODate } from '../../components/DateField';
import Stepper from '../../components/Stepper';
import GradientButton from '../../components/GradientButton';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { LinearGradient } from 'expo-linear-gradient';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function getBadgeColors(colors: ThemeColors): Record<PropertyBadge['tone'], { bg: string; fg: string }> {
  return {
    accent: { bg: colors.accent, fg: '#fff' },
    primary: { bg: colors.primary, fg: '#fff' },
    success: { bg: colors.success, fg: '#fff' },
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { format } = useCurrency();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [featuredList, setFeaturedList] = useState<Property[]>([]);
  const [nearbyList, setNearbyList] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [types, setTypes] = useState<MasterOption[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [showGuestsPicker, setShowGuestsPicker] = useState(false);
  const searchRef = useRef<TextInput>(null);

  useEffect(() => {
    Promise.all([
      getFeaturedProperties().catch(() => []),
      getNearbyProperties(12).catch(() => []),
    ])
      .then(([featured, nearby]) => {
        setFeaturedList(featured.length ? featured : nearby.slice(0, 5));
        setNearbyList(nearby);
      })
      .finally(() => setIsLoading(false));
    getPropertyTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  /** Shared params for both the quick-search and "more filters" actions below — carries whatever the guest already filled in here so nothing typed is lost. */
  function buildSearchParams() {
    return {
      ...(searchText.trim() ? { q: searchText.trim() } : {}),
      ...(checkIn && checkOut
        ? { checkInDate: toISODate(checkIn), checkOutDate: toISODate(checkOut) }
        : {}),
      adults: String(adults),
      children: String(children),
    };
  }

  function handleSearchSubmit() {
    router.push({ pathname: '/(guest)/search', params: buildSearchParams() });
  }

  function handleOpenFilters() {
    router.push({ pathname: '/(guest)/search', params: { ...buildSearchParams(), showFilters: '1' } });
  }

  function matchesType(p: Property) {
    if (!selectedType) return true;
    return p.typeName === selectedType;
  }

  const featured = featuredList.filter(matchesType);
  const topPicks = (nearbyList.length > 0 ? nearbyList : featuredList).filter(matchesType);
  const hero = featured[0] ?? topPicks[0] ?? null;
  const restOfTopPicks = topPicks.filter((p) => p.id !== hero?.id);

  const initials = user
    ? [user.firstName?.[0], user.lastName?.[0]].filter(Boolean).join('').toUpperCase()
    : null;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Greeting header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greetingLabel}>{getGreeting()}</Text>
            <Text style={styles.greetingHeadline} numberOfLines={1}>
              Where to next{user?.firstName ? `, ${user.firstName}` : ''}?
            </Text>
          </View>
          <TouchableOpacity style={styles.bellBtn} onPress={() => router.push('/notifications')}>
            <Ionicons name="notifications-outline" size={18} color={colors.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.avatarBtn}
            onPress={() => router.push(user ? '/(guest)/profile' : '/(auth)/sign-in')}
          >
            {initials ? (
              <Text style={styles.avatarText}>{initials}</Text>
            ) : (
              <Ionicons name="person" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {/* Search card */}
        <View style={styles.searchCard}>
          <View style={styles.searchTopRow}>
            <View style={styles.destInputWrap}>
              <Ionicons name="location-outline" size={16} color={colors.textMuted} />
              <TextInput
                ref={searchRef}
                style={styles.destInput}
                placeholder={t.search_placeholder}
                placeholderTextColor={colors.textMuted}
                value={searchText}
                onChangeText={setSearchText}
                onSubmitEditing={handleSearchSubmit}
                returnKeyType="search"
              />
            </View>
            <TouchableOpacity style={styles.ghostIconBtn} onPress={handleOpenFilters} activeOpacity={0.8}>
              <Ionicons name="options-outline" size={18} color={colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSearchSubmit} activeOpacity={0.85}>
              <LinearGradient
                colors={colors.primaryGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.searchIconBtn}
              >
                <Ionicons name="search" size={18} color="#fff" />
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <View style={styles.searchFieldsRow}>
            <DateField
              compact
              label={t.check_in}
              value={checkIn}
              onChange={setCheckIn}
              minimumDate={new Date()}
              placeholder="Add date"
            />
            <DateField
              compact
              label={t.check_out}
              value={checkOut}
              onChange={setCheckOut}
              minimumDate={checkIn ?? new Date()}
              placeholder="Add date"
            />
            <TouchableOpacity style={styles.compactWrap} onPress={() => setShowGuestsPicker(true)} activeOpacity={0.7}>
              <Text style={styles.compactLabel} numberOfLines={1}>{t.guests_label}</Text>
              <Text style={styles.compactValue} numberOfLines={1}>
                {adults} {t.adults}{children > 0 ? `, ${children} ${t.children}` : ''}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Guests picker */}
        <Modal visible={showGuestsPicker} transparent animationType="slide" onRequestClose={() => setShowGuestsPicker(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>{t.guests_label}</Text>
              <Stepper label={t.adults} value={adults} onChange={setAdults} min={1} />
              <Stepper label={t.children} value={children} onChange={setChildren} min={0} />
              <GradientButton label="Done" onPress={() => setShowGuestsPicker(false)} style={styles.modalDoneBtn} />
            </View>
          </View>
        </Modal>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} size="large" color={colors.primary} />
        ) : (
          <>

            {/* Hero featured deal */}
            {hero && (
              <TouchableOpacity
                style={styles.heroCard}
                activeOpacity={0.92}
                onPress={() => router.push({ pathname: '/property/[id]', params: { id: hero.id } })}
              >
                {hero.thumbnail ? (
                  <Image source={{ uri: hero.thumbnail }} style={styles.heroImage} />
                ) : (
                  <View style={[styles.heroImage, { backgroundColor: colors.primaryLight }]} />
                )}
                <View style={styles.heroScrim} />
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>FEATURED</Text>
                </View>
                <View style={styles.heroArrow}>
                  <Ionicons name="arrow-forward" size={18} color={colors.primary} />
                </View>
                <View style={styles.heroTextWrap}>
                  <Text style={styles.heroTitle} numberOfLines={1}>{hero.name}</Text>
                  <Text style={styles.heroSub} numberOfLines={1}>
                    {formatLocation(hero) || hero.typeName} · {format(hero.pricePerNight)}/night
                  </Text>
                </View>
              </TouchableOpacity>
            )}

            {/* Property type filter */}
            {types.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoriesRow}
              >
                <TouchableOpacity
                  style={[styles.catChip, selectedType === null && styles.catChipActive]}
                  onPress={() => setSelectedType(null)}
                >
                  <Text style={[styles.catText, selectedType === null && styles.catTextActive]}>{t.all}</Text>
                </TouchableOpacity>
                {types.map((type) => (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.catChip, selectedType === type.name && styles.catChipActive]}
                    onPress={() => setSelectedType(selectedType === type.name ? null : type.name)}
                  >
                    <Text style={[styles.catText, selectedType === type.name && styles.catTextActive]}>
                      {type.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}

            {/* Top Picks list */}
            <View style={styles.sectionRow}>
              <Text style={styles.sectionTitle}>Top Picks</Text>
              <TouchableOpacity onPress={() => router.push('/(guest)/search')}>
                <Text style={styles.seeAll}>{t.see_all}</Text>
              </TouchableOpacity>
            </View>
            {restOfTopPicks.length === 0 ? (
              <Text style={styles.empty}>{t.no_properties}</Text>
            ) : (
              <View style={{ paddingHorizontal: 16 }}>
                {restOfTopPicks.map((item, i) => (
                  <PickCard
                    key={item.id}
                    property={item}
                    badge={getPropertyBadge(item, { featured: featuredList.some((f) => f.id === item.id), rank: i })}
                    t={t}
                    onPress={() => router.push({ pathname: '/property/[id]', params: { id: item.id } })}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function PickCard({
  property,
  badge,
  t,
  onPress,
}: {
  property: Property;
  badge: PropertyBadge | null;
  t: any;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const { format } = useCurrency();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const badgeColors = useMemo(() => getBadgeColors(colors), [colors]);
  return (
    <TouchableOpacity style={styles.pickCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.pickImageWrap}>
        {property.thumbnail ? (
          <Image source={{ uri: property.thumbnail }} style={styles.pickImage} />
        ) : (
          <View style={[styles.pickImage, { backgroundColor: colors.primaryLight }]} />
        )}
        {badge && (
          <View style={[styles.pickBadge, { backgroundColor: badgeColors[badge.tone].bg }]}>
            <Text style={[styles.pickBadgeText, { color: badgeColors[badge.tone].fg }]}>{badge.label}</Text>
          </View>
        )}
      </View>
      <View style={styles.pickBody}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pickName} numberOfLines={1}>{property.name}</Text>
          {formatLocation(property) ? (
            <View style={styles.locationRow2}>
              <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
              <Text style={styles.cardCity} numberOfLines={1}>{formatLocation(property)}</Text>
            </View>
          ) : null}
          {property.rating != null && (
            <View style={styles.pickRatingRow}>
              <Ionicons name="star" size={12} color={colors.accent} />
              <Text style={styles.pickRatingText}>
                {property.rating.toFixed(1)}
                {property.reviewCount ? ` (${property.reviewCount})` : ''}
              </Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.cardPriceAmount}>{format(property.pricePerNight)}</Text>
          <Text style={styles.cardPriceSub}>{t.per_night}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 16,
    },
    greetingLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
    greetingHeadline: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },
    bellBtn: {
      width: 38,
      height: 38,
      borderRadius: RADIUS.full,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
      ...SHADOW.dark,
    },
    avatarBtn: {
      width: 38,
      height: 38,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      ...SHADOW.sm,
    },
    avatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },

    // Search card
    searchCard: {
      marginHorizontal: 20,
      marginBottom: 20,
      backgroundColor: colors.card,
      borderRadius: RADIUS.xl,
      padding: 16,
      ...SHADOW.dark,
    },
    searchTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    destInputWrap: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.backgroundAlt,
      borderRadius: RADIUS.md,
      paddingHorizontal: 12,
      height: 44,
    },
    destInput: { flex: 1, fontSize: 14, color: colors.textPrimary, height: '100%' },
    searchFieldsRow: { flexDirection: 'row', gap: 8 },
    compactWrap: {
      flex: 1,
      backgroundColor: colors.backgroundAlt,
      borderRadius: RADIUS.md,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    compactLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    compactValue: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    ghostIconBtn: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.full,
      backgroundColor: colors.backgroundAlt,
      borderWidth: 1,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    searchIconBtn: {
      width: 44,
      height: 44,
      borderRadius: RADIUS.full,
      justifyContent: 'center',
      alignItems: 'center',
    },

    // Guests picker modal
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      padding: 20,
      paddingBottom: 36,
    },
    modalHandle: {
      width: 40,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginBottom: 8 },
    modalDoneBtn: { marginTop: 16 },

    // Hero
    heroCard: {
      marginHorizontal: 20,
      marginTop: 16,
      marginBottom: 20,
      height: 170,
      borderRadius: RADIUS.xl,
      overflow: 'hidden',
      ...SHADOW.md,
    },
    heroImage: { width: '100%', height: '100%', position: 'absolute' },
    heroScrim: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      height: 100,
      backgroundColor: 'rgba(15,23,42,0.55)',
    },
    heroBadge: {
      position: 'absolute',
      top: 14,
      left: 14,
      backgroundColor: colors.accent,
      borderRadius: RADIUS.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    heroBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
    heroArrow: {
      position: 'absolute',
      top: 14,
      right: 14,
      width: 34,
      height: 34,
      borderRadius: RADIUS.full,
      backgroundColor: '#fff',
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroTextWrap: { position: 'absolute', left: 16, right: 16, bottom: 14 },
    heroTitle: { fontSize: 17, fontWeight: '800', color: '#fff', marginBottom: 3 },
    heroSub: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: '600' },

    // Categories
    categoriesRow: { paddingHorizontal: 20, paddingBottom: 4, gap: 8 },
    catChip: {
      paddingHorizontal: 18,
      paddingVertical: 8,
      borderRadius: RADIUS.full,
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
    },
    catChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    catText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    catTextActive: { color: '#fff' },

    // Section header
    sectionRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      marginTop: 20,
      marginBottom: 12,
    },
    sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
    seeAll: { fontSize: 13, fontWeight: '600', color: colors.primary },

    // Pick card (vertical list)
    pickCard: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      marginBottom: 12,
      overflow: 'hidden',
      ...SHADOW.sm,
    },
    pickImageWrap: { width: 96, height: 96 },
    pickImage: { width: '100%', height: '100%' },
    pickBadge: {
      position: 'absolute',
      top: 6,
      left: 6,
      borderRadius: RADIUS.full,
      paddingHorizontal: 7,
      paddingVertical: 2,
    },
    pickBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.2 },
    pickBody: { flex: 1, flexDirection: 'row', padding: 12, alignItems: 'center' },
    pickName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
    pickRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
    pickRatingText: { fontSize: 11, fontWeight: '700', color: colors.textSecondary },

    // Card shared
    locationRow2: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
    cardCity: { fontSize: 11, color: colors.textSecondary, flex: 1 },
    cardPriceAmount: { fontSize: 13, fontWeight: '700', color: colors.primary },
    cardPriceSub: { fontSize: 10, color: colors.textSecondary },

    empty: { textAlign: 'center', color: colors.textMuted, marginTop: 40, fontSize: 14 },
  });
}
