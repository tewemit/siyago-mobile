import { useI18n } from '../../context/I18nContext';
import { RADIUS, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { registerHost, checkEmailAvailability, type HostKycFiles } from '../../services/auth';
import GradientButton from '../../components/GradientButton';
import WizardStepper, { type WizardStep } from '../../components/host-wizard/WizardStepper';
import PropertyDetailsStep, { type PropertyDetails } from '../../components/host-wizard/PropertyDetailsStep';
import KycUploadStep from '../../components/host-wizard/KycUploadStep';
import LegalConsentStep from '../../components/host-wizard/LegalConsentStep';
import RegistrationSummary from '../../components/host-wizard/RegistrationSummary';
import ChipSelect from '../../components/host-wizard/ChipSelect';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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
  confirmPassword: string;
  country: string;
};

const CHANNEL_MANAGERS = ['Siteminder', 'Cloudbeds', 'Beds24', 'RMS Cloud', 'Little Hotelier', 'Ezee Technosys', 'Other'];

const EMPTY_PROPERTY: PropertyDetails = { hotelName: '', propertyType: '', numberOfRooms: '', propertyAddress: '' };

export default function RegisterHostScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [step, setStep] = useState(1);
  const [usePersonalEmail, setUsePersonalEmail] = useState(false);
  const [emailTaken, setEmailTaken] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [property, setProperty] = useState<PropertyDetails>(EMPTY_PROPERTY);
  const [propertyError, setPropertyError] = useState<string | undefined>();
  const [kyc, setKyc] = useState<HostKycFiles>({});
  const [useCM, setUseCM] = useState<boolean | null>(null);
  const [selectedCM, setSelectedCM] = useState('');
  const [agreedIds, setAgreedIds] = useState<number[]>([]);
  const [allAgreed, setAllAgreed] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const {
    control,
    trigger,
    getValues,
    formState: { errors },
    // Only re-check a field once the user leaves it (not on every
    // keystroke) — otherwise, once a field has errored once, the strength/
    // pattern checks re-run and flash an error mid-type before the user has
    // finished entering a fresh value.
  } = useForm<FormValues>({ defaultValues: { country: 'Ethiopia' }, reValidateMode: 'onBlur' });

  const steps: WizardStep[] = [
    { id: 1, label: t.step_account, icon: 'person-outline' },
    { id: 2, label: t.step_property, icon: 'business-outline' },
    { id: 3, label: t.step_verify, icon: 'shield-checkmark-outline' },
    { id: 4, label: t.step_connect, icon: 'link-outline' },
  ];
  const stepTitle = [t.step_account_title, t.step_property_title, t.step_verify_title, t.step_connect_title][step - 1];
  const stepSub = [t.step_account_sub, t.step_property_sub, t.step_verify_sub, t.step_connect_sub][step - 1];

  const allKycUploaded = !!(kyc.businessLicense && kyc.idProof && kyc.ownershipProof);

  async function goNext() {
    if (step === 1) {
      const valid = await trigger(['firstName', 'lastName', 'email', 'phoneNumber', 'country', 'password', 'confirmPassword']);
      if (!valid) return;

      // Catch a duplicate email right here, before the guest spends time on
      // property details and KYC uploads only to have the final submit
      // reject them — the backend still re-validates independently at
      // submit either way, this is purely a faster-feedback UX check.
      setCheckingEmail(true);
      try {
        const exists = await checkEmailAvailability(getValues('email'));
        if (exists) {
          setEmailTaken(true);
          setCheckingEmail(false);
          return;
        }
      } catch {
        // Pre-check is a nice-to-have — if it fails (network hiccup, etc.)
        // don't block the wizard; the backend still enforces uniqueness at
        // final submit.
      }
      setCheckingEmail(false);
    }
    if (step === 2) {
      if (!property.hotelName.trim()) {
        setPropertyError(t.required);
        return;
      }
      setPropertyError(undefined);
    }
    setStep((s) => Math.min(4, s + 1));
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleFinalSubmit() {
    if (!allAgreed) return;
    const values = getValues();
    setSubmitting(true);
    try {
      await registerHost({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email.trim().toLowerCase(),
        password: values.password,
        phoneNumber: values.phoneNumber,
        country: values.country,
        hotelName: property.hotelName,
        kyc,
      });
      Alert.alert(t.host_registration_success, t.host_registration_success_msg);
      router.replace('/(auth)/sign-in');
    } catch (err: any) {
      Alert.alert(t.error, err?.response?.data?.message ?? 'Registration failed');
    } finally {
      setSubmitting(false);
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
          <TouchableOpacity style={styles.backBtn} onPress={() => (step === 1 ? router.back() : goBack())}>
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.logoCircle}>
            <Ionicons name="business" size={36} color="#fff" />
          </View>
          <Text style={styles.brandName}>Siyago</Text>
        </View>

        <View style={styles.card}>
          <WizardStepper steps={steps} currentStep={step} />
          <Text style={styles.heading}>{stepTitle}</Text>
          <Text style={styles.sub}>{stepSub}</Text>

          {step === 1 && (
            <>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <InputField
                    name="firstName"
                    label={t.first_name}
                    placeholder="John"
                    rules={{ required: t.required }}
                    icon="person-outline"
                    extra={{ autoCapitalize: 'words' }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <InputField
                    name="lastName"
                    label={t.last_name}
                    placeholder="Doe"
                    rules={{ required: t.required }}
                    icon="person-outline"
                    extra={{ autoCapitalize: 'words' }}
                  />
                </View>
              </View>

              <View style={styles.emailHeaderRow}>
                <Text style={styles.label}>{usePersonalEmail ? t.personal_email : t.business_email}</Text>
                <TouchableOpacity onPress={() => setUsePersonalEmail((v) => !v)}>
                  <Text style={styles.toggleLink}>
                    {usePersonalEmail ? t.use_business_email : t.dont_have_business_email}
                  </Text>
                </TouchableOpacity>
              </View>
              <Controller
                control={control}
                name="email"
                rules={{
                  required: t.required,
                  pattern: { value: /^\S+@\S+\.\S+$/, message: t.invalid_email },
                }}
                render={({ field: { onChange, value, onBlur } }) => (
                  <View style={[styles.inputWrapper, (errors.email || emailTaken) && styles.inputWrapperError]}>
                    <Ionicons name="mail-outline" size={18} color={colors.textMuted} />
                    <TextInput
                      style={styles.input}
                      placeholder={usePersonalEmail ? 'you@gmail.com' : 'you@yourhotel.com'}
                      placeholderTextColor={colors.textMuted}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      onChangeText={(v) => { onChange(v); setEmailTaken(false); }}
                      onBlur={onBlur}
                      value={value}
                    />
                  </View>
                )}
              />
              {errors.email && <Text style={styles.error}>{errors.email.message}</Text>}
              {emailTaken && (
                <View style={styles.emailTakenBox}>
                  <Text style={styles.emailTakenText}>
                    {t.email_already_registered}{' '}
                    <Text style={styles.emailTakenLink} onPress={() => router.push('/(auth)/sign-in')}>
                      {t.sign_in}
                    </Text>{' '}
                    {t.email_already_registered_hint}
                  </Text>
                </View>
              )}
              {usePersonalEmail && <Text style={styles.hintText}>{t.personal_email_info}</Text>}

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
                extra={{ secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false }}
              />
              <InputField
                name="confirmPassword"
                label={t.confirm_password}
                placeholder="••••••••"
                rules={{
                  required: t.required,
                  validate: (value: string) => value === getValues('password') || t.passwords_dont_match,
                }}
                icon="lock-closed-outline"
                extra={{ secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false }}
              />
            </>
          )}

          {step === 2 && (
            <PropertyDetailsStep value={property} onChange={setProperty} hotelNameError={propertyError} />
          )}

          {step === 3 && <KycUploadStep files={kyc} onChange={setKyc} />}

          {step === 4 && (
            <View style={{ gap: 20 }}>
              <View>
                <Text style={styles.sectionTitle}>{t.channel_manager_question}</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <TouchableOpacity
                    style={[styles.cmBtn, useCM === true && styles.cmBtnActive]}
                    onPress={() => setUseCM(true)}
                  >
                    <Text style={[styles.cmBtnText, useCM === true && styles.cmBtnTextActive]}>{t.yes_i_do}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.cmBtn, useCM === false && styles.cmBtnActive]}
                    onPress={() => setUseCM(false)}
                  >
                    <Text style={[styles.cmBtnText, useCM === false && styles.cmBtnTextActive]}>{t.not_yet}</Text>
                  </TouchableOpacity>
                </View>
                {useCM === true && (
                  <View style={{ marginTop: 12 }}>
                    <Text style={styles.label}>{t.which_platform}</Text>
                    <ChipSelect options={CHANNEL_MANAGERS} value={selectedCM || null} onChange={setSelectedCM} />
                  </View>
                )}
                {useCM === false && <Text style={styles.hintText}>{t.no_channel_manager_info}</Text>}
              </View>

              <RegistrationSummary
                title={t.registration_summary}
                rows={[
                  { label: t.first_name, value: getValues('firstName') },
                  { label: t.last_name, value: getValues('lastName') },
                  { label: t.email, value: getValues('email') },
                  { label: t.phone_number, value: getValues('phoneNumber') },
                  { label: t.country, value: getValues('country') },
                  { label: t.hotel_name, value: property.hotelName },
                  { label: t.property_type, value: property.propertyType },
                  { label: t.number_of_rooms, value: property.numberOfRooms },
                  { label: t.full_address, value: property.propertyAddress },
                ]}
              />

              <LegalConsentStep
                agreedIds={agreedIds}
                onChangeAgreedIds={setAgreedIds}
                onAllAgreedChange={setAllAgreed}
              />
            </View>
          )}

          <View style={styles.navRow}>
            {step > 1 ? (
              <TouchableOpacity onPress={goBack} style={styles.navBackBtn}>
                <Ionicons name="chevron-back" size={16} color={colors.textSecondary} />
                <Text style={styles.navBackText}>{t.back}</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}

            {step < 4 ? (
              <GradientButton
                label={checkingEmail ? t.checking_email : step === 3 ? (allKycUploaded ? t.next : t.skip_and_continue) : t.next}
                onPress={goNext}
                icon="chevron-forward"
                size="compact"
                disabled={checkingEmail}
                loading={checkingEmail}
              />
            ) : (
              <GradientButton
                label={submitting ? t.applying : t.apply_now}
                onPress={handleFinalSubmit}
                disabled={!allAgreed}
                loading={submitting}
                size="compact"
              />
            )}
          </View>

          {step === 1 && (
            <View style={styles.linkRow}>
              <Text style={styles.linkText}>{t.already_account} </Text>
              <TouchableOpacity onPress={() => router.push('/(auth)/sign-in')}>
                <Text style={styles.link}>{t.sign_in}</Text>
              </TouchableOpacity>
            </View>
          )}
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
    heading: { fontSize: 20, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    sub: { fontSize: 13, color: colors.textSecondary, marginBottom: 20 },

    label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 6 },
    emailHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    toggleLink: { fontSize: 12, fontWeight: '600', color: colors.primary },
    hintText: { fontSize: 12, color: colors.primary, marginTop: 6, marginBottom: 4 },
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
    emailTakenBox: {
      backgroundColor: colors.error + '1A',
      borderWidth: 1,
      borderColor: colors.error,
      borderRadius: RADIUS.md,
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginBottom: 8,
    },
    emailTakenText: { color: colors.error, fontSize: 12, lineHeight: 17 },
    emailTakenLink: { fontWeight: '700', textDecorationLine: 'underline' },

    sectionTitle: { fontSize: 14, fontWeight: '700', color: colors.textPrimary },
    cmBtn: {
      flex: 1,
      paddingVertical: 12,
      borderRadius: RADIUS.lg,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
    },
    cmBtnActive: { borderColor: colors.primary, backgroundColor: colors.primary },
    cmBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    cmBtnTextActive: { color: '#fff' },

    navRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 24,
    },
    navBackBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 10 },
    navBackText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },

    linkRow: { flexDirection: 'row', justifyContent: 'center', marginTop: 20, marginBottom: 4 },
    linkText: { color: colors.textSecondary, fontSize: 14 },
    link: { color: colors.primary, fontWeight: '700', fontSize: 14 },
  });
}
