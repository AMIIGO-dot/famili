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
  TextInput,
  Modal,
  Pressable,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useFamilyStore } from '../../src/stores/familyStore';

const COLORS = [
  '#5B9CF6', '#F97B8B', '#68D9A4', '#F5A623',
  '#BF86FF', '#FF7043', '#26C6DA', '#8D8D99',
];

const DEV_BYPASS = true; // keep in sync with familyStore

type DraftMember = { id?: string; name: string; color: string; role: 'parent' | 'child' };

export default function FamilyScreen() {
  const { t } = useTranslation();
  const { family, members, addMember, updateMember, deleteMember } = useFamilyStore();

  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<DraftMember | null>(null);

  const openAdd = () => {
    setEditing({ name: '', color: COLORS[members.length % COLORS.length], role: 'parent' });
    setModalVisible(true);
  };

  const openEdit = (m: typeof members[0]) => {
    setEditing({ id: m.id, name: m.name, color: m.color, role: m.role as 'parent' | 'child' });
    setModalVisible(true);
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
    setModalVisible(false);
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
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logoText}>FAMILJ</Text>
        {family && <Text style={styles.familyName}>{family.name}</Text>}
      </View>

      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.sectionLabel}>{t('settings.members', 'Members')}</Text>

        {members.map((m) => (
          <TouchableOpacity key={m.id} style={styles.memberRow} onPress={() => openEdit(m)} activeOpacity={0.7}>
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
            {/* Edit hint */}
            <Text style={styles.editHint}>›</Text>
            {/* Delete */}
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(m.id, m.name)}
              hitSlop={10}
            >
              <Text style={styles.deleteBtnText}>✕</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {/* Add member */}
        <TouchableOpacity style={styles.addBtn} onPress={openAdd} activeOpacity={0.7}>
          <Text style={styles.addBtnText}>{t('onboarding.addMember', '+ Add person')}</Text>
        </TouchableOpacity>

        <View style={{ height: 60 }} />
      </ScrollView>

      {/* Add/Edit modal */}
      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.backdrop} onPress={() => setModalVisible(false)} />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.kavWrap}
          pointerEvents="box-none"
        >
          <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>
            {editing?.id ? t('common.edit', 'Edit') : t('onboarding.addMember', 'Add person')}
          </Text>

          {/* Name */}
          <TextInput
            style={styles.nameInput}
            placeholder={t('onboarding.memberNamePlaceholder', 'E.g. Emma')}
            placeholderTextColor="#C0C0C8"
            value={editing?.name ?? ''}
            onChangeText={(v) => setEditing((e) => e ? { ...e, name: v } : e)}
            autoFocus
            autoCapitalize="words"
          />

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
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
              <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveBtn, !editing?.name.trim() && styles.saveBtnOff]}
              onPress={handleSave}
              disabled={!editing?.name.trim()}
            >
              <Text style={styles.saveBtnText}>{t('common.save')}</Text>
            </TouchableOpacity>
          </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAFAF8' },

  header: {
    alignItems: 'center',
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#EBEBEB',
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

  // Modal
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  kavWrap: { flex: 1, justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: '#FAFAF8',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#2C2C2E', marginBottom: 20 },
  nameInput: {
    fontSize: 17,
    backgroundColor: '#F0F0EC',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: '#2C2C2E',
    marginBottom: 20,
  },
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
    backgroundColor: '#F0F0EC',
    alignItems: 'center',
  },
  roleChipSel: { backgroundColor: '#2C2C2E' },
  roleChipText: { fontSize: 14, fontWeight: '600', color: '#6E6E7A' },
  roleChipTextSel: { color: '#fff' },
  colorRow: { flexDirection: 'row', gap: 10, flexWrap: 'wrap', marginBottom: 24 },
  colorSwatch: { width: 32, height: 32, borderRadius: 16 },
  colorSwatchSel: { borderWidth: 3, borderColor: '#2C2C2E' },
  modalBtns: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#F0F0EC',
    borderRadius: 12,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '600', color: '#6E6E7A' },
  saveBtn: {
    flex: 1,
    paddingVertical: 14,
    backgroundColor: '#2C2C2E',
    borderRadius: 12,
    alignItems: 'center',
  },
  saveBtnOff: { opacity: 0.35 },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
});
