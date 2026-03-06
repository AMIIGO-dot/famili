/**
 * FAMILU – Today Widget
 *
 * IMPORTANT – expo-widgets JSCore architecture:
 * The native ExpoWidgets module serializes the TodayWidget function via
 * .toString() and stores it in the App Group. The widget extension evaluates
 * it inside JavaScriptCore (NOT the RN bridge) with only ExpoWidgets.bundle
 * loaded, which assigns all @expo/ui/swift-ui components and modifiers to
 * globalThis. Therefore:
 *
 *  ✗ Do NOT use JSX — compiles to _jsxRuntime.jsx(...) closed-over variables
 *  ✗ Do NOT reference import-based vars inside the function body — they are
 *    closed-over CJS module variables that are undefined in JSCore
 *  ✓ DO access all components/modifiers via globalThis inside the function body
 *  ✓ DO call component functions directly instead of using JSX syntax
 */

// Type-only imports — erased at compile time, harmless in JSCore
import { createWidget, type WidgetBase } from 'expo-widgets';

// ─── Shared types (used by widgetUpdater.ts in the main app) ─────────────────
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

// ─── Widget component ─────────────────────────────────────────────────────────
// All component/modifier references are resolved from globalThis at runtime so
// the serialized function body is fully self-contained inside JSCore.
const TodayWidget = (props: WidgetBase<TodayWidgetProps>) => {
  'widget';

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const g = globalThis as any;

  // Components (assigned globally by ExpoWidgets.bundle)
  const VStack = g.VStack;
  const HStack = g.HStack;
  const Text   = g.Text;
  const Button = g.Button;

  // Modifiers
  const mFont            = g.font;
  const mForegroundStyle = g.foregroundStyle;
  const mBackground      = g.background;
  const mPadding         = g.padding;
  const mFrame           = g.frame;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // Design tokens
  const GREEN = '#44B57F';
  const DARK  = '#1A2E23';
  const MUTED = '#6B8F7A';
  const BG    = '#ECF8F2';

  // Safe prop defaults (undefined before first snapshot write)
  const p = props as any; // eslint-disable-line
  const events        = p.events        ?? [];
  const dateLabel     = p.dateLabel     ?? '';
  const noEventsLabel = p.noEventsLabel ?? '—';
  const addAiLabel    = p.addAiLabel    ?? '🎤';

  const isSmall = p.family === 'systemSmall';
  const shown   = events.slice(0, isSmall ? 2 : 4);

  // Root: solid BG + fill the full widget frame
  const rootMods = [
    mBackground(BG),
    mFrame({ maxWidth: 10000, maxHeight: 10000 }),
    mPadding({ all: 14 }),
  ];

  // Event rows — direct function calls, no JSX
  const eventRows: any[] = shown.length === 0 // eslint-disable-line
    ? [Text({
        modifiers: [mFont({ size: 11 }), mForegroundStyle(MUTED)],
        children: noEventsLabel,
      })]
    : shown.map((e: any, i: number) =>  // eslint-disable-line
        HStack({
          key: String(i),
          spacing: 4,
          children: [
            Text({ modifiers: [mFont({ size: 8 }), mForegroundStyle(e.color ?? GREEN)], children: '●' }),
            Text({ modifiers: [mFont({ size: isSmall ? 10 : 11 }), mForegroundStyle(DARK)], children: e.time + ' ' + e.title }),
          ],
        })
      );

  const header: any[] = isSmall // eslint-disable-line
    ? [
        Text({ modifiers: [mFont({ size: 10, weight: 'bold' }), mForegroundStyle(GREEN)], children: 'FAMILU' }),
        Text({ modifiers: [mFont({ size: 9 }), mForegroundStyle(MUTED)], children: dateLabel }),
      ]
    : [
        HStack({
          spacing: 6,
          children: [
            Text({ modifiers: [mFont({ size: 13, weight: 'bold' }), mForegroundStyle(GREEN)], children: 'FAMILU' }),
            Text({ modifiers: [mFont({ size: 11 }), mForegroundStyle(MUTED)], children: dateLabel }),
          ],
        }),
      ];

  return VStack({
    spacing: isSmall ? 5 : 6,
    modifiers: rootMods,
    children: [
      ...header,
      VStack({ spacing: 3, children: eventRows }),
      Button({
        label: addAiLabel,
        target: 'create-ai',
        modifiers: [mForegroundStyle(GREEN), mFont({ size: isSmall ? 11 : 12, weight: 'semibold' })],
        onPress: () => ({}),
      }),
    ],
  });
};

export default createWidget('TodayWidget', TodayWidget);
