/**
 * 연결 화면
 * PC Agent와 WebSocket 연결을 관리
 * 최근 연결 서버 URL을 AsyncStorage에서 불러와 자동 채우기
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { socketService, storageService, type ConnectionStatus } from '../services';
import { useTheme } from '../theme';

export default function ConnectionScreen() {
  const { colors } = useTheme();

  // 상태
  const [serverIp, setServerIp] = useState('');
  const [port, setPort] = useState('3000');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');
  const [recentServers, setRecentServers] = useState<string[]>([]);

  // 최근 서버 목록 로드 & 자동 채우기
  useEffect(() => {
    const loadRecentServers = async () => {
      const servers = await storageService.getRecentServers();
      setRecentServers(servers);

      // 가장 최근 서버의 IP/포트로 자동 채우기
      if (servers.length > 0) {
        const lastServer = servers[0];
        const parsed = parseServerUrl(lastServer);
        if (parsed) {
          setServerIp(parsed.ip);
          setPort(parsed.port);
        }
      }
    };
    loadRecentServers();
  }, []);

  // 연결 상태 변경 리스너
  useEffect(() => {
    const unsubscribe = socketService.onStatusChange((newStatus) => {
      setStatus(newStatus);
      if (newStatus === 'error') {
        setErrorMessage('연결에 실패했습니다. IP 주소를 확인해주세요.');
      } else {
        setErrorMessage('');
      }
    });

    return () => unsubscribe();
  }, []);

  /**
   * 서버 URL에서 IP와 포트 파싱
   * 예: "http://192.168.0.10:3000" → { ip: "192.168.0.10", port: "3000" }
   */
  const parseServerUrl = (url: string): { ip: string; port: string } | null => {
    try {
      const match = url.match(/^https?:\/\/([^:]+):(\d+)/);
      if (match) {
        return { ip: match[1], port: match[2] };
      }
      return null;
    } catch {
      return null;
    }
  };

  // 연결 시도
  const handleConnect = useCallback(() => {
    if (!serverIp.trim()) {
      setErrorMessage('IP 주소를 입력해주세요.');
      return;
    }

    setErrorMessage('');
    const serverUrl = `http://${serverIp}:${port}`;
    socketService.connect(serverUrl);
  }, [serverIp, port]);

  // 빠른 재연결 (최근 서버 선택)
  const handleQuickConnect = useCallback((url: string) => {
    const parsed = parseServerUrl(url);
    if (parsed) {
      setServerIp(parsed.ip);
      setPort(parsed.port);
    }
    setErrorMessage('');
    socketService.connect(url);
  }, []);

  // 연결 해제
  const handleDisconnect = useCallback(() => {
    socketService.disconnect();
  }, []);

  // 상태별 UI
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

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.background }]}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.content}>
        {/* 타이틀 */}
        <Text style={[styles.title, { color: colors.textHeading }]}>PC Agent 연결</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          PC에서 실행 중인 Agent 서버에 연결하세요
        </Text>

        {/* 상태 표시 */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={[styles.statusText, { color: colors.textOnPrimary }]}>{getStatusText()}</Text>
        </View>

        {/* 최근 연결 서버 (빠른 재연결) */}
        {recentServers.length > 0 && status !== 'connected' && (
          <View style={styles.recentSection}>
            <Text style={[styles.recentTitle, { color: colors.statusDisconnected }]}>최근 연결</Text>
            {recentServers.map((server, index) => (
              <TouchableOpacity
                key={index}
                style={[styles.recentItem, { backgroundColor: colors.surface, borderColor: colors.border }]}
                onPress={() => handleQuickConnect(server)}
                disabled={isConnecting}
              >
                <Text style={styles.recentIcon}>🖥️</Text>
                <Text style={[styles.recentUrl, { color: colors.textPrimary }]}>{server}</Text>
                <Text style={[styles.recentArrow, { color: colors.primary }]}>→</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 구분선 (최근 서버가 있을 때) */}
        {recentServers.length > 0 && status !== 'connected' && (
          <View style={styles.dividerRow}>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
            <Text style={[styles.dividerText, { color: colors.textTertiary }]}>또는 직접 입력</Text>
            <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          </View>
        )}

        {/* 입력 폼 */}
        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>서버 IP 주소</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textHeading }]}
            placeholder="예: 192.168.0.10"
            placeholderTextColor={colors.textTertiary}
            value={serverIp}
            onChangeText={setServerIp}
            returnKeyType="next"
            onSubmitEditing={handleConnect}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>포트</Text>
          <TextInput
            style={[styles.input, { backgroundColor: colors.surface, borderColor: colors.border, color: colors.textHeading }]}
            placeholder="3000"
            placeholderTextColor={colors.textTertiary}
            value={port}
            onChangeText={setPort}
            returnKeyType="go"
            onSubmitEditing={handleConnect}
            keyboardType="numeric"
          />
        </View>

        {/* 에러 메시지 */}
        {errorMessage ? (
          <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
        ) : null}

        {/* 버튼 */}
        {status === 'connected' ? (
          <TouchableOpacity
            style={[styles.button, { backgroundColor: colors.danger }]}
            onPress={handleDisconnect}
          >
            <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>연결 해제</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, isConnecting ? { backgroundColor: colors.textTertiary } : { backgroundColor: colors.primary }]}
            onPress={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator color={colors.textOnPrimary} />
            ) : (
              <Text style={[styles.buttonText, { color: colors.textOnPrimary }]}>연결하기</Text>
            )}
          </TouchableOpacity>
        )}

        {/* 도움말 */}
        <Text style={[styles.helpText, { color: colors.textSecondary }]}>
          PC에서 Agent 서버가 실행 중이어야 합니다
        </Text>
      </View>
    </ScrollView>
  );
}

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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 32,
  },
  statusBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 24,
  },
  statusText: {
    fontWeight: '600',
    fontSize: 14,
  },

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
    fontSize: 16,
    marginRight: 10,
  },
  recentUrl: {
    flex: 1,
    fontSize: 15,
    fontFamily: 'monospace',
  },
  recentArrow: {
    fontSize: 16,
    fontWeight: '600',
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

  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  errorText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 24,
  },
});
