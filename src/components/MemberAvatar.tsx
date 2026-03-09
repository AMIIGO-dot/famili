/**
 * FAMILJ – MemberAvatar
 *
 * Shows a member's photo if available, otherwise a colored initial circle.
 * Used consistently across the app wherever a member avatar appears.
 */

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

interface Props {
  name: string;
  color: string;
  avatarUrl?: string | null;
  size?: number;
}

export default function MemberAvatar({ name, color, avatarUrl, size = 44 }: Props) {
  const radius = size / 2;
  const fontSize = size * 0.38;

  if (avatarUrl) {
    return (
      <Image
        source={{ uri: avatarUrl }}
        style={[styles.image, { width: size, height: size, borderRadius: radius }]}
      />
    );
  }

  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: radius, backgroundColor: color }]}>
      <Text style={[styles.initial, { fontSize }]}>
        {name.charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  image: {
    resizeMode: 'cover',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontWeight: '700',
    color: '#fff',
  },
});
