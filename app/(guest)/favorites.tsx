import { useI18n } from '../../context/I18nContext';
import { useAuth } from '../../context/AuthContext';
import { RADIUS, SHADOW, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { getFavorites, toggleFavorite } from '../../services/favorites';
import { formatLocation, type Property } from '../../services/properties';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function FavoritesScreen() {
  const { t } = useI18n();
  const { isAuthenticated } = useAuth();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [favorites, setFavorites] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    try {
      const data = await getFavorites();
      setFavorites(data);
    } catch {
      setFavorites([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) load();
    else setIsLoading(false);
  }, [isAuthenticated, load]);

  async function handleRemove(id: string) {
    const snapshot = favorites;
    setFavorites((prev) => prev.filter((p) => p.id !== id));
    setRemovingIds((prev) => new Set(prev).add(id));
    try {
      await toggleFavorite(id);
    } catch {
      setFavorites(snapshot);
      Alert.alert(t.error, 'Could not remove from favorites');
    } finally {
      setRemovingIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.heading}>{t.favorites}</Text>
        </View>
        <View style={styles.emptyWrap}>
          <View style={styles.iconCircle}>
            <Ionicons name="heart-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>{t.favorites}</Text>
          <Text style={styles.emptySub}>Sign in to save and view your favorite stays</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(auth)/sign-in')}>
            <Text style={styles.primaryBtnText}>{t.sign_in}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading}>{t.favorites}</Text>
        {favorites.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{favorites.length}</Text>
          </View>
        )}
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 60 }} size="large" color={colors.primary} />
      ) : (
        <FlatList
          data={favorites}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.primary} />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.iconCircle}>
                <Ionicons name="bookmark-outline" size={40} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>{t.no_favorites}</Text>
              <Text style={styles.emptySub}>Tap the heart icon on any property to save it here.</Text>
              <TouchableOpacity style={styles.primaryBtn} onPress={() => router.replace('/(guest)/search')}>
                <Text style={styles.primaryBtnText}>{t.browse_properties}</Text>
              </TouchableOpacity>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.92}
              onPress={() => router.push({ pathname: '/property/[id]', params: { id: item.id } })}
            >
              {item.thumbnail ? (
                <Image source={{ uri: item.thumbnail }} style={styles.cardImage} />
              ) : (
                <View style={[styles.cardImage, { backgroundColor: colors.primaryLight }]} />
              )}
              {item.rating != null && (
                <View style={styles.ratingBadge}>
                  <Ionicons name="star" size={10} color="#fff" />
                  <Text style={styles.ratingBadgeText}>{item.rating.toFixed(1)}</Text>
                </View>
              )}
              <TouchableOpacity
                style={styles.heartBtn}
                onPress={() => handleRemove(item.id)}
                disabled={removingIds.has(item.id)}
              >
                <Ionicons name="heart" size={16} color={colors.error} />
              </TouchableOpacity>
              <View style={styles.cardBody}>
                <Text style={styles.cardName} numberOfLines={1}>{item.name}</Text>
                {formatLocation(item) ? (
                  <View style={styles.locationRow}>
                    <Ionicons name="location-outline" size={11} color={colors.textSecondary} />
                    <Text style={styles.cardCity} numberOfLines={1}>{formatLocation(item)}</Text>
                  </View>
                ) : null}
                <Text style={styles.cardPrice}>
                  <Text style={styles.priceAmt}>{item.currency} {item.pricePerNight.toLocaleString()}</Text>
                  <Text style={styles.priceNight}> {t.per_night}</Text>
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  heading: { fontSize: 22, fontWeight: '800', color: colors.textPrimary },
  countBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 2,
  },
  countText: { fontSize: 12, fontWeight: '700', color: colors.primary },

  gridRow: { gap: 12 },
  card: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    marginBottom: 12,
    overflow: 'hidden',
    ...SHADOW.sm,
  },
  cardImage: { width: '100%', height: 120 },
  ratingBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  ratingBadgeText: { color: '#fff', fontSize: 10, fontWeight: '700' },
  heartBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: RADIUS.full,
    backgroundColor: 'rgba(255,255,255,0.92)',
    justifyContent: 'center',
    alignItems: 'center',
    ...SHADOW.sm,
  },
  cardBody: { padding: 10 },
  cardName: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 3, marginBottom: 6 },
  cardCity: { fontSize: 11, color: colors.textSecondary, flex: 1 },
  cardPrice: {},
  priceAmt: { fontSize: 13, fontWeight: '700', color: colors.primary },
  priceNight: { fontSize: 11, color: colors.textSecondary },

  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    paddingTop: 60,
    gap: 12,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary },
  emptySub: { textAlign: 'center', color: colors.textMuted, lineHeight: 22, fontSize: 14 },
  primaryBtn: {
    backgroundColor: colors.primary,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
