/**
 * FAMILJ – PinPad
 * Shared numeric keypad for PIN creation and verification.
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useSharedValue,
  withSequence,
  withTiming,
  useAnimatedStyle,
} from 'react-native-reanimated';

const PIN_LENGTH = 4;

const KEYS = [
  '1', '2', '3',
  '4', '5', '6',
  '7', '8', '9',
  '',  '0', '⌫',
];

interface Props {
  title: string;
  subtitle?: string;
  onComplete: (pin: string) => void;
  resetSignal?: number; // increment to clear & shake
  error?: boolean;
}

export default function PinPad({ title, subtitle, onComplete, resetSignal = 0, error = false }: Props) {
  const [digits, setDigits] = useState<string[]>([]);
  const shakeX = useSharedValue(0);

  // Shake animation on error
  useEffect(() => {
    if (error || resetSignal > 0) {
      if (error) {
        shakeX.value = withSequence(
          withTiming(-12, { duration: 60 }),
          withTiming(12, { duration: 60 }),
          withTiming(-8, { duration: 50 }),
          withTiming(8, { duration: 50 }),
          withTiming(0, { duration: 40 }),
        );
      }
      setDigits([]);
    }
  }, [resetSignal, error]);

  const dotsStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const handleKey = (key: string) => {
    if (key === '') return;
    if (key === '⌫') {
      setDigits((d) => d.slice(0, -1));
      return;
    }
    setDigits((d) => {
      const next = [...d, key];
      if (next.length === PIN_LENGTH) {
        // Slight delay so the last dot fills before callback
        setTimeout(() => onComplete(next.join('')), 80);
        return next;
      }
      return next;
    });
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}

      {/* Dots */}
      <Animated.View style={[styles.dots, dotsStyle]}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[styles.dot, i < digits.length && styles.dotFilled]}
          />
        ))}
      </Animated.View>

      {/* Keypad */}
      <View style={styles.grid}>
        {KEYS.map((key, idx) => (
          <TouchableOpacity
            key={idx}
            style={[styles.key, key === '' && styles.keyInvisible]}
            onPress={() => handleKey(key)}
            disabled={key === '' || digits.length === PIN_LENGTH}
            activeOpacity={0.6}
          >
            <Text style={[styles.keyText, key === '⌫' && styles.keyBackspace]}>
              {key}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', paddingHorizontal: 24 },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C2C2E',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: '#9999A6',
    textAlign: 'center',
    marginBottom: 32,
  },
  dots: { flexDirection: 'row', gap: 18, marginBottom: 40, marginTop: 8 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#C7C7CC',
    backgroundColor: 'transparent',
  },
  dotFilled: { backgroundColor: '#2C2C2E', borderColor: '#2C2C2E' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', width: 264, gap: 16 },
  key: {
    width: 77,
    height: 77,
    borderRadius: 39,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyInvisible: { backgroundColor: 'transparent' },
  keyText: { fontSize: 24, fontWeight: '500', color: '#2C2C2E' },
  keyBackspace: { fontSize: 20 },
});
