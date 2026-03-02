/**
 * FAMILJ – Settings Screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../../src/stores/authStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from '../../src/i18n';

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { user, profile, signOut } = useAuthStore();
  const {
    language,
    timezone,
    weekStartsOn,
    timeFormat,
    setLanguage,
    setWeekStartsOn,
    setTimeFormat,
  } = useSettingsStore();

  const LANGUAGE_LABELS: Record<SupportedLanguage, string> = {
    en: 'English',
    sv: 'Svenska',
    de: 'Deutsch',
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.screenTitle}>{t('settings.title')}</Text>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>

        {/* Language */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('settings.language')}</Text>
          {SUPPORTED_LANGUAGES.map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[styles.option, language === lang && styles.optionActive]}
              onPress={() => setLanguage(lang, user?.id)}
            >
              <Text style={[styles.optionText, language === lang && styles.optionTextActive]}>
                {LANGUAGE_LABELS[lang]}
              </Text>
              {language === lang && <Text style={styles.checkmark}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>

        {/* Week start */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('settings.weekStart')}</Text>
          <TouchableOpacity
            style={[styles.option, weekStartsOn === 1 && styles.optionActive]}
            onPress={() => setWeekStartsOn(1, user?.id)}
          >
            <Text style={[styles.optionText, weekStartsOn === 1 && styles.optionTextActive]}>
              {t('settings.weekStartMonday')}
            </Text>
            {weekStartsOn === 1 && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.option, weekStartsOn === 0 && styles.optionActive]}
            onPress={() => setWeekStartsOn(0, user?.id)}
          >
            <Text style={[styles.optionText, weekStartsOn === 0 && styles.optionTextActive]}>
              {t('settings.weekStartSunday')}
            </Text>
            {weekStartsOn === 0 && <Text style={styles.checkmark}>✓</Text>}
          </TouchableOpacity>
        </View>

        {/* Time format */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('settings.timeFormat')}</Text>
          <View style={styles.row}>
            <Text style={styles.optionText}>{t('settings.timeFormat24h')}</Text>
            <Switch
              value={timeFormat === '12h'}
              onValueChange={(val) => setTimeFormat(val ? '12h' : '24h', user?.id)}
              trackColor={{ true: '#2C2C2E', false: '#C8C8CC' }}
              thumbColor="#FAFAF8"
            />
            <Text style={styles.optionText}>{t('settings.timeFormat12h')}</Text>
          </View>
        </View>

        {/* Timezone (read-only display for now) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('settings.timezone')}</Text>
          <View style={styles.option}>
            <Text style={styles.optionText}>{timezone}</Text>
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>{t('auth.signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
  },
  screenTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C2C2E',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    letterSpacing: 0.2,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 28,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9999A6',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  option: {
    backgroundColor: '#F0F0EC',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  optionActive: {
    backgroundColor: '#2C2C2E',
  },
  optionText: {
    fontSize: 15,
    color: '#2C2C2E',
  },
  optionTextActive: {
    color: '#FAFAF8',
  },
  checkmark: {
    color: '#FAFAF8',
    fontSize: 16,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F0F0EC',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  signOutBtn: {
    marginTop: 8,
    marginBottom: 40,
    backgroundColor: '#FFE8E8',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  signOutText: {
    color: '#D93025',
    fontSize: 15,
    fontWeight: '600',
  },
});
