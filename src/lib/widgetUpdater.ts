/**
 * FAMILU – Widget Updater
 *
 * Formats today's event occurrences into TodayWidgetProps and pushes them
 * to the home screen widget via expo-widgets. iOS only — safe to call from
 * anywhere; will no-op on Android/web.
 */
import { Platform, NativeModules } from 'react-native';
import type { EventOccurrence } from '../stores/eventStore';
import { formatTime } from './time';
import type { TodayWidgetEvent, TodayWidgetProps } from '../widgets/TodayWidget';

const TYPE_COLOR: Record<string, string> = {
  activity: '#44B57F',
  homework: '#F5A623',
  test:     '#F97B8B',
  other:    '#9999A6',
};

export function updateTodayWidget(
  occurrences: EventOccurrence[],
  timezone: string,
  dateLabel: string,
  noEventsLabel: string,
  addAiLabel: string,
): void {
  if (Platform.OS !== 'ios') return;
  // ExpoWidgets native module is only available in production/dev builds, not Expo Go
  if (!NativeModules.ExpoWidgets) return;
  try {
    // Lazy require so Android/web bundles never load expo-widgets native module
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TodayWidget = require('../widgets/TodayWidget').default as { updateSnapshot: (p: TodayWidgetProps) => void };

    const events: TodayWidgetEvent[] = occurrences
      .slice()
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 6)
      .map((o) => ({
        title: o.title,
        time:  formatTime(o.start, timezone, false),
        color: TYPE_COLOR[o.type ?? 'activity'] ?? '#44B57F',
      }));

    TodayWidget.updateSnapshot({ events, dateLabel, noEventsLabel, addAiLabel });
  } catch (e) {
    console.warn('[widgetUpdater]', e);
  }
}
