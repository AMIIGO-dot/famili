/**
 * FAMILJ – Min dag (My Day) Screen
 *
 * Hero card with animated blob background + cycling phrases.
 * Smooth scroll collapse. Events list below.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Card } from 'heroui-native';
import * as Haptics from 'expo-haptics';
import { useAudioRecorder, AudioModule, RecordingPresets } from 'expo-audio';
import * as LegacyFS from 'expo-file-system/legacy';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useFamilyStore } from '../../src/stores/familyStore';
import { useEventsStore, EventOccurrence } from '../../src/stores/eventStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useAuthStore } from '../../src/stores/authStore';
import { convertUTCToLocal, formatTime } from '../../src/lib/time';
import { useIsPremium } from '../../src/lib/premium';
import { usePurchaseStore } from '../../src/stores/purchaseStore';
import { useShoppingStore } from '../../src/stores/shoppingStore';
import { aiParseEvent, transcribeAudio, ParsedEvent } from '../../src/lib/aiParse';
import { canMakeAiCall, recordAiCall, MAX_RECORDING_SECONDS } from '../../src/lib/aiRateLimit';
import EventCreateSheet from '../../src/components/EventCreateSheet';
import ShoppingListSheet from '../../src/components/ShoppingListSheet';
import VoiceProcessingOverlay from '../../src/components/VoiceProcessingOverlay';
import { format } from 'date-fns';
import { sv as dateFnsSv, de as dateFnsDe, enUS } from 'date-fns/locale';
import { updateTodayWidget } from '../../src/lib/widgetUpdater';

const ALL_ID = '__ALL__';

const TYPE_COLORS: Record<string, string> = {
  activity: '#44B57F',
  homework: '#F5A623',
  test:     '#F97B8B',
  other:    '#9999A6',
};

const TYPE_BG: Record<string, string> = {
  activity: '#EEF4FF',
  homework: '#FFF8EE',
  test:     '#FFF0F2',
  other:    '#F5F5F6',
};

const HERO_PHRASE_KEYS = [
  'today.heroPhrase1',
  'today.heroPhrase2',
  'today.heroPhrase4',
];

// ─── Floating particle: drifts upward and fades ──────────────────────────────
function useParticle(durationMs: number, delayMs: number) {
  const y       = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const run = () => {
      y.setValue(0); opacity.setValue(0);
      Animated.sequence([
        Animated.delay(delayMs),
        Animated.parallel([
          Animated.timing(y, { toValue: -120, duration: durationMs, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.sequence([
            Animated.timing(opacity, { toValue: 0.65, duration: durationMs * 0.18, useNativeDriver: true }),
            Animated.timing(opacity, { toValue: 0,    duration: durationMs * 0.82, useNativeDriver: true }),
          ]),
        ]),
      ]).start(() => run());
    };
    run();
  }, []);
  return { y, opacity };
}

// ─── Organic blob: translate + scale + rotate ─────────────────────────────────
function useOscillate(a: number, b: number, duration: number, delay = 0) {
  const val = useRef(new Animated.Value(a)).current;
  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(val, { toValue: b, duration, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
        Animated.timing(val, { toValue: a, duration, useNativeDriver: true, easing: Easing.inOut(Easing.sin) }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);
  return val;
}

function HeroBackground() {
  // Blobs — green family
  const b1tx = useOscillate(-12, 26, 9000);
  const b1ty = useOscillate(-18, 14, 11000, 500);
  const b1s  = useOscillate(1.0, 1.18, 8000, 200);
  const b1r  = useOscillate(-8, 12, 13000);

  const b2tx = useOscillate(16, -22, 8500, 1000);
  const b2ty = useOscillate(20, -16, 9500);
  const b2s  = useOscillate(1.0, 1.14, 7000, 800);
  const b2r  = useOscillate(5, -15, 11500, 300);

  const b3tx = useOscillate(-20, 18, 10500, 600);
  const b3ty = useOscillate(14, -22, 8000, 1200);
  const b3s  = useOscillate(0.95, 1.15, 9500, 400);
  const b3r  = useOscillate(0, 20, 12000, 700);

  const b4tx = useOscillate(10, -16, 7500, 1500);
  const b4ty = useOscillate(-10, 18, 9000, 200);
  const b4s  = useOscillate(0.9, 1.12, 6500, 1000);

  const b5tx = useOscillate(-8, 8, 14000);
  const b5ty = useOscillate(-6, 10, 16000, 800);

  // Particles
  const p1 = useParticle(3800,    0);
  const p2 = useParticle(4400, 1400);
  const p3 = useParticle(3500, 2800);
  const p4 = useParticle(5000,  700);
  const p5 = useParticle(4100, 3600);
  const p6 = useParticle(3700, 2100);
  const PARTICLES = [
    { p: p1, left:  36, bottom: 62, size: 5 },
    { p: p2, left:  92, bottom: 34, size: 3 },
    { p: p3, left: 158, bottom: 78, size: 7 },
    { p: p4, left: 224, bottom: 48, size: 4 },
    { p: p5, left: 298, bottom: 68, size: 6 },
    { p: p6, left: 352, bottom: 38, size: 4 },
  ];

  return (
    <>
      {/* Deep-green base wash */}
      <Animated.View style={[styles.blob, styles.blob5, {
        transform: [{ translateX: b5tx }, { translateY: b5ty }],
      }]} />
      {/* Layered organic blobs */}
      <Animated.View style={[styles.blob, styles.blob1, {
        transform: [{ translateX: b1tx }, { translateY: b1ty }, { scale: b1s }, { rotate: b1r.interpolate({ inputRange: [-20, 20], outputRange: ['-20deg', '20deg'] }) }],
      }]} />
      <Animated.View style={[styles.blob, styles.blob2, {
        transform: [{ translateX: b2tx }, { translateY: b2ty }, { scale: b2s }, { rotate: b2r.interpolate({ inputRange: [-20, 20], outputRange: ['-20deg', '20deg'] }) }],
      }]} />
      <Animated.View style={[styles.blob, styles.blob3, {
        transform: [{ translateX: b3tx }, { translateY: b3ty }, { scale: b3s }, { rotate: b3r.interpolate({ inputRange: [-20, 20], outputRange: ['-20deg', '20deg'] }) }],
      }]} />
      <Animated.View style={[styles.blob, styles.blob4, {
        transform: [{ translateX: b4tx }, { translateY: b4ty }, { scale: b4s }],
      }]} />
      {/* Soft white frost */}
      <View style={styles.heroFrost} />
      {/* Floating particles */}
      {PARTICLES.map(({ p, left, bottom, size }, i) => (
        <Animated.View key={i} style={{
          position: 'absolute', left, bottom,
          width: size, height: size, borderRadius: size / 2,
          backgroundColor: '#fff',
          opacity: p.opacity,
          transform: [{ translateY: p.y }],
        }} />
      ))}
    </>
  );
}

