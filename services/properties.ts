import api from './api';
import { API_HOST } from '../constants/config';

export type RoomOption = {
  id: string;
  name: string;
  /** ETB-denominated — display via useCurrency()'s format()/convert(). */
  ratePerNight: number;
  maxAdults: number;
  maxChildren: number;
};

/**
 * A payment method the property owner has enabled, resolved to the gateway
 * enum `POST /bookings` actually accepts (`paymentType.gateway` is the
 * admin-set source of truth server-side — the display `name` is informational
 * only and must never be sent to the API in its place).
 */
export type PropertyPaymentMethod = {
  name: string;
  logo?: string;
  gateway: 'STRIPE' | 'CASH' | 'ETH_SWITCH';
};

export type Property = {
  id: string;
  name: string;
  description?: string;
  city: string;
  country: string;
  address?: string;
  thumbnail?: string;
  pricePerNight: number;
  rating?: number;
  reviewCount?: number;
  typeName?: string;
  starRating?: string;
  facilities?: string[];
  rooms?: RoomOption[];
  paymentTypes?: PropertyPaymentMethod[];
  /** Extra gallery photos beyond the main thumbnail — only present on the `getPropertyById` response. */
  images?: string[];
};

export type BrowseParams = {
  city?: string;
  limit?: number;
};

export type AdvancedSearchParams = {
  city?: string;
  propertyName?: string;
  checkInDate: string;
  checkOutDate: string;
  adults?: number;
  children?: number;
  numberOfRooms?: number;
  priceRange?: { min: number; max?: number };
  typeIds?: number[];
  facilities?: number[];
  amenities?: number[];
};

/** Builds a full image URL from the relative filename stored by the API. */
export function getImageUrl(mainImage?: string | null): string | undefined {
  if (!mainImage) return undefined;
  return `${API_HOST}/uploads/properties/main-images/${mainImage}`;
}

/** Extra gallery photos are stored under a different path than the main image. */
function getGalleryImageUrl(image?: string | null): string | undefined {
  if (!image) return undefined;
  return `${API_HOST}/uploads/properties/images/${image}`;
}

/**
 * Joins city/country into a display string, omitting whichever part is
 * missing. The search endpoints (GET/POST /properties/search) don't return
 * `city` at all, so callers should always go through this rather than
 * hardcoding "{city}, {country}" (which renders a dangling ", " when blank).
 */
export function formatLocation(p: { city?: string; country?: string }): string {
  return [p.city, p.country].filter(Boolean).join(', ');
}

export type PropertyBadge = { label: string; tone: 'accent' | 'primary' | 'success' };

/**
 * Derives a single display badge from data we already have (rating,
 * starRating) rather than an unverified `badges`/`isPremium` field — keeps
 * this honest about what the API actually confirmed returning.
 */
export function getPropertyBadge(
  p: Property,
  opts?: { featured?: boolean; rank?: number },
): PropertyBadge | null {
  if (opts?.featured && opts.rank === 0) return { label: 'Staff Pick', tone: 'accent' };
  if (p.starRating === 'FIVE_STAR') return { label: 'Luxury', tone: 'primary' };
  if (p.rating != null && p.rating >= 4.7) return { label: 'Top Rated', tone: 'success' };
  if (opts?.featured) return { label: 'Featured', tone: 'accent' };
  return null;
}

/**
 * Normalizes the various raw shapes returned by different property endpoints
 * (search, premium, public detail, host list) into one client-safe shape.
 * Safe to call on any raw property object even when `rooms`/`city` are
 * missing or shaped differently — every field falls back gracefully.
 */
export function normalizeProperty(raw: any): Property {
  const rooms = Array.isArray(raw.rooms) ? raw.rooms : [];
  const minRate =
    raw.minRatePerNight ??
    (rooms.length ? Math.min(...rooms.map((r: any) => r.standardRatePerNight)) : 0);

  return {
    id: String(raw.id),
    name: raw.name,
    description: raw.description ?? undefined,
    city: raw.city?.name ?? '',
    country: raw.country ?? '',
    address: raw.street ?? raw.address ?? '',
    thumbnail: getImageUrl(raw.mainImage),
    // ETB-denominated — display it via useCurrency()'s format()/convert(),
    // never render this raw number with a hardcoded currency label.
    pricePerNight: minRate ?? 0,
    rating: raw.rating ?? undefined,
    reviewCount: raw.reviewCount ?? undefined,
    typeName: raw.type?.name ?? undefined,
    starRating: raw.starRating ?? undefined,
    facilities: Array.isArray(raw.facilities)
      ? raw.facilities.map((f: any) => f.facility?.name).filter(Boolean)
      : undefined,
    rooms: rooms.length && rooms[0]?.id != null
      ? rooms.map((r: any) => ({
          id: String(r.id),
          name: r.roomType?.name ?? 'Room',
          ratePerNight: r.standardRatePerNight,
          maxAdults: r.numberOfAdults ?? 0,
          maxChildren: r.numberOfChildren ?? 0,
        }))
      : undefined,
    paymentTypes: Array.isArray(raw.paymentTypes)
      ? raw.paymentTypes
          .map((pt: any) => pt.paymentType)
          .filter((pt: any) => pt?.name && pt?.gateway)
          .map((pt: any) => ({ name: pt.name, logo: pt.logo ?? undefined, gateway: pt.gateway }))
      : undefined,
    images: Array.isArray(raw.images)
      ? raw.images.map((im: any) => getGalleryImageUrl(im.image)).filter(Boolean)
      : undefined,
  };
}

