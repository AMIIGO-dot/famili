/**
 * FAMILJ – Root Layout
 *
 * Initializes i18n, Supabase auth listener, and Expo Router navigation.
 */

import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import '../src/i18n'; // Initialize i18n before any screen renders
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';

export default function RootLayout() {
  const { initialize, profile } = useAuthStore();
  const { loadFromProfile } = useSettingsStore();

  useEffect(() => {
    initialize();
  }, []);

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
