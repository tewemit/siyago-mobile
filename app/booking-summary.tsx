import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import { useTheme } from '../context/ThemeContext';
import { useCurrency } from '../context/CurrencyContext';
import { RADIUS, SHADOW, type ThemeColors } from '../constants/theme';
import {
  calculatePrice,
  createBooking,
  getBookingByRef,
  getErrorMessage,
  requestGuestBookingOtp,
  verifyGuestBookingOtp,
  resendGuestBookingOtp,
  type PaymentMethod,
  type PriceBreakdown,
} from '../services/bookings';
import {
  formatLocation,
  getAvailablePaymentMethods,
  getPropertyById,
  type Property,
  type PropertyPaymentMethod,
} from '../services/properties';
import { getAvailableRoomTypes, getRoomPriceLines, type AvailableRoomType, type RoomPriceLine } from '../services/rooms';
import DateField, { toISODate, parseISODate } from '../components/DateField';
import Stepper from '../components/Stepper';
import GradientButton from '../components/GradientButton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const OTP_LENGTH = 6;
const RESEND_COOLDOWN_SECONDS = 60;
const PRICE_DEBOUNCE_MS = 400;

type GuestStep = 'form' | 'otp' | 'verified';

/**
 * One physical room the guest is booking, with its own occupancy.
 * ROOM_PRICING_LINES: `pricingLineId` is set when this instance was picked
 * from a specific price line (booking.com-style) rather than the room's flat
 * standardRatePerNight — occupancy/price/inclusions are then fixed by that
 * line, not editable (see the read-only summary render below).
 */
type SelectedRoom = {
  key: string;
  roomTypeId: string;
  adults: number;
  children: number;
  price: number;
  pricingLineId: number | null;
  breakfastIncluded?: boolean;
  shuttleIncluded?: boolean;
  amenityNames?: string[];
};

/** Second step of "+ Add room" — once a room TYPE is picked, show every
 * active price line for that specific room (one row per commercial option,
 * each with its own quantity), rather than immediately adding one flat-rate
 * instance. Mirrors the web booking-summary page's pricingLinePicker. */
type PricingLinePicker = {
  roomTypeId: string;
  roomTypeName: string;
  flatRate: number;
  maxAdults: number;
  maxChildren: number;
  lines: RoomPriceLine[];
  quantities: Record<string, number>;
};

/** One icon per gateway (not per exact method name) — a property can list
 * many differently-named local wallets that all resolve to ETH_SWITCH. */
function paymentMethodIcon(gateway: PropertyPaymentMethod['gateway']): keyof typeof Ionicons.glyphMap {
  switch (gateway) {
    case 'CASH':
      return 'cash-outline';
    case 'ETH_SWITCH':
      return 'phone-portrait-outline';
    case 'STRIPE':
    default:
      return 'card-outline';
  }
}

/** Shape room-selection.tsx serializes into the `bookingRooms` param — one entry per (room type × price line) row the guest picked, not yet expanded into individual instances (mirrors web's initialBookingRooms). */
type InitialBookingRoom = {
  id: string;
  name: string;
  price: number;
  maxAdults: number;
  maxChildren: number;
  count: number;
  pricingLineId: number | null;
  breakfastIncluded?: boolean;
  shuttleIncluded?: boolean;
  amenityNames?: string[];
};

