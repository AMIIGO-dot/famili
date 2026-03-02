/**
 * FAMILJ – Root Layout
 *
 * Initializes i18n, Supabase auth listener, and Expo Router navigation.
 */

import 'react-native-url-polyfill/auto';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Linking from 'expo-linking';
import '../src/i18n';
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useFamilyStore } from '../src/stores/familyStore';
import { supabase } from '../src/lib/supabase';

export default function RootLayout() {
  const { initialize, session, isInitialized, profile, user } = useAuthStore();
  const { loadFromProfile } = useSettingsStore();
  const { fetchFamily, family } = useFamilyStore();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    initialize();
  }, []);

  // Fetch family once user is known
  useEffect(() => {
    if (user) fetchFamily(user.id);
  }, [user]);

  // Handle magic link deep link callback
  useEffect(() => {
    const handleUrl = async (rawUrl: string) => {
      try {
        // Parse both query params and hash fragments (Supabase may use either)
        const url = new URL(rawUrl);
        const params: Record<string, string> = {};
        url.searchParams.forEach((v, k) => { params[k] = v; });
        // Also check fragment (#access_token=...&refresh_token=...)
        if (url.hash) {
          new URLSearchParams(url.hash.slice(1)).forEach((v, k) => { params[k] = v; });
        }

        if (params.access_token && params.refresh_token) {
          // Implicit flow — set session directly
          await supabase.auth.setSession({
            access_token: params.access_token,
            refresh_token: params.refresh_token,
          });
        } else if (params.token_hash && params.type) {
          // PKCE / OTP flow
          await supabase.auth.verifyOtp({
            type: params.type as any,
            token_hash: params.token_hash,
          });
        } else if (params.code) {
          // Authorization code flow
          await supabase.auth.exchangeCodeForSession(params.code);
        }
      } catch (_) {
        // Not an auth URL — ignore
      }
    };

    // Handle app opened via deep link
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Handle deep link while app is open
    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, []);

  // Route to onboarding when user is logged in but has no family
  useEffect(() => {
    if (!isInitialized) return;
    const inAuthGroup = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';

    if (!session && !inAuthGroup) {
      router.replace('/auth');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    } else if (session && !family && !inOnboarding && segments[0] !== '(tabs)') {
      router.replace('/onboarding');
    }
  }, [session, isInitialized, segments, family]);

  useEffect(() => {
    if (profile) loadFromProfile(profile);
  }, [profile]);

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
