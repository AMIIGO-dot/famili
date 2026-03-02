/**
 * FAMILJ – Auth Screen (Magic Link + Apple Sign In)
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { supabase } from '../src/lib/supabase';

export default function AuthScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleMagicLink = async () => {
    if (!email.trim()) return;
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: {
          shouldCreateUser: true,
        },
      });
      if (error) throw error;
      setSent(true);
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

        {sent ? (
          <View style={styles.sentBox}>
            <Text style={styles.sentText}>{t('auth.magicLinkSent')}</Text>
          </View>
        ) : (
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
              onPress={handleMagicLink}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FAFAF8" />
              ) : (
                <Text style={styles.buttonText}>{t('auth.sendMagicLink')}</Text>
              )}
            </TouchableOpacity>
          </>
        )}
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
  sentBox: {
    backgroundColor: '#E8F4E8',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
  },
  sentText: {
    color: '#1E6B1E',
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
  },
});
