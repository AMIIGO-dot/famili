/**
 * FAMILJ â€“ Settings Screen
 *
 * Three-segment layout:
 *   Preferences  |  Account  |  About
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Linking,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { Switch } from 'heroui-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useFamilyStore } from '../../src/stores/familyStore';
import { usePurchaseStore } from '../../src/stores/purchaseStore';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../src/i18n';

// â”€â”€â”€ App metadata â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const APP_VERSION = '0.1.0 (beta)';
const LINKS = {
  privacy: 'https://familj.app/privacy',
  terms:   'https://familj.app/terms',
  support: 'mailto:hello@familj.app',
};

// â”€â”€â”€ Language labels â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const LANGUAGE_LABELS: Record<SupportedLanguage, string> = { en: 'EN', sv: 'SV', de: 'DE' };
const LANGUAGE_FULL:   Record<SupportedLanguage, string> = {
  en: 'English', sv: 'Svenska', de: 'Deutsch',
};

// â”€â”€â”€ Shared primitives â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function SectionHeader({ label }: { label: string }) {
  return <Text style={styles.sectionHeader}>{label}</Text>;
}

function Card({ children }: { children: React.ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

function Divider() {
  return <View style={styles.divider} />;
}

function Row({
  icon,
  iconColor = '#44B57F',
  label,
  sublabel,
  right,
  onPress,
  last = false,
  destructive = false,
}: {
  icon: string;
  iconColor?: string;
  label: string;
  sublabel?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  last?: boolean;
  destructive?: boolean;
}) {
  const inner = (
    <View style={styles.row}>
      <View style={[styles.iconWrap, { backgroundColor: destructive ? '#FFF0F0' : iconColor + '1A' }]}>
        <Ionicons name={icon as any} size={17} color={destructive ? '#D93025' : iconColor} />
      </View>
      <View style={styles.rowMid}>
        <Text style={[styles.rowLabel, destructive && { color: '#D93025' }]}>{label}</Text>
        {sublabel ? <Text style={styles.rowSublabel}>{sublabel}</Text> : null}
      </View>
      <View style={styles.rowRight}>{right}</View>
      {onPress && !right && (
        <Ionicons name="chevron-forward" size={15} color="#C7C7CC" style={{ marginLeft: 4 }} />
      )}
    </View>
  );

  return (
    <>
      {onPress ? (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>{inner}</TouchableOpacity>
      ) : inner}
      {!last && <Divider />}
    </>
  );
}

// â”€â”€â”€ Segment bar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Seg = 'prefs' | 'account' | 'about';

function SegBar({ active, onChange }: { active: Seg; onChange: (s: Seg) => void }) {
  const { t } = useTranslation();
  const items: { key: Seg; label: string }[] = [
    { key: 'prefs',   label: t('settings.segPrefs') },
    { key: 'account', label: t('settings.segAccount') },
    { key: 'about',   label: t('settings.segAbout') },
  ];
  return (
    <View style={styles.segBar}>
      {items.map((item) => (
        <TouchableOpacity
          key={item.key}
          style={[styles.segItem, active === item.key && styles.segItemActive]}
          onPress={() => onChange(item.key)}
          activeOpacity={0.75}
        >
          <Text style={[styles.segLabel, active === item.key && styles.segLabelActive]}>
            {item.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// â”€â”€â”€ Preferences panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function PrefsPanel() {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const { language, timezone, weekStartsOn, timeFormat, setLanguage, setWeekStartsOn, setTimeFormat } =
    useSettingsStore();

  return (
    <ScrollView style={styles.panel} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

      <SectionHeader label={t('settings.language')} />
      <Card>
        <Row icon="language-outline" iconColor="#44B57F" label={LANGUAGE_FULL[language]} last
          right={
            <View style={styles.chipRow}>
              {SUPPORTED_LANGUAGES.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  style={[styles.chip, language === lang && styles.chipActive]}
                  onPress={() => setLanguage(lang, user?.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, language === lang && styles.chipTextActive]}>
                    {LANGUAGE_LABELS[lang]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />
      </Card>

      <SectionHeader label={t('settings.weekStart')} />
      <Card>
        <Row
          icon="calendar-outline"
          iconColor="#44B57F"
          label={weekStartsOn === 1 ? t('settings.weekStartMonday') : t('settings.weekStartSunday')}
          last
          right={
            <View style={styles.chipRow}>
              {([1, 0] as const).map((v) => (
                <TouchableOpacity
                  key={v}
                  style={[styles.chip, weekStartsOn === v && styles.chipActive]}
                  onPress={() => setWeekStartsOn(v, user?.id)}
                  activeOpacity={0.75}
                >
                  <Text style={[styles.chipText, weekStartsOn === v && styles.chipTextActive]}>
                    {v === 1 ? t('settings.weekStartMonday').slice(0, 3) : t('settings.weekStartSunday').slice(0, 3)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          }
        />
      </Card>

      <SectionHeader label={t('settings.timeFormat')} />
      <Card>
        <Row
          icon="time-outline"
          iconColor="#44B57F"
          label={t(timeFormat === '24h' ? 'settings.timeFormat24h' : 'settings.timeFormat12h')}
          last
          right={
            <View style={styles.switchRow}>
              <Text style={[styles.switchLabel, timeFormat === '24h' && { color: '#2C2C2E', fontWeight: '700' }]}>24h</Text>
              <Switch
                isSelected={timeFormat === '12h'}
                onSelectedChange={(v) => setTimeFormat(v ? '12h' : '24h', user?.id)}
              />
              <Text style={[styles.switchLabel, timeFormat === '12h' && { color: '#2C2C2E', fontWeight: '700' }]}>12h</Text>
            </View>
          }
        />
      </Card>

      <SectionHeader label={t('settings.timezone')} />
      <Card>
        <Row
          icon="globe-outline"
          iconColor="#44B57F"
          label={timezone}
          sublabel={t('settings.detectedTimezone')}
          last
        />
      </Card>

    </ScrollView>
  );
}

// â”€â”€â”€ Account panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AccountPanel() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, signOut } = useAuthStore();
  const { family, members } = useFamilyStore();
  const { isPremium: rcIsPremium } = usePurchaseStore();

  // Co-parents and kids inherit premium from the family owner via Supabase subscription
  const familySubscription = useFamilyStore((s) => s.subscription);
  const familyIsPremium = !!(
    familySubscription?.status === 'active' && familySubscription?.plan !== 'free'
  );
  const isPremium = rcIsPremium || familyIsPremium;

  // Only the family owner can purchase / manage the subscription
  const isOwner = !family || family.owner_id === user?.id;

  const email = user?.email ?? '';
  const initial = email.charAt(0).toUpperCase();
  const AVATAR_COLORS = ['#5B9CF6', '#F97B8B', '#68D9A4', '#BF86FF', '#F5A623'];
  const avatarColor = AVATAR_COLORS[email.charCodeAt(0) % AVATAR_COLORS.length];

  const handleSignOut = () => {
    Alert.alert(t('auth.signOut'), t('settings.signOutConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('auth.signOut'), style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <ScrollView style={styles.panel} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

      {/* Profile card */}
      <View style={styles.profileCard}>
        <View style={[styles.profileAvatar, { backgroundColor: avatarColor }]}>
          <Text style={styles.profileInitial}>{initial}</Text>
        </View>
        <View style={styles.profileInfo}>
          <Text style={styles.profileEmail}>{email}</Text>
          {family && (
            <Text style={styles.profileFamily}>
              {family.name} Â· {members.length} {t('settings.members').toLowerCase()}
            </Text>
          )}
        </View>
        <View style={[styles.freeBadge, isPremium && styles.premiumBadge]}>
          <Text style={[styles.freeBadgeText, isPremium && styles.premiumBadgeText]}>
            {isPremium ? 'PREMIUM' : 'FREE'}
          </Text>
        </View>
      </View>

      <SectionHeader label={t('settings.subscription')} />
      <Card>
        {isOwner ? (
          <>
            <Row
              icon="star-outline"
              iconColor="#44B57F"
              label={t('subscription.premium')}
              sublabel={t('subscription.currentPlan', {
                plan: t(isPremium ? 'subscription.planMonthly' : 'subscription.planFree'),
              })}
              onPress={() => router.push('/paywall')}
            />
            <Row
              icon="headset-outline"
              iconColor="#44B57F"
              label={t('subscription.manageSubscription')}
              sublabel={t('subscription.manageSubscriptionSub')}
              onPress={() => router.push('/customer-center')}
              last
            />
          </>
        ) : (
          <Row
            icon={isPremium ? 'star' : 'star-outline'}
            iconColor={isPremium ? '#F5A623' : '#AEAEB2'}
            label={isPremium ? t('subscription.familyPremium') : t('subscription.planFree')}
            sublabel={t('subscription.managedByOwner')}
            last
          />
        )}
      </Card>

      <SectionHeader label={t('settings.account')} />
      <Card>
        <Row icon="mail-outline" iconColor="#AEAEB2" label={email} last />
      </Card>

      <SectionHeader label=" " />
      <Card>
        <Row
          icon="log-out-outline"
          label={t('auth.signOut')}
          onPress={handleSignOut}
          destructive
          last
        />
      </Card>

    </ScrollView>
  );
}

