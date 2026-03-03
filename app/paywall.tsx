/**
 * FAMILJ – Paywall Screen
 *
 * Shows available subscription plans fetched from RevenueCat offerings.
 * Falls back to a static UI when RevenueCat is not configured (dev/CI).
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import type { PurchasesPackage } from 'react-native-purchases';
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

function PackageButton({
  pkg,
  onPress,
  isLoading,
}: {
  pkg: PurchasesPackage;
  onPress: () => void;
  isLoading: boolean;
}) {
  const { t } = useTranslation();
  const isAnnual = pkg.packageType === 'ANNUAL';
  return (
    <TouchableOpacity
      style={[styles.packageBtn, isAnnual && styles.packageBtnHighlight]}
      onPress={onPress}
      disabled={isLoading}
      activeOpacity={0.8}
    >
      {isAnnual && (
        <View style={styles.bestValueBadge}>
          <Text style={styles.bestValueText}>BEST VALUE</Text>
        </View>
      )}
      <Text style={[styles.packageTitle, isAnnual && styles.packageTitleHighlight]}>
        {pkg.product.title}
      </Text>
      <Text style={[styles.packagePrice, isAnnual && styles.packagePriceHighlight]}>
        {pkg.product.priceString}
      </Text>
      {isAnnual && pkg.product.introPrice && (
        <Text style={styles.trialLabel}>
          {pkg.product.introPrice.periodNumberOfUnits}-
          {pkg.product.introPrice.periodUnit.toLowerCase()} free trial
        </Text>
      )}
    </TouchableOpacity>
  );
}

export default function PaywallScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { offerings, isLoading, fetchOfferings, purchasePackage, restorePurchases, isPremium } =
    usePurchaseStore();

  useEffect(() => {
    if (isPurchasesConfigured) {
      fetchOfferings();
    }
  }, []);

  // Dismiss if user is already premium (e.g. after restore)
  useEffect(() => {
    if (isPremium) {
      Alert.alert(
        t('subscription.premium'),
        '✓ Your premium access is active!',
        [{ text: t('common.done'), onPress: () => router.back() }]
      );
    }
  }, [isPremium]);

  const handlePurchase = async (pkg: PurchasesPackage) => {
    const success = await purchasePackage(pkg);
    if (success) {
      Alert.alert(
        t('subscription.premium'),
        '🎉 Welcome to FAMILJ Premium!',
        [{ text: t('common.done'), onPress: () => router.back() }]
      );
    }
  };

  const handleRestore = async () => {
    const restored = await restorePurchases();
    if (restored) {
      Alert.alert(t('subscription.premium'), '✓ Purchase restored!');
    } else {
      Alert.alert(t('common.error'), 'No active subscription found.');
    }
  };

  const packages = offerings?.current?.availablePackages ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
          <Ionicons name="close" size={22} color="#1C1C1E" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('subscription.premium')}</Text>
        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* Hero */}
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="star" size={32} color="#F5A623" />
          </View>
          <Text style={styles.heroTitle}>FAMILJ Premium</Text>
          <Text style={styles.heroSub}>
            Everything your family needs, without limits.
          </Text>
        </View>

        {/* Features */}
        <View style={styles.featuresCard}>
          {FEATURE_KEYS.map((key) => (
            <View key={key} style={styles.featureRow}>
              <View style={styles.featureIconWrap}>
                <Ionicons
                  name={FEATURE_ICONS[key] as any}
                  size={18}
                  color="#5B9CF6"
                />
              </View>
              <Text style={styles.featureLabel}>
                {t(`subscription.features.${key}`)}
              </Text>
              <Ionicons name="checkmark" size={16} color="#34C759" />
            </View>
          ))}
        </View>

        {/* Packages */}
        {isLoading ? (
          <ActivityIndicator color="#5B9CF6" style={{ marginVertical: 32 }} />
        ) : packages.length > 0 ? (
          <View style={styles.packages}>
            {packages.map((pkg: PurchasesPackage) => (
              <PackageButton
                key={pkg.identifier}
                pkg={pkg}
                onPress={() => handlePurchase(pkg)}
                isLoading={isLoading}
              />
            ))}
          </View>
        ) : (
          /* Fallback when RevenueCat not configured */
          <View style={styles.devNotice}>
            <Ionicons name="information-circle-outline" size={20} color="#AEAEB2" />
            <Text style={styles.devNoticeText}>
              Configure EXPO_PUBLIC_RC_IOS_KEY / EXPO_PUBLIC_RC_ANDROID_KEY to enable in-app purchases.
            </Text>
          </View>
        )}

        {/* Restore */}
        <TouchableOpacity style={styles.restoreBtn} onPress={handleRestore}>
          <Text style={styles.restoreText}>{t('subscription.restorePurchases')}</Text>
        </TouchableOpacity>

        {/* Legal */}
        <Text style={styles.legalText}>
          {Platform.OS === 'ios'
            ? 'Payment will be charged to your Apple ID. Subscription renews automatically unless cancelled 24h before the end of the current period.'
            : 'Payment will be charged to your Google Account. Subscription renews automatically unless cancelled before renewal date.'}
        </Text>
      </ScrollView>
    </SafeAreaView>
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

  scroll: { paddingBottom: 48 },

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

  packages: {
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  packageBtn: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#F2F2F7',
    borderWidth: 2,
    borderColor: 'transparent',
    position: 'relative',
    overflow: 'hidden',
  },
  packageBtnHighlight: {
    backgroundColor: '#EAF1FF',
    borderColor: '#5B9CF6',
  },
  bestValueBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: '#5B9CF6',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  bestValueText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  packageTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1C1C1E',
    marginBottom: 4,
  },
  packageTitleHighlight: { color: '#1C54A5' },
  packagePrice: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1C1C1E',
  },
  packagePriceHighlight: { color: '#1C54A5' },
  trialLabel: {
    fontSize: 12,
    color: '#34C759',
    fontWeight: '600',
    marginTop: 4,
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

  restoreBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 8,
  },
  restoreText: {
    fontSize: 14,
    color: '#5B9CF6',
    fontWeight: '500',
  },

  legalText: {
    fontSize: 11,
    color: '#AEAEB2',
    textAlign: 'center',
    paddingHorizontal: 28,
    lineHeight: 16,
  },
});
