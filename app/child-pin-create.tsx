/**
 * FAMILJ – Child PIN Create Screen
 *
 * After redeeming an invite code, the child sets their 4-digit PIN.
 * PIN is stored in SecureStore — no email, no password needed.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import PinPad from '../src/components/PinPad';
import { useChildAuthStore } from '../src/stores/childAuthStore';
import { useFamilyStore } from '../src/stores/familyStore';

export default function ChildPinCreateScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { pendingJoin, createPin } = useChildAuthStore();
  const { members } = useFamilyStore();

  const [step, setStep] = useState<'create' | 'confirm'>('create');
  const [firstPin, setFirstPin] = useState('');
  const [resetSignal, setResetSignal] = useState(0);
  const [error, setError] = useState(false);

  const member = pendingJoin
    ? members.find((m) => m.id === pendingJoin.result.memberId)
    : null;

  const userId = pendingJoin?.userId ?? 'dev-child-id';

  const handleCreate = (pin: string) => {
    setFirstPin(pin);
    setStep('confirm');
    setResetSignal((n) => n + 1);
  };

  const handleConfirm = async (pin: string) => {
    if (pin !== firstPin) {
      setError(true);
      setTimeout(() => {
        setError(false);
        setStep('create');
        setFirstPin('');
        setResetSignal((n) => n + 1);
      }, 600);
      return;
    }
    await createPin(pin, userId);
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Avatar */}
        {member && (
          <View style={[styles.avatar, { backgroundColor: member.color }]}>
            <Text style={styles.avatarInitial}>{member.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}

        <PinPad
          title={
            step === 'create'
              ? t('childPin.createTitle', { name: member?.name ?? '' })
              : t('childPin.confirmTitle')
          }
          subtitle={
            step === 'create'
              ? t('childPin.createSub')
              : t('childPin.confirmSub')
          }
          onComplete={step === 'create' ? handleCreate : handleConfirm}
          resetSignal={resetSignal}
          error={error}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  avatarInitial: { fontSize: 30, fontWeight: '800', color: '#fff' },
});