export default function TodayScreen() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [sheetVisible, setSheetVisible] = useState(false);
  const [pressedEvent, setPressedEvent] = useState<EventOccurrence | undefined>(undefined);
  const [parsedEvent, setParsedEvent] = useState<ParsedEvent | null>(null);
  const [shoppingSheetVisible, setShoppingSheetVisible] = useState(false);
  const [shoppingEventId, setShoppingEventId] = useState('');
  const [shoppingEventTitle, setShoppingEventTitle] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string>(ALL_ID);

  const { session } = useAuthStore();

  // Voice recording
  const [micState, setMicState] = useState<'idle' | 'recording' | 'processing'>('idle');
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Always points to the latest render's handleMicFab to avoid stale closures in timers
  const handleMicFabRef = useRef<() => Promise<void>>(async () => {});

  // ── Staggered entrance animations ──────────────────────────────────────
  const brandEntrance   = useRef(new Animated.Value(0)).current;
  const phraseEntrance  = useRef(new Animated.Value(0)).current;
  const dateEntrance    = useRef(new Animated.Value(0)).current;
  const btnEntrance     = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.stagger(130, [
      Animated.spring(brandEntrance,  { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.spring(phraseEntrance, { toValue: 1, useNativeDriver: true, tension: 70, friction: 10 }),
      Animated.spring(dateEntrance,   { toValue: 1, useNativeDriver: true, tension: 80, friction: 12 }),
      Animated.spring(btnEntrance,    { toValue: 1, useNativeDriver: true, tension: 90, friction: 11 }),
    ]).start();
  }, []);

  // ── Phrase cycling: slide-up + fade ──────────────────────────────────────
  const [phraseIdx, setPhraseIdx] = useState(0);
  const phraseIdxRef = useRef(0);
  const phraseOpacity = useRef(new Animated.Value(1)).current;
  const phraseTransY  = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const cycle = () => {
      // slide up + fade out
      Animated.parallel([
        Animated.timing(phraseOpacity, { toValue: 0, duration: 450, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
        Animated.timing(phraseTransY,  { toValue: -16, duration: 450, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
      ]).start(() => {
        phraseIdxRef.current = (phraseIdxRef.current + 1) % HERO_PHRASE_KEYS.length;
        setPhraseIdx(phraseIdxRef.current);
        // reset below
        phraseTransY.setValue(20);
        // slide up into place + fade in
        Animated.parallel([
          Animated.timing(phraseOpacity, { toValue: 1, duration: 550, useNativeDriver: true, easing: Easing.out(Easing.quad) }),
          Animated.timing(phraseTransY,  { toValue: 0, duration: 550, useNativeDriver: true, easing: Easing.out(Easing.cubic) }),
        ]).start();
      });
    };
    const id = setInterval(cycle, 4500);
    return () => clearInterval(id);
  }, []);

  const { family, members } = useFamilyStore();
  const { currentMemberRole } = useFamilyStore();
  const listsByEventId = useShoppingStore((s) => s.listsByEventId);
  const { fetchEventsForWeek, getOccurrencesForRange } = useEventsStore();
  const { timezone, timeFormat, widgetAiTrigger, setWidgetAiTrigger } = useSettingsStore();
  const isPremium = useIsPremium();
  const presentPaywall = usePurchaseStore((s) => s.presentPaywall);

  // Today's range in UTC
  const today = convertUTCToLocal(new Date(), timezone);
  const todayStart = new Date(today);
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(today);
  todayEnd.setHours(23, 59, 59, 999);

  const handleMicFab = async () => {
    if (micState === 'recording') {
      if (!recorder.isRecording) return;
      // Clear auto-stop timer
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      setMicState('processing');
      try {
        await recorder.stop();
        const uri = recorder.uri;
        if (!uri) throw new Error('No URI');
        const ext = uri.split('.').pop()?.toLowerCase() ?? 'm4a';
        const mimeType = ext === 'caf' ? 'audio/x-caf' : ext === 'wav' ? 'audio/wav' : 'audio/m4a';
        console.log('[Voice FAB] uri:', uri, 'ext:', ext, 'mimeType:', mimeType);
        // Read file as base64 using expo-file-system legacy API (reliable across v19)
        const base64 = await LegacyFS.readAsStringAsync(uri, { encoding: LegacyFS.EncodingType.Base64 });
        console.log('[Voice FAB] base64 length:', base64.length);
        const transcript = await transcribeAudio(base64, i18n.language, mimeType);
        const parsed = await aiParseEvent(
          transcript,
          members.map((m) => ({ id: m.id, name: m.name })),
          timezone
        );
        // Record successful AI call for rate limiting
        const userId = session?.user?.id;
        if (userId) void recordAiCall(userId);
        setParsedEvent(parsed);
        setPressedEvent(undefined);
        setSheetVisible(true);
      } catch (err) {
        console.warn('[Voice FAB] error:', err);
        Alert.alert(t('common.error'), t('aiParse.error'));
      } finally {
        setMicState('idle');
      }
    } else if (micState === 'idle') {
      if (!isPremium) {
        await presentPaywall();
        // Re-read fresh state from store — don't rely on stale hook value
        const nowRC = usePurchaseStore.getState().isPremium;
        const nowFamily = useFamilyStore.getState().subscription?.status === 'active'
          && useFamilyStore.getState().subscription?.plan !== 'free';
        if (!nowRC && !nowFamily) return; // user cancelled or purchase failed
        // fall through → start recording immediately without extra tap
      }
      // Rate limit check
      const userId = session?.user?.id;
      if (userId) {
        const allowed = await canMakeAiCall(userId);
        if (!allowed) {
          Alert.alert(t('common.error'), t('aiParse.rateLimitReached'));
          return;
        }
      }
      try {
        const { granted } = await AudioModule.requestRecordingPermissionsAsync();
        if (!granted) { Alert.alert(t('common.error'), t('aiParse.micPermissionDenied')); return; }
        await AudioModule.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
        await recorder.prepareToRecordAsync(RecordingPresets.HIGH_QUALITY);
        recorder.record();
        setMicState('recording');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        // Auto-stop after MAX_RECORDING_SECONDS
        autoStopTimerRef.current = setTimeout(() => {
          if (recorder.isRecording) {
            Alert.alert(t('common.error'), t('aiParse.recordingTooLong'));
            void handleMicFabRef.current();
          }
        }, MAX_RECORDING_SECONDS * 1000);
      } catch (err) {
        console.warn('[Voice FAB] startRecording error:', err);
        Alert.alert(t('common.error'), t('aiParse.error'));
      }
    }
  };
  // Keep ref in sync with latest render
  handleMicFabRef.current = handleMicFab;

  useEffect(() => {
    if (family) {
      fetchEventsForWeek(family.id, todayStart, todayEnd);
    }
  }, [family?.id]);

  const allOccurrences = getOccurrencesForRange(todayStart, todayEnd);

  // Push today's events to the iOS home screen widget
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const _eventsKey = allOccurrences.map((o) => `${o.eventId}${o.start.getTime()}`).join('|');
  useEffect(() => {
    const localeMap = { sv: dateFnsSv, de: dateFnsDe, en: enUS };
    const dateLocale = localeMap[i18n.language as keyof typeof localeMap] ?? enUS;
    const localToday = convertUTCToLocal(new Date(), timezone);
    const dateLabel = format(localToday, 'EEEE d MMMM', { locale: dateLocale });
    updateTodayWidget(allOccurrences, timezone, dateLabel, t('today.noEvents'), t('widget.addWithAi'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [_eventsKey, timezone, i18n.language]);

  // Respond to widget "create-ai" button tap
  useEffect(() => {
    if (widgetAiTrigger && micState === 'idle') {
      setWidgetAiTrigger(false);
      void handleMicFabRef.current?.();
    }
  }, [widgetAiTrigger, micState]);

  const occurrences = (
    selectedMemberId === ALL_ID
      ? allOccurrences
      : allOccurrences.filter((o) => o.memberIds.includes(selectedMemberId))
  ).sort((a, b) => a.start.getTime() - b.start.getTime());

  const now = new Date();

  const getStatus = useCallback(
    (occ: EventOccurrence): 'past' | 'ongoing' | 'upcoming' => {
      if (now > occ.end) return 'past';
      if (now >= occ.start && now <= occ.end) return 'ongoing';
      return 'upcoming';
    },
    []
  );

  const formatDuration = (start: Date, end: Date): string => {
    const mins = Math.round((end.getTime() - start.getTime()) / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m > 0 ? `${h}h ${m}min` : `${h}h`;
  };

  const fullDateLabel = new Intl.DateTimeFormat(i18n.language, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(today);

  const typeLabel = (type: string) => {
    const keys: Record<string, string> = {
      activity: 'events.typeActivity',
      homework: 'events.typeHomework',
      test:     'events.typeTest',
      other:    'events.typeOther',
    };
    return t(keys[type] ?? 'events.typeOther');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={[]}>
      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        scrollEventThrottle={16}
      >
        {/* ── HERO ── */}
        <View style={[styles.hero, { height: 300 + insets.top }]}>
          <HeroBackground />

          {/* Logo — centered, fades in with brand entrance */}
          <Animated.View style={[styles.heroLogoWrap, { opacity: brandEntrance }]}>
            <Image
              source={require('../../assets/FAMILU app logo-white(1000 x 500 px).png')}
              style={styles.heroLogo}
              resizeMode="contain"
            />
          </Animated.View>

          <View style={[styles.heroContent, { paddingTop: insets.top + 22 }]}>
            <Animated.Text style={[styles.heroPhrase, {
              opacity: Animated.multiply(phraseOpacity, phraseEntrance),
              transform: [
                { translateY: phraseTransY },
                { translateY: phraseEntrance.interpolate({ inputRange: [0, 1], outputRange: [28, 0] }) },
              ],
            }]}>
              {t(HERO_PHRASE_KEYS[phraseIdx])}
            </Animated.Text>
            <Animated.Text style={[styles.heroDate, {
              opacity: dateEntrance,
              transform: [{ translateY: dateEntrance.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            }]}>{fullDateLabel}</Animated.Text>
            <Animated.View style={[{
              opacity: btnEntrance,
              transform: [{ scale: btnEntrance.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }],
              alignSelf: 'flex-start',
            }]}>
              <TouchableOpacity
                style={styles.heroBtn}
                activeOpacity={0.8}
                onPress={() => router.navigate('/')}
              >
                <Ionicons name="calendar-outline" size={15} color="#1A6E46" />
                <Text style={styles.heroBtnText}>{t('today.seeWeek')}</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </View>

        {/* ── Member filter ── */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.filterBar}
          contentContainerStyle={styles.filterContent}
          nestedScrollEnabled
        >
          <TouchableOpacity
            style={[styles.filterChip, selectedMemberId === ALL_ID && styles.filterChipAllSel]}
            onPress={() => setSelectedMemberId(ALL_ID)}
          >
            <Text style={[styles.filterChipText, selectedMemberId === ALL_ID && styles.filterChipTextSel]}>
              {t('weeklyView.all')}
            </Text>
          </TouchableOpacity>
          {members.map((m) => {
            const sel = selectedMemberId === m.id;
            return (
              <TouchableOpacity
                key={m.id}
                style={[styles.filterChip, { borderColor: m.color }, sel && { backgroundColor: m.color }]}
                onPress={() => setSelectedMemberId(sel ? ALL_ID : m.id)}
              >
                <View style={[styles.filterAvatar, { backgroundColor: sel ? 'rgba(255,255,255,0.35)' : m.color }]}>
                  <Text style={styles.filterAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                </View>
                <Text style={[styles.filterChipText, sel && styles.filterChipTextSel]}>{m.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* ── Event list ── */}
        <View style={styles.eventList}>
          {occurrences.length === 0 ? (
            /* Empty state */
            <View style={styles.emptyWrap}>
            <Text style={styles.emptyIcon}>☀</Text>
            <Text style={styles.emptyTitle}>{t('today.noEvents')}</Text>
            <Text style={styles.emptyHint}>{t('today.noEventsHint')}</Text>
          </View>
          ) : (
            occurrences.map((occ, idx) => {
            const localStart  = convertUTCToLocal(occ.start, timezone);
            const localEnd    = convertUTCToLocal(occ.end,   timezone);
            const startStr    = formatTime(occ.start, timezone, timeFormat === '12h');
            const endStr      = formatTime(occ.end,   timezone, timeFormat === '12h');
            const duration    = formatDuration(localStart, localEnd);
            const status      = getStatus(occ);
            const accentColor = TYPE_COLORS[occ.type] ?? TYPE_COLORS.other;
            const bgColor     = TYPE_BG[occ.type]     ?? TYPE_BG.other;
            const assignedMembers = members.filter((m) => occ.memberIds.includes(m.id));

            // Show a time-of-day marker if first event or gap to previous
            const prevEnd = idx > 0 ? occurrences[idx - 1].end : null;
              const showTimeSep = idx === 0 || (prevEnd && localStart.getTime() - prevEnd.getTime() > 30 * 60 * 1000);

              return (
              <React.Fragment key={`${occ.eventId}-${occ.start.getTime()}`}>
                {showTimeSep && (
                  <View style={styles.timeSep}>
                    <View style={styles.timeSepLine} />
                    <Text style={styles.timeSepText}>{startStr}</Text>
                    <View style={styles.timeSepLine} />
                  </View>
                )}

                <TouchableOpacity
                  activeOpacity={0.75}
                  style={[
                    styles.cardWrap,
                    status === 'ongoing' && { borderLeftWidth: 3, borderLeftColor: accentColor },
                    status === 'past'    && styles.cardWrapPast,
                  ]}
                  onPress={() => { setPressedEvent(occ); setSheetVisible(true); }}
                >
                  <Card
                    variant="default"
                    animation="disable-all"
                    style={status === 'past' ? { opacity: 0.55 } : undefined}
                  >
                    {/* Top row: dot + title + time */}
                    <Card.Header className="flex-row items-center gap-3 pb-2">
                      <View style={[styles.typeDot, { backgroundColor: accentColor }]} />
                      <Card.Title
                        numberOfLines={1}
                        style={styles.cardTitle}
                      >
                        {occ.title}
                      </Card.Title>
                      <Card.Description style={styles.cardTime}>
                        {startStr}
                      </Card.Description>
                      {currentMemberRole === 'parent' && listsByEventId[occ.eventId] && (
                        <TouchableOpacity
                          onPress={() => {
                            setShoppingEventId(occ.eventId);
                            setShoppingEventTitle(occ.title);
                            setShoppingSheetVisible(true);
                          }}
                          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                          <Text style={styles.cartBadge}>🛒</Text>
                        </TouchableOpacity>
                      )}
                    </Card.Header>

                    <Card.Body className="pt-0 gap-3">
                      {/* Sub-row: duration + type + recurring + ongoing */}
                      <View style={styles.cardMetaRow}>
                        <View style={[styles.typeBadge, { backgroundColor: accentColor + '18' }]}>
                          <Text style={[styles.typeBadgeText, { color: accentColor }]}>
                            {typeLabel(occ.type)}
                          </Text>
                        </View>
                        <Text style={styles.cardDuration}>{startStr} – {endStr} · {duration}</Text>
                        {occ.isRecurring && (
                          <Ionicons name="repeat" size={13} color="#AEAEB2" />
                        )}
                        {status === 'ongoing' && (
                          <View style={[styles.ongoingPill, { backgroundColor: accentColor }]}>
                            <Text style={styles.ongoingPillText}>{t('today.ongoing')}</Text>
                          </View>
                        )}
                      </View>

                      {/* Members */}
                      {assignedMembers.length > 0 && (
                        <View style={styles.membersRow}>
                          {assignedMembers.map((m) => (
                            <View key={m.id} style={[styles.memberChip, { backgroundColor: m.color + '18' }]}>
                              <View style={[styles.memberAvatar, { backgroundColor: m.color }]}>
                                <Text style={styles.memberAvatarText}>{m.name.charAt(0).toUpperCase()}</Text>
                              </View>
                              <Text style={[styles.memberName, { color: m.color }]}>{m.name}</Text>
                            </View>
                          ))}
                        </View>
                      )}
                    </Card.Body>
                  </Card>
                </TouchableOpacity>
              </React.Fragment>
            );
            })
          )}
          <View style={{ height: 140 }} />
        </View>

      </Animated.ScrollView>

      {/* —— FABs —— */}
      {currentMemberRole === 'parent' && (
        <View style={styles.fabGroup}>
          <TouchableOpacity
            style={[
              styles.fabMic,
              micState === 'recording' && styles.fabMicRecording,
            ]}
            activeOpacity={0.85}
            onPress={handleMicFab}
            disabled={micState === 'processing'}
          >
            {micState === 'recording'
              ? <Ionicons name="stop-circle" size={24} color="#fff" />
              : <Ionicons name="mic" size={22} color={isPremium ? '#44B57F' : '#AEAEB2'} />
            }
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.fab}
            activeOpacity={0.85}
            onPressIn={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)}
            onPress={() => { setParsedEvent(null); setPressedEvent(undefined); setSheetVisible(true); }}
          >
            <Text style={styles.fabIcon}>+</Text>
          </TouchableOpacity>
        </View>
      )}

      <EventCreateSheet
        visible={sheetVisible}
        onClose={() => { setSheetVisible(false); setPressedEvent(undefined); setParsedEvent(null); }}
        initialDate={todayStart}
        lockedDate={parsedEvent ? undefined : todayStart}
        editEvent={pressedEvent}
        initialParsed={parsedEvent}
        onOpenShoppingList={(id, evtTitle) => {
          setShoppingEventId(id);
          setShoppingEventTitle(evtTitle);
          setShoppingSheetVisible(true);
        }}
      />
      <ShoppingListSheet
        visible={shoppingSheetVisible}
        onClose={() => { setShoppingSheetVisible(false); setShoppingEventId(''); setShoppingEventTitle(''); }}
        eventId={shoppingEventId}
        eventTitle={shoppingEventTitle}
      />
      <VoiceProcessingOverlay visible={micState === 'processing'} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F2F3F5' },

  // ── Outer scroll ──────────────────────────────────────────────────────────
  scrollContent: { paddingBottom: 0 },

  // ── HERO ──────────────────────────────────────────────────────────────────
  hero: {
    height: 300,
    backgroundColor: '#44B57F',
    overflow: 'hidden',
  },

  // Animated blobs
  blob: { position: 'absolute', borderRadius: 9999 },
  blob5: { width: 440, height: 440, top: -110, left: -60,  backgroundColor: '#1B7A50', opacity: 0.50 },
  blob1: { width: 300, height: 300, top: -70,  left: -50,  backgroundColor: '#2D9160', opacity: 0.55 },
  blob2: { width: 240, height: 240, top: -20,  right: -50, backgroundColor: '#72DBA8', opacity: 0.40 },
  blob3: { width: 210, height: 210, bottom: -40, right: -30, backgroundColor: '#22B498', opacity: 0.35 },
  blob4: { width: 140, height: 140, bottom: 10, left: 40,  backgroundColor: '#C2F5DA', opacity: 0.45 },

  // Frosted overlay — desaturates and smooths the blobs
  heroFrost: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },

  heroContent: {
    flex: 1,
    paddingHorizontal: 26,
    paddingTop: 22,   // overridden inline with insets.top
    paddingBottom: 32,
    justifyContent: 'flex-end',
  },
  heroLogoWrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 60,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
  heroLogo: {
    width: 140,
    height: 70,
    opacity: 0.95,
  },
  heroPhrase: {
    fontSize: 34,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1.0,
    lineHeight: 42,
    marginBottom: 8,
  },
  heroDate: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    textTransform: 'capitalize',
    marginBottom: 22,
  },
  heroBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 26,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 14,
    elevation: 6,
  },
  heroBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A6E46',
    letterSpacing: 0.2,
  },

  // ── Filter bar ────────────────────────────────────────────────────────────
  filterBar: { flexGrow: 0, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  filterContent: { paddingHorizontal: 16, paddingVertical: 10, gap: 8, flexDirection: 'row' },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#F2F3F5',
    borderWidth: 1.5,
    borderColor: 'transparent',
    gap: 6,
  },
  filterChipAllSel: { backgroundColor: '#44B57F', borderColor: '#44B57F' },
  filterChipText: { fontSize: 13, fontWeight: '600', color: '#6E6E7A' },
  filterChipTextSel: { color: '#fff' },
  filterAvatar: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  filterAvatarText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  // ── Event list ────────────────────────────────────────────────────────────
  eventList: { backgroundColor: '#F2F3F5', paddingHorizontal: 16, paddingTop: 16, minHeight: 300 },

  // Empty state
  emptyWrap: { alignItems: 'center', marginTop: 72, paddingHorizontal: 32 },
  emptyIcon: { fontSize: 48, marginBottom: 14, opacity: 0.35 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#2C2C2E', textAlign: 'center', marginBottom: 8 },
  emptyHint: { fontSize: 14, color: '#9999A6', textAlign: 'center', lineHeight: 20 },

  // Time separator
  timeSep: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, marginTop: 4, gap: 8 },
  timeSepLine: { flex: 1, height: 1, backgroundColor: '#E5E5EA' },
  timeSepText: { fontSize: 11, fontWeight: '700', color: '#AEAEB2', letterSpacing: 0.5 },

  // Cards
  cardWrap: {
    marginBottom: 10,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  cardWrapPast: { shadowOpacity: 0.02, elevation: 1 },

  typeDot: { width: 9, height: 9, borderRadius: 5, flexShrink: 0 },
  cardTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#2C2C2E' },
  cardTime: { fontSize: 13, color: '#AEAEB2', fontWeight: '500', flexShrink: 0 },

  cardMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  typeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, alignSelf: 'flex-start' },
  typeBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.2 },
  cardDuration: { fontSize: 12, color: '#AEAEB2', fontWeight: '400' },

  ongoingPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, marginLeft: 'auto' },
  ongoingPillText: { fontSize: 11, fontWeight: '700', color: '#fff', letterSpacing: 0.2 },

  membersRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  memberChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20 },
  memberAvatar: { width: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontSize: 10, fontWeight: '700', color: '#fff' },
  memberName: { fontSize: 12, fontWeight: '600' },

  cartBadge: { fontSize: 15 },

  textMuted: { color: '#AEAEB2' },

  // FAB
  fabGroup: {
    position: 'absolute',
    bottom: 130,
    right: 24,
    alignItems: 'center',
    gap: 12,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#44B57F',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#44B57F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  fabMic: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.10,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1.5,
    borderColor: '#E5E5EA',
  },
  fabMicRecording: {
    backgroundColor: '#FF3B30',
    borderColor: '#FF3B30',
    shadowColor: '#FF3B30',
    shadowOpacity: 0.35,
  },
  fabMicProcessing: {
    backgroundColor: '#E5E5EA',
    borderColor: '#E5E5EA',
  },
  fabIcon: { color: '#FAFAF8', fontSize: 28, lineHeight: 32, fontWeight: '300' },

  // Legacy (unused, kept for safety)
  safeAreaLegacy: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#F2F3F5' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 10, paddingBottom: 14, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#E5E5EA' },
  headerLeft: { flex: 1 },
  headerTitle: { fontSize: 26, fontWeight: '800', color: '#2C2C2E', letterSpacing: -0.3, lineHeight: 30 },
  headerSubtitle: { fontSize: 13, color: '#9999A6', fontWeight: '500', marginTop: 2, textTransform: 'capitalize' },
  eventCountBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#F0FFF8', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 },
  eventCountNum: { fontSize: 16, fontWeight: '700', color: '#44B57F' },
  scroll: { flex: 1 },
});
