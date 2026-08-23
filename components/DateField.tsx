import { RADIUS, type ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import GradientButton from './GradientButton';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(d: Date) {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Compact "Aug 24" form (no year) for tight inline fields. */
export function formatDateShort(d: Date) {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** Formats as YYYY-MM-DD in local time (avoids UTC day-shift from toISOString). */
export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Reverse of `toISODate` — parses "YYYY-MM-DD" as a LOCAL midnight Date, not UTC (avoids the day shifting back one in negative-UTC-offset zones). */
export function parseISODate(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export default function DateField({
  label,
  icon,
  value,
  onChange,
  minimumDate,
  placeholder = 'Select date',
  compact = false,
}: {
  label: string;
  icon?: keyof typeof Ionicons.glyphMap;
  value: Date | null;
  onChange: (d: Date) => void;
  minimumDate?: Date;
  placeholder?: string;
  /** Tight "label above short date" cell, no icons — for dense rows like the home search card. */
  compact?: boolean;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [show, setShow] = useState(false);
  const [draft, setDraft] = useState(value ?? minimumDate ?? new Date());

  function handleChange(event: any, selected?: Date) {
    if (Platform.OS === 'android') {
      setShow(false);
      if (event.type === 'set' && selected) onChange(selected);
      return;
    }
    if (selected) setDraft(selected);
  }

  function openPicker() {
    setDraft(value ?? minimumDate ?? new Date());
    setShow(true);
  }

  return (
    <View style={compact ? styles.compactOuter : styles.wrap}>
      {compact ? (
        <TouchableOpacity style={styles.compactWrap} onPress={openPicker} activeOpacity={0.7}>
          <Text style={styles.compactLabel} numberOfLines={1}>{label}</Text>
          <Text style={value ? styles.compactValue : styles.compactPlaceholder} numberOfLines={1}>
            {value ? formatDateShort(value) : placeholder}
          </Text>
        </TouchableOpacity>
      ) : (
        <>
          <View style={styles.labelRow}>
            {icon && <Ionicons name={icon} size={14} color={colors.primary} />}
            <Text style={styles.label}>{label}</Text>
          </View>
          <TouchableOpacity style={styles.input} onPress={openPicker} activeOpacity={0.7}>
            <Text style={value ? styles.valueText : styles.placeholderText}>
              {value ? formatDate(value) : placeholder}
            </Text>
            <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        </>
      )}

      {show && Platform.OS === 'android' && (
        <DateTimePicker
          value={draft}
          mode="date"
          minimumDate={minimumDate}
          onChange={handleChange}
        />
      )}

      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide" onRequestClose={() => setShow(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <DateTimePicker
                value={draft}
                mode="date"
                display="spinner"
                minimumDate={minimumDate}
                onChange={handleChange}
              />
              <GradientButton
                label="Done"
                onPress={() => {
                  onChange(draft);
                  setShow(false);
                }}
                style={styles.doneBtn}
              />
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    wrap: { flex: 1 },
    compactOuter: { flex: 1 },
    compactWrap: {
      backgroundColor: colors.backgroundAlt,
      borderRadius: RADIUS.md,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    compactLabel: {
      fontSize: 9,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 0.4,
      marginBottom: 2,
    },
    compactValue: { fontSize: 13, fontWeight: '700', color: colors.textPrimary },
    compactPlaceholder: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
    labelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
    input: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: 14,
      paddingVertical: 13,
    },
    valueText: { fontSize: 14, color: colors.textPrimary, fontWeight: '600' },
    placeholderText: { fontSize: 14, color: colors.textMuted },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      padding: 20,
      paddingBottom: 36,
    },
    doneBtn: { marginTop: 12 },
  });
}
