import api from './api';
import { getImageUrl } from './properties';

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
  totalAmount: number;
  currency: string;
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

export type CreateBookingPayload = {
  propertyId: number;
  roomId: number;
  numberOfRooms?: number;
  numberOfAdults?: number;
  numberOfChildren?: number;
  checkInDate: string;
  checkOutDate: string;
  paymentMethod?: PaymentMethod;
  /** Required by the API's request-body validation (it checks the body for
   * either userId or full guest details before the request ever reaches the
   * controller — the controller itself only trusts req.userId from the JWT
   * and ignores this value, but validation still needs it present). Pass
   * the signed-in user's own id here. */
  userId: number;
};

export type CheckoutResult =
  | { confirmed: true; bookingReference: string }
  | { confirmed?: false; paymentLink: string; holdExpiresAt: string; bookingReference: string };

const DEFAULT_CURRENCY = 'USD';

/** Extracts a human-readable message from an API error response — the
 * booking endpoints are inconsistent about the key (`message` on most
 * validation/business errors, `error` on a few auth/guest-booking guards). */
export function getErrorMessage(err: any, fallback: string): string {
  return err?.response?.data?.message ?? err?.response?.data?.error ?? fallback;
}

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
    currency: raw.transaction?.currency ?? DEFAULT_CURRENCY,
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
    propertyId: payload.propertyId,
    checkInDate: payload.checkInDate,
    checkOutDate: payload.checkOutDate,
    bookingRooms: [
      {
        roomId: payload.roomId,
        numberOfRooms: payload.numberOfRooms ?? 1,
        numberOfAdults: payload.numberOfAdults ?? 1,
        numberOfChildren: payload.numberOfChildren ?? 0,
      },
    ],
    paymentMethod: payload.paymentMethod ?? 'CASH',
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

// --- HOST ---

export async function getHostBookings(): Promise<Booking[]> {
  const { data } = await api.get('/bookings');
  return (data ?? []).map(normalize);
}
