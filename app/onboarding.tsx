/**
 * FAMILJ – Onboarding Screen
 *
 * Step 1: Family name
 * Step 2: Add family members (name + color + role)
 *
 * Works with DEV_BYPASS (sets local state) and real Supabase.
 */

import React, { useState } from 'react';
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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { useFamilyStore } from '../src/stores/familyStore';
import { useAuthStore } from '../src/stores/authStore';

const PRESET_COLORS = ['#5B9CF6', '#F97B8B', '#68D9A4', '#F5A623', '#B48AE6', '#FF8C42', '#4ECDC4'];

interface DraftMember {
  name: string;
  color: string;
  role: 'parent' | 'child';
}

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user } = useAuthStore();
  const { family, members, fetchFamily } = useFamilyStore();

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
      Alert.alert(t('common.error'), 'Please add a family name and at least one member.');
      return;
    }

    setSaving(true);
    try {
      const { supabase } = await import('../src/lib/supabase');

      // DEV_BYPASS check — if family is already seeded (has dev-family-id), just navigate
      if (family?.id === 'dev-family-id') {
        router.replace('/(tabs)');
        return;
      }

      // Real path: create family + members in Supabase
      if (!user) throw new Error('Not logged in');

      const { data: newFamily, error: familyErr } = await supabase
        .from('families')
        .insert({ name: familyName.trim(), owner_id: user.id })
        .select()
        .single();

      if (familyErr) throw familyErr;

      await supabase.from('members').insert(
        validMembers.map((m) => ({
          family_id: newFamily.id,
          name: m.name.trim(),
          color: m.color,
          role: m.role,
        }))
      );

      await fetchFamily(user.id);
      router.replace('/(tabs)');
    } catch (err: any) {
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
        {/* Progress dots */}
        <View style={styles.progressRow}>
          <View style={[styles.dot, step >= 1 && styles.dotActive]} />
          <View style={[styles.dot, step >= 2 && styles.dotActive]} />
        </View>

        {step === 1 ? (
          /* ── Step 1: Family name ── */
          <View style={styles.stepContainer}>
            <Text style={styles.appName}>{t('common.appName')}</Text>
            <Text style={styles.stepTitle}>{t('onboarding.step1Title')}</Text>
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
            >
              <Text style={styles.btnText}>{t('onboarding.next')} →</Text>
            </TouchableOpacity>
          </View>
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
                  {/* Name input */}
                  <TextInput
                    style={styles.memberNameInput}
                    placeholder={t('onboarding.memberNamePlaceholder')}
                    placeholderTextColor="#AEAEB2"
                    value={member.name}
                    onChangeText={(v) => updateDraftMember(idx, { name: v })}
                    autoCapitalize="words"
                  />

                  {/* Role picker */}
                  <View style={styles.roleRow}>
                    {(['parent', 'child'] as const).map((role) => (
                      <TouchableOpacity
                        key={role}
                        style={[styles.roleChip, member.role === role && styles.roleChipActive]}
                        onPress={() => updateDraftMember(idx, { role })}
                      >
                        <Text style={[styles.roleChipText, member.role === role && styles.roleChipTextActive]}>
                          {t(`onboarding.memberRole${role.charAt(0).toUpperCase()}${role.slice(1)}` as any)}
                        </Text>
                      </TouchableOpacity>
                    ))}

                    {/* Remove button */}
                    {draftMembers.length > 1 && (
                      <TouchableOpacity style={styles.removeBtn} onPress={() => removeDraftMember(idx)}>
                        <Text style={styles.removeBtnText}>✕</Text>
                      </TouchableOpacity>
                    )}
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

              {/* Add member */}
              <TouchableOpacity style={styles.addMemberBtn} onPress={addDraftMember}>
                <Text style={styles.addMemberText}>{t('onboarding.addMember')}</Text>
              </TouchableOpacity>
            </ScrollView>

            {/* Footer buttons */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.backBtn} onPress={() => setStep(1)}>
                <Text style={styles.backBtnText}>← Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.btn, styles.btnFlex, saving && styles.btnDisabled]}
                onPress={handleFinish}
                disabled={saving}
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
  progressRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    paddingTop: 16,
    paddingBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#E0E0DA',
  },
  dotActive: {
    backgroundColor: '#2C2C2E',
    width: 20,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  appName: {
    fontSize: 32,
    fontWeight: '800',
    color: '#2C2C2E',
    letterSpacing: 3,
    textAlign: 'center',
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#2C2C2E',
    marginBottom: 16,
    lineHeight: 28,
  },
  input: {
    backgroundColor: '#F0F0EC',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 17,
    color: '#2C2C2E',
    marginBottom: 16,
  },
  btn: {
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnFlex: {
    flex: 1,
  },
  btnDisabled: {
    opacity: 0.4,
  },
  btnText: {
    color: '#FAFAF8',
    fontSize: 16,
    fontWeight: '600',
  },
  memberCard: {
    backgroundColor: '#F0F0EC',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  memberNameInput: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2C2C2E',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#DDDDD8',
    marginBottom: 10,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
    alignItems: 'center',
  },
  roleChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: '#E0E0DA',
  },
  roleChipActive: {
    backgroundColor: '#2C2C2E',
  },
  roleChipText: {
    fontSize: 13,
    color: '#6E6E7A',
    fontWeight: '500',
  },
  roleChipTextActive: {
    color: '#FAFAF8',
  },
  removeBtn: {
    marginLeft: 'auto' as any,
    padding: 4,
  },
  removeBtnText: {
    color: '#AEAEB2',
    fontSize: 16,
  },
  colorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  colorDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  colorDotSelected: {
    borderWidth: 3,
    borderColor: '#2C2C2E',
  },
  addMemberBtn: {
    borderWidth: 1.5,
    borderColor: '#C8C8CC',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  addMemberText: {
    fontSize: 15,
    color: '#6E6E7A',
    fontWeight: '500',
  },
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 12,
    paddingBottom: 8,
  },
  backBtn: {
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  backBtnText: {
    fontSize: 15,
    color: '#6E6E7A',
  },
});
