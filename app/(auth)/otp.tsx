import { useI18n } from '../../context/I18nContext';
import { RADIUS, SHADOW, type ThemeColors } from '../../constants/theme';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { login, verifyOtp } from '../../services/auth';
import { clearPendingLogin, getPendingLogin } from '../../services/otpSession';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const OTP_LENGTH = 6;

const RESEND_COOLDOWN_SECONDS = 60;

export default function OtpScreen() {
  const { preAuthToken: initialToken, email } = useLocalSearchParams<{ preAuthToken: string; email: string }>();
  const router = useRouter();
  const { refresh } = useAuth();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [token, setToken] = useState(initialToken);
  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN_SECONDS);
  const inputs = useRef<(TextInput | null)[]>([]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  async function handleResend() {
    const pending = getPendingLogin();
    if (!pending || cooldown > 0 || isResending) return;
    setIsResending(true);
    try {
      const { preAuthToken } = await login(pending.email, pending.password);
      setToken(preAuthToken);
      setDigits(Array(OTP_LENGTH).fill(''));
      setCooldown(RESEND_COOLDOWN_SECONDS);
      inputs.current[0]?.focus();
    } catch (err: any) {
      Alert.alert(t.error, err?.response?.data?.message ?? 'Could not resend code');
    } finally {
      setIsResending(false);
    }
  }

  function handleChange(text: string, index: number) {
    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < OTP_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyPress(key: string, index: number) {
    if (key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  async function handleVerify() {
    const code = digits.join('');
    if (code.length < OTP_LENGTH) {
      Alert.alert(t.error, t.otp_incomplete);
      return;
    }
    setIsLoading(true);
    try {
      const result = await verifyOtp(token, code);
      clearPendingLogin();
      await refresh();
      router.replace(result.role === 'host' || result.role === 'admin' ? '/(host)' : '/(guest)');
    } catch (err: any) {
      Alert.alert(t.error, err?.response?.data?.message ?? 'Please try again');
      setDigits(Array(OTP_LENGTH).fill(''));
      inputs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Top panel */}
      <View style={styles.topPanel}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <Image
          source={require('../../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.brandName}>SiyaGo</Text>
      </View>

      {/* Card */}
      <View style={styles.card}>
        <Text style={styles.heading}>{t.enter_otp}</Text>
        <Text style={styles.sub}>
          {t.otp_sent_to}{'\n'}
          <Text style={styles.emailText}>{email}</Text>
        </Text>

        <View style={styles.otpRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(el) => { inputs.current[i] = el; }}
              style={[styles.cell, d ? styles.cellFilled : null]}
              value={d}
              onChangeText={(text) => handleChange(text, i)}
              onKeyPress={({ nativeEvent }) => handleKeyPress(nativeEvent.key, i)}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        <TouchableOpacity
          style={[styles.btn, isLoading && styles.btnDisabled]}
          onPress={handleVerify}
          disabled={isLoading}
          activeOpacity={0.85}
        >
          <Text style={styles.btnText}>
            {isLoading ? t.verifying : t.verify}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resendRow}
          onPress={handleResend}
          disabled={cooldown > 0 || isResending}
        >
          <Text style={[styles.resendText, (cooldown > 0 || isResending) && styles.resendTextDisabled]}>
            {cooldown > 0 ? `${t.resend_in} ${cooldown}s` : t.resend_code}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.primary },

    topPanel: {
      alignItems: 'center',
      paddingTop: 60,
      paddingBottom: 36,
      backgroundColor: colors.primary,
    },
    backBtn: {
      position: 'absolute',
      top: 56,
      left: 20,
      width: 40,
      height: 40,
      borderRadius: RADIUS.full,
      backgroundColor: 'rgba(255,255,255,0.15)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    logoCircle: {
      width: 70,
      height: 70,
      borderRadius: 35,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 12,
    },
    logo: { width: 90, height: 90, marginBottom: 12 },
    brandName: { fontSize: 24, fontWeight: '800', color: '#fff' },

    card: {
      flex: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      padding: 28,
      paddingTop: 36,
    },
    heading: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 8 },
    sub: { fontSize: 14, color: colors.textSecondary, lineHeight: 22, marginBottom: 32 },
    emailText: { fontWeight: '700', color: colors.primary },

    otpRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 10,
      marginBottom: 36,
    },
    cell: {
      width: 48,
      height: 56,
      borderRadius: RADIUS.md,
      borderWidth: 1.5,
      borderColor: colors.border,
      backgroundColor: colors.card,
      textAlign: 'center',
      fontSize: 22,
      fontWeight: '700',
      color: colors.textPrimary,
    },
    cellFilled: {
      borderColor: colors.primary,
      backgroundColor: colors.primaryLight,
    },

    btn: {
      backgroundColor: colors.primary,
      height: 54,
      borderRadius: RADIUS.lg,
      justifyContent: 'center',
      alignItems: 'center',
      ...SHADOW.sm,
    },
    btnDisabled: { opacity: 0.6 },
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    resendRow: { alignItems: 'center', marginTop: 20 },
    resendText: { color: colors.primary, fontWeight: '700', fontSize: 14 },
    resendTextDisabled: { color: colors.textMuted },
  });
}
