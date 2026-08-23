import { useMemo } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useI18n } from '../../context/I18nContext';
import { RADIUS, SHADOW, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import type { HostKycFiles, PickedFile } from '../../services/auth';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type KycKey = keyof HostKycFiles;

export default function KycUploadStep({
  files,
  onChange,
}: {
  files: HostKycFiles;
  onChange: (next: HostKycFiles) => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const docs: { key: KycKey; label: string; hint: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { key: 'businessLicense', label: t.business_license, hint: t.business_license_hint, icon: 'document-text-outline' },
    { key: 'idProof', label: t.id_proof, hint: t.id_proof_hint, icon: 'card-outline' },
    { key: 'ownershipProof', label: t.ownership_proof, hint: t.ownership_proof_hint, icon: 'home-outline' },
  ];

  // Optional end-to-end: not picking anything for a doc simply skips it —
  // matches web's KYC step, which never blocks continuing.
  async function pick(key: KycKey, source: 'camera' | 'library') {
    if (source === 'camera') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t.error, t.camera_permission_denied);
        return;
      }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(t.error, t.library_permission_denied);
        return;
      }
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.7 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });

    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const file: PickedFile = {
      uri: asset.uri,
      name: asset.fileName ?? `${key}.jpg`,
      type: asset.mimeType ?? 'image/jpeg',
    };
    onChange({ ...files, [key]: file });
  }

  function remove(key: KycKey) {
    const next = { ...files };
    delete next[key];
    onChange(next);
  }

  return (
    <View style={{ gap: 14 }}>
      <View style={styles.hintRow}>
        <Ionicons name="shield-checkmark-outline" size={14} color={colors.warning} />
        <Text style={styles.hintText}>{t.documents_info}</Text>
      </View>

      {docs.map((doc) => {
        const file = files[doc.key];
        return (
          <View key={doc.key} style={styles.card}>
            <View style={styles.cardHeader}>
              <View style={styles.iconWrap}>
                <Ionicons
                  name={file ? 'checkmark-circle' : doc.icon}
                  size={20}
                  color={file ? colors.success : colors.primary}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{doc.label}</Text>
                <Text style={styles.hint} numberOfLines={1}>
                  {file ? file.name : doc.hint}
                </Text>
              </View>
            </View>
            {file?.uri ? <Image source={{ uri: file.uri }} style={styles.preview} /> : null}
            <View style={styles.actionsRow}>
              <TouchableOpacity style={styles.actionBtn} onPress={() => pick(doc.key, 'camera')}>
                <Ionicons name="camera-outline" size={15} color={colors.primary} />
                <Text style={styles.actionText}>{t.take_photo}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionBtn} onPress={() => pick(doc.key, 'library')}>
                <Ionicons name="images-outline" size={15} color={colors.primary} />
                <Text style={styles.actionText}>{t.choose_from_library}</Text>
              </TouchableOpacity>
              {file && (
                <TouchableOpacity style={styles.actionBtn} onPress={() => remove(doc.key)}>
                  <Ionicons name="trash-outline" size={15} color={colors.error} />
                  <Text style={[styles.actionText, { color: colors.error }]}>{t.remove_file}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    hintRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 8,
      backgroundColor: colors.accentLight,
      borderRadius: RADIUS.lg,
      padding: 12,
    },
    hintText: { fontSize: 12, color: colors.accentDark, lineHeight: 17, flex: 1 },
    card: {
      backgroundColor: colors.card,
      borderRadius: RADIUS.lg,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 14,
      ...SHADOW.sm,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    iconWrap: {
      width: 38,
      height: 38,
      borderRadius: RADIUS.full,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    label: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
    hint: { fontSize: 12, color: colors.textSecondary },
    preview: { width: '100%', height: 120, borderRadius: RADIUS.md, marginTop: 10 },
    actionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
    actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    actionText: { fontSize: 12, fontWeight: '700', color: colors.primary },
  });
}
