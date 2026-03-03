/**
 * FAMILJ - Tab Navigation Layout
 * White pill with a sliding animated active indicator (Reanimated spring).
 * Gives the "liquid" morphing feel when switching tabs.
 */

import { Tabs } from 'expo-router';
import { Platform, View, Text, Pressable, StyleSheet, LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useDerivedValue,
} from 'react-native-reanimated';

type IoniconName = React.ComponentProps<typeof Ionicons>['name'];

const TAB_CONFIG: Record<string, { focused: IoniconName; outline: IoniconName; label: string }> = {
  index:    { focused: 'calendar',  outline: 'calendar-outline',  label: 'Vecka'   },
  today:    { focused: 'sunny',     outline: 'sunny-outline',     label: 'Min dag' },
  family:   { focused: 'people',    outline: 'people-outline',    label: 'Familj'  },
  settings: { focused: 'settings',  outline: 'settings-outline',  label: 'Inst.'   },
};

const SPRING = {
  damping: 18,
  stiffness: 200,
  mass: 0.8,
};

function FamiljTabBar({ state, navigation }: BottomTabBarProps) {
  const tabCount = state.routes.length;
  const pillWidth = useSharedValue(0);
  const activeIndex = useSharedValue(state.index);

  // Track active index changes
  if (activeIndex.value !== state.index) {
    activeIndex.value = state.index;
  }

  const tabItemWidth = useDerivedValue(() => pillWidth.value / tabCount);

  // Sliding indicator translateX
  const indicatorStyle = useAnimatedStyle(() => {
    const itemW = tabItemWidth.value;
    const targetX = activeIndex.value * itemW + 6; // 6 = pill paddingHorizontal
    return {
      transform: [{ translateX: withSpring(targetX, SPRING) }],
      width: withSpring(itemW - 12, SPRING), // shrink slightly between tabs
    };
  });

  const onPillLayout = (e: LayoutChangeEvent) => {
    pillWidth.value = e.nativeEvent.layout.width;
  };

  return (
    <View style={styles.outerWrap} pointerEvents="box-none">
      <View style={styles.pill} onLayout={onPillLayout}>

        {/* Sliding background indicator */}
        <Animated.View style={[styles.indicator, indicatorStyle]} />

        {/* Tab buttons */}
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const cfg = TAB_CONFIG[route.name] ?? TAB_CONFIG.settings;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!isFocused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              accessibilityRole="button"
              accessibilityState={{ selected: isFocused }}
            >
              <View style={styles.tabContent}>
                <Ionicons
                  name={isFocused ? cfg.focused : cfg.outline}
                  size={24}
                  color="#1C1C1E"
                />
                <Text style={[styles.label, isFocused && styles.labelFocused]}>
                  {cfg.label}
                </Text>
              </View>
            </Pressable>
          );
        })}

      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FamiljTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index"    options={{ title: 'Vecka'   }} />
      <Tabs.Screen name="today"    options={{ title: 'Min dag' }} />
      <Tabs.Screen name="family"   options={{ title: 'Familj'  }} />
      <Tabs.Screen name="settings" options={{ title: 'Inst.'   }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  outerWrap: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 20,
    left: 20,
    right: 20,
    height: 72,
  },
  pill: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 6,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 16,
    elevation: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(0,0,0,0.07)',
    overflow: 'hidden',
  },
  // The sliding grey blob
  indicator: {
    position: 'absolute',
    top: 8,
    bottom: 8,
    borderRadius: 14,
    backgroundColor: '#EFEFEF',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
    paddingVertical: 6,
  },
  tabContent: {
    alignItems: 'center',
    gap: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    color: '#8E8E93',
    letterSpacing: 0.1,
  },
  labelFocused: {
    color: '#1C1C1E',
    fontWeight: '600',
  },
});
