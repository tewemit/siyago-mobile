import { useMemo } from 'react';
import { useI18n } from '../context/I18nContext';
import { useTheme } from '../context/ThemeContext';
import { RADIUS, SHADOW, type ThemeColors } from '../constants/theme';
import { usePathname, useRouter } from 'expo-router';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

/**
 * Persistent bottom navigation rendered once at the root layout (outside the
 * Stack) so it stays pinned on every screen — guest browsing, auth, and host
 * mode alike — rather than only on the 4 tab-root screens.
 */
export default function BottomBar() {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();

  const tabs: {
    key: string;
    href: '/(guest)' | '/(guest)/search' | '/(guest)/bookings' | '/(guest)/favorites' | '/(guest)/profile';
    match: (p: string) => boolean;
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    activeIcon: keyof typeof Ionicons.glyphMap;
  }[] = [
    { key: 'home', href: '/(guest)', match: (p) => p === '/', label: t.home, icon: 'home-outline', activeIcon: 'home' },
    { key: 'search', href: '/(guest)/search', match: (p) => p === '/search', label: t.search, icon: 'search-outline', activeIcon: 'search' },
    { key: 'favorites', href: '/(guest)/favorites', match: (p) => p === '/favorites', label: t.favorites, icon: 'heart-outline', activeIcon: 'heart' },
    { key: 'trips', href: '/(guest)/bookings', match: (p) => p === '/bookings', label: t.trips, icon: 'briefcase-outline', activeIcon: 'briefcase' },
    { key: 'account', href: '/(guest)/profile', match: (p) => p === '/profile', label: t.profile, icon: 'person-outline', activeIcon: 'person' },
  ];

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {tabs.map((tab) => {
        const focused = tab.match(pathname);
        return (
          <TouchableOpacity
            key={tab.key}
            style={styles.item}
            activeOpacity={0.7}
            onPress={() => router.replace(tab.href)}
          >
            <View style={focused ? styles.activeIcon : undefined}>
              <Ionicons
                name={focused ? tab.activeIcon : tab.icon}
                size={22}
                color={focused ? colors.primary : colors.textMuted}
              />
            </View>
            <Text style={[styles.label, focused && styles.labelActive]}>{tab.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      backgroundColor: colors.tabBar,
      paddingTop: 8,
      ...SHADOW.dark,
    },
    item: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: 2,
      paddingTop: 4,
    },
    label: {
      fontSize: 11,
      fontWeight: '600',
      marginTop: 2,
      color: colors.textMuted,
    },
    labelActive: {
      color: colors.primary,
    },
    activeIcon: {
      backgroundColor: colors.primaryLight,
      borderRadius: RADIUS.full,
      width: 40,
      height: 40,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
}
