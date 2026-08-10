import api from './api';
import { normalizeProperty, type Property } from './properties';

export async function toggleFavorite(propertyId: string): Promise<{ favorited: boolean }> {
  const { data } = await api.post(`/favorites/toggle/${propertyId}`);
  return data;
}

export async function getFavoriteStatus(propertyId: string): Promise<boolean> {
  const { data } = await api.get(`/favorites/status/${propertyId}`);
  return !!data?.favorited;
}

export async function getBulkFavoriteStatus(
  propertyIds: string[],
): Promise<Record<string, boolean>> {
  if (!propertyIds.length) return {};
  const { data } = await api.post('/favorites/bulk-status', {
    propertyIds: propertyIds.map(Number),
  });
  return data ?? {};
}

/** GET /favorites returns a bare array of flattened Property objects
 * (each with an extra `favoritedAt`) — not wrapped in a `{property}` key. */
export async function getFavorites(): Promise<Property[]> {
  const { data } = await api.get<any[]>('/favorites');
  return (data ?? []).map(normalizeProperty);
}
