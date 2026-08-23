import api, { getErrorMessage } from './api';
import { getImageUrl } from './properties';

// Re-exported for existing call sites — the helper itself now lives in
// api.ts since it's generic, not booking-specific (also used by the
// notifications screen for the same PUT /users/me error shape).
export { getErrorMessage };

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT';

export type Booking = {
  id: string;
  propertyId: string;
  roomId?: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  /** ETB-denominated — display via useCurrency()'s format()/convert(). */
  totalAmount: number;
  status: BookingStatus;
  reference: string;
  property?: {
    name: string;
    city: string;
    thumbnail?: string;
  };
};

/** Extra fields present only on the POST /bookings create response. */
export type CreateBookingResult = Booking & {
  /** Present when paymentMethod is STRIPE/ETH_SWITCH; absent (undefined) for CASH. */
  paymentLink?: string;
  holdExpiresAt?: string | null;
};

export type PaymentMethod = 'STRIPE' | 'CASH' | 'ETH_SWITCH';

/** One physical room being booked, with who's staying in it. */
export type BookingRoomLine = {
  roomId: number;
  numberOfRooms: number;
  numberOfAdults: number;
  numberOfChildren: number;
  /**
   * A guest-selected RoomPriceOption id (ROOM_PRICING_LINES_EXECUTION.md) —
   * re-validated server-side, never trusted for price. Omit for a flat-rate
   * (standardRatePerNight) room instance.
   */
  pricingLineId?: number;
};

type CreateBookingCommon = {
  propertyId: number;
  bookingRooms: BookingRoomLine[];
  checkInDate: string;
  checkOutDate: string;
  paymentMethod?: PaymentMethod;
  /** Re-validated server-side against this exact booking — see calculatePrice's couponCode doc. */
  couponCode?: string;
};

/**
 * Unauthenticated bookings require a `guestVerificationToken` proving the
 * caller owns the email/phone they entered — see `requestGuestBookingOtp`/
 * `verifyGuestBookingOtp` below. The API's `addBooking` controller ignores
 * any body `userId` for unauthenticated callers and, once a verification
 * token is present, resolves the booking's owner from the token itself —
 * raw `guestName`/`guestEmail`/`guestPhone`/`country` fields (accepted by
 * the zod schema for staff-entered `/bookings/reception` bookings) are not
 * a valid path for `POST /bookings` from an unauthenticated caller.
 */
export type CreateBookingPayload = CreateBookingCommon &
  (
    | { userId: number; guestVerificationToken?: undefined }
    | { userId?: undefined; guestVerificationToken: string }
  );

export type CheckoutResult =
  | { confirmed: true; bookingReference: string }
  | { confirmed?: false; paymentLink: string; holdExpiresAt: string; bookingReference: string };

/** Maps the API's raw booking DTO (checkInDate/checkOutDate/totalPrice/nested property+rooms) to the shape the UI consumes. */
function normalize(raw: any): Booking {
  const bookingRooms = Array.isArray(raw.bookingRooms) ? raw.bookingRooms : [];
  // Use the booking-room's own submitted guest counts (numberOfAdults/
  // numberOfChildren on BookingRoom) rather than the room's max capacity —
  // the latter isn't even selected on the /bookings/my and /bookings list
  // endpoints, and represents capacity, not who's actually staying.
  const guests = bookingRooms.reduce((sum: number, br: any) => {
    const partySize = (br.numberOfAdults ?? 0) + (br.numberOfChildren ?? 0);
    return sum + partySize * (br.numberOfRooms ?? 1);
  }, 0);

  return {
    id: String(raw.id),
    propertyId: String(raw.property?.id ?? raw.propertyId ?? ''),
    roomId: bookingRooms[0]?.room?.id ? String(bookingRooms[0].room.id) : undefined,
    checkIn: raw.checkInDate ?? '',
    checkOut: raw.checkOutDate ?? '',
    guests: guests || 1,
    totalAmount: raw.totalPrice ?? 0,
    status: raw.status,
    reference: raw.reference,
    property: raw.property
      ? {
          name: raw.property.name,
          city: raw.property.city?.name ?? '',
          thumbnail: getImageUrl(raw.property.mainImage),
        }
      : undefined,
  };
}

export async function getMyBookings(): Promise<Booking[]> {
  const { data } = await api.get('/bookings/my');
  return (data ?? []).map(normalize);
}

export async function getBookingByRef(ref: string): Promise<Booking> {
  const { data } = await api.get(`/bookings/by-reference/${ref}`);
  return normalize(data);
}

/**
 * Synchronously asks ETH-Switch what actually happened for a PENDING
 * booking's payment, instead of waiting on the slow 5-minute background
 * poll job — ETH-Switch's own returnUrl always lands on the web app (it's a
 * fixed backend config value, not something the client controls), so unlike
 * Stripe there's no session id this app can verify on its own. This mirrors
 * what the web app calls the moment a guest lands back on booking-details.
 * 404s for bookings that aren't ETH-Switch or have already left PENDING —
 * safe to call opportunistically and ignore failures.
 */
export async function verifyEthSwitchPayment(
  reference: string,
): Promise<{ bookingReference: string; bookingStatus: string; paymentStatus: string }> {
  const { data } = await api.put(`/bookings/ets/verify/${reference}`);
  return data;
}