/** Generic fallback shown only when a property hasn't configured any payment methods yet. */
const FALLBACK_PAYMENT_METHODS: PropertyPaymentMethod[] = [
  { name: 'Pay at property', gateway: 'CASH' },
  { name: 'Global credit and debit cards', gateway: 'STRIPE' },
];

/**
 * Payment methods available for a given property, sourced from the property's
 * own configured `paymentTypes` (each carries an admin-set gateway — see
 * `PropertyPaymentMethod`). Falls back to a generic Cash/Card pair when the
 * property hasn't configured any yet, mirroring the web app's booking flow.
 */
export function getAvailablePaymentMethods(property: Property): PropertyPaymentMethod[] {
  return property.paymentTypes?.length ? property.paymentTypes : FALLBACK_PAYMENT_METHODS;
}

/**
 * City/keyword browse — GET /properties/search?city=&limit=
 * Public endpoint. Passing no city returns the highest-rated active properties.
 */
export async function browseProperties(
  params: BrowseParams,
): Promise<{ data: Property[]; total: number }> {
  const { data } = await api.get<any[]>('/properties/search', {
    params: { city: params.city, limit: params.limit ?? 20 },
  });
  const list = (data ?? []).map(normalizeProperty);
  return { data: list, total: list.length };
}

/**
 * Full-filter search — POST /properties/search. Requires check-in/check-out
 * dates. Powers the Search tab's date/guest/type/amenity filtering.
 * Note: unlike the GET browse endpoint, results from this endpoint do NOT
 * include a `city` field (the API's select omits it) — `normalizeProperty`
 * will leave `city` as an empty string for these results.
 */
export async function searchPropertiesAdvanced(
  params: AdvancedSearchParams,
): Promise<{ data: Property[]; total: number }> {
  const { data } = await api.post<any[]>('/properties/search', {
    city: params.city || undefined,
    propertyName: params.propertyName || undefined,
    checkInDate: params.checkInDate,
    checkOutDate: params.checkOutDate,
    adults: params.adults ?? 1,
    children: params.children ?? 0,
    numberOfRooms: params.numberOfRooms ?? 1,
    priceRange: params.priceRange,
    typeIds: params.typeIds?.length ? params.typeIds : undefined,
    facilities: params.facilities?.length ? params.facilities : undefined,
    amenities: params.amenities?.length ? params.amenities : undefined,
  });
  const list = (Array.isArray(data) ? data : (data as any)?.data ?? []).map(normalizeProperty);
  return { data: list, total: list.length };
}

/** Home screen "Featured" strip — public premium listing endpoint. */
export async function getFeaturedProperties(): Promise<Property[]> {
  const { data } = await api.get<any[]>('/properties/premium');
  return (data ?? []).map(normalizeProperty);
}

/** Home screen "Near Location" grid — falls back to the general browse endpoint. */
export async function getNearbyProperties(limit = 12): Promise<Property[]> {
  const res = await browseProperties({ limit });
  return res.data;
}

/**
 * Guest-safe property detail (no auth required).
 * Merges in the property's rooms to compute a starting price per night.
 */
export async function getPropertyById(id: string): Promise<Property> {
  const [{ data: raw }, roomsRes] = await Promise.all([
    api.get(`/public/properties/${id}`),
    api.get(`/rooms/byproperty/${id}`).catch(() => ({ data: [] })),
  ]);
  const rooms = roomsRes.data ?? [];
  const minRate = rooms.length
    ? Math.min(...rooms.map((r: any) => r.standardRatePerNight))
    : 0;
  return normalizeProperty({ ...raw, minRatePerNight: minRate, rooms });
}

/**
 * Host's own property list — GET /properties. Note this endpoint does NOT
 * include rooms, so `pricePerNight` normalizes to 0 (rendered as "—" by
 * callers) rather than being fetched per-property.
 */
export async function getHostProperties(): Promise<Property[]> {
  const { data } = await api.get<any[]>('/properties');
  return (data ?? []).map(normalizeProperty);
}
