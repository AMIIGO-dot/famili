/**
 * FAMILJ – Child Join Screen
 *
 * Children enter the 6-digit invite code (or scan the QR) from here.
 * No email required.
 */
import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useChildAuthStore } from '../src/stores/childAuthStore';

type Tab = 'code' | 'qr';

export default function ChildJoinScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { joinWithCode } = useChildAuthStore();

  const [tab, setTab] = useState<Tab>('code');
  const [digits, setDigits] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [qrScanned, setQrScanned] = useState(false);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const inputRef = useRef<TextInput>(null);

  const tryJoin = async (code: string) => {
    if (code.replace(/\s/g, '').length !== 6) return;
    setLoading(true);
    setErrorMsg(null);
    const clean = code.replace(/\s/g, '').toUpperCase();
    const result = await joinWithCode(clean);
    setLoading(false);
    if (result.success) {
      router.replace('/child-pin-create');
    } else {
      setErrorMsg(
        result.error === 'invalid_code'
          ? t('childJoin.invalidCode')
          : t('common.error')
      );
      setQrScanned(false);
    }
  };

  const onQrScanned = ({ data }: { data: string }) => {
    if (qrScanned) return;
    // Expect familj://join/XXXXXX
    const match = data.match(/familj:\/\/join\/([0-9A-Za-z]{6})/);
    if (match) {
      setQrScanned(true);
      tryJoin(match[1]);
    }
  };

  const switchTab = async (next: Tab) => {
    setTab(next);
    setErrorMsg(null);
    if (next === 'qr' && !cameraPermission?.granted) {
      await requestCameraPermission();
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Back */}
        <TouchableOpacity style={styles.back} onPress={() => router.replace('/auth')}>
          <Text style={styles.backText}>← {t('common.cancel')}</Text>
        </TouchableOpacity>

        <Text style={styles.heading}>{t('childJoin.heading')}</Text>
        <Text style={styles.sub}>{t('childJoin.sub')}</Text>

        {/* Tabs */}
        <View style={styles.tabs}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'code' && styles.tabBtnActive]}
            onPress={() => switchTab('code')}
          >
            <Text style={[styles.tabText, tab === 'code' && styles.tabTextActive]}>
              {t('childJoin.tabCode')}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'qr' && styles.tabBtnActive]}
            onPress={() => switchTab('qr')}
          >
            <Text style={[styles.tabText, tab === 'qr' && styles.tabTextActive]}>
              {t('childJoin.tabQR')}
            </Text>
          </TouchableOpacity>
        </View>

        {tab === 'code' ? (
          <View style={styles.codeSection}>
            {/* 6 digit boxes — backed by a hidden TextInput */}
            <TouchableOpacity
              activeOpacity={1}
              onPress={() => inputRef.current?.focus()}
              style={styles.digitRow}
            >
              {Array.from({ length: 6 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.digitBox,
                    i === digits.length && styles.digitBoxActive,
                    digits[i] && styles.digitBoxFilled,
                  ]}
                >
                  <Text style={styles.digitChar}>{digits[i] ?? ''}</Text>
                </View>
              ))}
            </TouchableOpacity>

            <TextInput
              ref={inputRef}
              style={styles.hiddenInput}
              keyboardType="number-pad"
              maxLength={6}
              value={digits}
              onChangeText={(v) => { setDigits(v.replace(/\D/g, '')); setErrorMsg(null); }}
              autoFocus
              caretHidden
            />

            {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

            <TouchableOpacity
              style={[styles.joinBtn, (digits.length !== 6 || loading) && styles.joinBtnDisabled]}
              disabled={digits.length !== 6 || loading}
              onPress={() => tryJoin(digits)}
              activeOpacity={0.8}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.joinBtnText}>{t('childJoin.join')}</Text>
              }
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.qrSection}>
            {!cameraPermission?.granted ? (
              <View style={styles.permissionBox}>
                <Text style={styles.permissionText}>{t('childJoin.cameraPermission')}</Text>
                <TouchableOpacity style={styles.joinBtn} onPress={requestCameraPermission}>
                  <Text style={styles.joinBtnText}>{t('childJoin.allowCamera')}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.cameraWrap}>
                <CameraView
                  style={styles.camera}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={onQrScanned}
                />
                <View style={styles.cameraOverlay}>
                  <View style={styles.scanFrame} />
                </View>
                {loading && (
                  <View style={styles.scanningOverlay}>
                    <ActivityIndicator size="large" color="#fff" />
                    <Text style={styles.scanningText}>{t('childJoin.checking')}</Text>
                  </View>
                )}
              </View>
            )}
            {errorMsg && <Text style={[styles.error, styles.qrError]}>{errorMsg}</Text>}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FFFFFF' },
  flex: { flex: 1, paddingHorizontal: 28 },
  back: { paddingTop: 16, paddingBottom: 8, alignSelf: 'flex-start' },
  backText: { fontSize: 15, color: '#9999A6' },
  heading: { fontSize: 28, fontWeight: '800', color: '#2C2C2E', marginTop: 20, marginBottom: 6 },
  sub: { fontSize: 15, color: '#9999A6', marginBottom: 28, lineHeight: 22 },

  tabs: { flexDirection: 'row', backgroundColor: '#F2F3F5', borderRadius: 12, padding: 4, marginBottom: 32 },
  tabBtn: { flex: 1, paddingVertical: 10, alignItems: 'center', borderRadius: 10 },
  tabBtnActive: { backgroundColor: '#FFFFFF', shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: 1 }, shadowRadius: 4, elevation: 2 },
  tabText: { fontSize: 14, fontWeight: '600', color: '#9999A6' },
  tabTextActive: { color: '#2C2C2E' },

  codeSection: { alignItems: 'center', gap: 20 },
  digitRow: { flexDirection: 'row', gap: 10 },
  digitBox: {
    width: 46, height: 58, borderRadius: 12,
    backgroundColor: '#F2F3F5',
    borderWidth: 2, borderColor: 'transparent',
    alignItems: 'center', justifyContent: 'center',
  },
  digitBoxActive: { borderColor: '#2C2C2E', backgroundColor: '#FAFAF8' },
  digitBoxFilled: { backgroundColor: '#FAFAF8' },
  digitChar: { fontSize: 24, fontWeight: '700', color: '#2C2C2E' },
  hiddenInput: { position: 'absolute', opacity: 0, height: 0, width: 0 },

  joinBtn: {
    backgroundColor: '#2C2C2E', paddingVertical: 16, paddingHorizontal: 48,
    borderRadius: 16, alignItems: 'center', marginTop: 8, minWidth: 200,
  },
  joinBtnDisabled: { opacity: 0.35 },
  joinBtnText: { color: '#FAFAF8', fontSize: 16, fontWeight: '700' },

  error: { fontSize: 13, color: '#F97B8B', textAlign: 'center' },
  qrError: { marginTop: 16 },

  qrSection: { flex: 1, alignItems: 'center' },
  permissionBox: { alignItems: 'center', gap: 20, marginTop: 40 },
  permissionText: { fontSize: 14, color: '#9999A6', textAlign: 'center', lineHeight: 22 },
  cameraWrap: { width: '100%', aspectRatio: 1, borderRadius: 24, overflow: 'hidden', position: 'relative' },
  camera: { flex: 1 },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center', justifyContent: 'center',
  },
  scanFrame: {
    width: 200, height: 200,
    borderWidth: 3, borderColor: 'rgba(255,255,255,0.8)',
    borderRadius: 20,
  },
  scanningOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center', gap: 14,
  },
  scanningText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
