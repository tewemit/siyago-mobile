import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { COLORS, RADIUS, SHADOW } from '../constants/theme';
import { applyForHost } from '../services/auth';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export default function BecomeHostScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { refresh } = useAuth();
  const [hotelName, setHotelName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleApply() {
    if (!hotelName.trim()) {
      Alert.alert(t.error, t.required);
      return;
    }
    setSubmitting(true);
    try {
      await applyForHost({ hotelName: hotelName.trim(), phoneNumber: phoneNumber.trim() || undefined });
      await refresh();
      Alert.alert(t.application_submitted, t.application_submitted_msg);
      router.replace('/(guest)/profile');
    } catch (err: any) {
      Alert.alert(t.error, err?.response?.data?.message ?? 'Could not submit application');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: COLORS.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{t.become_host}</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body}>
          <View style={styles.iconCircle}>
            <Ionicons name="business" size={32} color={COLORS.primary} />
          </View>
          <Text style={styles.sub}>{t.become_host_sub}</Text>

          <View style={styles.fieldWrap}>
            <View style={styles.fieldLabelRow}>
              <Ionicons name="business-outline" size={14} color={COLORS.primary} />
              <Text style={styles.label}>{t.hotel_name}</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Siyago Boutique Hotel"
              placeholderTextColor={COLORS.textMuted}
              value={hotelName}
              onChangeText={setHotelName}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.fieldWrap}>
            <View style={styles.fieldLabelRow}>
              <Ionicons name="call-outline" size={14} color={COLORS.primary} />
              <Text style={styles.label}>{t.phone_number}</Text>
            </View>
            <TextInput
              style={styles.input}
              placeholder="+251912345678"
              placeholderTextColor={COLORS.textMuted}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />
          </View>

          <TouchableOpacity
            style={[styles.btn, submitting && styles.btnDisabled]}
            onPress={handleApply}
            disabled={submitting}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>{submitting ? t.applying : t.apply_now}</Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.card,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: { fontWeight: '700', fontSize: 17, color: COLORS.textPrimary },

  body: { padding: 20 },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  sub: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 28,
    paddingHorizontal: 12,
  },

  fieldWrap: { marginBottom: 16 },
  fieldLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary },
  input: {
    backgroundColor: COLORS.card,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    color: COLORS.textPrimary,
  },

  btn: {
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    ...SHADOW.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
