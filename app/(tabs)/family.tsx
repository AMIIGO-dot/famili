/**
 * FAMILJ – Family Screen
 * Manage family members: view, add, edit, delete.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { BottomSheet, Button, TextField, Input, Label } from 'heroui-native';
import { useFamilyStore } from '../../src/stores/familyStore';
import InviteSheet from '../../src/components/InviteSheet';

const COLORS = [
  '#5B9CF6', '#F97B8B', '#68D9A4', '#F5A623',
  '#BF86FF', '#FF7043', '#26C6DA', '#8D8D99',
];

const DEV_BYPASS = true; // keep in sync with familyStore

type DraftMember = { id?: string; name: string; color: string; role: 'parent' | 'child' };

export default function FamilyScreen() {
  const { t } = useTranslation();
  const { family, members, addMember, updateMember, deleteMember, currentMemberRole } = useFamilyStore();
  const insets = useSafeAreaInsets();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<DraftMember | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMember, setInviteMember] = useState<typeof members[0] | null>(null);

  const openAdd = () => {
    setEditing({ name: '', color: COLORS[members.length % COLORS.length], role: 'parent' });
    setSheetOpen(true);
  };

  const openEdit = (m: typeof members[0]) => {
    setEditing({ id: m.id, name: m.name, color: m.color, role: m.role as 'parent' | 'child' });
    setSheetOpen(true);
  };

  const handleSave = async () => {
    if (!editing || !editing.name.trim() || !family) return;

    if (DEV_BYPASS) {
      // Mutate the store's members array directly (dev only)
      const store = useFamilyStore.getState();
      if (editing.id) {
        useFamilyStore.setState({
          members: store.members.map((m) =>
            m.id === editing.id
              ? { ...m, name: editing.name.trim(), color: editing.color, role: editing.role }
              : m
          ),
        });
      } else {
        const newMember = {
          id: `dev-member-${Date.now()}`,
          family_id: 'dev-family-id',
          name: editing.name.trim(),
          color: editing.color,
          role: editing.role,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        } as any;
        useFamilyStore.setState({ members: [...store.members, newMember] });
      }
    } else {
      if (editing.id) {
        await updateMember(editing.id, {
          name: editing.name.trim(),
          color: editing.color,
          role: editing.role,
        });
      } else {
        await addMember({
          family_id: family.id,
          name: editing.name.trim(),
          color: editing.color,
          role: editing.role,
        });
      }
    }
    setSheetOpen(false);
    setEditing(null);
  };

  const handleDelete = (id: string, name: string) => {
    Alert.alert(
      name,
      t('family.confirmDelete', 'Remove {{name}} from the family?').replace('{{name}}', name),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            if (DEV_BYPASS) {
              useFamilyStore.setState({
                members: useFamilyStore.getState().members.filter((m) => m.id !== id),
              });
            } else {
              await deleteMember(id);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerLeft} disabled>
          <Text style={styles.headerTitle}>
            {family?.name ?? 'Family'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {members.length} {members.length === 1 ? t('onboarding.memberNameLabel') : t('settings.members')}
          </Text>
        </TouchableOpacity>
        {currentMemberRole === 'parent' && (
          <TouchableOpacity style={styles.addIconBtn} onPress={openAdd} activeOpacity={0.75}>
            <Ionicons name="person-add" size={18} color="#2C2C2E" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>{t('settings.members', 'Members')}</Text>

        {members.map((m) => (
          <TouchableOpacity
            key={m.id}
            style={styles.memberRow}
            onPress={() => currentMemberRole === 'parent' && openEdit(m)}
            activeOpacity={currentMemberRole === 'parent' ? 0.7 : 1}
          >
            {/* Color avatar */}
            <View style={[styles.avatar, { backgroundColor: m.color }]}>
              <Text style={styles.avatarInitial}>{m.name.charAt(0).toUpperCase()}</Text>
            </View>
            {/* Info */}
            <View style={styles.memberInfo}>
              <Text style={styles.memberName}>{m.name}</Text>
              <Text style={styles.memberRole}>
                {m.role === 'parent'
                  ? t('onboarding.memberRoleParent')
                  : t('onboarding.memberRoleChild')}
              </Text>
            </View>
            {/* Edit hint — parents only */}
            {currentMemberRole === 'parent' && <Text style={styles.editHint}>›</Text>}
            {/* Invite button — parents only, for child members */}
            {currentMemberRole === 'parent' && m.role === 'child' && (
              <TouchableOpacity
                style={styles.inviteBtn}
                onPress={() => { setInviteMember(m); setInviteOpen(true); }}
                hitSlop={10}
              >
                <Ionicons name="person-add-outline" size={16} color="#5B9CF6" />
              </TouchableOpacity>
            )}
            {/* Delete — parents only */}
            {currentMemberRole === 'parent' && (
              <TouchableOpacity
                style={styles.deleteBtn}
                onPress={() => handleDelete(m.id, m.name)}
                hitSlop={10}
              >
                <Text style={styles.deleteBtnText}>✕</Text>
              </TouchableOpacity>
            )}
          </TouchableOpacity>
        ))}

        {/* Add member — parents only */}
        {currentMemberRole === 'parent' && (
          <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.7}>
            <Text style={styles.addBtnText}>{t('onboarding.addMember', '+ Add person')}</Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 130 }} />
      </ScrollView>

      {/* Add/Edit BottomSheet */}
      <BottomSheet isOpen={sheetOpen} onOpenChange={setSheetOpen}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content
            detached
            bottomInset={insets.bottom + 16}
            className="mx-4"
            backgroundClassName="rounded-[28px]"
            enablePanDownToClose
          >
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
              <View style={styles.sheetInner}>
                {/* Header */}
                <View style={styles.sheetHeader}>
                  <Text style={styles.sheetTitle}>
                    {editing?.id ? t('common.edit', 'Edit person') : t('onboarding.addMember', 'Add person')}
                  </Text>
                  <BottomSheet.Close />
                </View>

                {/* Name field */}
                <TextField isRequired style={styles.fieldWrap}>
                  <Label>{t('onboarding.memberNameLabel', 'Name')}</Label>
                  <Input
                    placeholder={t('onboarding.memberNamePlaceholder', 'E.g. Emma')}
                    value={editing?.name ?? ''}
                    onChangeText={(v) => setEditing((e) => e ? { ...e, name: v } : e)}
                    autoFocus
                    autoCapitalize="words"
                  />
                </TextField>

                {/* Role */}
                <Text style={styles.fieldLabel}>{t('onboarding.memberColorLabel', 'Role')}</Text>
                <View style={styles.roleRow}>
                  {(['parent', 'child'] as const).map((role) => (
                    <TouchableOpacity
                      key={role}
                      style={[styles.roleChip, editing?.role === role && styles.roleChipSel]}
                      onPress={() => setEditing((e) => e ? { ...e, role } : e)}
                    >
                      <Text style={[styles.roleChipText, editing?.role === role && styles.roleChipTextSel]}>
                        {role === 'parent' ? t('onboarding.memberRoleParent') : t('onboarding.memberRoleChild')}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Color picker */}
                <Text style={styles.fieldLabel}>{t('onboarding.memberColorLabel', 'Color')}</Text>
                <View style={styles.colorRow}>
                  {COLORS.map((c) => (
                    <TouchableOpacity
                      key={c}
                      style={[styles.colorSwatch, { backgroundColor: c }, editing?.color === c && styles.colorSwatchSel]}
                      onPress={() => setEditing((e) => e ? { ...e, color: c } : e)}
                    />
                  ))}
                </View>

                {/* Buttons */}
                <View style={styles.sheetBtns}>
                  <Button
                    variant="secondary"
                    style={styles.btnFlex}
                    onPress={() => setSheetOpen(false)}
                  >
                    {t('common.cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    style={styles.btnFlex}
                    isDisabled={!editing?.name.trim()}
                    onPress={handleSave}
                  >
                    {t('common.save')}
                  </Button>
                </View>
              </View>
            </KeyboardAvoidingView>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>

      {/* Invite sheet — show QR + code for child member */}
      {inviteMember && family && (
        <InviteSheet
          open={inviteOpen}
          member={inviteMember as any}
          familyId={family.id}
          onClose={() => { setInviteOpen(false); setInviteMember(null); }}
        />
      )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFFFFF' },
  container: { flex: 1, backgroundColor: '#F2F3F5' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 14,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerLeft: { flex: 1 },
  headerBrand: {
    fontSize: 10,
    fontWeight: '800',
    color: '#AEAEB2',
    letterSpacing: 2.5,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: '800',
    color: '#2C2C2E',
    letterSpacing: -0.3,
    lineHeight: 30,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#9999A6',
    fontWeight: '500',
    marginTop: 2,
  },
  addIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: '800',
    color: '#2C2C2E',
    letterSpacing: 3,
  },
  familyName: {
    fontSize: 13,
    color: '#9999A6',
    marginTop: 3,
    fontWeight: '500',
  },

  scroll: { flex: 1, paddingHorizontal: 20, paddingTop: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9999A6',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 12,
  },

  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { fontSize: 18, fontWeight: '700', color: '#fff' },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 16, fontWeight: '600', color: '#2C2C2E' },
  memberRole: { fontSize: 12, color: '#9999A6', marginTop: 2 },
  editHint: { fontSize: 20, color: '#C0C0C8', marginRight: 4 },
  deleteBtn: { padding: 6 },
  deleteBtnText: { fontSize: 13, color: '#C0C0C8', fontWeight: '600' },
  inviteBtn: { padding: 6, marginRight: 2 },

  addBtn: {
    marginTop: 8,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#DCDCDC',
    borderStyle: 'dashed',
    paddingVertical: 14,
    alignItems: 'center',
  },
  addBtnText: { fontSize: 14, fontWeight: '600', color: '#9999A6' },

  // Sheet
  sheetInner: {
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 24,
    gap: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2C2C2E',
  },
  fieldWrap: {
    marginBottom: 16,
  },
  sheetBtns: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 24,
  },
  btnFlex: { flex: 1 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#9999A6',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  roleRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
  roleChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F2F3F5',
    alignItems: 'center',
  },
  roleChipSel: { backgroundColor: '#2C2C2E' },
  roleChipText: { fontSize: 14, fontWeight: '600', color: '#6E6E7A' },
  roleChipTextSel: { color: '#fff' },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 24 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchSel: { borderWidth: 3, borderColor: '#2C2C2E' },

});
