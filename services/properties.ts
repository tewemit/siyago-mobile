import api from './api';
import { API_HOST } from '../constants/config';

export type RoomOption = {
  id: string;
  name: string;
  ratePerNight: number;
  maxAdults: number;
  maxChildren: number;
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
  currency: string;
  rating?: number;
  reviewCount?: number;
  typeName?: string;
  rooms?: RoomOption[];
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

const DEFAULT_CURRENCY = 'USD';

/** Builds a full image URL from the relative filename stored by the API. */
export function getImageUrl(mainImage?: string | null): string | undefined {
  if (!mainImage) return undefined;
  return `${API_HOST}/uploads/properties/main-images/${mainImage}`;
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
    pricePerNight: minRate ?? 0,
    currency: DEFAULT_CURRENCY,
    rating: raw.rating ?? undefined,
    reviewCount: raw.reviewCount ?? undefined,
    typeName: raw.type?.name ?? undefined,
    rooms: rooms.length && rooms[0]?.id != null
      ? rooms.map((r: any) => ({
          id: String(r.id),
          name: r.roomType?.name ?? 'Room',
          ratePerNight: r.standardRatePerNight,
          maxAdults: r.numberOfAdults ?? 0,
          maxChildren: r.numberOfChildren ?? 0,
        }))
      : undefined,
  };
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
