/**
 * FAMILJ – Auth Screen (OTP code sign-in)
 */

import React, { useState } from 'react';
import {
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

export default function AuthScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'email' | 'otp'>('email');

  const handleSendOtp = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { shouldCreateUser: true },
      });
      if (error) throw error;
      setStep('otp');
    } catch (err: any) {
      const msg = err?.message ?? t('common.error');
      console.error('[Auth] signInWithOtp error:', err);
      Alert.alert('Email not sent', msg);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otp.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email.trim().toLowerCase(),
        token: otp.trim(),
        type: 'email',
      });
      if (error) throw error;
      // Navigation handled automatically by _layout.tsx auth guard
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message ?? t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        <Text style={styles.appName}>{t('common.appName')}</Text>
        <Text style={styles.tagline}>{t('onboarding.tagline')}</Text>

        {step === 'email' ? (
          <>
            <Text style={styles.label}>{t('auth.emailLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor="#AEAEB2"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.6 }]}
              onPress={handleSendOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FAFAF8" />
              ) : (
                <Text style={styles.buttonText}>{t('auth.sendCode')}</Text>
              )}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Text style={styles.sentText}>{t('auth.otpSent', { email })}</Text>
            <Text style={styles.label}>{t('auth.otpLabel')}</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="000000"
              placeholderTextColor="#AEAEB2"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.6 }]}
              onPress={handleVerifyOtp}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FAFAF8" />
              ) : (
                <Text style={styles.buttonText}>{t('auth.verifyCode')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep('email')}>
              <Text style={styles.backText}>{t('auth.changeEmail')}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Child join entry point */}
        <TouchableOpacity
          style={styles.childJoinBtn}
          onPress={() => router.push('/child-join')}
          activeOpacity={0.7}
        >
          <Text style={styles.childJoinText}>{t('childJoin.joinAsChild')}</Text>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  appName: {
    fontSize: 36,
    fontWeight: '800',
    color: '#2C2C2E',
    letterSpacing: 3,
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: '#6E6E7A',
    textAlign: 'center',
    marginBottom: 48,
    lineHeight: 22,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6E6E7A',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  input: {
    backgroundColor: '#F0F0EC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#2C2C2E',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  buttonText: {
    color: '#FAFAF8',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  sentText: {
    color: '#6E6E7A',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 28,
  },
  otpInput: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: 8,
    textAlign: 'center',
  },
  backBtn: {
    marginTop: 16,
    alignItems: 'center',
  },
  backText: {
    color: '#6E6E7A',
    fontSize: 14,
  },
  childJoinBtn: {
    marginTop: 32,
    alignItems: 'center',
    padding: 8,
  },
  childJoinText: {
    color: '#AEAEB2',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
});
