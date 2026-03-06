/**
 * FAMILJ – Auth Screen
 *
 * Supports two flows:
 *   1. OTP (magic link) – send 6-digit code to email
 *   2. Password – sign in or create account with email + password
 */

import React, { useState } from 'react';
import {
  Image,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { supabase } from '../src/lib/supabase';

const LOGO = require('../assets/FAMILU app logo-green(1000 x 500 px) (1).png');

type AuthMode = 'otp' | 'password';
type Step = 'email' | 'otp' | 'password';
type PasswordSubMode = 'signin' | 'signup';

export default function AuthScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const [authMode, setAuthMode] = useState<AuthMode>('otp');
  const [step, setStep] = useState<Step>('email');
  const [pwSubMode, setPwSubMode] = useState<PasswordSubMode>('signin');

  // ── OTP flow ──────────────────────────────────────────────────────────────

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
      Alert.alert(t('common.error'), err?.message ?? t('common.error'));
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
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? t('common.error'));
    } finally {
      setLoading(false);
    }
  };

  // ── Password flow ─────────────────────────────────────────────────────────

  const handlePasswordContinue = async () => {
    if (!email.trim()) return;
    setPassword('');
    setConfirmPassword('');
    setStep('password');
  };

  const handlePasswordAuth = async () => {
    if (!password) return;

    if (pwSubMode === 'signup') {
      if (password.length < 6) {
        Alert.alert(t('common.error'), t('auth.passwordTooShort'));
        return;
      }
      if (password !== confirmPassword) {
        Alert.alert(t('common.error'), t('auth.passwordMismatch'));
        return;
      }
    }

    setLoading(true);
    try {
      if (pwSubMode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
      }
      // Navigation handled by _layout.tsx auth guard
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? t('auth.wrongPassword'));
    } finally {
      setLoading(false);
    }
  };

  // ── Mode toggle pill ──────────────────────────────────────────────────────

  const toggleMode = (mode: AuthMode) => {
    setAuthMode(mode);
    setStep('email');
    setOtp('');
    setPassword('');
    setConfirmPassword('');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.inner}
      >
        {/* Logo */}
        <Image source={LOGO} style={styles.logo} resizeMode="contain" />
        <Text style={styles.tagline}>{t('onboarding.tagline')}</Text>

        {/* Auth mode toggle */}
        {step === 'email' && (
          <View style={styles.modeToggle}>
            <TouchableOpacity
              style={[styles.modeBtn, authMode === 'otp' && styles.modeBtnActive]}
              onPress={() => toggleMode('otp')}
              activeOpacity={0.75}
            >
              <Text style={[styles.modeBtnText, authMode === 'otp' && styles.modeBtnTextActive]}>
                {t('auth.useCode')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeBtn, authMode === 'password' && styles.modeBtnActive]}
              onPress={() => toggleMode('password')}
              activeOpacity={0.75}
            >
              <Text style={[styles.modeBtnText, authMode === 'password' && styles.modeBtnTextActive]}>
                {t('auth.usePassword')}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Email step (shared by both modes) */}
        {step === 'email' && (
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
              returnKeyType="next"
              onSubmitEditing={authMode === 'otp' ? handleSendOtp : handlePasswordContinue}
            />
            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.6 }]}
              onPress={authMode === 'otp' ? handleSendOtp : handlePasswordContinue}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FAFAF8" />
              ) : (
                <Text style={styles.buttonText}>
                  {authMode === 'otp' ? t('auth.sendCode') : t('auth.signIn')}
                </Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {/* OTP verification step */}
        {step === 'otp' && (
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
              {loading ? <ActivityIndicator color="#FAFAF8" /> : <Text style={styles.buttonText}>{t('auth.verifyCode')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.backBtn} onPress={() => setStep('email')}>
              <Text style={styles.backText}>{t('auth.changeEmail')}</Text>
            </TouchableOpacity>
          </>
        )}

        {/* Password step */}
        {step === 'password' && (
          <>
            <Text style={styles.sentText}>{email}</Text>
            <Text style={styles.label}>{t('auth.passwordLabel')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('auth.passwordPlaceholder')}
              placeholderTextColor="#AEAEB2"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoFocus
              returnKeyType={pwSubMode === 'signup' ? 'next' : 'done'}
              onSubmitEditing={pwSubMode === 'signin' ? handlePasswordAuth : undefined}
            />
            {pwSubMode === 'signup' && (
              <>
                <Text style={styles.label}>{t('auth.confirmPasswordLabel')}</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.confirmPasswordPlaceholder')}
                  placeholderTextColor="#AEAEB2"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  returnKeyType="done"
                  onSubmitEditing={handlePasswordAuth}
                />
              </>
            )}
            <TouchableOpacity
              style={[styles.button, loading && { opacity: 0.6 }]}
              onPress={handlePasswordAuth}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FAFAF8" />
              ) : (
                <Text style={styles.buttonText}>
                  {pwSubMode === 'signin' ? t('auth.signIn') : t('auth.createAccount')}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => setPwSubMode(pwSubMode === 'signin' ? 'signup' : 'signin')}
            >
              <Text style={styles.backText}>
                {pwSubMode === 'signin' ? t('auth.noAccount') : t('auth.alreadyHaveAccount')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.backBtn, { marginTop: 8 }]} onPress={() => setStep('email')}>
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
  logo: {
    width: 180,
    height: 90,
    alignSelf: 'center',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 16,
    color: '#6E6E7A',
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 22,
  },
  modeToggle: {
    flexDirection: 'row',
    backgroundColor: '#F0F0EC',
    borderRadius: 12,
    padding: 3,
    marginBottom: 24,
  },
  modeBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  modeBtnActive: {
    backgroundColor: '#FAFAF8',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
  modeBtnText: {
    fontSize: 14,
    color: '#AEAEB2',
    fontWeight: '500',
  },
  modeBtnTextActive: {
    color: '#2C2C2E',
    fontWeight: '600',
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
    backgroundColor: '#44B57F',
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
    marginBottom: 20,
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
