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
  dateLabel: string;      // e.g. "fredag 6 mars"
  noEventsLabel: string;  // e.g. "Inga aktiviteter"
  addAiLabel: string;     // e.g. "Lägg till"
};

// ─── Widget component ─────────────────────────────────────────────────────────
// All component/modifier references are resolved from globalThis at runtime so
// the serialized function body is fully self-contained inside JSCore.
const TodayWidget = (props: WidgetBase<TodayWidgetProps>) => {
  'widget';

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const g = globalThis as any;

  // Components (assigned globally by ExpoWidgets.bundle)
  const VStack  = g.VStack;
  const HStack  = g.HStack;
  const Text    = g.Text;
  const Spacer  = g.Spacer;
  const Button  = g.Button;
  const Image   = g.Image;

  // Modifiers
  const mFont            = g.font;
  const mForegroundStyle = g.foregroundStyle;
  const mBackground      = g.background;
  const mPadding         = g.padding;
  const mFrame           = g.frame;
  const mCornerRadius    = g.cornerRadius;
  const mLineLimit       = g.lineLimit;
  const mBold            = g.bold;
  const mKerning         = g.kerning;
  const mClipShape       = g.clipShape;
  const mButtonStyle     = g.buttonStyle;
  /* eslint-enable @typescript-eslint/no-explicit-any */

  // ── Design tokens ──────────────────────────────────────────────────────────
  const GREEN     = '#34A853';   // brand green
  const GREEN_BG  = '#E8F5E9';  // light green tint for button
  const DARK      = '#1B2E22';
  const MUTED     = '#7A9484';
  const BG        = '#F5FBF7';  // near-white with green tint
  const WHITE     = '#FFFFFF';

  // Safe prop defaults (undefined before first snapshot write)
  const p = props as any; // eslint-disable-line
  const events        = p.events        ?? [];
  const dateLabel     = p.dateLabel     ?? '';
  const noEventsLabel = p.noEventsLabel ?? '';
  const addAiLabel    = p.addAiLabel    ?? '+';

  const isSmall = p.family === 'systemSmall';
  const maxRows = isSmall ? 3 : 4;
  const shown   = events.slice(0, maxRows);

  // ── Root container: fill entire widget area with soft background ───────────
  const rootMods = [
    mBackground(BG),
    mFrame({ maxWidth: 10000, maxHeight: 10000 }),
    mPadding({ top: 14, bottom: 12, leading: 14, trailing: 14 }),
  ];

  // ── Header ─────────────────────────────────────────────────────────────────
  //  FAMILU (bold, rounded, tracked) ·  date
  const brandText = Text({
    modifiers: [
      mFont({ size: isSmall ? 15 : 17, weight: 'heavy', design: 'rounded' }),
      mKerning(1.5),
      mForegroundStyle(GREEN),
    ],
    children: 'FAMILU',
  });

  const dateText = Text({
    modifiers: [
      mFont({ size: isSmall ? 10 : 12, weight: 'medium' }),
      mForegroundStyle(MUTED),
    ],
    children: dateLabel,
  });

  // ── Event list ─────────────────────────────────────────────────────────────
  const eventRows: any[] = shown.length === 0 // eslint-disable-line
    ? [
        Text({
          modifiers: [mFont({ size: isSmall ? 12 : 13 }), mForegroundStyle(MUTED)],
          children: noEventsLabel,
        }),
      ]
    : shown.map((e: any, i: number) => // eslint-disable-line
        HStack({
          key: String(i),
          spacing: 6,
          alignment: 'firstTextBaseline',
          children: [
            Text({
              modifiers: [
                mFont({ size: 7 }),
                mForegroundStyle(e.color ?? GREEN),
              ],
              children: '●',
            }),
            Text({
              modifiers: [
                mFont({ size: isSmall ? 13 : 14, weight: 'medium' }),
                mForegroundStyle(DARK),
                mLineLimit(1),
              ],
              children: e.time + '  ' + e.title,
            }),
          ],
        }),
      );

  // ── Add-with-AI button (clean pill) ────────────────────────────────────────
  const addButton = Button({
    target: 'create-ai',
    onPress: () => ({}),
    modifiers: [mButtonStyle('plain')],
    children: [
      HStack({
        spacing: 5,
        alignment: 'center',
        modifiers: [
          mBackground(GREEN_BG, 'capsule'),
          mPadding({ horizontal: 12, vertical: 6 }),
        ],
        children: [
          Image({
            systemName: 'plus',
            size: isSmall ? 10 : 11,
            color: GREEN,
          }),
          Text({
            modifiers: [
              mFont({ size: isSmall ? 11 : 12, weight: 'semibold' }),
              mForegroundStyle(GREEN),
            ],
            children: addAiLabel,
          }),
        ],
      }),
    ],
  });

  // ── Compose layout ─────────────────────────────────────────────────────────
  return VStack({
    alignment: 'leading',
    spacing: 0,
    modifiers: rootMods,
    children: [
      // Header
      brandText,
      Text({
        modifiers: [
          mFont({ size: 1 }),
          mFrame({ height: isSmall ? 2 : 4 }),
        ],
        children: ' ',
      }),
      dateText,
      // Spacer between header and events
      Text({
        modifiers: [
          mFont({ size: 1 }),
          mFrame({ height: isSmall ? 6 : 8 }),
        ],
        children: ' ',
      }),
      // Events
      VStack({ alignment: 'leading', spacing: isSmall ? 4 : 5, children: eventRows }),
      // Push button to bottom
      Spacer({ minLength: isSmall ? 4 : 8 }),
      // Add button at bottom
      addButton,
    ],
  });
};

export default createWidget('TodayWidget', TodayWidget);