export default function BookingSummaryScreen() {
  const { propertyId, checkInDate, checkOutDate, bookingRooms: bookingRoomsParam } = useLocalSearchParams<{
    propertyId: string;
    /** Present when arriving from room-selection.tsx — pre-fills dates/rooms instead of starting empty. */
    checkInDate?: string;
    checkOutDate?: string;
    bookingRooms?: string;
  }>();
  const router = useRouter();
  const { t } = useI18n();
  const { user, isLoading: authLoading } = useAuth();
  const { region } = useRegion();
  const { colors } = useTheme();
  const { format, convertToEtb } = useCurrency();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [checkIn, setCheckIn] = useState<Date | null>(() => (checkInDate ? parseISODate(checkInDate) : null));
  const [checkOut, setCheckOut] = useState<Date | null>(() => (checkOutDate ? parseISODate(checkOutDate) : null));
  const [availableRoomTypes, setAvailableRoomTypes] = useState<AvailableRoomType[]>([]);
  const [loadingRoomTypes, setLoadingRoomTypes] = useState(false);
  const [selectedRooms, setSelectedRooms] = useState<SelectedRoom[]>(() => {
    if (!bookingRoomsParam) return [];
    try {
      const parsed: InitialBookingRoom[] = JSON.parse(bookingRoomsParam);
      return parsed.flatMap((r) =>
        Array.from({ length: Math.max(1, r.count) }, (_, i) => ({
          key: `${r.id}-seed-${i}`,
          roomTypeId: String(r.id),
          adults: r.maxAdults,
          children: r.maxChildren,
          price: r.price,
          pricingLineId: r.pricingLineId,
          breakfastIncluded: r.breakfastIncluded,
          shuttleIncluded: r.shuttleIncluded,
          amenityNames: r.amenityNames,
        }))
      );
    } catch {
      return [];
    }
  });
  // See the reconcile-against-availability effect below for why this exists.
  const isFirstReconcileRun = useRef(true);
  const [showRoomPicker, setShowRoomPicker] = useState(false);
  const [pricingLinePicker, setPricingLinePicker] = useState<PricingLinePicker | null>(null);
  const [loadingPricingLines, setLoadingPricingLines] = useState(false);
  // ROOM_PRICING_LINES: every active line matching each room instance's
  // CURRENT occupancy, keyed by instance `key` — powers the inline "choose a
  // price option" list per room card. Refreshed on mount (auto-calculate)
  // and whenever that instance's adults/children changes.
  const [roomLineOptions, setRoomLineOptions] = useState<
    Record<string, { lines: RoomPriceLine[]; ratePerNight: number }>
  >({});
  const [priceBreakdown, setPriceBreakdown] = useState<PriceBreakdown | null>(null);
  const [priceLoading, setPriceLoading] = useState(false);
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<string | null>(null);
  const [couponError, setCouponError] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [submitting, setSubmitting] = useState(false);
  const [guestFirstName, setGuestFirstName] = useState('');
  const [guestLastName, setGuestLastName] = useState('');
  const [guestEmail, setGuestEmail] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestCountry, setGuestCountry] = useState('Ethiopia');

  // Prefill from the Region setting (Profile > Settings) once it loads from
  // storage — only while the field still holds its untouched default, so we
  // never clobber something the guest already typed.
  useEffect(() => {
    if (region && guestCountry === 'Ethiopia') setGuestCountry(region);
  }, [region]);
  const [guestStep, setGuestStep] = useState<GuestStep>('form');
  const [guestOtpToken, setGuestOtpToken] = useState<string | null>(null);
  const [guestVerificationToken, setGuestVerificationToken] = useState<string | null>(null);
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [otpSubmitting, setOtpSubmitting] = useState(false);
  const [otpResending, setOtpResending] = useState(false);
  const [otpCooldown, setOtpCooldown] = useState(0);
  const [demoOtp, setDemoOtp] = useState<string | null>(null);
  const otpInputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (otpCooldown <= 0) return;
    const id = setInterval(() => setOtpCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [otpCooldown]);

  useEffect(() => {
    getPropertyById(propertyId)
      .then((p) => setProperty(p))
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [propertyId]);

  const nights = checkIn && checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY) : 0;

  // Fetch the property's real room-type availability for the chosen dates —
  // `maxBookableRooms` per type reflects configured availability minus
  // whatever's already actively booked, unlike the static `property.rooms`.
  useEffect(() => {
    if (!checkIn || !checkOut || nights <= 0) {
      setAvailableRoomTypes([]);
      return;
    }
    let cancelled = false;
    setLoadingRoomTypes(true);
    getAvailableRoomTypes(propertyId, {
      checkInDate: toISODate(checkIn),
      checkOutDate: toISODate(checkOut),
    })
      .then((types) => { if (!cancelled) setAvailableRoomTypes(types); })
      .catch(() => { if (!cancelled) setAvailableRoomTypes([]); })
      .finally(() => { if (!cancelled) setLoadingRoomTypes(false); });
    return () => { cancelled = true; };
  }, [propertyId, checkIn, checkOut, nights]);

  // Reconcile selected rooms against freshly-fetched availability: seed one
  // default room the first time types load, drop rooms whose type vanished
  // or whose quantity now exceeds real availability, and clamp any
  // adults/children that no longer fit the type's capacity.
  //
  // On the very FIRST run, `availableRoomTypes` is still its pristine `[]`
  // initial value regardless of whether we arrived with room-selection.tsx's
  // pre-filled `selectedRooms` — the availability fetch is async and hasn't
  // resolved yet even when dates were pre-filled. Naively treating
  // "still empty" as "fetch came back with nothing" would wipe out those
  // pre-filled rooms before the real fetch ever gets a chance to validate
  // them. `isFirstReconcileRun` skips the destructive clear exactly once
  // when there's pre-filled data to protect; every subsequent run (i.e.
  // once the fetch has actually resolved, empty or not) behaves as before.
  useEffect(() => {
    if (isFirstReconcileRun.current) {
      isFirstReconcileRun.current = false;
      if (selectedRooms.length > 0) return;
    }
    if (!availableRoomTypes.length) {
      setSelectedRooms([]);
      return;
    }
    setSelectedRooms((prev) => {
      if (prev.length === 0) {
        const first = availableRoomTypes[0];
        return [{
          key: `${first.id}-default`,
          roomTypeId: first.id,
          adults: 1,
          children: 0,
          price: first.ratePerNight,
          pricingLineId: null,
        }];
      }
      const perTypeCount = new Map<string, number>();
      const next: SelectedRoom[] = [];
      for (const r of prev) {
        const type = availableRoomTypes.find((t) => t.id === r.roomTypeId);
        if (!type) continue;
        const used = perTypeCount.get(r.roomTypeId) ?? 0;
        if (used >= type.maxBookableRooms) continue;
        perTypeCount.set(r.roomTypeId, used + 1);
        next.push({
          ...r,
          adults: Math.min(Math.max(1, r.adults), Math.max(1, type.maxAdults)),
          children: Math.min(r.children, type.maxChildren),
        });
      }
      return next;
    });
  }, [availableRoomTypes]);

  // Debounced server-authoritative price preview (tax/VAT/promo-aware, and
  // the real occupancy-capacity check) — recomputed whenever the room
  // selection or dates change.
  useEffect(() => {
    if (!checkIn || !checkOut || selectedRooms.length === 0) {
      setPriceBreakdown(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setPriceLoading(true);
      calculatePrice({
        propertyId: Number(propertyId),
        checkInDate: toISODate(checkIn),
        checkOutDate: toISODate(checkOut),
        rooms: selectedRooms.map((r) => ({
          roomId: Number(r.roomTypeId),
          numberOfRooms: 1,
          numberOfAdults: r.adults,
          numberOfChildren: r.children,
          ...(r.pricingLineId != null && { pricingLineId: r.pricingLineId }),
        })),
        // Keep re-applying whatever coupon is already active whenever dates/
        // rooms change (matches web's fetchBreakdown(appliedCoupon) pattern)
        // — the server re-validates it every time regardless.
        couponCode: appliedCoupon || undefined,
      })
        .then((b) => { if (!cancelled) setPriceBreakdown(b); })
        .catch(() => { if (!cancelled) setPriceBreakdown(null); })
        .finally(() => { if (!cancelled) setPriceLoading(false); });
    }, PRICE_DEBOUNCE_MS);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [propertyId, checkIn, checkOut, selectedRooms, appliedCoupon]);

  // Client-side fallback total (rate × nights, no tax) shown only while the
  // server preview above is loading or unreachable, so the total card is
  // never blank.
  const naiveTotal = useMemo(() => {
    if (nights <= 0) return 0;
    // Each instance already carries its own effective per-night rate (either
    // the room type's flat standardRatePerNight or the price line's own
    // price) — using r.price directly, rather than re-deriving from
    // availableRoomTypes, keeps this correct for price-line-tied instances.
    return selectedRooms.reduce((sum, r) => sum + r.price * nights, 0);
  }, [selectedRooms, nights]);
  const displayTotal = priceBreakdown?.grandTotal ?? naiveTotal;

  // Step 1 -> Step 2: guest picked a room TYPE — fetch its full price-line
  // menu (all active lines, any occupancy) and open the quantity-per-line
  // picker instead of immediately adding a flat-rate instance.
  async function openPricingLinePicker(roomTypeId: string) {
    const type = availableRoomTypes.find((t) => t.id === roomTypeId);
    if (!type) return;
    setShowRoomPicker(false);
    setLoadingPricingLines(true);
    try {
      const detail = await getRoomPriceLines(roomTypeId);
      // ETB-equivalent sort, not raw price — mixing currencies would let a
      // small foreign-currency number (e.g. "$6") outrank a genuinely
      // cheaper ETB line otherwise.
      const sortedLines = [...detail.lines].sort(
        (a, b) => convertToEtb(a.price, a.currency) - convertToEtb(b.price, b.currency)
      );
      setPricingLinePicker({
        roomTypeId,
        roomTypeName: type.name,
        flatRate: type.ratePerNight,
        maxAdults: type.maxAdults,
        maxChildren: type.maxChildren,
        lines: sortedLines,
        quantities: {},
      });
    } catch {
      // Pricing lines are a nice-to-have here — fall back to just the flat rate.
      setPricingLinePicker({
        roomTypeId,
        roomTypeName: type.name,
        flatRate: type.ratePerNight,
        maxAdults: type.maxAdults,
        maxChildren: type.maxChildren,
        lines: [],
        quantities: {},
      });
    } finally {
      setLoadingPricingLines(false);
    }
  }

  function setPricingLineQty(rowKey: string, qty: number) {
    setPricingLinePicker((prev) => (prev ? { ...prev, quantities: { ...prev.quantities, [rowKey]: qty } } : prev));
  }

  // Step 2 -> commit: for every row with quantity > 0, push that many
  // physical-room instances, each carrying that row's occupancy/price/
  // pricingLineId — this is what makes "the booking a list of rooms along
  // with their selected price line" (one selectedRooms entry per unit).
  function confirmPricingLineSelections() {
    if (!pricingLinePicker) return;
    const { roomTypeId, flatRate, lines, quantities } = pricingLinePicker;
    const usedCount = selectedRooms.filter((r) => r.roomTypeId === roomTypeId).length;
    const type = availableRoomTypes.find((t) => t.id === roomTypeId);
    const remaining = (type?.maxBookableRooms ?? 0) - usedCount;

    const rows: Array<{ rowKey: string; line: RoomPriceLine | null }> = [
      ...lines.map((line) => ({ rowKey: `line-${line.id}`, line })),
      { rowKey: 'flat', line: null },
    ];
    const totalRequested = rows.reduce((sum, row) => sum + (quantities[row.rowKey] || 0), 0);
    if (totalRequested <= 0) {
      setPricingLinePicker(null);
      return;
    }
    if (totalRequested > remaining) {
      Alert.alert(t.error, t.max_rooms_reached);
      return;
    }

    const newInstances: SelectedRoom[] = [];
    for (const row of rows) {
      const qty = quantities[row.rowKey] || 0;
      for (let i = 0; i < qty; i++) {
        newInstances.push({
          key: `${roomTypeId}-${row.rowKey}-${Date.now()}-${i}`,
          roomTypeId,
          adults: row.line ? row.line.numberOfAdults : 1,
          children: row.line ? row.line.numberOfChildren : 0,
          // Normalized to ETB here (once) — row.line.price is denominated in
          // row.line.currency, but every downstream consumer expects ETB
          // like everywhere else in this app. The real authoritative amount
          // is always recomputed server-side at booking time from
          // pricingLineId alone.
          price: row.line ? convertToEtb(row.line.price, row.line.currency) : flatRate,
          pricingLineId: row.line ? row.line.id : null,
          breakfastIncluded: row.line?.breakfastIncluded ?? false,
          shuttleIncluded: row.line?.shuttleIncluded ?? false,
          amenityNames: row.line?.amenityNames ?? [],
        });
      }
    }

    setSelectedRooms((prev) => [...prev, ...newInstances]);
    // Populate roomLineOptions for the new instances from the lines already
    // fetched for this picker (filtered to each instance's own occupancy) —
    // no extra request needed, so "choose a price option" is available
    // immediately rather than only after the guest first touches a stepper.
    setRoomLineOptions((prev) => {
      const next = { ...prev };
      for (const instance of newInstances) {
        next[instance.key] = {
          lines: lines
            .filter((l) => l.numberOfAdults === instance.adults && l.numberOfChildren === instance.children)
            .sort((a, b) => convertToEtb(a.price, a.currency) - convertToEtb(b.price, b.currency)),
          ratePerNight: flatRate,
        };
      }
      return next;
    });
    setPricingLinePicker(null);
  }

  function removeRoom(key: string) {
    setSelectedRooms((prev) => prev.filter((r) => r.key !== key));
    setRoomLineOptions((prev) => {
      const { [key]: _removed, ...rest } = prev;
      return rest;
    });
  }

  // ROOM_PRICING_LINES: every active price line for a room type that
  // exactly matches the given occupancy (spec §29 — exact match only, no
  // fallback/substitution), cheapest first, plus the flat rate to fall back
  // to when none match. Shared by the mount-time auto-calculation below and
  // by updateRoomGuests whenever the guest edits a room's occupancy.
  async function fetchMatchingPriceLines(roomTypeId: string, occAdults: number, occChildren: number) {
    const detail = await getRoomPriceLines(roomTypeId);
    const lines = detail.lines
      .filter((l) => l.numberOfAdults === occAdults && l.numberOfChildren === occChildren)
      .sort((a, b) => convertToEtb(a.price, a.currency) - convertToEtb(b.price, b.currency));
    return { lines, ratePerNight: detail.ratePerNight };
  }

  // Apply a chosen price line (or null for the flat rate) to a room instance.
  function applyPriceLine(r: SelectedRoom, line: RoomPriceLine | null, ratePerNight: number): SelectedRoom {
    return {
      ...r,
      price: line ? convertToEtb(line.price, line.currency) : ratePerNight,
      pricingLineId: line ? line.id : null,
      breakfastIncluded: line?.breakfastIncluded ?? false,
      shuttleIncluded: line?.shuttleIncluded ?? false,
      amenityNames: line?.amenityNames ?? [],
    };
  }

  // Guest manually picks a different price option for a room instance —
  // same occupancy, different inclusions/price (or the flat "Room only" row,
  // passed as `line: null`).
  function selectRoomPriceLine(key: string, line: RoomPriceLine | null) {
    const options = roomLineOptions[key];
    setSelectedRooms((prev) =>
      prev.map((r) => (r.key === key ? applyPriceLine(r, line, options?.ratePerNight ?? r.price) : r))
    );
  }

  // ROOM_PRICING_LINES: when the guest edits a room instance's occupancy,
  // re-resolve its price the same way the search/room-selection screens do
  // — exact adults/children match against that room's active price lines
  // wins if one exists (cheapest by default), otherwise the flat rate. The
  // backend re-validates independently at booking time regardless, so this
  // is purely a client-side display recalculation.
  async function updateRoomGuests(key: string, field: 'adults' | 'children', value: number) {
    const target = selectedRooms.find((r) => r.key === key);
    if (!target) return;
    const nextAdults = field === 'adults' ? value : target.adults;
    const nextChildren = field === 'children' ? value : target.children;
    setSelectedRooms((prev) => prev.map((r) => (r.key === key ? { ...r, [field]: value } : r)));

    try {
      const { lines, ratePerNight } = await fetchMatchingPriceLines(target.roomTypeId, nextAdults, nextChildren);
      setRoomLineOptions((prev) => ({ ...prev, [key]: { lines, ratePerNight } }));
      setSelectedRooms((prev) =>
        prev.map((r) => (r.key === key ? applyPriceLine(r, lines[0] ?? null, ratePerNight) : r))
      );
    } catch {
      // Keep the rate already on the instance — re-resolution is a
      // nice-to-have display recalculation, not required for booking.
    }
  }

  // Right after mount, resolve every seeded room instance's price against
  // its CURRENT (propagated) occupancy: self-heals any stale carried-over
  // price and populates roomLineOptions so "choose a price option" is
  // available immediately. A previously-selected line is preserved if it's
  // still a valid match for this occupancy; otherwise the cheapest matching
  // line wins (or the flat rate, if none match) — same auto-pick rule
  // occupancy edits use above.
  useEffect(() => {
    let cancelled = false;
    Promise.all(
      selectedRooms.map(async (r) => {
        try {
          const { lines, ratePerNight } = await fetchMatchingPriceLines(r.roomTypeId, r.adults, r.children);
          if (cancelled) return;
          setRoomLineOptions((prev) => ({ ...prev, [r.key]: { lines, ratePerNight } }));
          const preserved = r.pricingLineId != null ? lines.find((l) => l.id === r.pricingLineId) : null;
          const lineToApply = preserved ?? lines[0] ?? null;
          setSelectedRooms((prev) =>
            prev.map((sr) => (sr.key === r.key ? applyPriceLine(sr, lineToApply, ratePerNight) : sr))
          );
        } catch {
          // Leave this instance's carried-over price as-is.
        }
      })
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mirrors web's applyCoupon (booking-summary/page.js) — a coupon code is
  // ETB-only backend logic (COUPON_SCOPE_RBAC_CORRECTION: platform-wide OR
  // scoped to this exact property), re-validated server-side against the
  // current dates/rooms every time. An invalid/expired/wrong-property code
  // comes back as a normal 200 with `couponDiscount: null`, not an error.
  async function applyCoupon() {
    setCouponError('');
    const code = couponInput.trim();
    if (!code || !checkIn || !checkOut || selectedRooms.length === 0) return;
    setPriceLoading(true);
    try {
      const breakdown = await calculatePrice({
        propertyId: Number(propertyId),
        checkInDate: toISODate(checkIn),
        checkOutDate: toISODate(checkOut),
        rooms: selectedRooms.map((r) => ({
          roomId: Number(r.roomTypeId),
          numberOfRooms: 1,
          numberOfAdults: r.adults,
          numberOfChildren: r.children,
          ...(r.pricingLineId != null && { pricingLineId: r.pricingLineId }),
        })),
        couponCode: code,
      });
      if (breakdown.couponDiscount) {
        setAppliedCoupon(code);
        setPriceBreakdown(breakdown);
      } else {
        setCouponError(t.invalid_promo_code);
      }
    } catch {
      setCouponError(t.invalid_promo_code);
    } finally {
      setPriceLoading(false);
    }
  }

  const availablePaymentMethods = useMemo(
    () => (property ? getAvailablePaymentMethods(property) : []),
    [property],
  );

  // Re-point the default selection at whatever this property actually
  // supports once it loads — the initial 'CASH' guess is wrong whenever a
  // property doesn't offer pay-at-property.
  useEffect(() => {
    if (!availablePaymentMethods.length) return;
    if (!availablePaymentMethods.some((m) => m.gateway === paymentMethod)) {
      setPaymentMethod(availablePaymentMethods[0].gateway);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availablePaymentMethods]);

  function validateTripDetails(): boolean {
    if (!checkIn || !checkOut) {
      Alert.alert(t.error, t.booking_fill_dates);
      return false;
    }
    if (nights <= 0) {
      Alert.alert(t.error, t.checkout_after_checkin_required);
      return false;
    }
    if (selectedRooms.length === 0) {
      Alert.alert(t.error, t.please_select_a_room);
      return false;
    }
    return true;
  }

  async function handleBook() {
    if (!validateTripDetails()) return;

    if (!user && (!guestVerificationToken || guestStep !== 'verified')) {
      Alert.alert(t.error, t.guest_otp_intro);
      return;
    }

    setSubmitting(true);
    try {
      const booking = await createBooking({
        ...(user ? { userId: Number(user.id) } : { guestVerificationToken: guestVerificationToken! }),
        propertyId: Number(propertyId),
        bookingRooms: selectedRooms.map((r) => ({
          roomId: Number(r.roomTypeId),
          numberOfRooms: 1,
          numberOfAdults: r.adults,
          numberOfChildren: r.children,
          ...(r.pricingLineId != null && { pricingLineId: r.pricingLineId }),
        })),
        checkInDate: toISODate(checkIn!),
        checkOutDate: toISODate(checkOut!),
        paymentMethod,
        couponCode: appliedCoupon || undefined,
      } as Parameters<typeof createBooking>[0]);

      // CASH bookings come back already CONFIRMED with no paymentLink.
      // STRIPE/ETH_SWITCH come back PENDING with a paymentLink already
      // generated by the create call itself — no separate checkout step
      // needed for a fresh booking.
      if (booking.paymentLink) {
        await WebBrowser.openBrowserAsync(booking.paymentLink);
      }
      const refreshed = booking.paymentLink
        ? await getBookingByRef(booking.reference).catch(() => booking)
        : booking;

      if (!user) {
        Alert.alert(t.confirm_booking, `${t.reference}: ${refreshed.reference}\n\n${t.guest_booking_reference_msg}`, [
          {
            text: t.ok,
            onPress: () => router.replace({ pathname: '/booking-details/[ref]', params: { ref: refreshed.reference } }),
          },
        ]);
      } else {
        router.replace({ pathname: '/booking-details/[ref]', params: { ref: refreshed.reference } });
      }
    } catch (err: any) {
      Alert.alert(t.error, getErrorMessage(err, 'Booking failed'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSendGuestOtp() {
    if (!validateTripDetails()) return;

    const firstName = guestFirstName.trim();
    const lastName = guestLastName.trim();
    const email = guestEmail.trim().toLowerCase();
    const phone = guestPhone.trim();
    const country = guestCountry.trim();
    if (!firstName) {
      Alert.alert(t.error, `${t.first_name}: ${t.required}`);
      return;
    }
    if (!lastName) {
      Alert.alert(t.error, `${t.last_name}: ${t.required}`);
      return;
    }
    if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
      Alert.alert(t.error, t.invalid_email);
      return;
    }
    if (!phone || phone.length < 5) {
      Alert.alert(t.error, t.invalid_phone);
      return;
    }
    if (!country) {
      Alert.alert(t.error, `${t.country}: ${t.required}`);
      return;
    }

    setOtpSubmitting(true);
    try {
      const result = await requestGuestBookingOtp({ firstName, lastName, email, phone, country });
      setGuestOtpToken(result.guestOtpToken);
      setDemoOtp(result.demoOtp ?? null);
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setOtpCooldown(RESEND_COOLDOWN_SECONDS);
      setGuestStep('otp');
      setTimeout(() => otpInputs.current[0]?.focus(), 100);
    } catch (err: any) {
      Alert.alert(t.error, getErrorMessage(err, 'Could not send verification code'));
    } finally {
      setOtpSubmitting(false);
    }
  }

  async function handleVerifyGuestOtp() {
    const code = otpDigits.join('');
    if (code.length < OTP_LENGTH || !guestOtpToken) {
      Alert.alert(t.error, t.otp_incomplete);
      return;
    }
    setOtpSubmitting(true);
    try {
      const result = await verifyGuestBookingOtp(guestOtpToken, code);
      setGuestVerificationToken(result.guestVerificationToken);
      setGuestStep('verified');
    } catch (err: any) {
      Alert.alert(t.error, getErrorMessage(err, 'Invalid or expired verification code'));
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      otpInputs.current[0]?.focus();
    } finally {
      setOtpSubmitting(false);
    }
  }

  async function handleResendGuestOtp() {
    if (!guestOtpToken || otpCooldown > 0 || otpResending) return;
    setOtpResending(true);
    try {
      const result = await resendGuestBookingOtp(guestOtpToken);
      setGuestOtpToken(result.guestOtpToken);
      setDemoOtp(result.demoOtp ?? null);
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setOtpCooldown(RESEND_COOLDOWN_SECONDS);
      otpInputs.current[0]?.focus();
    } catch (err: any) {
      Alert.alert(t.error, getErrorMessage(err, 'Could not resend code'));
    } finally {
      setOtpResending(false);
    }
  }

  function handleOtpChange(text: string, index: number) {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    if (digit && index < OTP_LENGTH - 1) {
      otpInputs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputs.current[index - 1]?.focus();
    }
  }

  function handleEditGuestDetails() {
    setGuestStep('form');
    setGuestOtpToken(null);
    setGuestVerificationToken(null);
    setDemoOtp(null);
    setOtpDigits(Array(OTP_LENGTH).fill(''));
  }

  if (isLoading || authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const primaryAction =
    user || guestStep === 'verified'
      ? { label: submitting ? t.loading : t.confirm_booking, onPress: handleBook, disabled: submitting }
      : guestStep === 'otp'
        ? { label: otpSubmitting ? t.verifying : t.verify, onPress: handleVerifyGuestOtp, disabled: otpSubmitting }
        : { label: otpSubmitting ? t.loading : t.next, onPress: handleSendGuestOtp, disabled: otpSubmitting };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{t.booking_summary}</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          {!user && (
            <TouchableOpacity
              style={styles.signInBanner}
              onPress={() => router.push({ pathname: '/(auth)/sign-in', params: { propertyId } })}
            >
              <Ionicons name="person-circle-outline" size={18} color={colors.primary} />
              <Text style={styles.signInBannerText}>{t.have_account_sign_in}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary} />
            </TouchableOpacity>
          )}

          {property && (
            <View style={styles.propertyCard}>
              <View style={styles.propertyCardInner}>
                <Text style={styles.propName}>{property.name}</Text>
                <View style={styles.propLocRow}>
                  <Ionicons name="location-outline" size={12} color={colors.primary} />
                  <Text style={styles.propLoc}>{formatLocation(property)}</Text>
                </View>
              </View>
              <View style={styles.propPriceCol}>
                <Text style={styles.propPriceAmt}>
                  {format(property.pricePerNight)}
                </Text>
                <Text style={styles.propPriceNight}>{t.per_night}</Text>
              </View>
            </View>
          )}

          <View style={styles.dateRow}>
            <DateField label={t.check_in} icon="log-in-outline" value={checkIn} onChange={setCheckIn} minimumDate={new Date()} />
            <DateField label={t.check_out} icon="log-out-outline" value={checkOut} onChange={setCheckOut} minimumDate={checkIn ?? new Date()} />
          </View>

          <View style={styles.roomSection}>
            <View style={styles.roomSectionHeaderRow}>
              <Text style={styles.sectionLabel}>{t.select_room}</Text>
              {selectedRooms.length > 0 && (
                <Text style={styles.roomCountBadge}>{selectedRooms.length} {t.rooms}</Text>
              )}
            </View>

            {property && !property.rooms?.length ? (
              <Text style={styles.noRoomsText}>{t.no_rooms_available}</Text>
            ) : !checkIn || !checkOut ? (
              <Text style={styles.noRoomsText}>{t.select_dates_first}</Text>
            ) : loadingRoomTypes ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 12 }} />
            ) : availableRoomTypes.length === 0 ? (
              <Text style={styles.noRoomsText}>{t.no_availability_for_dates}</Text>
            ) : (
              <>
                {selectedRooms.map((sr, idx) => {
                  const type = availableRoomTypes.find((rt) => rt.id === sr.roomTypeId);
                  if (!type) return null;
                  const lineOptions = roomLineOptions[sr.key]?.lines ?? [];
                  return (
                    <View key={sr.key} style={styles.selectedRoomCard}>
                      <View style={styles.selectedRoomHeaderRow}>
                        <Text style={styles.roomName}>{t.room} {idx + 1} · {type.name}</Text>
                        <TouchableOpacity onPress={() => removeRoom(sr.key)} hitSlop={8}>
                          <Ionicons name="trash-outline" size={18} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                      <Text style={styles.roomRate}>{format(sr.price)} {t.per_night}</Text>

                      {/* Occupancy — always editable; changing it auto-picks
                          whichever price line matches the new adults/
                          children (or falls back to the flat rate). */}
                      <Stepper
                        label={t.adults}
                        value={sr.adults}
                        onChange={(v) => updateRoomGuests(sr.key, 'adults', v)}
                        min={1}
                        max={type.maxAdults}
                      />
                      <Stepper
                        label={t.children}
                        value={sr.children}
                        onChange={(v) => updateRoomGuests(sr.key, 'children', v)}
                        min={0}
                        max={type.maxChildren}
                      />

                      {/* ROOM_PRICING_LINES: choose among the price options
                          that match this room's CURRENT occupancy — mirrors
                          the "add room" picker. Hidden entirely when the
                          room has no line for this occupancy (flat rate
                          applies as-is). */}
                      {lineOptions.length > 0 && (
                        <View style={{ marginTop: 6, gap: 6 }}>
                          {lineOptions.map((line) => {
                            const included = [
                              line.breakfastIncluded && t.breakfast_included,
                              line.shuttleIncluded && t.shuttle_included,
                              ...line.amenityNames,
                            ].filter((v): v is string => !!v);
                            const isSelected = sr.pricingLineId === line.id;
                            return (
                              <TouchableOpacity
                                key={line.id}
                                style={[styles.priceOptionRow, isSelected && styles.priceOptionRowSelected]}
                                onPress={() => selectRoomPriceLine(sr.key, line)}
                                activeOpacity={0.8}
                              >
                                <Ionicons
                                  name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                                  size={16}
                                  color={isSelected ? colors.primary : colors.textMuted}
                                />
                                <Text style={styles.priceOptionLabel} numberOfLines={1}>
                                  {included.length > 0 ? included.join(' + ') : t.room_only}
                                </Text>
                                <Text style={styles.priceOptionAmount}>
                                  {format(convertToEtb(line.price, line.currency))}
                                </Text>
                              </TouchableOpacity>
                            );
                          })}
                        </View>
                      )}
                    </View>
                  );
                })}

                <TouchableOpacity style={styles.addRoomBtn} onPress={() => setShowRoomPicker(true)} activeOpacity={0.8}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
                  <Text style={styles.addRoomBtnText}>{t.add_room}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {!user && (
            <>
              <Text style={styles.sectionLabel}>{t.continue_as_guest}</Text>

              {guestStep === 'form' && (
                <View style={styles.guestFormCard}>
                  <Text style={styles.guestIntroText}>{t.guest_otp_intro}</Text>
                  <View style={styles.guestNameRow}>
                    <TextInput
                      style={[styles.guestInput, styles.guestInputHalf]}
                      placeholder={t.first_name}
                      placeholderTextColor={colors.textMuted}
                      value={guestFirstName}
                      onChangeText={setGuestFirstName}
                      autoCapitalize="words"
                    />
                    <TextInput
                      style={[styles.guestInput, styles.guestInputHalf]}
                      placeholder={t.last_name}
                      placeholderTextColor={colors.textMuted}
                      value={guestLastName}
                      onChangeText={setGuestLastName}
                      autoCapitalize="words"
                    />
                  </View>
                  <TextInput
                    style={styles.guestInput}
                    placeholder={t.email}
                    placeholderTextColor={colors.textMuted}
                    value={guestEmail}
                    onChangeText={setGuestEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                  <TextInput
                    style={styles.guestInput}
                    placeholder={t.phone_number}
                    placeholderTextColor={colors.textMuted}
                    value={guestPhone}
                    onChangeText={setGuestPhone}
                    keyboardType="phone-pad"
                  />
                  <TextInput
                    style={[styles.guestInput, { marginBottom: 0 }]}
                    placeholder={t.country}
                    placeholderTextColor={colors.textMuted}
                    value={guestCountry}
                    onChangeText={setGuestCountry}
                    autoCapitalize="words"
                  />
                </View>
              )}

              {guestStep === 'otp' && (
                <View style={styles.guestFormCard}>
                  <Text style={styles.guestIntroText}>
                    {t.otp_sent_to}{'\n'}
                    <Text style={styles.emailText}>{guestEmail.trim().toLowerCase()}</Text>
                  </Text>

                  {__DEV__ && demoOtp && (
                    <Text style={styles.demoOtpText}>Demo OTP: {demoOtp}</Text>
                  )}

                  <View style={styles.otpRow}>
                    {otpDigits.map((d, i) => (
                      <TextInput
                        key={i}
                        ref={(el) => { otpInputs.current[i] = el; }}
                        style={[styles.otpCell, d ? styles.otpCellFilled : null]}
                        value={d}
                        onChangeText={(text) => handleOtpChange(text, i)}
                        onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                        keyboardType="number-pad"
                        maxLength={1}
                        selectTextOnFocus
                      />
                    ))}
                  </View>

                  <View style={styles.otpFooterRow}>
                    <TouchableOpacity onPress={handleEditGuestDetails}>
                      <Text style={styles.guestLinkText}>{t.edit_details}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleResendGuestOtp} disabled={otpCooldown > 0 || otpResending}>
                      <Text style={[styles.guestLinkText, (otpCooldown > 0 || otpResending) && styles.guestLinkTextDisabled]}>
                        {otpCooldown > 0 ? `${t.resend_in} ${otpCooldown}s` : t.resend_code}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              {guestStep === 'verified' && (
                <View style={[styles.guestFormCard, styles.guestVerifiedCard]}>
                  <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                  <Text style={styles.guestVerifiedText}>
                    {t.verified_as} {guestEmail.trim().toLowerCase()}
                  </Text>
                  <TouchableOpacity onPress={handleEditGuestDetails}>
                    <Text style={styles.guestLinkText}>{t.edit_details}</Text>
                  </TouchableOpacity>
                </View>
              )}
            </>
          )}

          <Text style={styles.sectionLabel}>{t.choose_payment_method}</Text>
          {availablePaymentMethods.map((method) => {
            const selected = method.gateway === paymentMethod;
            return (
              <TouchableOpacity
                key={method.name}
                style={[styles.paymentOption, selected && styles.paymentOptionSelected]}
                onPress={() => setPaymentMethod(method.gateway)}
                activeOpacity={0.85}
              >
                <View style={styles.paymentIconWrap}>
                  <Ionicons name={paymentMethodIcon(method.gateway)} size={20} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.paymentTitle}>{method.name}</Text>
                  <Text style={styles.paymentSub}>
                    {method.gateway === 'CASH' ? t.pay_at_property_sub : t.pay_with_card_sub}
                  </Text>
                </View>
                <Ionicons
                  name={selected ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={selected ? colors.primary : colors.textMuted}
                />
              </TouchableOpacity>
            );
          })}

          {nights > 0 && selectedRooms.length > 0 && (
            <View style={styles.couponCard}>
              <Text style={styles.sectionLabel}>{t.promo_code}</Text>
              <View style={styles.couponRow}>
                <TextInput
                  style={styles.couponInput}
                  placeholder={t.enter_promo_code}
                  placeholderTextColor={colors.textMuted}
                  value={couponInput}
                  onChangeText={(v) => { setCouponInput(v); setCouponError(''); }}
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[styles.couponApplyBtn, (priceLoading || !couponInput.trim()) && styles.couponApplyBtnDisabled]}
                  onPress={applyCoupon}
                  disabled={priceLoading || !couponInput.trim()}
                >
                  <Text style={styles.couponApplyBtnText}>{priceLoading ? t.loading : t.apply}</Text>
                </TouchableOpacity>
              </View>
              {couponError ? <Text style={styles.couponErrorText}>{couponError}</Text> : null}
              {appliedCoupon ? (
                <Text style={styles.couponAppliedText}>
                  {t.promo_applied.replace('{code}', appliedCoupon)}
                </Text>
              ) : null}
            </View>
          )}

          {nights > 0 && selectedRooms.length > 0 && property && (
            <View style={styles.totalCard}>
              {priceBreakdown ? (
                priceBreakdown.rooms.map((line, i) => (
                  <View key={i} style={styles.totalRow}>
                    <Text style={styles.totalLabel}>
                      {line.roomType} · {nights} {t.nights} × {format(line.effectiveRatePerNight)}
                    </Text>
                    <Text style={styles.totalValue}>{format(line.lineTotal)}</Text>
                  </View>
                ))
              ) : (
                selectedRooms.map((r) => {
                  const type = availableRoomTypes.find((rt) => rt.id === r.roomTypeId);
                  if (!type) return null;
                  return (
                    <View key={r.key} style={styles.totalRow}>
                      <Text style={styles.totalLabel}>
                        {type.name} · {nights} {t.nights} × {format(r.price)}
                      </Text>
                      <Text style={styles.totalValue}>{format(r.price * nights)}</Text>
                    </View>
                  );
                })
              )}
              {priceBreakdown?.couponDiscount && (
                <View style={styles.totalRow}>
                  <Text style={styles.couponDiscountLabel}>
                    {t.promo} {priceBreakdown.couponDiscount.code} (−{priceBreakdown.couponDiscount.percent.toFixed(0)}%)
                  </Text>
                  <Text style={styles.couponDiscountValue}>− {format(priceBreakdown.couponDiscount.amount)}</Text>
                </View>
              )}
              {priceBreakdown?.taxEnabled && priceBreakdown.totalTax > 0 && (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>{t.taxes_and_fees}</Text>
                  <Text style={styles.totalValue}>{format(priceBreakdown.totalTax)}</Text>
                </View>
              )}
              <View style={[styles.totalRow, { marginTop: 8 }]}>
                <Text style={styles.totalLabelBold}>{t.total}</Text>
                {priceLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={styles.totalValueBold}>{format(displayTotal)}</Text>
                )}
              </View>
            </View>
          )}

          <Modal
            visible={showRoomPicker}
            transparent
            animationType="slide"
            onRequestClose={() => setShowRoomPicker(false)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                <Text style={styles.modalTitle}>{t.select_room}</Text>
                <ScrollView style={{ maxHeight: 420 }}>
                  {availableRoomTypes.map((rt) => {
                    const used = selectedRooms.filter((r) => r.roomTypeId === rt.id).length;
                    const remaining = rt.maxBookableRooms - used;
                    const soldOut = remaining <= 0;
                    return (
                      <TouchableOpacity
                        key={rt.id}
                        style={[styles.roomTypeOption, soldOut && styles.roomTypeOptionDisabled]}
                        onPress={() => !soldOut && openPricingLinePicker(rt.id)}
                        disabled={soldOut}
                        activeOpacity={0.8}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={styles.roomName}>{rt.name}</Text>
                          <Text style={styles.roomCapacity}>{rt.maxAdults + rt.maxChildren} {t.guests}</Text>
                          <Text style={soldOut ? styles.soldOutText : styles.roomsLeftText}>
                            {soldOut ? t.sold_out : `${remaining} ${t.rooms_remaining}`}
                          </Text>
                        </View>
                        <Text style={styles.roomRate}>{format(rt.ratePerNight)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
                <TouchableOpacity style={styles.modalCloseBtn} onPress={() => setShowRoomPicker(false)}>
                  <Text style={styles.modalCloseBtnText}>{t.close}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>

          {/* Price-line picker — booking.com style: for the chosen room
              type, show every active price line as its own row with a
              quantity selector, plus a flat-rate "Room only" fallback. */}
          <Modal
            visible={!!pricingLinePicker || loadingPricingLines}
            transparent
            animationType="slide"
            onRequestClose={() => setPricingLinePicker(null)}
          >
            <View style={styles.modalOverlay}>
              <View style={styles.modalSheet}>
                {loadingPricingLines || !pricingLinePicker ? (
                  <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
                ) : (
                  <>
                    <Text style={styles.modalTitle}>{pricingLinePicker.roomTypeName}</Text>
                    <Text style={styles.modalSubtitle}>{t.select_price_option}</Text>
                    <ScrollView style={{ maxHeight: 380 }}>
                      {pricingLinePicker.lines.map((line) => {
                        const rowKey = `line-${line.id}`;
                        const included = [
                          line.breakfastIncluded && t.breakfast_included,
                          line.shuttleIncluded && t.shuttle_included,
                          ...line.amenityNames,
                        ].filter((v): v is string => !!v);
                        const qty = pricingLinePicker.quantities[rowKey] ?? 0;
                        return (
                          <View key={rowKey} style={styles.priceLineRow}>
                            <View style={styles.priceLineRowTop}>
                              <View style={{ flex: 1 }}>
                                <Text style={styles.roomCapacity}>
                                  {line.numberOfAdults} {t.adults}
                                  {line.numberOfChildren > 0 ? `, ${line.numberOfChildren} ${t.children}` : ''}
                                </Text>
                                {included.map((label) => (
                                  <Text key={label} style={styles.pricingLineIncludedText}>✓ {label}</Text>
                                ))}
                              </View>
                              <Text style={styles.roomRate}>{format(convertToEtb(line.price, line.currency))}</Text>
                            </View>
                            <Stepper
                              label={t.rooms}
                              value={qty}
                              onChange={(v) => setPricingLineQty(rowKey, v)}
                              min={0}
                              max={6}
                            />
                          </View>
                        );
                      })}

                      {/* Flat-rate fallback — always available, matches legacy behavior. */}
                      <View style={styles.priceLineRow}>
                        <View style={styles.priceLineRowTop}>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.roomName}>{t.room_only}</Text>
                            <Text style={styles.roomCapacity}>
                              {pricingLinePicker.maxAdults} {t.adults}, {pricingLinePicker.maxChildren} {t.children}
                            </Text>
                          </View>
                          <Text style={styles.roomRate}>{format(pricingLinePicker.flatRate)}</Text>
                        </View>
                        <Stepper
                          label={t.rooms}
                          value={pricingLinePicker.quantities.flat ?? 0}
                          onChange={(v) => setPricingLineQty('flat', v)}
                          min={0}
                          max={6}
                        />
                      </View>
                    </ScrollView>

                    <View style={styles.pricingLinePickerFooterRow}>
                      <TouchableOpacity
                        style={[styles.modalCloseBtn, { flex: 1 }]}
                        onPress={() => setPricingLinePicker(null)}
                      >
                        <Text style={styles.modalCloseBtnText}>{t.close}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.modalCloseBtn, styles.pricingLinePickerAddBtn]}
                        onPress={confirmPricingLineSelections}
                      >
                        <Text style={styles.pricingLinePickerAddBtnText}>{t.add_room}</Text>
                      </TouchableOpacity>
                    </View>
                  </>
                )}
              </View>
            </View>
          </Modal>

          <GradientButton
            label={primaryAction.label}
            onPress={primaryAction.onPress}
            disabled={primaryAction.disabled}
            style={styles.btnWrap}
          />
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

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
  topTitle: { fontWeight: '700', fontSize: 17, color: colors.textPrimary },

  body: { padding: 20, gap: 4 },

  propertyCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    padding: 16,
    marginBottom: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...SHADOW.sm,
  },
  propertyCardInner: { flex: 1, marginRight: 12 },
  propName: { fontWeight: '700', fontSize: 15, color: colors.textPrimary, marginBottom: 4 },
  propLocRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  propLoc: { color: colors.textSecondary, fontSize: 12 },
  propPriceCol: { alignItems: 'flex-end' },
  propPriceAmt: { fontWeight: '800', fontSize: 15, color: colors.primary },
  propPriceNight: { fontSize: 11, color: colors.textSecondary },

  roomSection: { marginBottom: 16 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  roomSectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  roomCountBadge: { fontSize: 12, fontWeight: '700', color: colors.primary },
  roomName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  roomCapacity: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  roomRate: { fontSize: 13, fontWeight: '700', color: colors.primary, marginBottom: 4 },
  noRoomsText: { color: colors.textSecondary, fontSize: 13, marginBottom: 16 },

  selectedRoomCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  selectedRoomHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },

  addRoomBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: RADIUS.lg,
    paddingVertical: 12,
    marginBottom: 4,
  },
  addRoomBtnText: { fontSize: 13, fontWeight: '700', color: colors.primary },

  roomTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  roomTypeOptionDisabled: { opacity: 0.5 },
  soldOutText: { fontSize: 11, fontWeight: '700', color: colors.error, marginTop: 2 },
  roomsLeftText: { fontSize: 11, color: colors.success, marginTop: 2 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 20,
    paddingBottom: 36,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: colors.textPrimary, marginBottom: 12 },
  modalCloseBtn: {
    backgroundColor: colors.primaryLight,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  modalCloseBtnText: { color: colors.primary, fontWeight: '700', fontSize: 15 },
  modalSubtitle: { fontSize: 12, color: colors.textSecondary, marginBottom: 12 },

  pricingLineSummaryText: { fontSize: 12, color: colors.textSecondary, marginBottom: 2 },
  pricingLineIncludedText: { fontSize: 11, color: colors.success, marginTop: 2 },

  priceOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  priceOptionRowSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  priceOptionLabel: { flex: 1, fontSize: 12, color: colors.textPrimary },
  priceOptionAmount: { fontSize: 12, fontWeight: '700', color: colors.textPrimary },

  priceLineRow: {
    backgroundColor: colors.background,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 10,
  },
  priceLineRowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6, gap: 8 },

  pricingLinePickerFooterRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  pricingLinePickerAddBtn: { backgroundColor: colors.primary },
  pricingLinePickerAddBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },

  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },

  signInBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.primaryLight,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  signInBannerText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.primary },

  guestFormCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 20,
    ...SHADOW.sm,
  },
  guestInput: {
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
    marginBottom: 10,
  },
  guestIntroText: { fontSize: 12, color: colors.textSecondary, lineHeight: 18, marginBottom: 12 },
  guestNameRow: { flexDirection: 'row', gap: 10 },
  guestInputHalf: { flex: 1 },
  emailText: { fontWeight: '700', color: colors.primary },
  demoOtpText: { fontSize: 12, fontWeight: '700', color: colors.accent, marginBottom: 10 },

  otpRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 16 },
  otpCell: {
    width: 42,
    height: 50,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.background,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  otpCellFilled: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  otpFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  guestLinkText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  guestLinkTextDisabled: { color: colors.textMuted },

  guestVerifiedCard: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  guestVerifiedText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.textPrimary },

  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 14,
    marginBottom: 10,
  },
  paymentOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  paymentIconWrap: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentTitle: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  paymentSub: { fontSize: 11, color: colors.textSecondary },

  totalCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 16,
    marginTop: 8,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 12, color: colors.textSecondary },
  totalValue: { fontSize: 12, color: colors.textSecondary },
  totalLabelBold: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  totalValueBold: { fontSize: 16, fontWeight: '800', color: colors.primary },
  couponDiscountLabel: { fontSize: 12, color: colors.success },
  couponDiscountValue: { fontSize: 12, color: colors.success, fontWeight: '700' },

  couponCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 4,
    marginTop: 4,
    ...SHADOW.sm,
  },
  couponRow: { flexDirection: 'row', gap: 10 },
  couponInput: {
    flex: 1,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: colors.textPrimary,
  },
  couponApplyBtn: {
    backgroundColor: colors.primary,
    borderRadius: RADIUS.md,
    paddingHorizontal: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  couponApplyBtnDisabled: { opacity: 0.5 },
  couponApplyBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  couponErrorText: { color: colors.error, fontSize: 12, marginTop: 6 },
  couponAppliedText: { color: colors.success, fontSize: 12, marginTop: 6, fontWeight: '600' },

  btnWrap: { marginTop: 12 },
  });
}
