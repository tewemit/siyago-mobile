import { useI18n } from '../../context/I18nContext';
import { RADIUS, SHADOW, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { registerHost } from '../../services/auth';
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
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
  country: string;
  hotelName: string;
};

export default function RegisterHostScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ defaultValues: { country: 'Ethiopia' } });

  async function onSubmit(values: FormValues) {
    try {
      await registerHost({ ...values, email: values.email.trim().toLowerCase() });
      Alert.alert(t.host_registration_success, t.host_registration_success_msg);
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
              <Ionicons name={icon} size={18} color={colors.textMuted} />
              <TextInput
                style={styles.input}
                placeholder={placeholder}
                placeholderTextColor={colors.textMuted}
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
        <View style={styles.topPanel}>
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.logoCircle}>
            <Ionicons name="business" size={36} color="#fff" />
          </View>
          <Text style={styles.brandName}>Siyago</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.heading}>{t.register_as_host}</Text>
          <Text style={styles.sub}>{t.register_host_sub}</Text>

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
            name="country"
            label={t.country}
            placeholder="Ethiopia"
            rules={{ required: t.required }}
            icon="flag-outline"
            extra={{ autoCapitalize: 'words' }}
          />
          <InputField
            name="hotelName"
            label={t.hotel_name}
            placeholder="Siyago Boutique Hotel"
            rules={{ required: t.required }}
            icon="business-outline"
            extra={{ autoCapitalize: 'words' }}
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
              {isSubmitting ? t.applying : t.apply_now}
            </Text>
          </TouchableOpacity>

          <View style={styles.linkRow}>
            <Text style={styles.linkText}>{t.already_account} </Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
              <Text style={styles.link}>{t.sign_in}</Text>
            </TouchableOpacity>
          </View>
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
    brandName: { fontSize: 24, fontWeight: '800', color: '#fff' },

    card: {
      flex: 1,
      backgroundColor: colors.background,
      borderTopLeftRadius: RADIUS.xl,
      borderTopRightRadius: RADIUS.xl,
      padding: 28,
      paddingTop: 32,
    },
    heading: { fontSize: 22, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    sub: { fontSize: 14, color: colors.textSecondary, marginBottom: 24 },

    label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
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
    error: { color: colors.error, fontSize: 12, marginBottom: 8 },

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
    btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 24, marginBottom: 12 },
    linkText: { color: colors.textSecondary, fontSize: 14 },
    link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  });
}
