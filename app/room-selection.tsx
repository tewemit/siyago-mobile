import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { useCurrency } from '../context/CurrencyContext';
import { RADIUS, SHADOW, type ThemeColors } from '../constants/theme';
import { formatLocation, getPropertyById, type Property } from '../services/properties';
import {
  getAvailableRoomTypes,
  getRoomPriceLines,
  type AvailableRoomType,
  type RoomPriceLine,
} from '../services/rooms';
import DateField, { toISODate, parseISODate } from '../components/DateField';
import Stepper from '../components/Stepper';
import GradientButton from '../components/GradientButton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MS_PER_DAY = 1000 * 60 * 60 * 24;

/**
 * "Browse rooms" step — sits between property/[id].tsx's "Book Now" and
 * booking-summary.tsx. Mirrors what web's RoomList.jsx offers (room type,
 * occupancy, amenities, per-price-line pricing, before checkout) but as its
 * own dedicated mobile screen rather than crammed into a modal — the
 * quantity-per-price-line picker already built into booking-summary.tsx
 * stays there too (still useful for "add one more room" after this initial
 * browse), this screen is purely about letting a guest compare options
 * before committing to anything.
 *
 * One row per (room type × price line) — quantity 0 means "not selected".
 * A flat-rate "Room only" row is always included alongside whatever price
 * lines a room type has, exactly like booking-summary's picker.
 */
type RowSelection = {
  roomTypeId: string;
  rowKey: string;
  quantity: number;
  name: string;
  adults: number;
  children: number;
  price: number;
  pricingLineId: number | null;
  breakfastIncluded: boolean;
  shuttleIncluded: boolean;
  amenityNames: string[];
};

