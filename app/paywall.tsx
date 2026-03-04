/**
 * FAMILJ – Paywall Screen
 *
 * Uses the RevenueCat native Paywall UI (RevenueCatUI.Paywall).
 * The paywall design and copy are configured in the RevenueCat dashboard.
 *
 * Falls back to a feature-list screen when RevenueCat is not yet configured
 * (e.g. running in Expo Go or CI without native modules).
 */

import React, { useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type {
  CustomerInfo,
  PurchasesStoreTransaction,
  PurchasesError,
} from 'react-native-purchases';
import RevenueCatUI from 'react-native-purchases-ui';
import { usePurchaseStore } from '../src/stores/purchaseStore';
import { isPurchasesConfigured } from '../src/lib/purchases';

const FEATURE_KEYS = [
  'unlimitedMembers',
  'aiParsing',
  'sundaySummary',
  'widget',
  'advancedRecurrence',
  'pdfExport',
] as const;

const FEATURE_ICONS: Record<string, string> = {
  unlimitedMembers: 'people-outline',
  aiParsing: 'sparkles-outline',
  sundaySummary: 'sunny-outline',
  widget: 'phone-portrait-outline',
  advancedRecurrence: 'repeat-outline',
  pdfExport: 'document-outline',
};

// ─── Fallback shown when SDK is not configured (Dev / CI) ─────────────────────

function DevFallback({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('subscription.premium')}</Text>
        <View style={{ width: 36 }} />
      </View>
      <ScrollView contentContainerStyle={{ paddingBottom: 48 }}>
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="star" size={32} color="#F5A623" />
          </View>
          <Text style={styles.heroTitle}>FAMILU Premium</Text>
          <Text style={styles.heroSub}>
            Everything your family needs, without limits.
          </Text>
        </View>
        <View style={styles.featuresCard}>
          {FEATURE_KEYS.map((key) => (
            <View key={key} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Ionicons name={FEATURE_ICONS[key] as any} size={18} color="#44B57F" />
              </View>
              <Text style={styles.featureLabel}>
                {t(`subscription.features.${key}`)}
              </Text>
              <Ionicons name="checkmark" size={16} color="#34C759" />
            </View>
          ))}
        </View>
        <View style={styles.devNotice}>
          <Ionicons name="information-circle-outline" size={20} color="#AEAEB2" />
          <Text style={styles.devNoticeText}>
            Set EXPO_PUBLIC_RC_API_KEY in .env and run a development build to
            enable in-app purchases.
          </Text>
        </View>
        <Text style={styles.legalText}>
          {Platform.OS === 'ios'
            ? 'Payment charged to your Apple ID. Renews automatically unless cancelled.'
            : 'Payment charged to your Google Account. Renews automatically unless cancelled.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function PaywallScreen() {
  const router = useRouter();
  const fetchCustomerInfo = usePurchaseStore((s) => s.fetchCustomerInfo);

  const handleDismiss = useCallback(() => {
    router.back();
  }, [router]);

  const handlePurchaseCompleted = useCallback(
    (_: { customerInfo: CustomerInfo; storeTransaction: PurchasesStoreTransaction }) => {
      fetchCustomerInfo();
      router.back();
    },
    [router, fetchCustomerInfo]
  );

  const handleRestoreCompleted = useCallback(
    (_: { customerInfo: CustomerInfo }) => {
      fetchCustomerInfo();
      router.back();
    },
    [router, fetchCustomerInfo]
  );

  const handlePurchaseError = useCallback(
    ({ error }: { error: PurchasesError }) => {
      console.warn('[Paywall] purchase error:', error.message);
    },
    []
  );

  if (!isPurchasesConfigured) {
    return <DevFallback onClose={handleDismiss} />;
  }

  return (
    <View style={styles.safe}>
      <RevenueCatUI.Paywall
        options={{ displayCloseButton: true }}
        onDismiss={handleDismiss}
        onPurchaseCompleted={handlePurchaseCompleted}
        onPurchaseCancelled={handleDismiss}
        onRestoreCompleted={handleRestoreCompleted}
        onPurchaseError={handlePurchaseError}
        onRestoreError={({ error }) =>
          console.warn('[Paywall] restore error:', error.message)
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5EA',
  },
  closeBtn: {
    width: 36, height: 36,
    borderRadius: 18,
    backgroundColor: '#F2F2F7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#1C1C1E',
  },

  hero: {
    alignItems: 'center',
    paddingTop: 32,
    paddingBottom: 24,
    paddingHorizontal: 24,
  },
  heroIcon: {
    width: 72, height: 72,
    borderRadius: 22,
    backgroundColor: '#FFF8EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1C1C1E',
    letterSpacing: -0.5,
  },
  heroSub: {
    fontSize: 15,
    color: '#636366',
    textAlign: 'center',
    marginTop: 6,
    lineHeight: 22,
  },

  featuresCard: {
    marginHorizontal: 20,
    backgroundColor: '#F9F9FB',
    borderRadius: 16,
    padding: 4,
    marginBottom: 24,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    paddingHorizontal: 12,
    gap: 12,
  },
  featureIconWrap: {
    width: 32, height: 32,
    borderRadius: 10,
    backgroundColor: '#EAF1FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureLabel: {
    flex: 1,
    fontSize: 14,
    color: '#1C1C1E',
    fontWeight: '500',
  },

  devNotice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 24,
    backgroundColor: '#F2F2F7',
    padding: 16,
    borderRadius: 12,
  },
  devNoticeText: {
    flex: 1,
    fontSize: 13,
    color: '#636366',
    lineHeight: 18,
  },

  legalText: {
    fontSize: 11,
    color: '#AEAEB2',
    textAlign: 'center',
    paddingHorizontal: 28,
    lineHeight: 16,
    marginTop: 8,
  },
});