// â”€â”€â”€ About panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

function AboutPanel() {
  const { t } = useTranslation();

  const open = (url: string) => {
    Linking.openURL(url).catch(() => Alert.alert(t('common.error'), 'Could not open link'));
  };

  return (
    <ScrollView style={styles.panel} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 48 }}>

      <View style={styles.appBrand}>
        <Image
          source={require('../../assets/FAMILU app logo-green(1000 x 500 px) (1).png')}
          style={styles.appBrandLogo}
          resizeMode="contain"
        />
        <Text style={styles.appBrandVersion}>{APP_VERSION}</Text>
      </View>

      <SectionHeader label={t('settings.legal')} />
      <Card>
        <Row
          icon="document-text-outline"
          iconColor="#44B57F"
          label={t('settings.termsOfUse')}
          onPress={() => open(LINKS.terms)}
        />
        <Row
          icon="shield-checkmark-outline"
          iconColor="#44B57F"
          label={t('settings.privacyPolicy')}
          onPress={() => open(LINKS.privacy)}
          last
        />
      </Card>

      <SectionHeader label={t('settings.support')} />
      <Card>
        <Row
          icon="mail-outline"
          iconColor="#44B57F"
          label={t('settings.contactSupport')}
          sublabel="hello@familj.app"
          onPress={() => open(LINKS.support)}
        />
        <Row
          icon="star-half-outline"
          iconColor="#44B57F"
          label={t('settings.rateApp')}
          onPress={() => Alert.alert('Rate FAMILU', 'Coming soon on the App Store')}
          last
        />
      </Card>


      <Text style={styles.legalFooter}>{t('settings.copyright')}</Text>

    </ScrollView>
  );
}

