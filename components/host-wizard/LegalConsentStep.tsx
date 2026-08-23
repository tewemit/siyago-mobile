import { useEffect, useMemo, useState } from 'react';
import { useI18n } from '../../context/I18nContext';
import { RADIUS, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { getLegalDocuments, type LegalDocument } from '../../services/master';
import GradientButton from '../GradientButton';
import { Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function LegalConsentStep({
  agreedIds,
  onChangeAgreedIds,
  onAllAgreedChange,
}: {
  agreedIds: number[];
  onChangeAgreedIds: (ids: number[]) => void;
  onAllAgreedChange: (allAgreed: boolean) => void;
}) {
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [docs, setDocs] = useState<LegalDocument[]>([]);
  const [viewingDoc, setViewingDoc] = useState<LegalDocument | null>(null);

  useEffect(() => {
    getLegalDocuments().then(setDocs).catch(() => setDocs([]));
  }, []);

  // No published documents means there's nothing to agree to — matches
  // web's `allHostAgreed = legalDocs.length === 0 || ...` so the step never
  // blocks submission when the admin hasn't published anything yet.
  useEffect(() => {
    const allAgreed = docs.length === 0 || docs.every((d) => agreedIds.includes(d.id));
    onAllAgreedChange(allAgreed);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docs, agreedIds]);

  function toggle(id: number) {
    onChangeAgreedIds(agreedIds.includes(id) ? agreedIds.filter((x) => x !== id) : [...agreedIds, id]);
  }

  function agree(id: number) {
    if (!agreedIds.includes(id)) onChangeAgreedIds([...agreedIds, id]);
  }

  if (docs.length === 0) return null;

  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.title}>{t.read_and_accept}</Text>
      {docs.map((doc) => {
        const checked = agreedIds.includes(doc.id);
        return (
          <TouchableOpacity key={doc.id} style={styles.row} onPress={() => toggle(doc.id)} activeOpacity={0.8}>
            <View style={[styles.checkbox, checked && styles.checkboxChecked]}>
              {checked && <Ionicons name="checkmark" size={13} color="#fff" />}
            </View>
            <Text style={styles.rowText}>
              {t.i_have_read_and_agree}{' '}
              <Text style={styles.link} onPress={() => setViewingDoc(doc)}>
                {doc.title}
              </Text>{' '}
              <Text style={styles.version}>(v{doc.version})</Text>
            </Text>
          </TouchableOpacity>
        );
      })}

      <Modal
        visible={!!viewingDoc}
        animationType="slide"
        transparent
        onRequestClose={() => setViewingDoc(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{viewingDoc?.title}</Text>
            <ScrollView style={{ maxHeight: 360 }}>
              <Text style={styles.modalBody}>{viewingDoc?.content}</Text>
            </ScrollView>
            <GradientButton
              label={t.i_have_read_and_accept}
              onPress={() => {
                if (viewingDoc) agree(viewingDoc.id);
                setViewingDoc(null);
              }}
              style={styles.modalAgreeBtn}
            />
            <TouchableOpacity style={styles.modalClose} onPress={() => setViewingDoc(null)}>
              <Text style={styles.modalCloseText}>{t.close}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    title: { fontSize: 13, fontWeight: '600', color: colors.textPrimary },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 1,
    },
    checkboxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
    rowText: { flex: 1, fontSize: 13, color: colors.textSecondary, lineHeight: 19 },
    link: { color: colors.primary, fontWeight: '700', textDecorationLine: 'underline' },
    version: { color: colors.textMuted, fontSize: 11 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: colors.card,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      padding: 20,
      paddingBottom: 40,
      maxHeight: '80%',
    },
    modalHandle: {
      width: 40,
      height: 4,
      backgroundColor: colors.border,
      borderRadius: RADIUS.full,
      alignSelf: 'center',
      marginBottom: 16,
    },
    modalTitle: { fontSize: 17, fontWeight: '700', color: colors.textPrimary, marginBottom: 12 },
    modalBody: { fontSize: 13, color: colors.textSecondary, lineHeight: 20 },
    modalAgreeBtn: { marginTop: 16 },
    modalClose: { marginTop: 10, alignItems: 'center', paddingVertical: 12 },
    modalCloseText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  });
}
