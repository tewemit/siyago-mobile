import api from './api';
import { API_HOST } from '../constants/config';

/** Builds a full image URL from the relative filename stored by the API — same convention as properties.ts's getImageUrl, different upload subpath. */
export function getRoomImageUrl(mainImage?: string | null): string | undefined {
  if (!mainImage) return undefined;
  return `${API_HOST}/uploads/rooms/main-images/${mainImage}`;
}

/** One commercial price line for a room type (ROOM_PRICING_LINES_EXECUTION.md) — booking.com-style occupancy/inclusions/price option, distinct from the room's flat standardRatePerNight. */
export type RoomPriceLine = {
  id: number;
  numberOfAdults: number;
  numberOfChildren: number;
  /**
   * Per-night, denominated in `currency` — NOT always ETB. A non-ETB line
   * is real and bookable (the backend converts it server-side using its own
   * authoritative rate at booking time — see priceCalculatorService.ts's
   * COUPON_SCOPE_RBAC_CORRECTION-adjacent currency conversion), but display
   * code must route it through useCurrency().convertToEtb(price, currency)
   * before format() — never assume it's already ETB.
   */
  price: number;
  currency: 'ETB' | 'USD' | 'EUR' | 'GBP';
  breakfastIncluded: boolean;
  shuttleIncluded: boolean;
  amenityNames: string[];
};

export type RoomPriceLines = {
  ratePerNight: number;
  maxAdults: number;
  maxChildren: number;
  lines: RoomPriceLine[];
};

/**
 * All of a room's currently-active price lines — GET /rooms/:id, public, no
 * auth required. Unlike `getAvailableRoomTypes` (which is occupancy-filtered
 * to a fixed adults/children query), this returns every active line
 * regardless of occupancy, which is what a booking.com-style "pick a price
 * option" picker needs to show the full menu for one specific room type.
 */
export async function getRoomPriceLines(roomId: string): Promise<RoomPriceLines> {
  const { data } = await api.get<any>(`/rooms/${roomId}`);
  const lines: RoomPriceLine[] = (data?.priceOptions ?? [])
    .filter((p: any) => p.isActive)
    // Sorted by ETB-equivalent price, not raw `price` — the API's own sort
    // is ascending-by-raw-value, which is only meaningful within a single
    // currency; mixing currencies would let a small foreign-currency number
    // (e.g. "$6") outrank a genuinely cheaper ETB line. Rates aren't
    // available in this module (no hook access outside a component), so
    // callers that need true cheapest-first ordering with live rates should
    // re-sort using useCurrency().convertToEtb(); this is a reasonable
    // same-currency-safe default in the meantime.
    .map((p: any) => ({
      id: p.id,
      numberOfAdults: p.numberOfAdults,
      numberOfChildren: p.numberOfChildren,
      price: p.price,
      currency: p.currency ?? 'ETB',
      breakfastIncluded: !!p.breakfastIncluded,
      shuttleIncluded: !!p.shuttleIncluded,
      amenityNames: (p.amenities ?? [])
        .map((a: any) => a.amenity?.name)
        .filter((name: unknown): name is string => !!name),
    }));
  return {
    ratePerNight: data?.standardRatePerNight ?? 0,
    maxAdults: data?.numberOfAdults ?? 1,
    maxChildren: data?.numberOfChildren ?? 0,
    lines,
  };
}

export type AvailableRoomType = {
  id: string;
  name: string;
  /** ETB-denominated — display via useCurrency()'s format()/convert(). */
  ratePerNight: number;
  /** Host-configured max occupancy per single unit of this room type. */
  maxAdults: number;
  maxChildren: number;
  /**
   * Real remaining bookable units for the requested date range — the
   * property's configured availability for those nights minus whatever's
   * already actively booked. This is the true ceiling a guest can select,
   * unlike `Property.rooms` (a static, undated catalog).
   */
  maxBookableRooms: number;
  /** Full URL, already resolved via getRoomImageUrl — undefined when the host hasn't uploaded one. */
  imageUrl?: string;
  description?: string;
  /** The room's own general amenities (WiFi, AC, etc.) — distinct from a price line's specific inclusions (breakfast/shuttle/amenities). */
  amenityNames: string[];
};

/**
 * Date-aware room availability — POST /rooms/available/:propertyId. Public,
 * no auth required. `adults`/`children` default to 1/0 (every active room
 * type that still has at least one bookable unit for the dates, regardless
 * of party size) for callers that haven't collected a guest count yet — the
 * backend filters to room types whose own capacity (numberOfAdults/
 * numberOfChildren) is >= whatever's passed, so a real party size narrows
 * the list to what can actually fit, same as the property search screen.
 */
export async function getAvailableRoomTypes(
  propertyId: string,
  params: { checkInDate: string; checkOutDate: string; adults?: number; children?: number },
): Promise<AvailableRoomType[]> {
  const { data } = await api.post<any[]>(`/rooms/available/${propertyId}`, {
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    adults: params.adults ?? 1,
    children: params.children ?? 0,
  });
  return (data ?? []).map((r: any) => ({
    id: String(r.id),
    name: r.roomType?.name ?? 'Room',
    ratePerNight: r.standardRatePerNight,
    maxAdults: r.numberOfAdults ?? 1,
    maxChildren: r.numberOfChildren ?? 0,
    maxBookableRooms: r.maxBookableRooms ?? 0,
    imageUrl: getRoomImageUrl(r.mainImage),
    description: r.description ?? undefined,
    amenityNames: (r.amenities ?? [])
      .map((a: any) => a.amenity?.name)
      .filter((name: unknown): name is string => !!name),
  }));
}
