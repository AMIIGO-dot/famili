/**
 * VoiceProcessingOverlay
 * Full-screen overlay shown while audio is being processed.
 * Clean pulsing rings in brand green with softly cycling locale phrases.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';

const GREEN = '#44B57F';
const CORE   = 52;
const DELAYS = [0, 340, 680];

function Ring({ delay }: { delay: number }) {
  const scale   = useRef(new Animated.Value(0.4)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 2.6,
            duration: 1600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: 0.35,
              duration: 200,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 1400,
              easing: Easing.out(Easing.quad),
              useNativeDriver: true,
            }),
          ]),
        ]),
        Animated.parallel([
          Animated.timing(scale,   { toValue: 0.4, duration: 0, useNativeDriver: true }),
          Animated.timing(opacity, { toValue: 0,   duration: 0, useNativeDriver: true }),
        ]),
        Animated.delay(DELAYS[DELAYS.length - 1] - delay + 340),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        styles.ring,
        { opacity, transform: [{ scale }] },
      ]}
    />
  );
}

interface Props {
  visible: boolean;
}

export default function VoiceProcessingOverlay({ visible }: Props) {
  const { t } = useTranslation();
  const phrases: string[] = t('aiParse.creatingPhrases', { returnObjects: true }) as string[];

  // Pulse the core dot softly
  const coreScale  = useRef(new Animated.Value(1)).current;
  // Cycle through phrases
  const textOpacity = useRef(new Animated.Value(0)).current;
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    if (!visible) return;

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(coreScale, { toValue: 1.12, duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(coreScale, { toValue: 1.0,  duration: 600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    pulse.start();

    // Fade in first phrase, then cycle
    let idx = 0;
    setPhraseIdx(0);
    textOpacity.setValue(0);

    const cycle = () => Animated.sequence([
      Animated.timing(textOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(textOpacity, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]);

    let running = true;
    const step = () => {
      if (!running) return;
      cycle().start(() => {
        if (!running) return;
        idx = (idx + 1) % phrases.length;
        setPhraseIdx(idx);
        step();
      });
    };
    step();

    return () => {
      running = false;
      pulse.stop();
      coreScale.setValue(1);
      textOpacity.setValue(0);
    };
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.center}>
          {DELAYS.map((d, i) => <Ring key={i} delay={d} />)}
          <Animated.View style={[styles.core, { transform: [{ scale: coreScale }] }]} />
        </View>
        <Animated.Text style={[styles.phrase, { opacity: textOpacity }]}>
          {phrases[phraseIdx]}
        </Animated.Text>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    width: CORE,
    height: CORE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    borderWidth: 2,
    borderColor: GREEN,
  },
  core: {
    width: CORE,
    height: CORE,
    borderRadius: CORE / 2,
    backgroundColor: GREEN,
  },
  phrase: {
    marginTop: 48,
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.3,
    color: GREEN,
    opacity: 0.55,
  },
});
