/**
 * FAMILJ – Tab Navigation Layout
 */

import { Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TouchableOpacity, View, Text, StyleSheet } from 'react-native';

/** Custom center tab button — raised dark pill with app name */
function FamiljTabButton({ onPress, accessibilityState }: any) {
  const focused = accessibilityState?.selected;
  return (
    <TouchableOpacity style={styles.centerBtnWrap} onPress={onPress} activeOpacity={0.85}>
      <View style={[styles.centerBtn, focused && styles.centerBtnFocused]}>
        <Text style={styles.centerBtnText}>FAMILJ</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function TabLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FAFAF8',
          borderTopColor: '#EBEBEB',
          height: 64,
          paddingBottom: 10,
        },
        tabBarActiveTintColor: '#2C2C2E',
        tabBarInactiveTintColor: '#AAAAAF',
        tabBarLabelStyle: {
          fontWeight: '600',
          fontSize: 10,
          letterSpacing: 0.3,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('weeklyView.title'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 20, color }}>≡</Text>,
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'FAMILJ',
          tabBarButton: (props) => <FamiljTabButton {...props} />,
          tabBarLabel: () => null,
          tabBarIcon: () => null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 18, color }}>⚙</Text>,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  centerBtnWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  centerBtn: {
    backgroundColor: '#2C2C2E',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 5,
  },
  centerBtnFocused: {
    backgroundColor: '#5B9CF6',
  },
  centerBtnText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2.5,
  },
  centerBtnTextFocused: {
    color: '#fff',
  },
});

