import { useI18n } from '../../context/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import {
  formatLocation,
  getFeaturedProperties,
  getNearbyProperties,
  getPropertyBadge,
  type Property,
  type PropertyBadge,
} from '../../services/properties';
import { getPropertyTypes, type MasterOption } from '../../services/master';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

const BADGE_COLORS: Record<PropertyBadge['tone'], { bg: string; fg: string }> = {
  accent: { bg: COLORS.accent, fg: '#fff' },
  primary: { bg: COLORS.primary, fg: '#fff' },
  success: { bg: COLORS.success, fg: '#fff' },
};

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useI18n();
  const [featuredList, setFeaturedList] = useState<Property[]>([]);
  const [nearbyList, setNearbyList] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [types, setTypes] = useState<MasterOption[]>([]);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [searchText, setSearchText] = useState('');
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

  function handleSearchSubmit() {
    if (searchText.trim()) {
      router.push({ pathname: '/(guest)/search', params: { q: searchText.trim() } });
    }
  }

  function goToCity(city: string) {
    router.push({ pathname: '/(guest)/search', params: { q: city } });
  }

  function matchesType(p: Property) {
    if (!selectedType) return true;
    return p.typeName === selectedType;
  }

  const featured = featuredList.filter(matchesType);
  const topPicks = (nearbyList.length > 0 ? nearbyList : featuredList).filter(matchesType);
  const hero = featured[0] ?? topPicks[0] ?? null;
  const restOfTopPicks = topPicks.filter((p) => p.id !== hero?.id);

  const destinations = useMemo(() => {
    const seen = new Map<string, Property>();
    [...featuredList, ...nearbyList].forEach((p) => {
      if (p.city && !seen.has(p.city)) seen.set(p.city, p);
    });
    return Array.from(seen.values()).slice(0, 6);
  }, [featuredList, nearbyList]);

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
            <Ionicons name="notifications-outline" size={18} color={COLORS.textPrimary} />
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

        {/* Search bar */}
        <View style={styles.searchRow}>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color={COLORS.textMuted} />
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              placeholder={t.search_placeholder}
              placeholderTextColor={COLORS.textMuted}
              value={searchText}
              onChangeText={setSearchText}
              onSubmitEditing={handleSearchSubmit}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity style={styles.filterBtn} onPress={() => router.push('/(guest)/search')}>
            <Ionicons name="options" size={20} color={COLORS.card} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} size="large" color={COLORS.primary} />
        ) : (
          <>
            {/* Destination quick-picks */}
            {destinations.length > 0 && (
              <FlatList
                data={destinations}
                horizontal
                showsHorizontalScrollIndicator={false}
                keyExtractor={(d) => d.city}
                contentContainerStyle={styles.destRow}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.destItem} onPress={() => goToCity(item.city)} activeOpacity={0.85}>
                    {item.thumbnail ? (
                      <Image source={{ uri: item.thumbnail }} style={styles.destAvatar} />
                    ) : (
                      <View style={[styles.destAvatar, { backgroundColor: COLORS.primaryLight }]} />
                    )}
                    <Text style={styles.destLabel} numberOfLines={1}>{item.city}</Text>
                  </TouchableOpacity>
                )}
              />
            )}

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
                  <View style={[styles.heroImage, { backgroundColor: COLORS.primaryLight }]} />
                )}
                <View style={styles.heroScrim} />
                <View style={styles.heroBadge}>
                  <Text style={styles.heroBadgeText}>FEATURED</Text>
                </View>
                <View style={styles.heroArrow}>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
                </View>
                <View style={styles.heroTextWrap}>
                  <Text style={styles.heroTitle} numberOfLines={1}>{hero.name}</Text>
                  <Text style={styles.heroSub} numberOfLines={1}>
                    {formatLocation(hero) || hero.typeName} · {hero.currency} {hero.pricePerNight.toLocaleString()}/night
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
  return (
    <TouchableOpacity style={styles.pickCard} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.pickImageWrap}>
        {property.thumbnail ? (
          <Image source={{ uri: property.thumbnail }} style={styles.pickImage} />
        ) : (
          <View style={[styles.pickImage, { backgroundColor: COLORS.primaryLight }]} />
        )}
        {badge && (
          <View style={[styles.pickBadge, { backgroundColor: BADGE_COLORS[badge.tone].bg }]}>
            <Text style={[styles.pickBadgeText, { color: BADGE_COLORS[badge.tone].fg }]}>{badge.label}</Text>
          </View>
        )}
      </View>
      <View style={styles.pickBody}>
        <View style={{ flex: 1 }}>
          <Text style={styles.pickName} numberOfLines={1}>{property.name}</Text>
          {formatLocation(property) ? (
            <View style={styles.locationRow2}>
              <Ionicons name="location-outline" size={11} color={COLORS.textSecondary} />
              <Text style={styles.cardCity} numberOfLines={1}>{formatLocation(property)}</Text>
            </View>
          ) : null}
          {property.rating != null && (
            <View style={styles.pickRatingRow}>
              <Ionicons name="star" size={12} color={COLORS.accent} />
              <Text style={styles.pickRatingText}>
                {property.rating.toFixed(1)}
                {property.reviewCount ? ` (${property.reviewCount})` : ''}
              </Text>
            </View>
          )}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.cardPriceAmount}>{property.currency} {property.pricePerNight.toLocaleString()}</Text>
          <Text style={styles.cardPriceSub}>{t.per_night}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
  },
  greetingLabel: { fontSize: 12, color: COLORS.textSecondary, fontWeight: '600', marginBottom: 2, textTransform: 'uppercase', letterSpacing: 0.4 },
  greetingHeadline: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },
  bellBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.dark,
  },
  avatarBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.sm,
  },
  avatarText: { color: '#fff', fontSize: 14, fontWeight: '800' },

  // Search
  searchRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 20, gap: 10 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    height: 50,
    gap: 8,
    ...SHADOW.dark,
  },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary, height: '100%' },
  filterBtn: {
    width: 50,
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.sm,
  },

  // Destinations
  destRow: { paddingHorizontal: 20, gap: 16, paddingBottom: 8 },
  destItem: { alignItems: 'center', width: 64 },
  destAvatar: { width: 58, height: 58, borderRadius: 29, marginBottom: 6, ...SHADOW.sm },
  destLabel: { fontSize: 11, fontWeight: '600', color: COLORS.textPrimary },

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
    backgroundColor: COLORS.accent,
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
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  catChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  catText: { fontSize: 13, fontWeight: '600', color: COLORS.textSecondary },
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
  sectionTitle: { fontSize: 17, fontWeight: '700', color: COLORS.textPrimary },
  seeAll: { fontSize: 13, fontWeight: '600', color: COLORS.primary },

  // Pick card (vertical list)
  pickCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
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
  pickName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  pickRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 2 },
  pickRatingText: { fontSize: 11, fontWeight: '700', color: COLORS.textSecondary },

  // Card shared
  locationRow2: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 2 },
  cardCity: { fontSize: 11, color: COLORS.textSecondary, flex: 1 },
  cardPriceAmount: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  cardPriceSub: { fontSize: 10, color: COLORS.textSecondary },

  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40, fontSize: 14 },
});
