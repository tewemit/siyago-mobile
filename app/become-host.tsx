import { useI18n } from '../context/I18nContext';
import { useAuth } from '../context/AuthContext';
import { RADIUS, type ThemeColors } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { applyForHost, type HostKycFiles } from '../services/auth';
import GradientButton from '../components/GradientButton';
import WizardStepper, { type WizardStep } from '../components/host-wizard/WizardStepper';
import PropertyDetailsStep, { type PropertyDetails } from '../components/host-wizard/PropertyDetailsStep';
import KycUploadStep from '../components/host-wizard/KycUploadStep';
import LegalConsentStep from '../components/host-wizard/LegalConsentStep';
import RegistrationSummary from '../components/host-wizard/RegistrationSummary';
import ChipSelect from '../components/host-wizard/ChipSelect';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
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

const CHANNEL_MANAGERS = ['Siteminder', 'Cloudbeds', 'Beds24', 'RMS Cloud', 'Little Hotelier', 'Ezee Technosys', 'Other'];

const EMPTY_PROPERTY: PropertyDetails = { hotelName: '', propertyType: '', numberOfRooms: '', propertyAddress: '' };

export default function BecomeHostScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, refresh } = useAuth();
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [step, setStep] = useState(1);
  const [property, setProperty] = useState<PropertyDetails>(EMPTY_PROPERTY);
  const [propertyError, setPropertyError] = useState<string | undefined>();
  const [phoneNumber, setPhoneNumber] = useState(user?.phoneNumber ?? '');
  const [kyc, setKyc] = useState<HostKycFiles>({});
  const [useCM, setUseCM] = useState<boolean | null>(null);
  const [selectedCM, setSelectedCM] = useState('');
  const [agreedIds, setAgreedIds] = useState<number[]>([]);
  const [allAgreed, setAllAgreed] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const steps: WizardStep[] = [
    { id: 1, label: t.step_property, icon: 'business-outline' },
    { id: 2, label: t.step_verify, icon: 'shield-checkmark-outline' },
    { id: 3, label: t.step_connect, icon: 'link-outline' },
  ];
  const stepTitle = [t.step_property_title, t.step_verify_title, t.step_connect_title][step - 1];
  const stepSub = [t.step_property_sub, t.step_verify_sub, t.step_connect_sub][step - 1];

  const allKycUploaded = !!(kyc.businessLicense && kyc.idProof && kyc.ownershipProof);

  function goNext() {
    if (step === 1) {
      if (!property.hotelName.trim()) {
        setPropertyError(t.required);
        return;
      }
      setPropertyError(undefined);
    }
    setStep((s) => Math.min(3, s + 1));
  }

  function goBack() {
    setStep((s) => Math.max(1, s - 1));
  }

  async function handleFinalSubmit() {
    if (!allAgreed) return;
    setSubmitting(true);
    try {
      await applyForHost({
        hotelName: property.hotelName.trim(),
        phoneNumber: phoneNumber.trim() || undefined,
        kyc,
        agreedDocumentIds: agreedIds,
      });
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
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.topBar}>
          <TouchableOpacity style={styles.backBtn} onPress={() => (step === 1 ? router.back() : goBack())}>
            <Ionicons name="arrow-back" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.topTitle}>{t.become_host}</Text>
          <View style={{ width: 38 }} />
        </View>

        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <WizardStepper steps={steps} currentStep={step} />
          <Text style={styles.heading}>{stepTitle}</Text>
          <Text style={styles.sub}>{stepSub}</Text>

          {step === 1 && (
            <View style={{ gap: 16 }}>
              <PropertyDetailsStep value={property} onChange={setProperty} hotelNameError={propertyError} />
              <View>
                <Text style={styles.label}>{t.phone_number}</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+251912345678"
                  placeholderTextColor={colors.textMuted}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                  keyboardType="phone-pad"
                />
              </View>
            </View>
          )}

          {step === 2 && <KycUploadStep files={kyc} onChange={setKyc} />}

          {step === 3 && (
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
                  { label: t.full_name, value: `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() },
                  { label: t.email, value: user?.email },
                  { label: t.phone_number, value: phoneNumber },
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

            {step < 3 ? (
              <GradientButton
                label={step === 2 ? (allKycUploaded ? t.next : t.skip_and_continue) : t.next}
                onPress={goNext}
                icon="chevron-forward"
                size="compact"
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
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
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

    heading: { fontSize: 19, fontWeight: '800', color: colors.textPrimary, marginBottom: 4 },
    sub: { fontSize: 13, color: colors.textSecondary, marginBottom: 20 },

    label: { fontSize: 13, fontWeight: '600', color: colors.textPrimary, marginBottom: 8 },
    hintText: { fontSize: 12, color: colors.primary, marginTop: 6 },
    input: {
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.border,
      borderRadius: RADIUS.md,
      paddingHorizontal: 14,
      paddingVertical: 13,
      fontSize: 15,
      color: colors.textPrimary,
    },

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
  });
}
