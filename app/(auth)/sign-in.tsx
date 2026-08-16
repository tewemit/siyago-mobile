import { useI18n } from '../../context/I18nContext';
import { RADIUS, SHADOW, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { login } from '../../services/auth';
import { setPendingLogin } from '../../services/otpSession';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type FormValues = { email: string; password: string };

export default function SignInScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [showPass, setShowPass] = useState(false);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  async function onSubmit({ email, password }: FormValues) {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const { preAuthToken } = await login(cleanEmail, password);
      setPendingLogin(cleanEmail, password);
      router.push({ pathname: '/(auth)/otp', params: { preAuthToken, email: cleanEmail } });
    } catch (err: any) {
      Alert.alert(t.error, err?.response?.data?.message ?? 'Invalid email or password');
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Top brand panel */}
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
          <Text style={styles.brandTagline}>Your home away from home</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.heading}>{t.welcome_back}</Text>
          <Text style={styles.sub}>{t.sign_in_sub}</Text>

          <Text style={styles.label}>{t.email}</Text>
          <Controller
            control={control}
            name="email"
            rules={{
              required: t.required,
              pattern: { value: /^\S+@\S+\.\S+$/, message: t.invalid_email },
            }}
            render={({ field: { onChange, value, onBlur } }) => (
              <View style={[styles.inputWrapper, errors.email && styles.inputWrapperError]}>
                <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={colors.textMuted}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                />
              </View>
            )}
          />
          {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}

          <Text style={[styles.label, { marginTop: 16 }]}>{t.password}</Text>
          <Controller
            control={control}
            name="password"
            rules={{ required: t.required, minLength: { value: 6, message: 'Min 6 characters' } }}
            render={({ field: { onChange, value, onBlur } }) => (
              <View style={[styles.inputWrapper, errors.password && styles.inputWrapperError]}>
                <Ionicons name="lock-closed-outline" size={18} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={colors.textMuted}
                  secureTextEntry={!showPass}
                  autoCapitalize="none"
                  autoCorrect={false}
                  onChangeText={onChange}
                  onBlur={onBlur}
                  value={value}
                />
                <TouchableOpacity onPress={() => setShowPass((v) => !v)}>
                  <Ionicons
                    name={showPass ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            )}
          />
          {errors.password && <Text style={styles.error}>{errors.password.message}</Text>}

          <TouchableOpacity
            style={[styles.btn, isSubmitting && styles.btnDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>
              {isSubmitting ? t.sending : t.sign_in}
            </Text>
          </TouchableOpacity>

          <View style={styles.linkRow}>
            <Text style={styles.linkText}>{t.no_account} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/sign-up')}>
              <Text style={styles.link}>{t.sign_up}</Text>
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={styles.skipRow} onPress={() => router.replace('/(guest)')}>
            <Text style={styles.skipText}>Browse without signing in →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.primary },
  container: { flexGrow: 1 },

  topPanel: {
    alignItems: 'center',
    paddingTop: 72,
    paddingBottom: 40,
    backgroundColor: colors.primary,
    position: 'relative',
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
    zIndex: 1,
  },
  logo: {
    width: 110,
    height: 110,
    marginBottom: 12,
  },
  brandName: { fontSize: 28, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
  brandTagline: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },

  card: {
    flex: 1,
    backgroundColor: colors.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 28,
    paddingTop: 32,
  },
  heading: { fontSize: 24, fontWeight: '800', color: colors.textPrimary, marginBottom: 6 },
  sub: { fontSize: 14, color: colors.textSecondary, marginBottom: 28 },

  label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
    marginBottom: 4,
  },
  inputWrapperError: { borderColor: colors.error },
  input: { flex: 1, fontSize: 15, color: colors.textPrimary },
  error: { color: colors.error, fontSize: 12, marginBottom: 12 },

  btn: {
    backgroundColor: colors.primary,
    height: 54,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    ...SHADOW.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16, letterSpacing: 0.3 },

  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  linkText: { color: colors.textSecondary, fontSize: 14 },
  link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  skipRow: { alignItems: 'center', marginTop: 16 },
  skipText: { color: colors.textMuted, fontSize: 13 },
  });
}
