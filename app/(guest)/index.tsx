import { useI18n } from '../../context/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import { formatLocation, getFeaturedProperties, getNearbyProperties, type Property } from '../../services/properties';
import { getPropertyTypes, type MasterOption } from '../../services/master';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
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
        // Fall back to the general browse list if no premium properties exist yet.
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

  function matchesType(p: Property) {
    if (!selectedType) return true;
    return p.typeName === selectedType;
  }

  const featured = featuredList.filter(matchesType);
  const nearBy = nearbyList.filter(matchesType);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.locationRow}>
            <Ionicons name="location" size={16} color={COLORS.primary} />
            <View style={{ marginLeft: 4 }}>
              <Text style={styles.locationLabel}>{t.current_location}</Text>
              <Text style={styles.cityName}>
                {'Everywhere'}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.bellBtn}>
            <Ionicons name="notifications-outline" size={20} color={COLORS.textPrimary} />
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

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 60 }} size="large" color={COLORS.primary} />
        ) : (
          <>
            {/* Featured horizontal scroll */}
            {featured.length > 0 && (
              <>
                <SectionHeader label={t.featured} onSeeAll={() => router.push('/(guest)/search')} t_see_all={t.see_all} />
                <FlatList
                  data={featured}
                  keyExtractor={(item) => item.id + '_feat'}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.featuredList}
                  renderItem={({ item }) => (
                    <FeaturedCard property={item} t={t} onPress={() =>
                      router.push({ pathname: '/property/[id]', params: { id: item.id } })
                    } />
                  )}
                />
              </>
            )}

            {/* Near Location 2-column grid */}
            <SectionHeader label={t.near_location} onSeeAll={() => router.push('/(guest)/search')} t_see_all={t.see_all} />
            {nearBy.length === 0 && featured.length === 0 ? (
              <Text style={styles.empty}>{t.no_properties}</Text>
            ) : (
              <View style={styles.grid}>
                {(nearBy.length > 0 ? nearBy : featured).map((item) => (
                  <GridCard key={item.id + '_near'} property={item} t={t} onPress={() =>
                    router.push({ pathname: '/property/[id]', params: { id: item.id } })
                  } />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SectionHeader({ label, onSeeAll, t_see_all }: { label: string; onSeeAll: () => void; t_see_all: string }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{label}</Text>
      <TouchableOpacity onPress={onSeeAll}>
        <Text style={styles.seeAll}>{t_see_all}</Text>
      </TouchableOpacity>
    </View>
  );
}

function FeaturedCard({ property, t, onPress }: { property: Property; t: any; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.featCard} onPress={onPress} activeOpacity={0.92}>
      {property.thumbnail ? (
        <Image source={{ uri: property.thumbnail }} style={styles.featImage} />
      ) : (
        <View style={[styles.featImage, { backgroundColor: COLORS.primaryLight }]} />
      )}
      {property.rating != null && (
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={10} color="#fff" />
          <Text style={styles.ratingBadgeText}>{property.rating.toFixed(1)}</Text>
        </View>
      )}
      <View style={styles.featBody}>
        <Text style={styles.cardName} numberOfLines={1}>{property.name}</Text>
        {formatLocation(property) ? (
          <View style={styles.locationRow2}>
            <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
            <Text style={styles.cardCity} numberOfLines={1}>
              {formatLocation(property)}
            </Text>
          </View>
        ) : null}
        <Text style={styles.cardPrice}>
          <Text style={styles.cardPriceAmount}>{property.currency} {property.pricePerNight.toLocaleString()}</Text>
          <Text style={styles.cardPriceSub}> {t.per_night}</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

function GridCard({ property, t, onPress }: { property: Property; t: any; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.gridCard} onPress={onPress} activeOpacity={0.92}>
      {property.thumbnail ? (
        <Image source={{ uri: property.thumbnail }} style={styles.gridImage} />
      ) : (
        <View style={[styles.gridImage, { backgroundColor: COLORS.primaryLight }]} />
      )}
      {property.rating != null && (
        <View style={styles.ratingBadge}>
          <Ionicons name="star" size={10} color="#fff" />
          <Text style={styles.ratingBadgeText}>{property.rating.toFixed(1)}</Text>
        </View>
      )}
      <View style={styles.gridBody}>
        <Text style={styles.cardName} numberOfLines={1}>{property.name}</Text>
        {formatLocation(property) ? (
          <View style={styles.locationRow2}>
            <Ionicons name="location-outline" size={11} color={COLORS.textSecondary} />
            <Text style={styles.cardCity} numberOfLines={1}>
              {formatLocation(property)}
            </Text>
          </View>
        ) : null}
        <Text style={styles.cardPrice}>
          <Text style={styles.cardPriceAmount}>{property.currency} {property.pricePerNight.toLocaleString()}</Text>
          <Text style={styles.cardPriceSub}> {t.per_night}</Text>
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  locationRow: { flexDirection: 'row', alignItems: 'center' },
  locationLabel: { fontSize: 11, color: COLORS.textSecondary, fontWeight: '500' },
  cityName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.dark,
  },

  // Search
  searchRow: { flexDirection: 'row', paddingHorizontal: 20, marginBottom: 16, gap: 10 },
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

  // Featured horizontal card
  featuredList: { paddingLeft: 20, paddingRight: 8, gap: 12 },
  featCard: {
    width: 220,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  featImage: { width: '100%', height: 148 },

  // Grid card
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    gap: 12,
  },
  gridCard: {
    width: '47%',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  gridImage: { width: '100%', height: 120 },

  // Card shared
  ratingBadge: {
    position: 'absolute',
    top: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(26,26,46,0.7)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  ratingBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  featBody: { padding: 12 },
  gridBody: { padding: 10 },
  cardName: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  locationRow2: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },
  cardCity: { fontSize: 11, color: COLORS.textSecondary, flex: 1 },
  cardPrice: {},
  cardPriceAmount: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  cardPriceSub: { fontSize: 11, color: COLORS.textSecondary },

  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40, fontSize: 14 },
});
