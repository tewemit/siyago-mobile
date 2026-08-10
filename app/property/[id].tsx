import { useI18n } from '../../context/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import { getPropertyById, type Property } from '../../services/properties';
import { getFavoriteStatus, toggleFavorite } from '../../services/favorites';
import { getPropertyReviews, getReviewEligibility, type Review, type ReviewEligibility } from '../../services/reviews';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native';

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);

  useEffect(() => {
    getPropertyById(id)
      .then(setProperty)
      .catch(() => {})
      .finally(() => setIsLoading(false));
    getPropertyReviews(id).then(setReviews).catch(() => setReviews([]));
  }, [id]);

  useEffect(() => {
    if (!isAuthenticated) {
      setLiked(false);
      setEligibility(null);
      return;
    }
    getFavoriteStatus(id).then(setLiked).catch(() => {});
    getReviewEligibility(id).then(setEligibility).catch(() => {});
  }, [id, isAuthenticated]);

  async function handleToggleLike() {
    if (!isAuthenticated) {
      router.push('/(auth)/sign-in');
      return;
    }
    setLiked((prev) => !prev);
    try {
      const result = await toggleFavorite(id);
      setLiked(result.favorited);
    } catch {
      setLiked((prev) => !prev);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!property) {
    return (
      <SafeAreaView style={styles.center}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={{ color: COLORS.textSecondary, marginTop: 80 }}>Property not found.</Text>
      </SafeAreaView>
    );
  }

  const desc = property.description ?? '';
  const shortDesc = desc.length > 140 ? desc.slice(0, 140) + '…' : desc;
  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : property.rating;

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero */}
        <View style={styles.heroWrapper}>
          {property.thumbnail ? (
            <Image source={{ uri: property.thumbnail }} style={styles.hero} />
          ) : (
            <View style={[styles.hero, { backgroundColor: COLORS.primaryLight }]} />
          )}
          {/* Overlay gradient feel */}
          <View style={styles.heroOverlay} />

          {/* Back button */}
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>

          {/* Options button */}
          <TouchableOpacity style={styles.optionsBtn}>
            <Ionicons name="ellipsis-horizontal" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>

          {/* Heart button */}
          <TouchableOpacity style={styles.heartBtn} onPress={handleToggleLike}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={20}
              color={liked ? COLORS.error : COLORS.textPrimary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
          {/* Amenities */}
          <View style={styles.amenitiesRow}>
            <AmenityChip icon="wifi" label={t.free_wifi} />
            <AmenityChip icon="restaurant-outline" label={t.free_breakfast} />
            {avgRating != null && (
              <AmenityChip icon="star" label={avgRating.toFixed(1)} iconColor={COLORS.accent} />
            )}
          </View>

          {/* Name + price row */}
          <View style={styles.namePriceRow}>
            <Text style={styles.name} numberOfLines={2}>{property.name}</Text>
            <View style={styles.priceCol}>
              <Text style={styles.priceAmount}>
                {property.currency} {property.pricePerNight.toLocaleString()}
              </Text>
              <Text style={styles.priceNight}>{t.per_night}</Text>
            </View>
          </View>

          {/* Location */}
          <View style={styles.locationRow}>
            <Ionicons name="location" size={14} color={COLORS.primary} />
            <Text style={styles.locationText}>
              {property.address}, {property.city}, {property.country}
            </Text>
          </View>

          {/* Rating count */}
          {avgRating != null && (
            <View style={styles.ratingDetailRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name="star"
                  size={14}
                  color={s <= Math.round(avgRating) ? COLORS.accent : COLORS.border}
                />
              ))}
              <Text style={styles.ratingDetailText}>
                {avgRating.toFixed(1)}{' '}
                {reviews.length ? `(${reviews.length} ${t.reviews})` : ''}
              </Text>
            </View>
          )}

          {/* Description */}
          {desc ? (
            <>
              <Text style={styles.sectionTitle}>{t.description}</Text>
              <Text style={styles.descText}>{expanded ? desc : shortDesc}</Text>
              {desc.length > 140 && (
                <TouchableOpacity onPress={() => setExpanded(!expanded)}>
                  <Text style={styles.readMore}>
                    {expanded ? 'Show less' : t.read_more}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          ) : null}

          {/* Preview thumbnails (show hero repeated as placeholders) */}
          <Text style={styles.sectionTitle}>{t.preview}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewScroll}>
            {[property.thumbnail, property.thumbnail, property.thumbnail]
              .filter(Boolean)
              .map((uri, i) => (
                <Image key={i} source={{ uri: uri! }} style={styles.previewThumb} />
              ))}
          </ScrollView>

          {/* Reviews */}
          <View style={styles.reviewsHeaderRow}>
            <Text style={[styles.sectionTitle, { marginTop: 0 }]}>{t.reviews_title}</Text>
            {isAuthenticated && eligibility?.canReview && (
              <TouchableOpacity
                onPress={() => router.push({ pathname: '/write-review', params: { propertyId: property.id } })}
              >
                <Text style={styles.writeReviewLink}>{t.write_a_review}</Text>
              </TouchableOpacity>
            )}
          </View>
          {isAuthenticated && eligibility && !eligibility.canReview && (
            <Text style={styles.reviewHint}>
              {eligibility.reason === 'already_reviewed' ? t.review_already_submitted_msg : t.review_no_booking_msg}
            </Text>
          )}
          {reviews.length === 0 ? (
            <Text style={styles.reviewHint}>{t.no_reviews_yet}</Text>
          ) : (
            reviews.map((r) => (
              <View key={r.id} style={styles.reviewCard}>
                <View style={styles.reviewTopRow}>
                  <Text style={styles.reviewAuthor}>{r.authorName}</Text>
                  <View style={styles.reviewStars}>
                    {[1, 2, 3, 4, 5].map((s) => (
                      <Ionicons
                        key={s}
                        name="star"
                        size={12}
                        color={s <= r.rating ? COLORS.accent : COLORS.border}
                      />
                    ))}
                  </View>
                </View>
                {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
              </View>
            ))
          )}
        </View>
      </ScrollView>

      {/* Footer CTA */}
      <View style={styles.footer}>
        <View>
          <Text style={styles.footerPrice}>
            {property.currency} {property.pricePerNight.toLocaleString()}
          </Text>
          <Text style={styles.footerNight}>{t.per_night}</Text>
        </View>
        <TouchableOpacity
          style={styles.bookBtn}
          activeOpacity={0.85}
          onPress={() =>
            router.push({ pathname: '/booking-summary', params: { propertyId: property.id } })
          }
        >
          <Text style={styles.bookBtnText}>{t.booking_now}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AmenityChip({
  icon,
  label,
  iconColor,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  iconColor?: string;
}) {
  return (
    <View style={styles.amenityChip}>
      <Ionicons name={icon} size={14} color={iconColor ?? COLORS.primary} />
      <Text style={styles.amenityText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.card },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.background },

  heroWrapper: { position: 'relative', height: 300 },
  hero: { width: '100%', height: 300 },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },

  backBtn: {
    position: 'absolute',
    top: 52,
    left: 16,
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.dark,
  },
  optionsBtn: {
    position: 'absolute',
    top: 52,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.dark,
  },
  heartBtn: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.dark,
  },

  body: { padding: 20 },

  amenitiesRow: { flexDirection: 'row', gap: 8, marginBottom: 16, flexWrap: 'wrap' },
  amenityChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  amenityText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  namePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  name: { fontSize: 20, fontWeight: '800', color: COLORS.textPrimary, flex: 1, marginRight: 8 },
  priceCol: { alignItems: 'flex-end' },
  priceAmount: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  priceNight: { fontSize: 11, color: COLORS.textSecondary },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  locationText: { fontSize: 13, color: COLORS.textSecondary, flex: 1 },

  ratingDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 16 },
  ratingDetailText: { fontSize: 13, color: COLORS.textSecondary, marginLeft: 4 },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.textPrimary, marginTop: 16, marginBottom: 8 },
  descText: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 22 },
  readMore: { fontSize: 13, color: COLORS.primary, fontWeight: '600', marginTop: 6 },

  previewScroll: { marginTop: 4 },
  previewThumb: { width: 90, height: 70, borderRadius: RADIUS.md, marginRight: 10 },

  reviewsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
  },
  writeReviewLink: { fontSize: 13, fontWeight: '700', color: COLORS.primary },
  reviewHint: { fontSize: 13, color: COLORS.textMuted, marginBottom: 8 },
  reviewCard: {
    backgroundColor: COLORS.backgroundAlt,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
  },
  reviewTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  reviewAuthor: { fontSize: 13, fontWeight: '700', color: COLORS.textPrimary },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 19 },

  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: COLORS.card,
    borderTopWidth: 1,
    borderColor: COLORS.border,
    ...SHADOW.dark,
  },
  footerPrice: { fontSize: 18, fontWeight: '800', color: COLORS.primary },
  footerNight: { fontSize: 11, color: COLORS.textSecondary },
  bookBtn: {
    backgroundColor: COLORS.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: RADIUS.lg,
    ...SHADOW.sm,
  },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
