import { useI18n } from '../context/I18nContext';
import { COLORS, RADIUS, SHADOW } from '../constants/theme';
import { createCheckout, getBookingByRef, getErrorMessage } from '../services/bookings';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import {
  Alert,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type Method = 'CASH' | 'STRIPE';

export default function PaymentScreen() {
  const { bookingId } = useLocalSearchParams<{ bookingId: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [method, setMethod] = useState<Method>('CASH');
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue() {
    setSubmitting(true);
    try {
      const result = await createCheckout(bookingId, { paymentMethod: method });
      if ('confirmed' in result && result.confirmed) {
        router.replace({ pathname: '/booking-details/[ref]', params: { ref: result.bookingReference } });
        return;
      }
      if ('paymentLink' in result && result.paymentLink) {
        await WebBrowser.openBrowserAsync(result.paymentLink);
        // Re-check status after the browser closes — webhook may have confirmed it.
        const booking = await getBookingByRef(result.bookingReference).catch(() => null);
        router.replace({
          pathname: '/booking-details/[ref]',
          params: { ref: booking?.reference ?? result.bookingReference },
        });
        return;
      }
      throw new Error('Unexpected checkout response');
    } catch (err: any) {
      Alert.alert(t.error, getErrorMessage(err, 'Could not start payment'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.background }}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={COLORS.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.topTitle}>{t.payment}</Text>
        <View style={{ width: 38 }} />
      </View>

      <View style={styles.body}>
        <Text style={styles.sub}>{t.choose_payment_method}</Text>

        <TouchableOpacity
          style={[styles.option, method === 'CASH' && styles.optionSelected]}
          onPress={() => setMethod('CASH')}
          activeOpacity={0.85}
        >
          <View style={styles.optionIconWrap}>
            <Ionicons name="cash-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>{t.pay_at_property}</Text>
            <Text style={styles.optionSub}>{t.pay_at_property_sub}</Text>
          </View>
          <Ionicons
            name={method === 'CASH' ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={method === 'CASH' ? COLORS.primary : COLORS.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.option, method === 'STRIPE' && styles.optionSelected]}
          onPress={() => setMethod('STRIPE')}
          activeOpacity={0.85}
        >
          <View style={styles.optionIconWrap}>
            <Ionicons name="card-outline" size={22} color={COLORS.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>{t.pay_with_card}</Text>
            <Text style={styles.optionSub}>{t.pay_with_card_sub}</Text>
          </View>
          <Ionicons
            name={method === 'STRIPE' ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={method === 'STRIPE' ? COLORS.primary : COLORS.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.btn, submitting && styles.btnDisabled]}
          onPress={handleContinue}
          disabled={submitting}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>{submitting ? t.processing : t.pay_now}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
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
  sub: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 20 },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 12,
  },
  optionSelected: { borderColor: COLORS.primary, backgroundColor: COLORS.primaryLight },
  optionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.textPrimary, marginBottom: 2 },
  optionSub: { fontSize: 12, color: COLORS.textSecondary },

  btn: {
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
    ...SHADOW.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
