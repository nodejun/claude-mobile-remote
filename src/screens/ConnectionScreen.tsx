/**
 * 연결 화면
 * PC Agent와 WebSocket 연결을 관리
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { socketService, type ConnectionStatus } from '../services';

export default function ConnectionScreen() {
  // 상태
  const [serverIp, setServerIp] = useState('');
  const [port, setPort] = useState('3000');
  const [status, setStatus] = useState<ConnectionStatus>('disconnected');
  const [errorMessage, setErrorMessage] = useState('');

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

  // 연결 시도
  const handleConnect = () => {
    if (!serverIp.trim()) {
      setErrorMessage('IP 주소를 입력해주세요.');
      return;
    }

    setErrorMessage('');
    const serverUrl = `http://${serverIp}:${port}`;
    socketService.connect(serverUrl);
  };

  // 연결 해제
  const handleDisconnect = () => {
    socketService.disconnect();
  };

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
        return '#FFA500';
      case 'connected':
        return '#34C759';
      case 'error':
        return '#FF3B30';
      default:
        return '#8E8E93';
    }
  };

  const isConnecting = status === 'connecting';

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {/* 타이틀 */}
        <Text style={styles.title}>PC Agent 연결</Text>
        <Text style={styles.subtitle}>
          PC에서 실행 중인 Agent 서버에 연결하세요
        </Text>

        {/* 상태 표시 */}
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>

        {/* 입력 폼 */}
        <View style={styles.inputContainer}>
          <Text style={styles.label}>서버 IP 주소</Text>
          <TextInput
            style={styles.input}
            placeholder="예: 192.168.0.10"
            placeholderTextColor="#999"
            value={serverIp}
            onChangeText={setServerIp}
            returnKeyType="next"
            onSubmitEditing={handleConnect}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.inputContainer}>
          <Text style={styles.label}>포트</Text>
          <TextInput
            style={styles.input}
            placeholder="3000"
            placeholderTextColor="#999"
            value={port}
            onChangeText={setPort}
            returnKeyType="go"
            onSubmitEditing={handleConnect}
            keyboardType="numeric"
          />
        </View>

        {/* 에러 메시지 */}
        {errorMessage ? (
          <Text style={styles.errorText}>{errorMessage}</Text>
        ) : null}

        {/* 버튼 */}
        {status === 'connected' ? (
          <TouchableOpacity
            style={[styles.button, styles.disconnectButton]}
            onPress={handleDisconnect}
          >
            <Text style={styles.buttonText}>연결 해제</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.button, isConnecting ? styles.buttonDisabled : null]}
            onPress={handleConnect}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>연결하기</Text>
            )}
          </TouchableOpacity>
        )}

        {/* 도움말 */}
        <Text style={styles.helpText}>
          PC에서 Agent 서버가 실행 중이어야 합니다
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
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
    color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 32,
  },
  statusBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginBottom: 32,
  },
  statusText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    color: '#1a1a1a',
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#007AFF',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    backgroundColor: '#999',
  },
  disconnectButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    marginTop: 24,
  },
});
