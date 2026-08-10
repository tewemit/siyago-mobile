import api from './api';

export type MasterOption = { id: number; name: string };

/** Property type lookup (hotel/homestay/apartment/etc — DB-driven, not a fixed enum). */
export async function getPropertyTypes(): Promise<MasterOption[]> {
  const { data } = await api.get<MasterOption[]>('/master/property-types');
  return data ?? [];
}

export async function getAmenities(): Promise<MasterOption[]> {
  const { data } = await api.get<MasterOption[]>('/master/amenities');
  return data ?? [];
}

export async function getFacilities(): Promise<MasterOption[]> {
  const { data } = await api.get<MasterOption[]>('/master/facilities');
  return data ?? [];
}