export type PriceBreakdownRoomLine = {
  roomId: number;
  roomType: string;
  quantity: number;
  numberOfAdults: number;
  numberOfChildren: number;
  /** ETB-denominated. */
  effectiveRatePerNight: number;
  /** ETB-denominated — this line's total across all its nights/units. */
  lineTotal: number;
};

/** A successfully-applied coupon's effect on this specific price preview — null when no couponCode was supplied or it didn't match. */
export type CouponDiscount = {
  code: string;
  percent: number;
  /** ETB-denominated. */
  amount: number;
};

export type PriceBreakdown = {
  nights: number;
  rooms: PriceBreakdownRoomLine[];
  subtotal: number;
  couponDiscount: CouponDiscount | null;
  taxEnabled: boolean;
  totalTax: number;
  /** ETB-denominated — the authoritative total to charge the guest. */
  grandTotal: number;
};

/**
 * Server-authoritative price preview — POST /bookings/calculate-price.
 * Public, no auth required. Re-runs the same discount/tax/occupancy-capacity
 * logic `POST /bookings` uses to actually create the booking, so this is the
 * only accurate way to show a multi-room total (VAT/service charge/promos
 * aren't reproducible client-side) and it throws a descriptive 422 if any
 * line's numberOfAdults/numberOfChildren exceeds that room's capacity.
 */
export async function calculatePrice(params: {
  propertyId: number;
  checkInDate: string;
  checkOutDate: string;
  rooms: BookingRoomLine[];
  /**
   * A platform-wide OR property-scoped promo code (COUPON_SCOPE_RBAC_CORRECTION)
   * — re-validated server-side (active/not-expired/scope-matches-this-property)
   * every time; an invalid/expired/wrong-property code simply comes back with
   * `couponDiscount: null` rather than an error.
   */
  couponCode?: string;
}): Promise<PriceBreakdown> {
  const { data } = await api.post('/bookings/calculate-price', params);
  return data;
}

/**
 * Creates a booking. The response's `status` depends entirely on
 * `paymentMethod`: CASH bookings come back already CONFIRMED (no
 * `paymentLink`); STRIPE/ETH_SWITCH bookings come back PENDING with a
 * `paymentLink` already generated — there's no need to separately call
 * `createCheckout` right after creating a booking, only when re-generating
 * a link for an existing PENDING booking later (see `createCheckout`).
 */
export async function createBooking(
  payload: CreateBookingPayload,
): Promise<CreateBookingResult> {
  const { data } = await api.post('/bookings', {
    userId: payload.userId,
    guestVerificationToken: payload.guestVerificationToken,
    propertyId: payload.propertyId,
    checkInDate: payload.checkInDate,
    checkOutDate: payload.checkOutDate,
    bookingRooms: payload.bookingRooms,
    paymentMethod: payload.paymentMethod ?? 'CASH',
    couponCode: payload.couponCode,
  });
  return {
    ...normalize(data),
    paymentLink: data?.paymentLink,
    holdExpiresAt: data?.holdExpiresAt ?? null,
  };
}

export async function cancelBooking(id: string): Promise<void> {
  await api.patch(`/bookings/${id}/cancel`);
}

/**
 * Re-generates (or switches the method for) a payment link on an EXISTING
 * booking. Only valid while the booking is still PENDING with an unexpired
 * hold — the API returns 422 otherwise. This is the "Complete payment"
 * retry path from My Trips, not part of the initial booking flow (fresh
 * bookings already get their paymentLink back from `createBooking`).
 */
export async function createCheckout(
  bookingId: string,
  payload?: { paymentMethod?: PaymentMethod },
): Promise<CheckoutResult> {
  const { data } = await api.post(`/bookings/${bookingId}/checkout`, payload ?? {});
  return data;
}

// --- GUEST CHECKOUT VERIFICATION (OTP) ---
//
// Two-step identity check for anonymous bookings, matching/creating a
// "guest" account by email or phone: request an OTP, then verify it to
// receive the `guestVerificationToken` that `createBooking` requires. The
// account is created unactivated (no password) — the guest can later use
// "forgot password" with the same email to claim and log into it.

export type GuestOtpRequestPayload = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  country: string;
};

export type GuestOtpRequestResult = {
  requiresOtp: true;
  guestOtpToken: string;
  isNewAccount: boolean;
  message: string;
  /** Only present for whitelisted demo accounts (local/staging testing). */
  demoOtp?: string;
};

export type GuestOtpVerifyResult = {
  verified: true;
  guestVerificationToken: string;
  firstName: string;
  lastName: string;
  email: string;
};

export async function requestGuestBookingOtp(
  payload: GuestOtpRequestPayload,
): Promise<GuestOtpRequestResult> {
  const { data } = await api.post('/bookings/guest/request-otp', payload);
  return data;
}

export async function verifyGuestBookingOtp(
  guestOtpToken: string,
  otp: string,
): Promise<GuestOtpVerifyResult> {
  const { data } = await api.post('/bookings/guest/verify-otp', { guestOtpToken, otp });
  return data;
}

export async function resendGuestBookingOtp(guestOtpToken: string): Promise<GuestOtpRequestResult> {
  const { data } = await api.post('/bookings/guest/resend-otp', { guestOtpToken });
  return data;
}

// --- HOST ---

export async function getHostBookings(): Promise<Booking[]> {
  const { data } = await api.get('/bookings');
  return (data ?? []).map(normalize);
}
