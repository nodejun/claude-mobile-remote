/**
 * 설정 화면
 * 앱 설정 관리 (연결, 텍스트, 테마, 데이터, 앱 정보)
 * 다크 모드 토글로 앱 전체 테마 전환
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  StatusBar,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { storageService, type AppSettings } from '../services';
import { useTheme } from '../theme';

export default function SettingsScreen() {
  const { colors, isDark, setDarkMode } = useTheme();

  // ─── 상태 ────────────────────────────────────────────
  const [settings, setSettings] = useState<AppSettings>({
    codeFontSize: 13,
    darkMode: false,
  });
  const [recentServers, setRecentServers] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ─── 설정 로드 ────────────────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      const [savedSettings, servers] = await Promise.all([
        storageService.getSettings(),
        storageService.getRecentServers(),
      ]);
      setSettings(savedSettings);
      setRecentServers(servers);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // ─── 설정 업데이트 헬퍼 ────────────────────────────────
  const updateSetting = useCallback(
    async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
      setSettings((prev) => ({ ...prev, [key]: value }));
      await storageService.saveSettings({ [key]: value });
    },
    [],
  );

  // ─── 글꼴 크기 조절 ────────────────────────────────────
  const handleFontSizeChange = useCallback(
    (delta: number) => {
      const newSize = Math.min(22, Math.max(10, settings.codeFontSize + delta));
      if (newSize !== settings.codeFontSize) {
        updateSetting('codeFontSize', newSize);
      }
    },
    [settings.codeFontSize, updateSetting],
  );

  // ─── 서버 기록 삭제 ────────────────────────────────────
  const handleRemoveServer = useCallback(async (url: string) => {
    await storageService.removeRecentServer(url);
    setRecentServers((prev) => prev.filter((s) => s !== url));
  }, []);

  // ─── 대화 기록 삭제 ────────────────────────────────────
  const handleClearChat = useCallback(() => {
    Alert.alert(
      '대화 기록 삭제',
      '저장된 대화 기록을 모두 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            await storageService.clearChatMessages();
            Alert.alert('완료', '대화 기록이 삭제되었습니다.');
          },
        },
      ],
    );
  }, []);

  // ─── 로딩 ────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View
        style={[
          styles.header,
          {
            paddingTop: (StatusBar.currentHeight || 24) + 16,
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Text style={[styles.headerTitle, { color: colors.textHeading }]}>설정</Text>
      </View>

      {/* ═══ 연결 설정 ═══ */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>연결</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.shadow, shadowOpacity: colors.shadowOpacity }]}>
          <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>최근 연결 서버</Text>
          {recentServers.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>연결 기록이 없습니다</Text>
          ) : (
            recentServers.map((server, index) => (
              <View key={index} style={[styles.serverItem, { borderTopColor: colors.borderLight }]}>
                <View style={styles.serverInfo}>
                  <Text style={styles.serverIcon}>
                    {index === 0 ? '🟢' : '⚪'}
                  </Text>
                  <Text style={[styles.serverUrl, { color: colors.textSecondary }]}>{server}</Text>
                </View>
                <TouchableOpacity
                  onPress={() => handleRemoveServer(server)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Text style={[styles.removeButton, { color: colors.textTertiary }]}>✕</Text>
                </TouchableOpacity>
              </View>
            ))
          )}
        </View>
      </View>

      {/* ═══ 텍스트 ═══ */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>텍스트</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.shadow, shadowOpacity: colors.shadowOpacity }]}>
          <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>글꼴 크기</Text>
          <View style={styles.fontSizeControl}>
            <TouchableOpacity
              style={[
                styles.fontSizeButton,
                { backgroundColor: colors.primary },
                settings.codeFontSize <= 10 && { backgroundColor: colors.border },
              ]}
              onPress={() => handleFontSizeChange(-1)}
              disabled={settings.codeFontSize <= 10}
            >
              <Text
                style={[
                  styles.fontSizeButtonText,
                  { color: colors.textOnPrimary },
                  settings.codeFontSize <= 10 && { color: colors.textTertiary },
                ]}
              >
                -
              </Text>
            </TouchableOpacity>

            <View style={styles.fontSizeValue}>
              <Text style={[styles.fontSizeValueText, { color: colors.textPrimary }]}>
                {settings.codeFontSize}pt
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.fontSizeButton,
                { backgroundColor: colors.primary },
                settings.codeFontSize >= 22 && { backgroundColor: colors.border },
              ]}
              onPress={() => handleFontSizeChange(1)}
              disabled={settings.codeFontSize >= 22}
            >
              <Text
                style={[
                  styles.fontSizeButtonText,
                  { color: colors.textOnPrimary },
                  settings.codeFontSize >= 22 && { color: colors.textTertiary },
                ]}
              >
                +
              </Text>
            </TouchableOpacity>
          </View>

          {/* 미리보기 */}
          <View style={styles.fontPreview}>
            <Text
              style={[
                styles.fontPreviewText,
                { fontSize: settings.codeFontSize },
              ]}
            >
              {'Hello, World!'}
            </Text>
          </View>

          <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
            채팅 및 코드 뷰어의 텍스트 크기를 조절합니다 (10~22pt)
          </Text>
        </View>
      </View>

      {/* ═══ 테마 ═══ */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>테마</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.shadow, shadowOpacity: colors.shadowOpacity }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingLabelGroup}>
              <Text style={[styles.cardLabel, { color: colors.textPrimary }]}>다크 모드</Text>
              <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
                앱 전체 테마를 어둡게 변경합니다
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={setDarkMode}
              trackColor={{ false: colors.border, true: colors.success }}
              thumbColor="#fff"
            />
          </View>
        </View>
      </View>

      {/* ═══ 데이터 ═══ */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>데이터</Text>

        <TouchableOpacity
          style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.shadow, shadowOpacity: colors.shadowOpacity }]}
          onPress={handleClearChat}
        >
          <Text style={[styles.dangerLabel, { color: colors.danger }]}>대화 기록 삭제</Text>
          <Text style={[styles.settingDescription, { color: colors.textTertiary }]}>
            저장된 모든 대화 기록을 삭제합니다
          </Text>
        </TouchableOpacity>
      </View>

      {/* ═══ 앱 정보 ═══ */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: colors.textTertiary }]}>앱 정보</Text>

        <View style={[styles.card, { backgroundColor: colors.surface, shadowColor: colors.shadow, shadowOpacity: colors.shadowOpacity }]}>
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textPrimary }]}>앱 이름</Text>
            <Text style={[styles.infoValue, { color: colors.textTertiary }]}>Claude Mobile Remote</Text>
          </View>
          <View style={[styles.infoDivider, { backgroundColor: colors.borderLight }]} />
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textPrimary }]}>버전</Text>
            <Text style={[styles.infoValue, { color: colors.textTertiary }]}>1.0.0</Text>
          </View>
        </View>
      </View>

      {/* 하단 여백 */}
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // 헤더
  header: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
  },

  // 섹션
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
    marginLeft: 4,
  },

  // 카드 (각 설정 항목)
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 2,
    elevation: 1,
  },
  cardLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 8,
  },

  // 서버 목록
  emptyText: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  serverItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  serverInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  serverIcon: {
    fontSize: 10,
    marginRight: 10,
  },
  serverUrl: {
    fontSize: 14,
    fontFamily: 'monospace',
  },
  removeButton: {
    fontSize: 16,
    paddingHorizontal: 4,
  },

  // 글꼴 크기 조절
  fontSizeControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  fontSizeButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fontSizeButtonText: {
    fontSize: 24,
    fontWeight: '600',
  },
  fontSizeValue: {
    minWidth: 60,
    alignItems: 'center',
    marginHorizontal: 20,
  },
  fontSizeValueText: {
    fontSize: 20,
    fontWeight: '700',
  },

  // 글꼴 미리보기 (항상 다크 배경)
  fontPreview: {
    backgroundColor: '#1e1e1e',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  fontPreviewText: {
    fontFamily: 'monospace',
    color: '#d4d4d4',
  },

  // 설정 행
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingLabelGroup: {
    flex: 1,
    marginRight: 16,
  },
  settingDescription: {
    fontSize: 13,
    marginTop: 2,
  },

  // 위험 동작
  dangerLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },

  // 앱 정보
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 15,
  },
  infoValue: {
    fontSize: 15,
  },
  infoDivider: {
    height: 1,
    marginVertical: 8,
  },
});
