import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import { getHostProperties, type Property } from '../../services/properties';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function HostPropertiesScreen() {
  const router = useRouter();
  const [properties, setProperties] = useState<Property[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await getHostProperties();
      setProperties(data);
    } catch {
      setProperties([]);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <SafeAreaView style={styles.container}>
      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={COLORS.primary} />
      ) : (
        <FlatList
          data={properties}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(); }}
              tintColor={COLORS.primary}
            />
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No properties yet.</Text>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.card}
              activeOpacity={0.8}
              onPress={() => router.push({ pathname: '/property/[id]', params: { id: item.id } })}
            >
              <View style={{ flex: 1 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.location}>
                  {item.city}{item.country ? `, ${item.country}` : ''}
                </Text>
                <Text style={styles.price}>
                  {item.pricePerNight > 0
                    ? `${item.currency} ${item.pricePerNight.toLocaleString()} / night`
                    : 'Rates managed on the web dashboard'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    padding: 14,
    marginBottom: 12,
    ...SHADOW.dark,
  },
  name: { fontWeight: '700', fontSize: 15, marginBottom: 2, color: COLORS.textPrimary },
  location: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 4 },
  price: { fontWeight: '600', color: COLORS.primary },
  empty: { textAlign: 'center', color: COLORS.textMuted, marginTop: 40 },
});
