import { useI18n } from '../../context/I18nContext';
import { RADIUS, SHADOW, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useCurrency } from '../../context/CurrencyContext';
import { browseProperties, formatLocation, searchPropertiesAdvanced, type Property } from '../../services/properties';
import { getPropertyTypes, type MasterOption } from '../../services/master';
import DateField, { toISODate, parseISODate } from '../../components/DateField';
import Stepper from '../../components/Stepper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
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

/** One room's occupancy in a multi-room search. */
type RoomRequest = { adults: number; children: number };

export default function SearchScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { format } = useCurrency();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{
    q?: string;
    checkInDate?: string;
    checkOutDate?: string;
    adults?: string;
    children?: string;
    showFilters?: string;
  }>();
  const [query, setQuery] = useState(params.q ?? '');
  const [results, setResults] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  // Home's quick-search card can deep-link straight into a ready-to-run
  // search (dates + guests already chosen) — open the filters panel too so
  // the guest can see/adjust what was carried over instead of it being
  // invisibly applied.
  const [showFilters, setShowFilters] = useState(() => !!(params.showFilters || params.checkInDate));

  const [checkIn, setCheckIn] = useState<Date | null>(() =>
    params.checkInDate ? parseISODate(params.checkInDate) : new Date()
  );
  const [checkOut, setCheckOut] = useState<Date | null>(() => {
    if (params.checkOutDate) return parseISODate(params.checkOutDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
  const [rooms, setRooms] = useState<RoomRequest[]>(() => [
    { adults: Math.max(1, Number(params.adults) || 1), children: Math.max(0, Number(params.children) || 0) },
  ]);
  const [types, setTypes] = useState<MasterOption[]>([]);
  const [selectedTypeIds, setSelectedTypeIds] = useState<number[]>([]);

  useEffect(() => {
    getPropertyTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  useEffect(() => {
    if (params.q || params.checkInDate) handleSearch();
  }, []);

  function toggleType(id: number) {
    setSelectedTypeIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addRoom() {
    setRooms((prev) => [...prev, { adults: 1, children: 0 }]);
  }

  function removeRoom(index: number) {
    setRooms((prev) => prev.filter((_, i) => i !== index));
  }

  function updateRoom(index: number, field: keyof RoomRequest, value: number) {
    setRooms((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  }

  async function handleSearch() {
    setIsLoading(true);
    setSearched(true);
    try {
      if (checkIn && checkOut) {
        // The search API only accepts a single adults/children/numberOfRooms
        // combo — it looks for ONE room type whose per-unit capacity fits
        // `adults`/`children` with at least `numberOfRooms` units free (see
        // propertyService.getAvailableProperties). A heterogeneous per-room
        // breakdown is only meaningful once a specific property (and its
        // real room-type inventory) is chosen, on the booking-summary screen.
        // Here we conservatively use the largest single room's requirement
        // so every matched property can actually seat that room.
        const res = await searchPropertiesAdvanced({
          city: query.trim() || undefined,
          checkInDate: toISODate(checkIn),
          checkOutDate: toISODate(checkOut),
          adults: Math.max(1, ...rooms.map((r) => r.adults)),
          children: Math.max(0, ...rooms.map((r) => r.children)),
          numberOfRooms: rooms.length,
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
          <Ionicons name="search" size={18} color={colors.textMuted} />
          <TextInput
            style={styles.searchInput}
            placeholder={t.search_placeholder}
            placeholderTextColor={colors.textMuted}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')}>
              <Ionicons name="close-circle" size={18} color={colors.textMuted} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[styles.filterToggleBtn, showFilters && styles.filterToggleBtnActive]}
          onPress={() => setShowFilters((v) => !v)}
        >
          <Ionicons name="options" size={20} color={showFilters ? '#fff' : colors.primary} />
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

          <View style={styles.roomsHeaderRow}>
            <Text style={styles.roomsHeaderText}>{t.rooms}</Text>
            <Text style={styles.roomCountBadge}>{rooms.length}</Text>
          </View>
          {rooms.map((room, index) => (
            <View key={index} style={styles.roomCard}>
              <View style={styles.roomCardHeaderRow}>
                <Text style={styles.roomCardLabel}>{t.room} {index + 1}</Text>
                {rooms.length > 1 && (
                  <TouchableOpacity onPress={() => removeRoom(index)} hitSlop={8}>
                    <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>
              <Stepper label={t.adults} value={room.adults} onChange={(v) => updateRoom(index, 'adults', v)} min={1} />
              <Stepper label={t.children} value={room.children} onChange={(v) => updateRoom(index, 'children', v)} min={0} />
            </View>
          ))}
          <TouchableOpacity style={styles.addRoomBtn} onPress={addRoom} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
            <Text style={styles.addRoomBtnText}>{t.add_room}</Text>
          </TouchableOpacity>

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
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={colors.primary} />
      )}

      {!isLoading && searched && (
        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Ionicons name="search-outline" size={48} color={colors.textMuted} />
              <Text style={styles.empty}>{t.no_properties}</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.88}
              onPress={() =>
                router.push({
                  pathname: '/property/[id]',
                  // Carries the dates/party size the guest already searched
                  // with, so room-selection doesn't ask them to pick again —
                  // purely a convenience default, still fully editable there.
                  // Mirrors the same max-across-rooms aggregation the search
                  // request itself uses just above.
                  params: {
                    id: item.id,
                    ...(checkIn && { checkInDate: toISODate(checkIn) }),
                    ...(checkOut && { checkOutDate: toISODate(checkOut) }),
                    adults: String(Math.max(1, ...rooms.map((r) => r.adults))),
                    children: String(Math.max(0, ...rooms.map((r) => r.children))),
                  },
                })
              }
            >
              {item.thumbnail ? (
                <Image source={{ uri: item.thumbnail }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, { backgroundColor: colors.primaryLight }]} />
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
                    <Ionicons name="location-outline" size={12} color={colors.textSecondary} />
                    <Text style={styles.cardCity}>{formatLocation(item)}</Text>
                  </View>
                ) : null}
                <Text style={styles.cardPrice}>
                  <Text style={styles.priceAmt}>{format(item.pricePerNight)}</Text>
                  <Text style={styles.priceNight}> {t.per_night}</Text>
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} style={{ marginRight: 12, alignSelf: 'center' }} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },

  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  heading: { fontSize: 20, fontWeight: '800', color: colors.textPrimary },

  searchRow: { flexDirection: 'row', paddingHorizontal: 16, marginBottom: 8, gap: 8 },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    height: 50,
    gap: 8,
    ...SHADOW.dark,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.textPrimary },
  filterToggleBtn: {
    width: 50,
    height: 50,
    backgroundColor: colors.primaryLight,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterToggleBtnActive: { backgroundColor: colors.primary },
  goBtn: {
    width: 50,
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.sm,
  },

  filtersPanel: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    ...SHADOW.sm,
  },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },

  roomsHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, marginBottom: 6 },
  roomsHeaderText: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  roomCountBadge: { fontSize: 12, fontWeight: '700', color: colors.primary },
  roomCard: {
    backgroundColor: colors.background,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  roomCardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8 },
  roomCardLabel: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  addRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    marginBottom: 4,
  },
  addRoomBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  typeChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  typeChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  typeChipText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
  typeChipTextActive: { color: '#fff' },

  card: {
    flexDirection: 'row',
    backgroundColor: colors.card,
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
  cardName: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  cardCity: { fontSize: 12, color: colors.textSecondary },
  cardPrice: {},
  priceAmt: { fontSize: 14, fontWeight: '700', color: colors.primary },
  priceNight: { fontSize: 11, color: colors.textSecondary },

  emptyWrap: { alignItems: 'center', marginTop: 48, gap: 12 },
  empty: { fontSize: 14, color: colors.textMuted },
  });
}
