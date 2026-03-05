/**
 * FAMILJ – Root Layout
 *
 * Initializes i18n, Supabase auth listener, and Expo Router navigation.
 */

import 'react-native-url-polyfill/auto';
import '../global.css';
import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as Linking from 'expo-linking';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { HeroUINativeProvider } from 'heroui-native';
import '../src/i18n';
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import { useFamilyStore } from '../src/stores/familyStore';
import { useEventsStore } from '../src/stores/eventStore';
import { useChildAuthStore } from '../src/stores/childAuthStore';
import { usePurchaseStore } from '../src/stores/purchaseStore';
import { initPurchases } from '../src/lib/purchases';
import { requestNotificationPermission } from '../src/lib/notifications';
import { supabase } from '../src/lib/supabase';

// Keep the native splash screen visible until we know where to route
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const { initialize, session, isInitialized, profile, user } = useAuthStore();
  const { loadFromProfile, initLanguage } = useSettingsStore();
  const { fetchFamily, family, isLoading: familyLoading, currentMemberRole, checkPendingInvite, reset: resetFamily } = useFamilyStore();
  const { pinVerified: childPinVerified } = useChildAuthStore();
  const { fetchCustomerInfo } = usePurchaseStore();
  const router = useRouter();
  const segments = useSegments();

  // Clear all user-scoped stores immediately when session is lost
  useEffect(() => {
    if (!user) {
      resetFamily();
      useEventsStore.getState().reset();
    }
  }, [user]);

  // Restore persisted language first, then initialize auth
  useEffect(() => {
    initLanguage().then(() => initialize());
    requestNotificationPermission();
  }, []);

  // Initialize RevenueCat when user is known
  useEffect(() => {
    if (user?.id) {
      initPurchases(user.id).then(() => fetchCustomerInfo());
    } else {
      // User logged out — clear purchase state
      usePurchaseStore.getState().reset();
    }
  }, [user?.id]);

  // Fetch family once user is known; if none found, check for a co-parent email invite
  useEffect(() => {
    if (!user) return;
    fetchFamily(user.id).then(() => {
      const { family: loaded } = useFamilyStore.getState();
      if (!loaded && user.email) {
        checkPendingInvite(user.email, user.id);
      }
    });
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

  // Route guard: auth → /auth, no family → /onboarding, child !pinVerified → /child-pin-login
  useEffect(() => {
    if (!isInitialized) return;
    const inAuthGroup = segments[0] === 'auth';
    const inOnboarding = segments[0] === 'onboarding';
    const inChildJoin = segments[0] === 'child-join';
    const inChildPinCreate = segments[0] === 'child-pin-create';
    const inChildPinLogin = segments[0] === 'child-pin-login';

    if (!session) {
      if (!inAuthGroup && !inChildJoin) router.replace('/auth');
      return;
    }

    // Logged in — wait for family fetch to settle before deciding
    if (familyLoading) return;

    if (family) {
      // Has a family — boot them out of auth/onboarding/child-join screens
      if (inAuthGroup || inOnboarding || inChildJoin) {
        router.replace('/(tabs)');
        return;
      }
      // Child PIN gate — must verify PIN before accessing tabs
      if (
        currentMemberRole === 'child' &&
        !childPinVerified &&
        !inChildPinLogin &&
        !inChildPinCreate
      ) {
        router.replace('/child-pin-login');
        return;
      }
    } else {
      // No family yet — must complete onboarding
      if (!inOnboarding) router.replace('/onboarding');
    }
  }, [session, isInitialized, familyLoading, family, segments, currentMemberRole, childPinVerified]);

  useEffect(() => {
    if (profile) loadFromProfile(profile);
  }, [profile]);

  // Hold rendering until auth is initialized AND family load has settled.
  // This prevents the onboarding screen flashing for users who already have a family.
  const isReady = isInitialized && !familyLoading;

  // Hide the native splash once ready — it already shows our logo + green bg
  useEffect(() => {
    if (isReady) SplashScreen.hideAsync();
  }, [isReady]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <HeroUINativeProvider>
        <StatusBar style="dark" />
        {isReady && (
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="paywall" options={{ presentation: 'modal' }} />
            <Stack.Screen name="customer-center" options={{ presentation: 'modal' }} />
          </Stack>
        )}
      </HeroUINativeProvider>
    </GestureHandlerRootView>
  );
}
