/**
 * FAMILU – Widget Updater
 *
 * Formats today's event occurrences into TodayWidgetProps and pushes them
 * to the home screen widget via expo-widgets. iOS only — safe to call from
 * anywhere; will no-op on Android/web.
 */
import { Platform } from 'react-native';
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
  try {
    // Lazy require so Android/web bundles never load expo-widgets native module
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const TodayWidget = require('../widgets/TodayWidget').default as { updateSnapshot: (p: TodayWidgetProps) => void };

    const now = new Date();

    // Only show upcoming events (end time hasn't passed yet)
    const events: TodayWidgetEvent[] = occurrences
      .slice()
      .filter((o) => o.end.getTime() > now.getTime())
      .sort((a, b) => a.start.getTime() - b.start.getTime())
      .slice(0, 6)
      .map((o) => ({
        title: o.title,
        time:  formatTime(o.start, timezone, false),
        color: TYPE_COLOR[o.type ?? 'activity'] ?? '#34A853',
      }));

    TodayWidget.updateSnapshot({ events, dateLabel, noEventsLabel, addAiLabel });
    console.log('[widgetUpdater] snapshot written, events:', events.length);
  } catch (e) {
    console.warn('[widgetUpdater]', e);
  }
}
