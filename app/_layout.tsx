/**
 * FAMILJ – Root Layout
 *
 * Initializes i18n, Supabase auth listener, and Expo Router navigation.
 */

import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../src/i18n'; // Initialize i18n before any screen renders
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';

export default function RootLayout() {
  const { initialize, session, isInitialized, profile } = useAuthStore();
  const { loadFromProfile } = useSettingsStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initialize();
  }, []);

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === 'auth';

    if (!session && !inAuthGroup) {
      router.replace('/auth');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, isInitialized, segments]);

  useEffect(() => {
    if (profile) {
      loadFromProfile(profile);
    }
  }, [profile]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="onboarding" />
      </Stack>
    </>
  );
}
