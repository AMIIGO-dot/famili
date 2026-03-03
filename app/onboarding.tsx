/**
 * FAMILJ – Onboarding Screen
 *
 * Step 1: Language + Family name
 * Step 2: Add family members (name + role + color)
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useFamilyStore } from '../src/stores/familyStore';
import { useAuthStore } from '../src/stores/authStore';
import { useSettingsStore } from '../src/stores/settingsStore';
import i18n from '../src/i18n';
import type { SupportedLanguage } from '../src/i18n';

const PRESET_COLORS = ['#44B57F', '#F97B8B', '#5B9CF6', '#F5A623', '#B48AE6', '#FF8C42', '#4ECDC4'];

const LANGUAGE_OPTIONS: { code: SupportedLanguage; label: string; native: string }[] = [
  { code: 'sv', label: 'SV', native: 'Svenska' },
  { code: 'en', label: 'EN', native: 'English' },
  { code: 'de', label: 'DE', native: 'Deutsch' },
];

interface DraftMember {
  name: string;
  color: string;
  role: 'parent' | 'child';
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const { fetchFamily } = useFamilyStore();
  const { setLanguage } = useSettingsStore();

  // Default to Swedish
  const [selectedLang, setSelectedLang] = useState<SupportedLanguage>('sv');

  // Apply Swedish immediately on mount
  useEffect(() => {
    i18n.changeLanguage('sv');
  }, []);

  const handleSelectLang = (lang: SupportedLanguage) => {
    setSelectedLang(lang);
    i18n.changeLanguage(lang);
  };

  const [step, setStep] = useState<1 | 2>(1);
  const [familyName, setFamilyName] = useState('');
  const [draftMembers, setDraftMembers] = useState<DraftMember[]>([
    { name: '', color: PRESET_COLORS[0], role: 'parent' },
  ]);
  const [saving, setSaving] = useState(false);

  const addDraftMember = () => {
    setDraftMembers((prev) => [
      ...prev,
      { name: '', color: PRESET_COLORS[prev.length % PRESET_COLORS.length], role: 'child' },
    ]);
  };

  const updateDraftMember = (idx: number, changes: Partial<DraftMember>) => {
    setDraftMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, ...changes } : m)));
  };

  const removeDraftMember = (idx: number) => {
    if (draftMembers.length <= 1) return;
    setDraftMembers((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleFinish = async () => {
    const validMembers = draftMembers.filter((m) => m.name.trim());
    if (!familyName.trim() || validMembers.length === 0) {
      Alert.alert(t('common.error'), t('onboarding.step2Title'));
      return;
    }

    setSaving(true);
    try {
      // DEV_BYPASS: fake user has no real UUID — skip Supabase and go straight to tabs
      if (user?.id === 'dev-user-id') {
        await setLanguage(selectedLang);
        router.replace('/(tabs)');
        return;
      }

      const { supabase } = await import('../src/lib/supabase');

      if (!user) throw new Error('Not logged in');

      // 1. Create family
      const { data: newFamily, error: familyErr } = await supabase
        .from('families')
        .insert({ name: familyName.trim(), owner_id: user.id })
        .select()
        .single();

      if (familyErr) throw familyErr;

      // 2. Create members — attach user_id to the first parent (= the account creator)
      let ownerTagged = false;
      const { error: membersErr } = await supabase.from('members').insert(
        validMembers.map((m) => {
          const isOwner = m.role === 'parent' && !ownerTagged;
          if (isOwner) ownerTagged = true;
          return {
            family_id: newFamily.id,
            name: m.name.trim(),
            color: m.color,
            role: m.role,
            user_id: isOwner ? user.id : null,
          };
        })
      );

      if (membersErr) throw membersErr;

      // 3. Save chosen language to profile
      await setLanguage(selectedLang, user.id);

      // 4. Refresh family in store and navigate
      await fetchFamily(user.id);
      router.replace('/(tabs)');
    } catch (err: any) {
      console.error('[Onboarding] handleFinish error:', err);
      Alert.alert(t('common.error'), err.message ?? t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Progress bar */}
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: step === 1 ? '50%' : '100%' }]} />
          </View>
        </View>

        {step === 1 ? (
          /* ── Step 1: Logo + Language + Family name ── */
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.stepContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Logo */}
            <View style={styles.logoWrap}>
              <Image
                source={require('../assets/FAMILU app logo-green(1000 x 500 px) (1).png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>

            {/* Language selector */}
            <Text style={styles.sectionLabel}>{t('onboarding.chooseLanguage')}</Text>
            <View style={styles.langRow}>
              {LANGUAGE_OPTIONS.map((opt) => {
                const active = selectedLang === opt.code;
                return (
                  <TouchableOpacity
                    key={opt.code}
                    style={[styles.langCard, active && styles.langCardActive]}
                    onPress={() => handleSelectLang(opt.code)}
                    activeOpacity={0.75}
                  >
                    <Text style={[styles.langCardCode, active && styles.langCardCodeActive]}>
                      {opt.label}
                    </Text>
                    <Text style={[styles.langCardNative, active && styles.langCardNativeActive]}>
                      {opt.native}
                    </Text>
                    {active && (
                      <View style={styles.langCheckWrap}>
                        <Ionicons name="checkmark" size={12} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Family name */}
            <Text style={styles.sectionLabel}>{t('onboarding.step1Title')}</Text>
            <TextInput
              style={styles.input}
              placeholder={t('onboarding.familyNamePlaceholder')}
              placeholderTextColor="#AEAEB2"
              value={familyName}
              onChangeText={setFamilyName}
              autoCapitalize="words"
              returnKeyType="next"
              onSubmitEditing={() => familyName.trim() && setStep(2)}
            />
            <TouchableOpacity
              style={[styles.btn, !familyName.trim() && styles.btnDisabled]}
              onPress={() => setStep(2)}
              disabled={!familyName.trim()}
              activeOpacity={0.85}
            >
              <Text style={styles.btnText}>{t('onboarding.next')}</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" style={{ marginLeft: 6 }} />
            </TouchableOpacity>
          </ScrollView>
        ) : (
          /* ── Step 2: Members ── */
          <View style={{ flex: 1 }}>
            <Text style={styles.stepTitle}>{t('onboarding.step2Title')}</Text>
            <ScrollView
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingBottom: 24 }}
            >
              {draftMembers.map((member, idx) => (
                <View key={idx} style={styles.memberCard}>
                  <View style={styles.memberCardHeader}>
                    <TextInput
                      style={styles.memberNameInput}
                      placeholder={t('onboarding.memberNamePlaceholder')}
                      placeholderTextColor="#AEAEB2"
                      value={member.name}
                      onChangeText={(v) => updateDraftMember(idx, { name: v })}
                      autoCapitalize="words"
                    />
                    {draftMembers.length > 1 && (
                      <TouchableOpacity
                        style={styles.removeBtn}
                        onPress={() => removeDraftMember(idx)}
                        hitSlop={8}
                      >
                        <Ionicons name="close" size={18} color="#AEAEB2" />
                      </TouchableOpacity>
                    )}
                  </View>

                  {/* Role picker */}
                  <View style={styles.roleRow}>
                    {(['parent', 'child'] as const).map((role) => (
                      <TouchableOpacity
                        key={role}
                        style={[styles.roleChip, member.role === role && styles.roleChipActive]}
                        onPress={() => updateDraftMember(idx, { role })}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.roleChipText, member.role === role && styles.roleChipTextActive]}>
                          {t(`onboarding.memberRole${role.charAt(0).toUpperCase()}${role.slice(1)}` as any)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  {/* Color picker */}
                  <View style={styles.colorRow}>
                    {PRESET_COLORS.map((c) => (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.colorDot,
                          { backgroundColor: c },
                          member.color === c && styles.colorDotSelected,
                        ]}
                        onPress={() => updateDraftMember(idx, { color: c })}
                      />
                    ))}
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.addMemberBtn} onPress={addDraftMember} activeOpacity={0.7}>
                <Ionicons name="add" size={18} color="#44B57F" />
                <Text style={styles.addMemberText}>{t('onboarding.addMember')}</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)} activeOpacity={0.7}>
                <Ionicons name="arrow-back" size={18} color="#44B57F" />
                <Text style={styles.backBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnFlex, saving && styles.btnDisabled]}
                onPress={handleFinish}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Text style={styles.btnText}>
                  {saving ? t('common.loading') : t('onboarding.getStarted')}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FAFAF8',
    paddingHorizontal: 24,
  },

  // Progress bar
  progressRow: { paddingTop: 16, paddingBottom: 8 },
  progressTrack: { height: 3, backgroundColor: '#E8E8E4', borderRadius: 2, overflow: 'hidden' },
  progressFill: { height: 3, backgroundColor: '#44B57F', borderRadius: 2 },

  // Step 1 scroll content
  stepContent: { paddingBottom: 32, paddingTop: 8 },

  // Logo block
  logoWrap: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 44,
  },
  logo: { width: 180, height: 90 },

  // Section label
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9999A6',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 12,
  },

  // Language cards
  langRow: { flexDirection: 'row', gap: 10, marginBottom: 36 },
  langCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: '#F0F0EC',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
    position: 'relative',
  },
  langCardActive: { backgroundColor: '#F0FFF8', borderColor: '#44B57F' },
  langCardCode: { fontSize: 15, fontWeight: '800', color: '#AEAEB2', letterSpacing: 1, marginBottom: 2 },
  langCardCodeActive: { color: '#44B57F' },
  langCardNative: { fontSize: 11, fontWeight: '500', color: '#AEAEB2' },
  langCardNativeActive: { color: '#44B57F' },
  langCheckWrap: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#44B57F',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Step 2 title
  stepTitle: { fontSize: 22, fontWeight: '700', color: '#2C2C2E', marginTop: 8, marginBottom: 16, lineHeight: 28 },

  // Input
  input: {
    backgroundColor: '#F0F0EC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#2C2C2E',
    marginBottom: 16,
  },

  // Button
  btn: {
    backgroundColor: '#44B57F',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
  },
  btnFlex: { flex: 1 },
  btnDisabled: { opacity: 0.4 },
  btnText: { color: '#FAFAF8', fontSize: 16, fontWeight: '600' },

  // Member cards
  memberCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  memberCardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  memberNameInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2E',
    paddingVertical: 0,
    borderBottomWidth: 1,
    borderBottomColor: '#E8E8E4',
    paddingBottom: 6,
  },
  removeBtn: { marginLeft: 12, padding: 4 },
  roleRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  roleChip: { paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F0F0EC' },
  roleChipActive: { backgroundColor: '#44B57F' },
  roleChipText: { fontSize: 13, color: '#6E6E7A', fontWeight: '500' },
  roleChipTextActive: { color: '#FAFAF8', fontWeight: '600' },
  colorRow: { flexDirection: 'row', gap: 10 },
  colorDot: { width: 28, height: 28, borderRadius: 14 },
  colorDotSelected: { borderWidth: 3, borderColor: '#44B57F' },

  // Add member
  addMemberBtn: {
    borderWidth: 1.5,
    borderColor: '#D0D0CC',
    borderStyle: 'dashed',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
  },
  addMemberText: { fontSize: 15, color: '#44B57F', fontWeight: '600' },

  // Footer
  footer: { flexDirection: 'row', gap: 12, paddingTop: 12, paddingBottom: 8, alignItems: 'center' },
  backBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 4, paddingVertical: 8 },
  backBtnText: { fontSize: 15, color: '#44B57F', fontWeight: '500' },
});
