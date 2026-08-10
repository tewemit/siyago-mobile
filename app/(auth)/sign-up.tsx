import { useI18n } from '../../context/I18nContext';
import { COLORS, RADIUS, SHADOW } from '../../constants/theme';
import { register } from '../../services/auth';
import { useRouter } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import {
  Alert,
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

type FormValues = {
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  password: string;
};

export default function SignUpScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>();

  async function onSubmit(values: FormValues) {
    try {
      await register({ ...values, email: values.email.trim().toLowerCase() });
      Alert.alert(
        t.create_account,
        'Account created! Please check your email to verify your account, then sign in.',
      );
      router.replace('/(auth)/sign-in');
    } catch (err: any) {
      Alert.alert(t.error, err?.response?.data?.message ?? 'Registration failed');
    }
  }

  function InputField({
    name,
    label,
    placeholder,
    rules,
    icon,
    extra,
  }: {
    name: keyof FormValues;
    label: string;
    placeholder: string;
    rules: object;
    icon: keyof typeof Ionicons.glyphMap;
    extra?: object;
  }) {
    return (
      <View style={{ marginBottom: 4 }}>
        <Text style={styles.label}>{label}</Text>
        <Controller
          control={control}
          name={name}
          rules={rules}
          render={({ field: { onChange, value, onBlur } }) => (
            <View style={[styles.inputWrapper, errors[name] && styles.inputWrapperError]}>
              <Ionicons name={icon} size={18} color={COLORS.textMuted} />
              <TextInput
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor={COLORS.textMuted}
                onChangeText={onChange}
                onBlur={onBlur}
                value={value}
                {...extra}
              />
            </View>
          )}
        />
        {errors[name] && (
          <Text style={styles.error}>{errors[name]?.message as string}</Text>
        )}
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Top panel */}
        <View style={styles.topPanel}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.logoCircle}>
            <Ionicons name="home" size={36} color="#fff" />
          </View>
          <Text style={styles.brandName}>Siyago</Text>
        </View>

        {/* Form card */}
        <View style={styles.card}>
          <Text style={styles.heading}>{t.create_account}</Text>
          <Text style={styles.sub}>Join thousands of travelers</Text>

          <InputField
            name="firstName"
            label={t.first_name}
            placeholder="John"
            rules={{ required: t.required }}
            icon="person-outline"
            extra={{ autoCapitalize: 'words' }}
          />
          <InputField
            name="lastName"
            label={t.last_name}
            placeholder="Doe"
            rules={{ required: t.required }}
            icon="person-outline"
            extra={{ autoCapitalize: 'words' }}
          />
          <InputField
            name="email"
            label={t.email}
            placeholder="you@example.com"
            rules={{
              required: t.required,
              pattern: { value: /^\S+@\S+\.\S+$/, message: t.invalid_email },
            }}
            icon="mail-outline"
            extra={{ keyboardType: 'email-address', autoCapitalize: 'none' }}
          />
          <InputField
            name="phoneNumber"
            label={t.phone_number}
            placeholder="+251912345678"
            rules={{
              required: t.required,
              pattern: { value: /^\+?[1-9]\d{1,14}$/, message: t.invalid_phone },
            }}
            icon="call-outline"
            extra={{ keyboardType: 'phone-pad' }}
          />
          <InputField
            name="password"
            label={t.password}
            placeholder="••••••••"
            rules={{
              required: t.required,
              minLength: { value: 8, message: t.min_8_chars },
              pattern: {
                value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                message: t.password_strength_hint,
              },
            }}
            icon="lock-closed-outline"
            extra={{ secureTextEntry: true }}
          />

          <TouchableOpacity
            style={[styles.btn, isSubmitting && styles.btnDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            <Text style={styles.btnText}>
              {isSubmitting ? t.sending : t.create_account}
            </Text>
          </TouchableOpacity>

          <View style={styles.linkRow}>
            <Text style={styles.linkText}>{t.already_account} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
              <Text style={styles.link}>{t.sign_in}</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.linkRow}>
            <Text style={styles.linkText}>{t.have_property_to_list} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/register-host')}>
              <Text style={styles.link}>{t.register_as_host}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.primary },
  container: { flexGrow: 1 },

  topPanel: {
    alignItems: 'center',
    paddingTop: 60,
    paddingBottom: 36,
    backgroundColor: COLORS.primary,
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
  brandName: { fontSize: 24, fontWeight: '800', color: '#fff' },

  card: {
    flex: 1,
    backgroundColor: COLORS.background,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: 28,
    paddingTop: 32,
  },
  heading: { fontSize: 22, fontWeight: '800', color: COLORS.textPrimary, marginBottom: 4 },
  sub: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 24 },

  label: { fontSize: 13, fontWeight: '600', color: COLORS.textPrimary, marginBottom: 6 },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.card,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    height: 52,
    gap: 10,
    marginBottom: 4,
  },
  inputWrapperError: { borderColor: COLORS.error },
  input: { flex: 1, fontSize: 15, color: COLORS.textPrimary },
  error: { color: COLORS.error, fontSize: 12, marginBottom: 8 },

  btn: {
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: RADIUS.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
    ...SHADOW.sm,
  },
  btnDisabled: { opacity: 0.6 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

  linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, marginBottom: 12 },
  linkText: { color: COLORS.textSecondary, fontSize: 14 },
  link: { color: COLORS.primary, fontWeight: '700', fontSize: 14 },
});
