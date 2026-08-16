import { useMemo } from 'react';
import { useI18n } from '../../context/I18nContext';
import { RADIUS, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useRouter } from 'expo-router';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function InboxScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t.inbox}</Text>
        <View style={{ width: 38 }} />
      </View>
      <View style={styles.emptyWrap}>
        <View style={styles.iconCircle}>
          <Ionicons name="chatbubble-outline" size={40} color={colors.primary} />
        </View>
        <Text style={styles.badge}>{t.coming_soon}</Text>
        <Text style={styles.emptyTitle}>{t.no_messages}</Text>
        <Text style={styles.emptySub}>{t.messages_coming_soon_msg}</Text>
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingVertical: 12,
    },
    backBtn: {
      width: 38,
      height: 38,
      borderRadius: RADIUS.full,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    topTitle: { fontWeight: '700', fontSize: 17, color: colors.textPrimary },
    emptyWrap: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: 40,
    },
    iconCircle: {
      width: 88,
      height: 88,
      borderRadius: 44,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    badge: {
      backgroundColor: colors.accentLight,
      color: colors.accentDark,
      fontSize: 11,
      fontWeight: '700',
      paddingHorizontal: 12,
      paddingVertical: 4,
      borderRadius: RADIUS.full,
      marginBottom: 12,
      overflow: 'hidden',
    },
    emptyTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.textPrimary,
      marginBottom: 8,
      textAlign: 'center',
    },
    emptySub: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}
