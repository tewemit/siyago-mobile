import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { RADIUS, SHADOW, type ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';

/**
 * Primary CTA button — bright-to-deep blue gradient pill, matching the
 * brand's splash-screen mockup. Drop-in replacement for the old flat
 * `backgroundColor: colors.primary` button pattern used across the app.
 *
 * `size="compact"` mirrors the old `btnSmall` pattern (48px tall, hugs
 * content, horizontal padding) for inline row buttons like wizard "Next" —
 * `size="default"` (the default) is the full-height 54px block CTA.
 */
export default function GradientButton({
  label,
  onPress,
  disabled = false,
  loading = false,
  icon,
  iconPosition = 'right',
  size = 'default',
  style,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  iconPosition?: 'left' | 'right';
  size?: 'default' | 'compact';
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      style={[styles.wrap, isDisabled && styles.disabled, style]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.85}
    >
      <LinearGradient
        colors={colors.primaryGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={size === 'compact' ? styles.gradientCompact : styles.gradient}
      >
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <>
            {icon && iconPosition === 'left' && <Ionicons name={icon} size={16} color="#fff" />}
            <Text style={styles.text}>{label}</Text>
            {icon && iconPosition === 'right' && <Ionicons name={icon} size={16} color="#fff" />}
          </>
        )}
      </LinearGradient>
    </TouchableOpacity>
  );
}

/** Non-pressable variant for spots that need the gradient look without being a button (e.g. a badge). */
export function GradientSurface({ style, children }: { style?: ViewStyle; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <LinearGradient
      colors={colors.primaryGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={style}
    >
      <View>{children}</View>
    </LinearGradient>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: {
      borderRadius: RADIUS.lg,
      overflow: 'hidden',
      ...SHADOW.sm,
      shadowColor: colors.primary,
    },
    disabled: { opacity: 0.6 },
    gradient: {
      height: 54,
      justifyContent: 'center',
      alignItems: 'center',
    },
    gradientCompact: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      height: 48,
      paddingHorizontal: 24,
    },
    text: {
      color: '#fff',
      fontWeight: '700',
      fontSize: 16,
    },
  });
}
