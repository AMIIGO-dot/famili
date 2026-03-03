/**
 * FAMILJ – Invite Sheet (Parent Side)
 *
 * Shows a QR code and 6-digit code for a child member.
 * Parent opens this and hands the phone to the child,
 * or the child scans via their own device.
 */
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import QRCode from 'react-native-qrcode-svg';
import { BottomSheet, Button } from 'heroui-native';
import { createInviteCode } from '../lib/inviteService';
import { useAuthStore } from '../stores/authStore';
import type { Database } from '../lib/database.types';

type Member = Database['public']['Tables']['members']['Row'];

interface Props {
  open: boolean;
  member: Member | null;
  familyId: string;
  onClose: () => void;
}

const DEEP_LINK = (code: string) => `familj://join/${code}`;
const EXPIRY_HOURS = 24;

export default function InviteSheet({ open, member, familyId, onClose }: Props) {
  const { t } = useTranslation();
  const { user } = useAuthStore();
  const insets = useSafeAreaInsets();

  const [code, setCode] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    if (!member) return;
    setLoading(true);
    setError(null);
    try {
      const callerId = user?.id ?? 'dev-user-id';
      const newCode = await createInviteCode(member.id, familyId, callerId);
      setCode(newCode);
      setExpiresAt(new Date(Date.now() + EXPIRY_HOURS * 60 * 60 * 1000));
    } catch (e: any) {
      console.error('[InviteSheet] generate error:', e);
      setError(e?.message ?? 'Error');
    } finally {
      setLoading(false);
    }
  };

  // Generate a fresh code whenever the sheet opens for a new member
  useEffect(() => {
    if (open && member) {
      setCode(null);
      generate();
    }
  }, [open, member?.id]);

  // Format code as "047 291" for readability
  const displayCode = code
    ? `${code.slice(0, 3)} ${code.slice(3)}`
    : '--- ---';

  return (
    <BottomSheet isOpen={open} onOpenChange={(v) => { if (!v) onClose(); }} snapPoints={['65%']}>
      <BottomSheet.Portal>
        <BottomSheet.Overlay />
        <BottomSheet.Content
          detached
          bottomInset={insets.bottom + 16}
          className="mx-4"
          backgroundClassName="rounded-[28px]"
          enablePanDownToClose
        >
          <View style={styles.inner}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>
                {t('invite.title', { name: member?.name ?? '' })}
              </Text>
              <BottomSheet.Close />
            </View>

            <Text style={styles.subtitle}>{t('invite.subtitle', { name: member?.name ?? '' })}</Text>

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color="#2C2C2E" />
              </View>
            ) : error ? (
              <View style={styles.center}>
                <Text style={styles.errorText}>{error}</Text>
                <Button variant="primary" onPress={generate} style={styles.retryBtn}>
                  {t('common.retry')}
                </Button>
              </View>
            ) : code ? (
              <>
                {/* QR Code */}
                <View style={styles.qrWrap}>
                  <QRCode
                    value={DEEP_LINK(code)}
                    size={180}
                    color="#2C2C2E"
                    backgroundColor="#FAFAF8"
                  />
                </View>

                {/* Numeric code */}
                <Text style={styles.codeLabel}>{t('invite.orEnterCode')}</Text>
                <View style={styles.codeBox}>
                  <Text style={styles.codeText}>{displayCode}</Text>
                </View>

                {/* Expiry */}
                {expiresAt && (
                  <Text style={styles.expiry}>
                    {t('invite.expiresIn', { hours: EXPIRY_HOURS })}
                  </Text>
                )}

                {/* Regenerate */}
                <TouchableOpacity onPress={generate} style={styles.regenBtn} activeOpacity={0.7}>
                  <Text style={styles.regenText}>{t('invite.generateNew')}</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
        </BottomSheet.Content>
      </BottomSheet.Portal>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  inner: { paddingHorizontal: 22, paddingBottom: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  title: { fontSize: 18, fontWeight: '700', color: '#2C2C2E', flex: 1 },
  subtitle: { fontSize: 13, color: '#9999A6', marginBottom: 20 },
  center: { alignItems: 'center', paddingVertical: 32, gap: 16 },
  errorText: { fontSize: 14, color: '#F97B8B' },
  retryBtn: { alignSelf: 'center' },
  qrWrap: {
    alignSelf: 'center',
    padding: 16,
    backgroundColor: '#FAFAF8',
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
    marginBottom: 20,
  },
  codeLabel: { fontSize: 11, fontWeight: '700', color: '#9999A6', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center', marginBottom: 10 },
  codeBox: {
    backgroundColor: '#F2F3F5',
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    alignSelf: 'center',
    marginBottom: 10,
  },
  codeText: { fontSize: 32, fontWeight: '800', color: '#2C2C2E', letterSpacing: 8 },
  expiry: { fontSize: 11, color: '#AEAEB2', textAlign: 'center', marginTop: 4 },
  regenBtn: { alignSelf: 'center', marginTop: 12, padding: 8 },
  regenText: { fontSize: 13, color: '#9999A6', textDecorationLine: 'underline' },
});
