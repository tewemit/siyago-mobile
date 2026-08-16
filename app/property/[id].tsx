import { useI18n } from '../../context/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
// LIGHT_COLORS (not the reactive `colors`) is used deliberately for the
// floating hero buttons and their icons below — those buttons keep a fixed
// near-white circular background regardless of theme (they sit on top of a
// photo, not the page), so their icon color must stay fixed too instead of
// going near-invisible-white-on-white in Navy mode.
import { LIGHT_COLORS, RADIUS, SHADOW, type ThemeColors } from '../../constants/theme';
import { formatLocation, getPropertyById, type Property } from '../../services/properties';
import { getFavoriteStatus, toggleFavorite } from '../../services/favorites';
import { getPropertyReviews, getReviewEligibility, type Review, type ReviewEligibility } from '../../services/reviews';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native';

type Tab = 'overview' | 'amenities' | 'reviews';

function facilityIcon(name: string): keyof typeof Ionicons.glyphMap {
  const n = name.toLowerCase();
  if (n.includes('wifi')) return 'wifi';
  if (n.includes('parking')) return 'car-outline';
  if (n.includes('pool')) return 'water-outline';
  if (n.includes('gym') || n.includes('fitness')) return 'barbell-outline';
  if (n.includes('spa')) return 'flower-outline';
  if (n.includes('restaurant') || n.includes('breakfast')) return 'restaurant-outline';
  if (n.includes('bar')) return 'wine-outline';
  if (n.includes('laundry')) return 'shirt-outline';
  if (n.includes('front desk')) return 'time-outline';
  if (n.includes('business') || n.includes('conference')) return 'briefcase-outline';
  if (n.includes('garden')) return 'leaf-outline';
  if (n.includes('currency')) return 'cash-outline';
  return 'checkmark-circle-outline';
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const [property, setProperty] = useState<Property | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [eligibility, setEligibility] = useState<ReviewEligibility | null>(null);
  const [tab, setTab] = useState<Tab>('overview');
  const [activeImageIndex, setActiveImageIndex] = useState(0);

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

  async function handleShare() {
    if (!property) return;
    try {
      await Share.share({
        message: `Check out ${property.name} on Siyago — ${formatLocation(property)}`,
      });
    } catch {
      // User dismissed the share sheet — nothing to do.
    }
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!property) {
    return (
      <SafeAreaView style={styles.center}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={LIGHT_COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={{ color: colors.textSecondary, marginTop: 80 }}>Property not found.</Text>
      </SafeAreaView>
    );
  }

  const desc = property.description ?? '';
  const shortDesc = desc.length > 140 ? desc.slice(0, 140) + '…' : desc;
  const avgRating = reviews.length
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : property.rating;
  const facilities = property.facilities ?? [];
  const heroImages = property.images?.length
    ? property.images
    : property.thumbnail
      ? [property.thumbnail]
      : [];

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Hero */}
        <View style={styles.heroWrapper}>
          {heroImages.length > 1 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              onMomentumScrollEnd={(e) => {
                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                setActiveImageIndex(index);
              }}
            >
              {heroImages.map((uri, i) => (
                <Image key={i} source={{ uri }} style={[styles.hero, { width }]} />
              ))}
            </ScrollView>
          ) : heroImages[0] ? (
            <Image source={{ uri: heroImages[0] }} style={styles.hero} />
          ) : (
            <View style={[styles.hero, { backgroundColor: colors.primaryLight }]} />
          )}
          <View style={styles.heroOverlay} pointerEvents="none" />

          {heroImages.length > 1 && (
            <View style={styles.heroDotsRow} pointerEvents="none">
              {heroImages.map((_, i) => (
                <View
                  key={i}
                  style={[styles.heroDot, i === activeImageIndex && styles.heroDotActive]}
                />
              ))}
            </View>
          )}

          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={LIGHT_COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.optionsBtn} onPress={handleShare}>
            <Ionicons name="ellipsis-horizontal" size={20} color={LIGHT_COLORS.textPrimary} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.heartBtn} onPress={handleToggleLike}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={20}
              color={liked ? LIGHT_COLORS.error : LIGHT_COLORS.textPrimary}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.body}>
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
            <Ionicons name="location" size={14} color={colors.primary} />
            <Text style={styles.locationText}>
              {property.address}, {property.city}, {property.country}
            </Text>
          </View>

          {/* Rating summary */}
          {avgRating != null && (
            <View style={styles.ratingDetailRow}>
              {[1, 2, 3, 4, 5].map((s) => (
                <Ionicons
                  key={s}
                  name="star"
                  size={14}
                  color={s <= Math.round(avgRating) ? colors.accent : colors.border}
                />
              ))}
              <Text style={styles.ratingDetailText}>
                {avgRating.toFixed(1)}{' '}
                {reviews.length ? `(${reviews.length} ${t.reviews})` : ''}
              </Text>
            </View>
          )}

          {/* Tabs */}
          <View style={styles.tabRow}>
            <TabButton label="Overview" active={tab === 'overview'} onPress={() => setTab('overview')} />
            <TabButton label="Amenities" active={tab === 'amenities'} onPress={() => setTab('amenities')} />
            <TabButton
              label={`Reviews${reviews.length ? ` (${reviews.length})` : ''}`}
              active={tab === 'reviews'}
              onPress={() => setTab('reviews')}
            />
          </View>

          {tab === 'overview' && (
            <>
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
            </>
          )}

          {tab === 'amenities' && (
            <View style={styles.amenityGrid}>
              {facilities.length === 0 ? (
                <Text style={styles.reviewHint}>No amenities listed for this property yet.</Text>
              ) : (
                facilities.map((f) => (
                  <View key={f} style={styles.amenityGridItem}>
                    <View style={styles.amenityGridIconWrap}>
                      <Ionicons name={facilityIcon(f)} size={16} color={colors.primary} />
                    </View>
                    <Text style={styles.amenityGridLabel} numberOfLines={1}>{f}</Text>
                  </View>
                ))
              )}
            </View>
          )}

          {tab === 'reviews' && (
            <>
              <View style={styles.reviewsHeaderRow}>
                <Text style={styles.reviewsCount}>
                  {reviews.length} {reviews.length === 1 ? 'review' : t.reviews}
                </Text>
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
                      <View style={styles.reviewAvatarWrap}>
                        <Text style={styles.reviewAvatarText}>{r.authorName.slice(0, 1).toUpperCase()}</Text>
                      </View>
                      <Text style={styles.reviewAuthor}>{r.authorName}</Text>
                      <View style={{ flex: 1 }} />
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Ionicons
                            key={s}
                            name="star"
                            size={12}
                            color={s <= r.rating ? colors.accent : colors.border}
                          />
                        ))}
                      </View>
                    </View>
                    {r.comment ? <Text style={styles.reviewComment}>{r.comment}</Text> : null}
                  </View>
                ))
              )}
            </>
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

function TabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <TouchableOpacity style={[styles.tabBtn, active && styles.tabBtnActive]} onPress={onPress} activeOpacity={0.8}>
      <Text style={[styles.tabBtnText, active && styles.tabBtnTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.card },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.background },

  heroWrapper: { position: 'relative', height: 300 },
  hero: { width: '100%', height: 300 },
  heroOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  heroDotsRow: {
    position: 'absolute',
    bottom: 16,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.5)',
  },
  heroDotActive: {
    backgroundColor: '#fff',
    width: 16,
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

  namePriceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  name: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, flex: 1, marginRight: 8 },
  priceCol: { alignItems: 'flex-end' },
  priceAmount: { fontSize: 18, fontWeight: '800', color: colors.primary },
  priceNight: { fontSize: 11, color: colors.textSecondary },

  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 10 },
  locationText: { fontSize: 13, color: colors.textSecondary, flex: 1 },

  ratingDetailRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 16 },
  ratingDetailText: { fontSize: 13, color: colors.textSecondary, marginLeft: 4 },

  tabRow: {
    flexDirection: 'row',
    backgroundColor: colors.backgroundAlt,
    borderRadius: RADIUS.full,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: RADIUS.full,
    alignItems: 'center',
  },
  tabBtnActive: {
    backgroundColor: colors.card,
    ...SHADOW.sm,
  },
  tabBtnText: { fontSize: 12, fontWeight: '700', color: colors.textSecondary },
  tabBtnTextActive: { color: colors.primary },

  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.textPrimary, marginTop: 4, marginBottom: 8 },
  descText: { fontSize: 14, color: colors.textSecondary, lineHeight: 22 },
  readMore: { fontSize: 13, color: colors.primary, fontWeight: '600', marginTop: 6 },

  amenityGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  amenityGridItem: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.backgroundAlt,
    borderRadius: RADIUS.md,
    padding: 10,
  },
  amenityGridIconWrap: {
    width: 30,
    height: 30,
    borderRadius: RADIUS.full,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  amenityGridLabel: { flex: 1, fontSize: 12, fontWeight: '600', color: colors.textPrimary },

  reviewsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reviewsCount: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
  writeReviewLink: { fontSize: 13, fontWeight: '700', color: colors.primary },
  reviewHint: { fontSize: 13, color: colors.textMuted, marginBottom: 8 },
  reviewCard: {
    backgroundColor: colors.backgroundAlt,
    borderRadius: RADIUS.md,
    padding: 12,
    marginBottom: 8,
  },
  reviewTopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  reviewAvatarWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewAvatarText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  reviewAuthor: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
  reviewStars: { flexDirection: 'row', gap: 2 },
  reviewComment: { fontSize: 13, color: colors.textSecondary, lineHeight: 19 },

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
    backgroundColor: colors.card,
    borderTopWidth: 1,
    borderColor: colors.border,
    ...SHADOW.dark,
  },
  footerPrice: { fontSize: 18, fontWeight: '800', color: colors.primary },
  footerNight: { fontSize: 11, color: colors.textSecondary },
  bookBtn: {
    backgroundColor: colors.primary,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: RADIUS.lg,
    ...SHADOW.sm,
  },
  bookBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
