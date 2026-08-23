import { useMemo } from 'react';
import { RADIUS, type ThemeColors } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export type WizardStep = {
  id: number;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export default function WizardStepper({
  steps,
  currentStep,
}: {
  steps: WizardStep[];
  currentStep: number;
}) {
  const { colors } = useTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      {steps.map((step, i) => {
        const done = currentStep > step.id;
        const active = currentStep === step.id;
        return (
          <View key={step.id} style={styles.stepWrap}>
            <View style={styles.circleCol}>
              <View
                style={[
                  styles.circle,
                  done && styles.circleDone,
                  active && styles.circleActive,
                ]}
              >
                <Ionicons
                  name={done ? 'checkmark' : step.icon}
                  size={16}
                  color={done || active ? '#fff' : colors.textMuted}
                />
              </View>
              <Text style={[styles.label, (done || active) && styles.labelActive]} numberOfLines={1}>
                {step.label}
              </Text>
            </View>
            {i < steps.length - 1 && (
              <View style={[styles.connector, done && styles.connectorDone]} />
            )}
          </View>
        );
      })}
    </View>
  );
}

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      marginBottom: 24,
      paddingHorizontal: 4,
    },
    stepWrap: { flexDirection: 'row', alignItems: 'flex-start', flex: 1 },
    circleCol: { alignItems: 'center', width: 56 },
    circle: {
      width: 32,
      height: 32,
      borderRadius: RADIUS.full,
      borderWidth: 2,
      borderColor: colors.border,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    circleActive: { backgroundColor: colors.primary, borderColor: colors.primary },
    circleDone: { backgroundColor: colors.success, borderColor: colors.success },
    label: { marginTop: 4, fontSize: 10, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
    labelActive: { color: colors.textPrimary },
    connector: {
      flex: 1,
      height: 2,
      backgroundColor: colors.border,
      marginTop: 15,
      marginHorizontal: 2,
    },
    connectorDone: { backgroundColor: colors.success },
  });
}