// â”€â”€â”€ Root screen â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export default function SettingsScreen() {
  const { t } = useTranslation();
  const [seg, setSeg] = useState<Seg>('prefs');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>

        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('settings.title')}</Text>
        </View>

        <SegBar active={seg} onChange={setSeg} />

        {seg === 'prefs'   && <PrefsPanel />}
        {seg === 'account' && <AccountPanel />}
        {seg === 'about'   && <AboutPanel />}

      </View>
    </SafeAreaView>
  );
}

// â”€â”€â”€ Styles â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#F2F3F5' },

  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2C2C2E',
    letterSpacing: -0.3,
  },

  // Segment bar
  segBar: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  segItem: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
  },
  segItemActive: { backgroundColor: '#44B57F' },
  segLabel: { fontSize: 13, fontWeight: '600', color: '#6E6E7A' },
  segLabelActive: { color: '#FFFFFF' },

  // Panel
  panel: { flex: 1, paddingHorizontal: 16, paddingTop: 20 },

  // Section header
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9999A6',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 8,
    marginLeft: 4,
  },

  // Card
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
    overflow: 'hidden',
  },

  // Row
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    paddingHorizontal: 14,
    gap: 12,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowMid: { flex: 1, gap: 1 },
  rowLabel: { fontSize: 15, fontWeight: '500', color: '#2C2C2E' },
  rowSublabel: { fontSize: 11, color: '#AEAEB2', marginTop: 1 },
  rowRight: { alignItems: 'flex-end', justifyContent: 'center' },
  divider: { height: 1, backgroundColor: '#F2F3F5', marginLeft: 58 },

  // Chips
  chipRow: { flexDirection: 'row', gap: 6 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, backgroundColor: '#F2F3F5' },
  chipActive: { backgroundColor: '#44B57F' },
  chipText: { fontSize: 13, fontWeight: '600', color: '#6E6E7A' },
  chipTextActive: { color: '#FAFAF8' },

  // Switch
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  switchLabel: { fontSize: 12, fontWeight: '500', color: '#C7C7CC' },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    gap: 12,
  },
  profileAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: { fontSize: 22, fontWeight: '800', color: '#fff' },
  profileInfo: { flex: 1, gap: 2 },
  profileEmail: { fontSize: 14, fontWeight: '600', color: '#2C2C2E' },
  profileFamily: { fontSize: 12, color: '#9999A6', fontWeight: '500' },
  freeBadge: {
    backgroundColor: '#F2F3F5',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  freeBadgeText: { fontSize: 10, fontWeight: '800', color: '#9999A6', letterSpacing: 1 },
  premiumBadge: { backgroundColor: '#FFF3D6' },
  premiumBadgeText: { color: '#C67C00' },

  // About
  appBrand: { alignItems: 'center', paddingVertical: 24, gap: 4 },
  appBrandLogo: { width: 180, height: 90 },
  appBrandVersion: { fontSize: 12, color: '#AEAEB2', fontWeight: '500' },
  legalFooter: {
    textAlign: 'center',
    fontSize: 11,
    color: '#C7C7CC',
    marginTop: 8,
    lineHeight: 18,
  },
});
