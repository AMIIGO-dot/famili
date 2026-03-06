/**
 * FAMILU – Today Widget
 *
 * Shows today's activities and an AI voice creation button directly on
 * the iOS home screen. Rendered by the system using SwiftUI via @expo/ui.
 *
 * This component runs in a separate minimal JS runtime — only @expo/ui/swift-ui
 * components are allowed here. No React Native, no hooks, no i18next.
 * All display text is passed as props from the main app.
 */
import { Button, HStack, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding, background, frame } from '@expo/ui/swift-ui/modifiers';
import { createWidget, type WidgetBase } from 'expo-widgets';

export type TodayWidgetEvent = {
  title: string;
  time: string;   // "15:00"
  color: string;  // hex colour matching event type
};

export type TodayWidgetProps = {
  events: TodayWidgetEvent[];
  dateLabel: string;      // e.g. "Måndag 6 mars"
  noEventsLabel: string;  // e.g. "Lugnt idag"
  addAiLabel: string;     // e.g. "🎤 Lägg till med AI"
};

const GREEN      = '#44B57F';
const GREEN_DARK  = '#2F8A60';
const BG          = '#F0FAF5';   // very light green tint — always visible on home screen
const DARK        = '#1A2E23';
const MUTED       = '#6B8F7A';

const TodayWidget = (props: WidgetBase<TodayWidgetProps>) => {
  'widget';

  // Defensive defaults — widget crashes if props.events is undefined
  // (happens when no snapshot data has been stored in the App Group yet)
  const events        = props.events        ?? [];
  const dateLabel     = props.dateLabel     ?? '';
  const noEventsLabel = props.noEventsLabel ?? '–';
  const addAiLabel    = props.addAiLabel    ?? '🎤';

  const isSmall = props.family === 'systemSmall';
  const shown   = events.slice(0, isSmall ? 2 : 4);

  const rootModifiers = [
    padding({ all: 14 }),
    background(BG),
    frame({ maxWidth: 9999, maxHeight: 9999 }),
  ];

  if (isSmall) {
    return (
      <VStack spacing={5} modifiers={rootModifiers}>
        {/* Brand + date */}
        <Text modifiers={[font({ size: 10, weight: 'bold' }), foregroundStyle(GREEN_DARK)]}>
          FAMILU
        </Text>
        <Text modifiers={[font({ size: 10 }), foregroundStyle(MUTED)]}>
          {dateLabel}
        </Text>

        {/* Event rows */}
        <VStack spacing={3}>
          {shown.length === 0
            ? <Text modifiers={[font({ size: 11 }), foregroundStyle(MUTED)]}>{noEventsLabel}</Text>
            : shown.map((e, i) => (
                <HStack key={i} spacing={3}>
                  <Text modifiers={[font({ size: 8 }), foregroundStyle(e.color ?? GREEN)]}></Text>
                  <Text modifiers={[font({ size: 10 }), foregroundStyle(DARK)]}>
                    {e.time} {e.title}
                  </Text>
                </HStack>
              ))
          }
        </VStack>

        {/* AI button */}
        <Button
          label={addAiLabel}
          target="create-ai"
          modifiers={[foregroundStyle(GREEN_DARK), font({ size: 12, weight: 'semibold' })]}
          onPress={() => ({})}
        />
      </VStack>
    );
  }

  // ── Medium layout (4×2) ──────────────────────────────────────────────────
  return (
    <VStack spacing={6} modifiers={rootModifiers}>
      {/* Header */}
      <HStack spacing={6}>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(GREEN_DARK)]}>
          FAMILU
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(MUTED)]}>
          {dateLabel}
        </Text>
      </HStack>

      {/* Event list */}
      <VStack spacing={4}>
        {shown.length === 0
          ? <Text modifiers={[font({ size: 12 }), foregroundStyle(MUTED)]}>{noEventsLabel}</Text>
          : shown.map((e, i) => (
              <HStack key={i} spacing={5}>
                <Text modifiers={[font({ size: 10 }), foregroundStyle(e.color ?? GREEN)]}></Text>
                <Text modifiers={[font({ size: 12, weight: 'semibold' }), foregroundStyle(DARK)]}>
                  {e.time}
                </Text>
                <Text modifiers={[font({ size: 12 }), foregroundStyle(DARK)]}>
                  {e.title}
                </Text>
              </HStack>
            ))
        }
      </VStack>

      {/* AI button */}
      <Button
        label={addAiLabel}
        target="create-ai"
        modifiers={[foregroundStyle(GREEN_DARK), font({ size: 13, weight: 'semibold' })]}
        onPress={() => ({})}
      />
    </VStack>
  );
};

export default createWidget('TodayWidget', TodayWidget);
