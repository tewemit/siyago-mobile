import { RADIUS, type ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Modal, Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatDate(d: Date) {
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** Formats as YYYY-MM-DD in local time (avoids UTC day-shift from toISOString). */
export function toISODate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function DateField({
  label,
  icon,
  value,
  onChange,
  minimumDate,
  placeholder = 'Select date',
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  value: Date | null;
  onChange: (d: Date) => void;
  minimumDate?: Date;
  placeholder?: string;
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
    <View style={styles.wrap}>
      <View style={styles.labelRow}>
        <Ionicons name={icon} size={14} color={colors.primary} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <TouchableOpacity style={styles.input} onPress={openPicker} activeOpacity={0.7}>
        <Text style={value ? styles.valueText : styles.placeholderText}>
          {value ? formatDate(value) : placeholder}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={colors.textMuted} />
      </TouchableOpacity>

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
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={() => {
                  onChange(draft);
                  setShow(false);
                }}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
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
    doneBtn: {
      backgroundColor: colors.primary,
      borderRadius: RADIUS.lg,
      paddingVertical: 14,
      alignItems: 'center',
      marginTop: 12,
    },
    doneBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  });
}
