import { useMemo } from 'react';
import { RADIUS, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { StyleSheet, Text, View } from 'react-native';

export default function RegistrationSummary({
  title,
  rows,
}: {
  title: string;
  rows: { label: string; value?: string }[];
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const visible = rows.filter((r) => r.value);
  if (visible.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {visible.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.label}>{row.label}:</Text>
          <Text style={styles.value} numberOfLines={2}>{row.value}</Text>
        </View>
      ))}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.backgroundAlt,
      borderRadius: RADIUS.lg,
      padding: 14,
      gap: 6,
    },
    title: { fontSize: 13, fontWeight: '700', color: colors.textPrimary, marginBottom: 4 },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
    label: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },
    value: { fontSize: 13, color: colors.textPrimary, flexShrink: 1 },
  });
}
