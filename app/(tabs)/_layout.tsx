/**
 * FAMILJ – Tab Navigation Layout
 */

import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FAFAF8',
          borderTopColor: '#E8E8E4',
        },
        tabBarActiveTintColor: '#2C2C2E',
        tabBarInactiveTintColor: '#9999A6',
        tabBarLabelStyle: {
          fontWeight: '500',
          fontSize: 11,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('weeklyView.title'),
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          tabBarIcon: () => null,
        }}
      />
    </Tabs>
  );
}
