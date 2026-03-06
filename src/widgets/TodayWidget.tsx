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
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
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

const GREEN = '#44B57F';
const DARK  = '#2C2C2E';
const MUTED = '#9999A6';

const TodayWidget = (props: WidgetBase<TodayWidgetProps>) => {
  'widget';

  const isSmall = props.family === 'systemSmall';
  const shown   = props.events.slice(0, isSmall ? 2 : 4);

  if (isSmall) {
    return (
      <VStack spacing={5} modifiers={[padding({ all: 14 })]}>
        {/* Brand + date */}
        <Text modifiers={[font({ size: 10, weight: 'bold' }), foregroundStyle(GREEN)]}>
          FAMILU
        </Text>
        <Text modifiers={[font({ size: 10 }), foregroundStyle(MUTED)]}>
          {props.dateLabel}
        </Text>

        {/* Event rows */}
        <VStack spacing={3}>
          {shown.length === 0
            ? <Text modifiers={[font({ size: 11 }), foregroundStyle(MUTED)]}>{props.noEventsLabel}</Text>
            : shown.map((e, i) => (
                <HStack key={i} spacing={3}>
                  <Text modifiers={[font({ size: 8 }), foregroundStyle(e.color)]}>●</Text>
                  <Text modifiers={[font({ size: 10 }), foregroundStyle(DARK)]}>
                    {e.time} {e.title}
                  </Text>
                </HStack>
              ))
          }
        </VStack>

        {/* AI button */}
        <Button
          label={props.addAiLabel}
          target="create-ai"
          modifiers={[foregroundStyle(GREEN), font({ size: 12, weight: 'semibold' })]}
          onPress={() => ({})}
        />
      </VStack>
    );
  }

  // ── Medium layout (4×2) ──────────────────────────────────────────────────
  return (
    <VStack spacing={6} modifiers={[padding({ all: 14 })]}>
      {/* Header */}
      <HStack spacing={6}>
        <Text modifiers={[font({ size: 13, weight: 'bold' }), foregroundStyle(GREEN)]}>
          FAMILU
        </Text>
        <Text modifiers={[font({ size: 11 }), foregroundStyle(MUTED)]}>
          {props.dateLabel}
        </Text>
      </HStack>

      {/* Event list */}
      <VStack spacing={4}>
        {shown.length === 0
          ? <Text modifiers={[font({ size: 12 }), foregroundStyle(MUTED)]}>{props.noEventsLabel}</Text>
          : shown.map((e, i) => (
              <HStack key={i} spacing={5}>
                <Text modifiers={[font({ size: 10 }), foregroundStyle(e.color)]}>●</Text>
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
        label={props.addAiLabel}
        target="create-ai"
        modifiers={[foregroundStyle(GREEN), font({ size: 13, weight: 'semibold' })]}
        onPress={() => ({})}
      />
    </VStack>
  );
};

export default createWidget('TodayWidget', TodayWidget);
