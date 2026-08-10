import { useI18n } from '../../context/I18nContext';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import { browseProperties, formatLocation, searchPropertiesAdvanced, type Property } from '../../services/properties';
import { getPropertyTypes, type MasterOption } from '../../services/master';
import DateField, { toISODate } from '../../components/DateField';
import Stepper from '../../components/Stepper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function SearchScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const params = useLocalSearchParams<{ q?: string }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [results, setResults] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [numberOfRooms, setNumberOfRooms] = useState(1);
  const [types, setTypes] = useState<MasterOption[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<number[]>([]);

  useEffect(() => {
    getPropertyTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  useEffect(() => {
    if (params.q) handleSearch();
  }, []);

  function toggleType(id: number) {
    setSelectedTypeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function handleSearch() {
    setIsLoading(true);
    setSearched(true);
    try {
      if (checkIn && checkOut) {
        const res = await searchPropertiesAdvanced({
          city: query.trim() || undefined,
          checkInDate: toISODate(checkIn),
          checkOutDate: toISODate(checkOut),
          adults,
          children,
          numberOfRooms,
          typeIds: selectedTypeIds,
        });
        setResults(res.data);
      } else {
        const res = await browseProperties({ city: query.trim() || undefined });
        setResults(res.data);
      }
    } catch {
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>{t.search}</Text>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color={COLORS.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t.search_placeholder}
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]}
          onPress={() => setShowFilters((v) => !v)}
        >
          <Ionicons name="options" size={20} color={showFilters ? '#fff' : COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.goBtn} onPress={handleSearch}>
          <Ionicons name="search" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {showFilters && (
        <View style={styles.filtersPanel}>
          <View style={styles.dateRow}>
            <DateField label={t.check_in} icon="log-in-outline" value={checkIn} onChange={setCheckIn} minimumDate={new Date()} />
            <DateField label={t.check_out} icon="log-out-outline" value={checkOut} onChange={setCheckOut} minimumDate={checkIn ?? new Date()} />
          </View>

          <Stepper label={t.adults} value={adults} onChange={setAdults} min={1} />
          <Stepper label={t.children} value={children} onChange={setChildren} min={0} />
          <Stepper label={t.rooms} value={numberOfRooms} onChange={setNumberOfRooms} min={1} />

          {types.length > 0 && (
            <View style={styles.typeChipsRow}>
              {types.map((type) => {
                const active = selectedTypeIds.includes(type.id);
                return (
                  <TouchableOpacity
                    key={type.id}
                    style={[styles.typeChip, active && styles.typeChipActive]}
                    onPress={() => toggleType(type.id)}
                  >
                    <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>{type.name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>
      )}

      {isLoading && (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={COLORS.primary} />
      )}

      {!isLoading && searched && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="search-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.empty}>{t.no_properties}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.88}
              onPress={() =>
                router.push({ pathname: '/property/[id]', params: { id: item.id } })
              }
            >
              {item.thumbnail ? (
                <Image source={{ uri: item.thumbnail }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, { backgroundColor: COLORS.primaryLight }]} />
              )}
              {item.rating != null && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={10} color="#fff" />
                  <Text style={styles.ratingBadgeText}>{item.rating.toFixed(1)}</Text>
                </View>
              )}
              <View style={styles.cardBody}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                {formatLocation(item) ? (
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={12} color={COLORS.textSecondary} />
                    <Text style={styles.cardCity}>{formatLocation(item)}</Text>
                  </View>
                ) : null}
                <Text style={styles.cardPrice}>
                  <Text style={styles.priceAmt}>{item.currency} {item.pricePerNight.toLocaleString()}</Text>
                  <Text style={styles.priceNight}> {t.per_night}</Text>
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={COLORS.textMuted} style={{ marginRight: 12, alignSelf: 'center' }} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary },

  searchRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
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
  searchInput: { flex: 1, fontSize: 14, color: COLORS.textPrimary },
  filterToggleBtn: {
    width: 50,
    height: 50,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterToggleBtnActive: { backgroundColor: COLORS.primary },
  goBtn: {
    width: 50,
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.sm,
  },

  filtersPanel: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    ...SHADOW.sm,
  },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  typeChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  typeChipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeChipText: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary },
  typeChipTextActive: { color: '#fff' },

  card: {
    flexDirection: 'row',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    marginBottom: 10,
    overflow: 'hidden',
    ...SHADOW.dark,
  },
  cardImage: { width: 90, height: 90 },
  ratingBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  ratingBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  cardBody: { flex: 1, padding: 12, justifyContent: 'center' },
  cardName: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  cardCity: { fontSize: 12, color: COLORS.textSecondary },
  cardPrice: {},
  priceAmt: { fontSize: 14, fontWeight: '700', color: COLORS.primary },
  priceNight: { fontSize: 11, color: COLORS.textSecondary },

  emptyWrap: { alignItems: 'center', marginTop: 48, gap: 12 },
  empty: { fontSize: 14, color: COLORS.textMuted },
});