export default function RoomSelectionScreen() {
  const { propertyId, checkInDate, checkOutDate, adults: adultsParam, children: childrenParam } = useLocalSearchParams<{
    propertyId: string;
    checkInDate?: string;
    checkOutDate?: string;
    /** Carried forward from search.tsx when the guest already picked a party size there. */
    adults?: string;
    children?: string;
  }>();
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const { format, convertToEtb } = useCurrency();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [property, setProperty] = useState<Property | null>(null);
  const [checkIn, setCheckIn] = useState<Date | null>(() =>
    checkInDate ? parseISODate(checkInDate) : new Date()
  );
  const [checkOut, setCheckOut] = useState<Date | null>(() => {
    if (checkOutDate) return parseISODate(checkOutDate);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
  // Party size for this whole browsing session — narrows which room TYPES
  // show (the backend only returns types whose own capacity fits), separate
  // from the per-price-line occupancy chosen once a specific room/line is
  // picked below.
  const [adults, setAdults] = useState(() => Math.max(1, Number(adultsParam) || 1));
  const [children, setChildren] = useState(() => Math.max(0, Number(childrenParam) || 0));
  const [roomTypes, setRoomTypes] = useState<AvailableRoomType[]>([]);
  const [priceLinesByRoom, setPriceLinesByRoom] = useState<Record<string, RoomPriceLine[]>>({});
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [expandedRoomId, setExpandedRoomId] = useState<string | null>(null);
  const [selections, setSelections] = useState<Record<string, RowSelection>>({});

  useEffect(() => {
    getPropertyById(propertyId).then(setProperty).catch(() => {});
  }, [propertyId]);

  const nights = checkIn && checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY) : 0;

  // Fetch room types for the chosen dates, then each type's full price-line
  // menu in parallel (a property realistically has a handful of room types,
  // so N+1 here is a non-issue and keeps every card's options ready to
  // expand instantly rather than spinner-per-tap).
  useEffect(() => {
    if (!checkIn || !checkOut || nights <= 0) {
      setRoomTypes([]);
      setPriceLinesByRoom({});
      return;
    }
    let cancelled = false;
    setLoadingRooms(true);
    getAvailableRoomTypes(propertyId, { checkInDate: toISODate(checkIn), checkOutDate: toISODate(checkOut), adults, children })
      .then(async (types) => {
        if (cancelled) return;
        setRoomTypes(types);
        const entries = await Promise.all(
          types.map(async (rt) => {
            try {
              const detail = await getRoomPriceLines(rt.id);
              // ETB-equivalent sort, not raw price — mixing currencies would
              // let a small foreign-currency number (e.g. "$6") outrank a
              // genuinely cheaper ETB line otherwise.
              const sorted = [...detail.lines].sort(
                (a, b) => convertToEtb(a.price, a.currency) - convertToEtb(b.price, b.currency)
              );
              return [rt.id, sorted] as const;
            } catch {
              return [rt.id, []] as const;
            }
          })
        );
        if (!cancelled) setPriceLinesByRoom(Object.fromEntries(entries));
      })
      .catch(() => { if (!cancelled) { setRoomTypes([]); setPriceLinesByRoom({}); } })
      .finally(() => { if (!cancelled) setLoadingRooms(false); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId, checkIn?.getTime(), checkOut?.getTime(), adults, children]);

  // Dates or party size changed after the guest had already picked rows —
  // those picks no longer correspond to real availability/pricing (the room
  // list itself may have changed), so start the selection over rather than
  // silently keep stale rows.
  useEffect(() => {
    setSelections({});
  }, [checkIn?.getTime(), checkOut?.getTime(), adults, children]);

  function rowsFor(roomType: AvailableRoomType): Array<{ rowKey: string; line: RoomPriceLine | null }> {
    const lines = priceLinesByRoom[roomType.id] ?? [];
    return [...lines.map((line) => ({ rowKey: `line-${line.id}`, line })), { rowKey: 'flat', line: null }];
  }

  function selectedCountFor(roomTypeId: string): number {
    return Object.values(selections)
      .filter((s) => s.roomTypeId === roomTypeId)
      .reduce((sum, s) => sum + s.quantity, 0);
  }

  function setRowQuantity(roomType: AvailableRoomType, rowKey: string, line: RoomPriceLine | null, quantity: number) {
    const key = `${roomType.id}-${rowKey}`;
    const otherRowsUsed = selectedCountFor(roomType.id) - (selections[key]?.quantity ?? 0);
    const clamped = Math.max(0, Math.min(quantity, roomType.maxBookableRooms - otherRowsUsed));
    setSelections((prev) => {
      const next = { ...prev };
      if (clamped <= 0) {
        delete next[key];
        return next;
      }
      next[key] = {
        roomTypeId: roomType.id,
        rowKey,
        quantity: clamped,
        name: roomType.name,
        adults: line ? line.numberOfAdults : 1,
        children: line ? line.numberOfChildren : 0,
        // Normalized to ETB here (once) — line.price is denominated in
        // line.currency, but every downstream consumer (running total,
        // booking-summary's pre-fill) expects ETB like everywhere else in
        // this app. The real authoritative amount is always recomputed
        // server-side at booking time from pricingLineId alone.
        price: line ? convertToEtb(line.price, line.currency) : roomType.ratePerNight,
        pricingLineId: line ? line.id : null,
        breakfastIncluded: line?.breakfastIncluded ?? false,
        shuttleIncluded: line?.shuttleIncluded ?? false,
        amenityNames: line?.amenityNames ?? [],
      };
      return next;
    });
  }

  const totalRoomsSelected = Object.values(selections).reduce((sum, s) => sum + s.quantity, 0);
  const totalPrice = useMemo(
    () => Object.values(selections).reduce((sum, s) => sum + s.price * s.quantity, 0) * Math.max(1, nights),
    [selections, nights]
  );

  function handleContinue() {
    if (!checkIn || !checkOut || totalRoomsSelected === 0) return;
    const bookingRooms = Object.values(selections).map((s) => ({
      id: s.roomTypeId,
      name: s.name,
      price: s.price,
      maxAdults: s.adults,
      maxChildren: s.children,
      count: s.quantity,
      pricingLineId: s.pricingLineId,
      breakfastIncluded: s.breakfastIncluded,
      shuttleIncluded: s.shuttleIncluded,
      amenityNames: s.amenityNames,
    }));
    router.push({
      pathname: '/booking-summary',
      params: {
        propertyId,
        checkInDate: toISODate(checkIn),
        checkOutDate: toISODate(checkOut),
        bookingRooms: JSON.stringify(bookingRooms),
      },
    });
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle} numberOfLines={1}>{property?.name ?? t.choose_your_room}</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        {property && (
          <View style={styles.propLocRow}>
            <Ionicons name="location-outline" size={12} color={colors.primary} />
            <Text style={styles.propLoc}>{formatLocation(property)}</Text>
          </View>
        )}

        <View style={styles.dateRow}>
          <DateField label={t.check_in} icon="log-in-outline" value={checkIn} onChange={setCheckIn} minimumDate={new Date()} />
          <DateField label={t.check_out} icon="log-out-outline" value={checkOut} onChange={setCheckOut} minimumDate={checkIn ?? new Date()} />
        </View>

        <View style={styles.guestsCard}>
          <Stepper label={t.adults} value={adults} onChange={setAdults} min={1} />
          <Stepper label={t.children} value={children} onChange={setChildren} min={0} />
        </View>

        {loadingRooms ? (
          <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
        ) : roomTypes.length === 0 ? (
          <Text style={styles.emptyText}>{t.no_rooms_for_property}</Text>
        ) : (
          roomTypes.map((rt) => {
            const expanded = expandedRoomId === rt.id;
            const cheapestPrice = Math.min(
              rt.ratePerNight,
              ...(priceLinesByRoom[rt.id] ?? []).map((l) => convertToEtb(l.price, l.currency))
            );
            const selectedCount = selectedCountFor(rt.id);
            const soldOut = rt.maxBookableRooms <= 0;

            return (
              <View key={rt.id} style={styles.roomCard}>
                {rt.imageUrl ? (
                  <Image source={{ uri: rt.imageUrl }} style={styles.roomImage} />
                ) : (
                  <View style={[styles.roomImage, styles.roomImagePlaceholder]}>
                    <Ionicons name="bed-outline" size={28} color={colors.textMuted} />
                  </View>
                )}

                <View style={styles.roomCardBody}>
                  <Text style={styles.roomName}>{rt.name}</Text>
                  <Text style={styles.roomSleeps}>
                    {t.sleeps} {rt.maxAdults + rt.maxChildren}
                  </Text>
                  {rt.description ? (
                    <Text style={styles.roomDesc} numberOfLines={2}>{rt.description}</Text>
                  ) : null}

                  {rt.amenityNames.length > 0 && (
                    <View style={styles.amenityChipsRow}>
                      {rt.amenityNames.slice(0, 4).map((name) => (
                        <View key={name} style={styles.amenityChip}>
                          <Text style={styles.amenityChipText} numberOfLines={1}>{name}</Text>
                        </View>
                      ))}
                      {rt.amenityNames.length > 4 && (
                        <View style={styles.amenityChip}>
                          <Text style={styles.amenityChipText}>+{rt.amenityNames.length - 4}</Text>
                        </View>
                      )}
                    </View>
                  )}

                  <View style={styles.roomPriceRow}>
                    <View>
                      <Text style={styles.fromLabel}>{t.from}</Text>
                      <Text style={styles.fromPrice}>{format(cheapestPrice)}</Text>
                      <Text style={styles.perNightLabel}>{t.per_night}</Text>
                    </View>
                    {soldOut ? (
                      <Text style={styles.soldOutText}>{t.sold_out}</Text>
                    ) : (
                      <TouchableOpacity
                        style={styles.seeOptionsBtn}
                        onPress={() => setExpandedRoomId(expanded ? null : rt.id)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.seeOptionsBtnText}>
                          {selectedCount > 0
                            ? `${selectedCount} ${t.rooms}`
                            : `${t.see_options} (${rowsFor(rt).length})`}
                        </Text>
                        <Ionicons
                          name={expanded ? 'chevron-up' : 'chevron-down'}
                          size={14}
                          color={colors.primary}
                        />
                      </TouchableOpacity>
                    )}
                  </View>

                  {expanded && (
                    <View style={styles.priceLineList}>
                      {rowsFor(rt).map(({ rowKey, line }) => {
                        const key = `${rt.id}-${rowKey}`;
                        const qty = selections[key]?.quantity ?? 0;
                        const included = line
                          ? [
                              line.breakfastIncluded && t.breakfast_included,
                              line.shuttleIncluded && t.shuttle_included,
                              ...line.amenityNames,
                            ].filter((v): v is string => !!v)
                          : [];
                        return (
                          <View key={rowKey} style={styles.priceLineRow}>
                            <View style={styles.priceLineRowTop}>
                              <View style={{ flex: 1 }}>
                                {!line && <Text style={styles.roomName}>{t.room_only}</Text>}
                                <Text style={styles.roomCapacity}>
                                  {line ? line.numberOfAdults : rt.maxAdults} {t.adults}
                                  {(line ? line.numberOfChildren : rt.maxChildren) > 0
                                    ? `, ${line ? line.numberOfChildren : rt.maxChildren} ${t.children}`
                                    : ''}
                                </Text>
                                {included.map((label) => (
                                  <Text key={label} style={styles.includedText}>✓ {label}</Text>
                                ))}
                              </View>
                              <Text style={styles.roomRate}>
                                {format(line ? convertToEtb(line.price, line.currency) : rt.ratePerNight)}
                              </Text>
                            </View>
                            <Stepper
                              label={t.rooms}
                              value={qty}
                              onChange={(v) => setRowQuantity(rt, rowKey, line, v)}
                              min={0}
                              max={rt.maxBookableRooms}
                            />
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {totalRoomsSelected > 0 && (
        <View style={styles.footer}>
          <View>
            <Text style={styles.footerCount}>
              {totalRoomsSelected} {t.rooms} · {nights} {t.nights}
            </Text>
            <Text style={styles.footerTotal}>{format(totalPrice)}</Text>
          </View>
          <GradientButton label={t.continue} onPress={handleContinue} size="compact" />
        </View>
      )}
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
      backgroundColor: colors.card,
      borderBottomWidth: 1,
      borderColor: colors.border,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: RADIUS.full,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    topTitle: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 16, color: colors.textPrimary, marginHorizontal: 8 },

    body: { padding: 20, paddingBottom: 100 },

    propLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
    propLoc: { color: colors.textSecondary, fontSize: 12 },

    dateRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },

    guestsCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      padding: 14,
      marginBottom: 20,
      gap: 8,
      ...SHADOW.sm,
    },

    emptyText: { color: colors.textSecondary, fontSize: 13, textAlign: 'center', marginTop: 30 },

    roomCard: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
      marginBottom: 16,
      ...SHADOW.sm,
    },
    roomImage: { width: '100%', height: 160 },
    roomImagePlaceholder: { backgroundColor: colors.backgroundAlt, justifyContent: 'center', alignItems: 'center' },
    roomCardBody: { padding: 14 },

    roomName: { fontSize: 15, fontWeight: '700', color: colors.textPrimary },
    roomSleeps: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    roomDesc: { fontSize: 12, color: colors.textSecondary, marginTop: 6, lineHeight: 17 },
    roomCapacity: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    roomRate: { fontSize: 13, fontWeight: '700', color: colors.primary },

    amenityChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
    amenityChip: {
      backgroundColor: colors.backgroundAlt,
      borderRadius: RADIUS.full,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    amenityChipText: { fontSize: 11, color: colors.textSecondary, fontWeight: '600' },

    roomPriceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-end',
      marginTop: 14,
      paddingTop: 12,
      borderTopWidth: 1,
      borderColor: colors.border,
    },
    fromLabel: { fontSize: 10, color: colors.textMuted },
    fromPrice: { fontSize: 17, fontWeight: '800', color: colors.textPrimary },
    perNightLabel: { fontSize: 10, color: colors.textSecondary },
    soldOutText: { fontSize: 12, fontWeight: '700', color: colors.error },

    seeOptionsBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primaryLight,
      borderRadius: RADIUS.full,
      paddingHorizontal: 14,
      paddingVertical: 9,
    },
    seeOptionsBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },

    priceLineList: { marginTop: 12, gap: 10 },
    priceLineRow: {
      backgroundColor: colors.background,
      borderRadius: RADIUS.md,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
    },
    priceLineRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },
    includedText: { fontSize: 11, color: colors.success, marginTop: 2 },

    footer: {
      position: 'absolute',
      bottom: 0,
      left: 0,
      right: 0,
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingVertical: 14,
      backgroundColor: colors.card,
      borderTopWidth: 1,
      borderColor: colors.border,
      ...SHADOW.dark,
    },
    footerCount: { fontSize: 11, color: colors.textSecondary },
    footerTotal: { fontSize: 18, fontWeight: '800', color: colors.primary },
  });
}
