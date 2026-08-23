import { useI18n } from '../context/I18nContext';
import { RADIUS, type ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { createCheckout, getBookingByRef, getErrorMessage } from '../services/bookings';
import GradientButton from '../components/GradientButton';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
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
            <Ionicons name="cash-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>{t.pay_at_property}</Text>
            <Text style={styles.optionSub}>{t.pay_at_property_sub}</Text>
          </View>
          <Ionicons
            name={method === 'CASH' ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={method === 'CASH' ? colors.primary : colors.textMuted}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.option, method === 'STRIPE' && styles.optionSelected]}
          onPress={() => setMethod('STRIPE')}
          activeOpacity={0.85}
        >
          <View style={styles.optionIconWrap}>
            <Ionicons name="card-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>{t.pay_with_card}</Text>
            <Text style={styles.optionSub}>{t.pay_with_card_sub}</Text>
          </View>
          <Ionicons
            name={method === 'STRIPE' ? 'radio-button-on' : 'radio-button-off'}
            size={20}
            color={method === 'STRIPE' ? colors.primary : colors.textMuted}
          />
        </TouchableOpacity>

        <GradientButton label={t.pay_now} onPress={handleContinue} loading={submitting} style={styles.btnWrap} />
      </View>
    </SafeAreaView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderColor: colors.border,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.full,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topTitle: { fontWeight: '700', fontSize: 17, color: colors.textPrimary },

  body: { padding: 20 },
  sub: { fontSize: 14, color: colors.textSecondary, marginBottom: 20 },

  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.card,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  optionIconWrap: {
    width: 42,
    height: 42,
    borderRadius: RADIUS.full,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary, marginBottom: 2 },
  optionSub: { fontSize: 12, color: colors.textSecondary },

  btnWrap: { marginTop: 16 },
  });
}
