/**
 * FAMILJ – Customer Center Screen
 *
 * Displays the RevenueCat Customer Center where users can manage their
 * subscription: view active plans, request refunds, and restore purchases.
 */

import React, { useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import RevenueCatUI from 'react-native-purchases-ui';
import { usePurchaseStore } from '../src/stores/purchaseStore';
import type { CustomerInfo } from 'react-native-purchases';

export default function CustomerCenterScreen() {
  const router = useRouter();
  const fetchCustomerInfo = usePurchaseStore((s) => s.fetchCustomerInfo);

  const handleDismiss = useCallback(() => {
    router.back();
  }, [router]);

  const handleRestoreCompleted = useCallback(
    (_: { customerInfo: CustomerInfo }) => {
      fetchCustomerInfo();
    },
    [fetchCustomerInfo]
  );

  return (
    <View style={styles.container}>
      <RevenueCatUI.CustomerCenterView
        style={styles.container}
        shouldShowCloseButton
        onDismiss={handleDismiss}
        onRestoreCompleted={handleRestoreCompleted}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
});
