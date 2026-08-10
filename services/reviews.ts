import api from './api';

export type Review = {
  id: string;
  rating: number;
  comment?: string;
  cleanliness?: number;
  location?: number;
  value?: number;
  staff?: number;
  facilities?: number;
  authorName: string;
  createdAt: string;
  propertyReply?: string;
};

export type ReviewEligibility = {
  canReview: boolean;
  reason: 'no_booking' | 'already_reviewed' | null;
};

export type SubmitReviewPayload = {
  propertyId: string;
  bookingId?: string;
  rating: number;
  comment?: string;
  cleanliness?: number;
  location?: number;
  value?: number;
  staff?: number;
  facilities?: number;
};

function normalize(raw: any): Review {
  return {
    id: String(raw.id),
    rating: raw.rating,
    comment: raw.comment ?? undefined,
    cleanliness: raw.cleanliness ?? undefined,
    location: raw.location ?? undefined,
    value: raw.value ?? undefined,
    staff: raw.staff ?? undefined,
    facilities: raw.facilities ?? undefined,
    authorName: raw.guestName ?? ([raw.user?.firstName, raw.user?.lastName].filter(Boolean).join(' ') || 'Guest'),
    createdAt: raw.createdAt,
    propertyReply: raw.propertyReply ?? undefined,
  };
}

export async function getPropertyReviews(propertyId: string): Promise<Review[]> {
  const { data } = await api.get<any[]>(`/reviews/property/${propertyId}`);
  return (data ?? []).map(normalize);
}

export async function getReviewEligibility(propertyId: string): Promise<ReviewEligibility> {
  const { data } = await api.get(`/reviews/eligibility/${propertyId}`);
  return { canReview: !!data?.canReview, reason: data?.reason ?? null };
}

export async function submitReview(payload: SubmitReviewPayload): Promise<Review> {
  const { data } = await api.post('/reviews', payload);
  return normalize(data);
}
