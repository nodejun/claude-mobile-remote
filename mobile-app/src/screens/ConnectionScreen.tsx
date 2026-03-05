/**
 * 연결 화면
 * PC Agent와 WebSocket 연결을 관리
 *
 * 두 가지 연결 방식:
 *   1. 페어링 코드 (기본): 시그널링 서버를 통해 자동으로 PC를 찾아 연결
 *   2. 직접 입력: IP/포트를 수동 입력하여 연결
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import {
  socketService,
  storageService,
  signalingService,
  SignalingError,
  type ConnectionStatus,
} from '../services';
import { useTheme } from '../theme';

/** 연결 모드 탭 */
type ConnectionMode = 'pairing' | 'manual';

export default function ConnectionScreen() {
  const { colors } = useTheme();

  // ─── 공통 상태 ──────────────────────────────────
  const [mode, setMode] = useState<ConnectionMode>('pairing');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');

  // ─── 페어링 코드 상태 ──────────────────────────────
  const [pairCode, setPairCode] = useState<string[]>(['', '', '', '', '', '']);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const pairInputRefs = useRef<(TextInput | null)[]>([]);

  // ─── 직접 입력 상태 ──────────────────────────────
  const [serverIp, setServerIp] = useState('');
  const [port, setPort] = useState('3000');
  const [recentServers, setRecentServers] = useState<string[]>([]);

  // ─── 초기화 ──────────────────────────────────

  // 저장된 페어링 코드 + 최근 서버 로드
  useEffect(() => {
    const loadSavedData = async () => {
      // 페어링 코드 로드
      const savedCode = await storageService.getPairCode();
      if (savedCode && savedCode.length === 6) {
        setPairCode(savedCode.split(''));
      }

      // 최근 서버 로드
      const servers = await storageService.getRecentServers();
      setRecentServers(servers);

      // 최근 서버의 IP/포트 자동 채우기
      if (servers.length > 0) {
        const lastServer = servers[0];
        const parsed = parseServerUrl(lastServer);
        if (parsed) {
          setServerIp(parsed.ip);
          setPort(parsed.port);
        }
      }
    };
    loadSavedData();
  }, []);

  // 연결 상태 변경 리스너
  useEffect(() => {
    const unsubscribe = socketService.onStatusChange((newStatus) => {
      setStatus(newStatus);
      if (newStatus === 'error') {
        setErrorMessage('연결에 실패했습니다. 서버 상태를 확인해주세요.');
      } else if (newStatus === 'connected') {
        setErrorMessage('');
      }
    });

    return () => unsubscribe();
  }, []);

  // ─── 유틸리티 ──────────────────────────────────

  /** 서버 URL에서 IP와 포트 파싱 */
  const parseServerUrl = (url: string): { ip: string; port: string } | null => {
    try {
      const match = url.match(/^https?:\/\/([^:]+):(\d+)/);
      return match ? { ip: match[1], port: match[2] } : null;
    } catch {
      return null;
    }
  };

  // ─── 페어링 코드 연결 ──────────────────────────────

  /** 페어링 코드 입력 처리 (개별 칸) */
  const handlePairCodeChange = useCallback(
    (text: string, index: number) => {
      // 영문+숫자만 허용, 대문자로 변환
      const char = text.toUpperCase().replace(/[^A-Z0-9]/g, '');

      const newCode = [...pairCode];
      newCode[index] = char.slice(-1); // 마지막 문자만 사용
      setPairCode(newCode);

      // 다음 칸으로 자동 이동
      if (char && index < 5) {
        pairInputRefs.current[index + 1]?.focus();
      }
    },
    [pairCode],
  );

  /** 백스페이스 처리 (이전 칸으로 이동) */
  const handlePairCodeKeyPress = useCallback(
    (key: string, index: number) => {
      if (key === 'Backspace' && !pairCode[index] && index > 0) {
        // 현재 칸이 비었으면 이전 칸으로 이동
        const newCode = [...pairCode];
        newCode[index - 1] = '';
        setPairCode(newCode);
        pairInputRefs.current[index - 1]?.focus();
      }
    },
    [pairCode],
  );

  /** 페어링 코드로 연결 */
  const handlePairConnect = useCallback(async () => {
    const code = pairCode.join('');

    if (code.length !== 6) {
      setErrorMessage('6자리 코드를 모두 입력해주세요.');
      return;
    }

    setErrorMessage('');
    setIsDiscovering(true);

    try {
      // 1. 시그널링 서버에서 PC IP/포트 조회
      const result = await signalingService.discover(code);

      // 2. WebSocket 연결
      const serverUrl = `http://${result.ip}:${result.port}`;
      socketService.connect(serverUrl);

      // 3. 코드 저장 (다음 접속 시 자동 채우기)
      await storageService.savePairCode(code);
    } catch (error) {
      if (error instanceof SignalingError) {
        if (error.statusCode === 404) {
          setErrorMessage('등록된 PC를 찾을 수 없습니다. 코드를 확인하세요.');
        } else if (error.statusCode === 0) {
          setErrorMessage('서버에 연결할 수 없습니다. 인터넷을 확인하세요.');
        } else {
          setErrorMessage(error.message);
        }
      } else {
        setErrorMessage('알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsDiscovering(false);
    }
  }, [pairCode]);

  // ─── 직접 입력 연결 ──────────────────────────────

  /** IP/포트 직접 입력 연결 */
  const handleManualConnect = useCallback(() => {
    if (!serverIp.trim()) {
      setErrorMessage('IP 주소를 입력해주세요.');
      return;
    }

    setErrorMessage('');
    const serverUrl = `http://${serverIp}:${port}`;
    socketService.connect(serverUrl);
  }, [serverIp, port]);

  /** 빠른 재연결 (최근 서버 선택) */
  const handleQuickConnect = useCallback((url: string) => {
    const parsed = parseServerUrl(url);
    if (parsed) {
      setServerIp(parsed.ip);
      setPort(parsed.port);
    }
    setErrorMessage('');
    socketService.connect(url);
  }, []);

  /** 연결 해제 */
  const handleDisconnect = useCallback(() => {
    socketService.disconnect();
  }, []);

  // ─── 상태 UI 헬퍼 ──────────────────────────────

  const getStatusText = () => {
    switch (status) {
      case 'connecting':
        return '연결 중...';
      case 'connected':
        return '연결됨';
      case 'error':
        return '연결 실패';
      default:
        return '연결 안 됨';
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case 'connecting':
        return colors.statusConnecting;
      case 'connected':
        return colors.statusConnected;
      case 'error':
        return colors.statusError;
      default:
        return colors.statusDisconnected;
    }
  };

  const isConnecting = status === 'connecting';
  const isBusy = isConnecting || isDiscovering;

  // ─── 렌더링 ──────────────────────────────────

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        {/* Claude 아바타 */}
        <View style={styles.avatarContainer}>
          <View
            style={[styles.avatarCircle, { backgroundColor: colors.primary }]}
          >
            <Text style={styles.avatarText}>C</Text>
          </View>
        </View>

        {/* 타이틀 */}
        <Text style={[styles.title, { color: colors.textHeading }]}>
          PC Agent 연결
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          PC에서 실행 중인 Agent 서버에 연결하세요
        </Text>

        {/* 상태 표시 — 도트 + 텍스트 */}
        <View style={styles.statusRow}>
          <View
            style={[styles.statusDot, { backgroundColor: getStatusColor() }]}
          />
          <Text
            style={[styles.statusText, { color: getStatusColor() }]}
          >
            {getStatusText()}
          </Text>
        </View>

        {/* 탭 선택 */}
        {status !== 'connected' && (
          <View
            style={[
              styles.tabContainer,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={[
                styles.tab,
                mode === 'pairing' && {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={() => {
                setMode('pairing');
                setErrorMessage('');
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      mode === 'pairing'
                        ? colors.textOnPrimary
                        : colors.textSecondary,
                  },
                ]}
              >
                페어링 코드
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.tab,
                mode === 'manual' && {
                  backgroundColor: colors.primary,
                },
              ]}
              onPress={() => {
                setMode('manual');
                setErrorMessage('');
              }}
            >
              <Text
                style={[
                  styles.tabText,
                  {
                    color:
                      mode === 'manual'
                        ? colors.textOnPrimary
                        : colors.textSecondary,
                  },
                ]}
              >
                직접 입력
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ═══ 페어링 코드 탭 ═══ */}
        {mode === 'pairing' && status !== 'connected' && (
          <View style={styles.pairSection}>
            <Text style={[styles.pairGuide, { color: colors.textSecondary }]}>
              PC Agent에 표시된 6자리 코드를 입력하세요
            </Text>

            {/* 6자리 코드 입력 */}
            <View style={styles.pairCodeRow}>
              {pairCode.map((digit, index) => (
                <TextInput
                  key={index}
                  ref={(ref) => {
                    pairInputRefs.current[index] = ref;
                  }}
                  style={[
                    styles.pairCodeInput,
                    {
                      backgroundColor: colors.surface,
                      borderColor: digit
                        ? colors.primary
                        : colors.border,
                      color: colors.textHeading,
                    },
                  ]}
                  value={digit}
                  onChangeText={(text) => handlePairCodeChange(text, index)}
                  onKeyPress={({ nativeEvent }) =>
                    handlePairCodeKeyPress(nativeEvent.key, index)
                  }
                  maxLength={1}
                  autoCapitalize="characters"
                  keyboardType="default"
                  textAlign="center"
                  selectTextOnFocus
                  editable={!isBusy}
                />
              ))}
            </View>

            {/* 연결 버튼 */}
            <TouchableOpacity
              style={[
                styles.button,
                isBusy
                  ? { backgroundColor: colors.textTertiary }
                  : { backgroundColor: colors.primary },
              ]}
              onPress={handlePairConnect}
              disabled={isBusy}
            >
              {isBusy ? (
                <View style={styles.buttonLoading}>
                  <ActivityIndicator
                    color={colors.textOnPrimary}
                    size="small"
                  />
                  <Text
                    style={[
                      styles.buttonText,
                      { color: colors.textOnPrimary, marginLeft: 8 },
                    ]}
                  >
                    {isDiscovering ? 'PC 찾는 중...' : '연결 중...'}
                  </Text>
                </View>
              ) : (
                <Text
                  style={[styles.buttonText, { color: colors.textOnPrimary }]}
                >
                  연결하기
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* ═══ 직접 입력 탭 ═══ */}
        {mode === 'manual' && status !== 'connected' && (
          <View style={styles.manualSection}>
            {/* 최근 연결 서버 (빠른 재연결) */}
            {recentServers.length > 0 && (
              <View style={styles.recentSection}>
                <Text
                  style={[
                    styles.recentTitle,
                    { color: colors.statusDisconnected },
                  ]}
                >
                  최근 연결
                </Text>
                {recentServers.map((server, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.recentItem,
                      {
                        backgroundColor: colors.surface,
                        borderColor: colors.border,
                      },
                    ]}
                    onPress={() => handleQuickConnect(server)}
                    disabled={isConnecting}
                  >
                    <Feather
                      name="monitor"
                      size={18}
                      color={colors.textSecondary}
                      style={styles.recentIcon}
                    />
                    <Text
                      style={[styles.recentUrl, { color: colors.textPrimary }]}
                    >
                      {server}
                    </Text>
                    <Feather
                      name="chevron-right"
                      size={18}
                      color={colors.primary}
                    />
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* 구분선 */}
            {recentServers.length > 0 && (
              <View style={styles.dividerRow}>
                <View
                  style={[
                    styles.dividerLine,
                    { backgroundColor: colors.border },
                  ]}
                />
                <Text
                  style={[
                    styles.dividerText,
                    { color: colors.textTertiary },
                  ]}
                >
                  또는 직접 입력
                </Text>
                <View
                  style={[
                    styles.dividerLine,
                    { backgroundColor: colors.border },
                  ]}
                />
              </View>
            )}

            {/* IP/포트 입력 */}
            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                서버 IP 주소
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.textHeading,
                  },
                ]}
                placeholder="예: 192.168.0.10"
                placeholderTextColor={colors.textTertiary}
                value={serverIp}
                onChangeText={setServerIp}
                returnKeyType="next"
                onSubmitEditing={handleManualConnect}
                keyboardType="numeric"
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={[styles.label, { color: colors.textPrimary }]}>
                포트
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    color: colors.textHeading,
                  },
                ]}
                placeholder="3000"
                placeholderTextColor={colors.textTertiary}
                value={port}
                onChangeText={setPort}
                returnKeyType="go"
                onSubmitEditing={handleManualConnect}
                keyboardType="numeric"
              />
            </View>

            {/* 연결 버튼 */}
            <TouchableOpacity
              style={[
                styles.button,
                isConnecting
                  ? { backgroundColor: colors.textTertiary }
                  : { backgroundColor: colors.primary },
              ]}
              onPress={handleManualConnect}
              disabled={isConnecting}
            >
              {isConnecting ? (
                <ActivityIndicator color={colors.textOnPrimary} />
              ) : (
                <Text
                  style={[styles.buttonText, { color: colors.textOnPrimary }]}
                >
                  연결하기
                </Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* 연결됨 상태: 해제 버튼 */}
        {status === 'connected' && (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.danger }]}
            onPress={handleDisconnect}
          >
            <Text
              style={[styles.buttonText, { color: colors.textOnPrimary }]}
            >
              연결 해제
            </Text>
          </TouchableOpacity>
        )}

        {/* 에러 메시지 */}
        {errorMessage ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>
            {errorMessage}
          </Text>
        ) : null}

        {/* 도움말 */}
        <Text style={[styles.helpText, { color: colors.textSecondary }]}>
          {mode === 'pairing'
            ? 'PC에서 Agent 시작 시 표시되는 코드를 입력하세요'
            : 'PC에서 Agent 서버가 실행 중이어야 합니다'}
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── 스타일 ──────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  // Claude 아바타
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
  },

  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
  },

  // 상태 — 도트 + 텍스트 행
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 15,
  },

  // 탭
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
  },

  // 페어링 코드
  pairSection: {
    alignItems: 'center',
  },
  pairGuide: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 20,
  },
  pairCodeRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  pairCodeInput: {
    width: 48,
    height: 56,
    borderRadius: 14,
    borderWidth: 2,
    fontSize: 22,
    fontWeight: 'bold',
    fontFamily: 'monospace',
  },

  // 직접 입력
  manualSection: {},

  // 최근 연결 서버
  recentSection: {
    marginBottom: 16,
  },
  recentTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
  },
  recentIcon: {
    marginRight: 10,
  },
  recentUrl: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'monospace',
  },
  input: {
    borderRadius: 14,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },

  // 구분선
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 16,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 13,
  },

  // 입력 폼
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  // 버튼
  button: {
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
    width: '100%',
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  buttonLoading: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // 에러 & 도움말
  errorText: {
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
  helpText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
});
