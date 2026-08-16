import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { useRegion } from '../context/RegionContext';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SHADOW, type ThemeColors } from '../constants/theme';
import {
  createBooking,
  getBookingByRef,
  getErrorMessage,
  requestGuestBookingOtp,
  verifyGuestBookingOtp,
  resendGuestBookingOtp,
  type PaymentMethod,
} from '../services/bookings';
import {
  formatLocation,
  getAvailablePaymentMethods,
  getPropertyById,
  type Property,
  type PropertyPaymentMethod,
} from '../services/properties';
import DateField, { toISODate } from '../components/DateField';
import Stepper from '../components/Stepper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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

type GuestStep = 'form' | 'otp' | 'verified';

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

export default function BookingSummaryScreen() {
  const { propertyId } = useLocalSearchParams<{ propertyId: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { user, isLoading: authLoading } = useAuth();
  const { region } = useRegion();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [checkIn, setCheckIn] = useState<Date | null>(null);
  const [checkOut, setCheckOut] = useState<Date | null>(null);
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
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
      .then((p) => {
        setProperty(p);
        if (p.rooms?.length) setSelectedRoomId(p.rooms[0].id);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [propertyId]);

  const selectedRoom = property?.rooms?.find((r) => r.id === selectedRoomId) ?? null;
  const nights = checkIn && checkOut ? Math.round((checkOut.getTime() - checkIn.getTime()) / MS_PER_DAY) : 0;
  const total = useMemo(
    () => (selectedRoom && nights > 0 ? selectedRoom.ratePerNight * nights : 0),
    [selectedRoom, nights],
  );
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
    if (!selectedRoomId || !selectedRoom) {
      Alert.alert(t.error, t.no_rooms_available);
      return false;
    }
    if (adults > selectedRoom.maxAdults || children > selectedRoom.maxChildren) {
      Alert.alert(t.error, t.guests_exceed_capacity);
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
        roomId: Number(selectedRoomId),
        numberOfAdults: adults,
        numberOfChildren: children,
        checkInDate: toISODate(checkIn!),
        checkOutDate: toISODate(checkOut!),
        paymentMethod,
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
                  {property.currency} {property.pricePerNight.toLocaleString()}
                </Text>
                <Text style={styles.propPriceNight}>{t.per_night}</Text>
              </View>
            </View>
          )}

          {property && property.rooms && property.rooms.length > 0 ? (
            <View style={styles.roomSection}>
              <Text style={styles.sectionLabel}>{t.select_room}</Text>
              {property.rooms.map((room) => {
                const selected = room.id === selectedRoomId;
                return (
                  <TouchableOpacity
                    key={room.id}
                    style={[styles.roomOption, selected && styles.roomOptionSelected]}
                    onPress={() => setSelectedRoomId(room.id)}
                    activeOpacity={0.8}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.roomName}>{room.name}</Text>
                      <Text style={styles.roomCapacity}>
                        {room.maxAdults + room.maxChildren} {t.guests}
                      </Text>
                    </View>
                    <Text style={styles.roomRate}>
                      {property.currency} {room.ratePerNight.toLocaleString()}
                    </Text>
                    <Ionicons
                      name={selected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={selected ? colors.primary : colors.textMuted}
                      style={{ marginLeft: 10 }}
                    />
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : property ? (
            <Text style={styles.noRoomsText}>{t.no_rooms_available}</Text>
          ) : null}

          <View style={styles.dateRow}>
            <DateField label={t.check_in} icon="log-in-outline" value={checkIn} onChange={setCheckIn} minimumDate={new Date()} />
            <DateField label={t.check_out} icon="log-out-outline" value={checkOut} onChange={setCheckOut} minimumDate={checkIn ?? new Date()} />
          </View>

          <View style={styles.guestsCard}>
            <Stepper label={t.adults} value={adults} onChange={setAdults} min={1} max={selectedRoom?.maxAdults ?? 10} />
            <Stepper label={t.children} value={children} onChange={setChildren} min={0} max={selectedRoom?.maxChildren ?? 10} />
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

          {nights > 0 && selectedRoom && property && (
            <View style={styles.totalCard}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>{nights} {t.nights} × {property.currency} {selectedRoom.ratePerNight.toLocaleString()}</Text>
                <Text style={styles.totalValue}>{property.currency} {total.toLocaleString()}</Text>
              </View>
              <View style={[styles.totalRow, { marginTop: 8 }]}>
                <Text style={styles.totalLabelBold}>{t.total}</Text>
                <Text style={styles.totalValueBold}>{property.currency} {total.toLocaleString()}</Text>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={[styles.btn, primaryAction.disabled && styles.btnDisabled]}
            onPress={primaryAction.onPress}
            disabled={primaryAction.disabled}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>{primaryAction.label}</Text>
          </TouchableOpacity>
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
  roomOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 8,
  },
  roomOptionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  roomName: { fontSize: 14, fontWeight: '600', color: colors.textPrimary },
  roomCapacity: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
  roomRate: { fontSize: 13, fontWeight: '700', color: colors.primary },
  noRoomsText: { color: colors.textSecondary, fontSize: 13, marginBottom: 16 },

  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },

  guestsCard: {
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 14,
    marginBottom: 20,
    ...SHADOW.sm,
  },

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

  btn: {
    backgroundColor: colors.primary,
    height: 54,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    ...SHADOW.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  });
}
