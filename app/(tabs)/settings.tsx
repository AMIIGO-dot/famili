/**
 * FAMILJ – Settings Screen
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
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
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
      <View style={styles.headerSurface}>
        <View style={styles.headerRow}>
          <Text style={styles.screenTitle}>{t('settings.title')}</Text>
          <View style={styles.headerIcon}>
            <Ionicons name="settings" size={20} color="#2C2C2E" />
          </View>
        </View>
      </View>
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

        {/* Timezone (read-only display) */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>{t('settings.timezone')}</Text>
          <View style={styles.option}>
            <Text style={styles.optionText}>{timezone}</Text>
            <Text style={styles.detectedLabel}>{t('settings.detectedTimezone')}</Text>
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={signOut}>
          <Text style={styles.signOutText}>{t('auth.signOut')}</Text>
        </TouchableOpacity>
      </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: {
    flex: 1,
    backgroundColor: '#F2F3F5',
  },
  headerSurface: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
  },
  headerBrand: {
    fontSize: 10,
    fontWeight: '800',
    color: '#AEAEB2',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  screenTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2C2C2E',
    letterSpacing: -0.3,
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  detectedLabel: {
    fontSize: 11,
    color: '#AEAEB2',
    fontStyle: 'italic',
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
