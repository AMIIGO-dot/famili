/**
 * FAMILJ – Child PIN Login Screen
 *
 * Shown to returning child users on every cold start.
 * After correct PIN, sets pinVerified = true and routes to tabs.
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import PinPad from '../src/components/PinPad';
import { useChildAuthStore } from '../src/stores/childAuthStore';
import { useFamilyStore } from '../src/stores/familyStore';
import { useAuthStore } from '../src/stores/authStore';

export default function ChildPinLoginScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { verifyPin } = useChildAuthStore();
  const { currentMember } = useFamilyStore();
  const { user } = useAuthStore();

  const [attempts, setAttempts] = useState(0);
  const [error, setError] = useState(false);
  const [resetSignal, setResetSignal] = useState(0);

  const userId = user?.id ?? '';

  const handlePin = async (pin: string) => {
    const valid = await verifyPin(pin, userId);
    if (valid) {
      router.replace('/(tabs)');
    } else {
      setAttempts((n) => n + 1);
      setError(true);
      setTimeout(() => {
        setError(false);
        setResetSignal((n) => n + 1);
      }, 600);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* Member avatar */}
        {currentMember && (
          <>
            <View style={[styles.avatar, { backgroundColor: currentMember.color }]}>
              <Text style={styles.avatarInitial}>
                {currentMember.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text style={styles.greeting}>
              {t('childPin.loginGreeting', { name: currentMember.name })}
            </Text>
          </>
        )}

        <PinPad
          title={t('childPin.loginTitle')}
          subtitle={attempts > 1 ? t('childPin.wrongPin', { attempts }) : undefined}
          onComplete={handlePin}
          resetSignal={resetSignal}
          error={error}
        />

        {/* Forgot PIN — re-join with new code */}
        <TouchableOpacity
          style={styles.forgotBtn}
          onPress={() => router.replace('/child-join')}
          activeOpacity={0.7}
        >
          <Text style={styles.forgotText}>{t('childPin.forgot')}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  avatarInitial: { fontSize: 34, fontWeight: '800', color: '#fff' },
  greeting: { fontSize: 15, color: '#9999A6', marginBottom: 16 },
  forgotBtn: { marginTop: 32, padding: 8 },
  forgotText: { fontSize: 13, color: '#C7C7CC', textDecorationLine: 'underline' },
});
