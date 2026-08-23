import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { RADIUS, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { getPropertyTypes, type MasterOption } from '../../services/master';
import ChipSelect from './ChipSelect';
import { StyleSheet, Text, TextInput, View } from 'react-native';

export type PropertyDetails = {
  hotelName: string;
  propertyType: string;
  numberOfRooms: string;
  propertyAddress: string;
};

export default function PropertyDetailsStep({
  value,
  onChange,
  hotelNameError,
}: {
  value: PropertyDetails;
  onChange: (next: PropertyDetails) => void;
  hotelNameError?: string;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [types, setTypes] = useState<MasterOption[]>([]);

  useEffect(() => {
    getPropertyTypes().then(setTypes).catch(() => setTypes([]));
  }, []);

  function set<K extends keyof PropertyDetails>(key: K, v: PropertyDetails[K]) {
    onChange({ ...value, [key]: v });
  }

  return (
    <View style={{ gap: 16 }}>
      <View style={styles.hintRow}>
        <Text style={styles.hintText}>{t.property_details_hint}</Text>
      </View>

      <View>
        <Text style={styles.label}>{t.hotel_name}</Text>
        <TextInput
          style={[styles.input, hotelNameError && styles.inputError]}
          placeholder="Siyago Boutique Hotel"
          placeholderTextColor={colors.textMuted}
          value={value.hotelName}
          onChangeText={(v) => set('hotelName', v)}
          autoCapitalize="words"
        />
        {hotelNameError ? <Text style={styles.error}>{hotelNameError}</Text> : null}
      </View>

      {types.length > 0 && (
        <View>
          <Text style={styles.label}>{t.property_type}</Text>
          <ChipSelect
            options={types.map((ty) => ty.name)}
            value={value.propertyType || null}
            onChange={(v) => set('propertyType', v)}
          />
        </View>
      )}

      <View>
        <Text style={styles.label}>{t.number_of_rooms}</Text>
        <TextInput
          style={styles.input}
          placeholder={t.number_of_rooms_placeholder}
          placeholderTextColor={colors.textMuted}
          value={value.numberOfRooms}
          onChangeText={(v) => set('numberOfRooms', v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
        />
      </View>

      <View>
        <Text style={styles.label}>{t.full_address}</Text>
        <TextInput
          style={styles.input}
          placeholder={t.address_placeholder}
          placeholderTextColor={colors.textMuted}
          value={value.propertyAddress}
          onChangeText={(v) => set('propertyAddress', v)}
        />
      </View>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    hintRow: {
      flexDirection: 'row',
      backgroundColor: colors.primaryLight,
      borderRadius: RADIUS.lg,
      padding: 12,
    },
    hintText: { fontSize: 12, color: colors.primary, lineHeight: 17, flex: 1 },
    label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 15,
      color: colors.textPrimary,
    },
    inputError: { borderColor: colors.error },
    error: { color: colors.error, fontSize: 12, marginTop: 6 },
  });
}
