/**
 * 변경사항 화면
 * Claude가 수정한 파일 목록을 보여주고 승인/거부 기능 제공
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StatusBar,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useConnection } from '../hooks';
import { socketService } from '../services';
import { CodeBlock } from '../components';
import type { RootStackParamList } from '../navigation/types';
import type {
  FileChange,
  ChangesListResult,
  FileChangedEvent,
} from '../types/changes';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function ChangesScreen() {
  const { isConnected } = useConnection();
  const navigation = useNavigation<NavigationProp>();

  // 상태
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [pendingCount, setPendingCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  /**
   * 전체 보기 화면으로 이동
   */
  const handleViewDetail = useCallback((change: FileChange) => {
    navigation.navigate('ChangeDetail', { change });
  }, [navigation]);

  /**
   * 변경 목록 조회
   */
  const fetchChanges = useCallback(() => {
    if (!isConnected) return;

    socketService.emit('get_changes', {});
  }, [isConnected]);

  /**
   * 변경 승인
   */
  const handleApprove = useCallback(async (changeId: string) => {
    const result = await socketService.approveChange(changeId);
    if (result.success) {
      fetchChanges();  // 성공 시 목록 갱신
    } else {
      setError(result.error || '승인 실패');
    }
  }, [fetchChanges]);

  /**
   * 변경 거부 (원본 복원) - 확인 후 실행
   */
  const handleReject = useCallback((changeId: string) => {
    Alert.alert(
      '변경 거부',
      '이 변경을 거부하고 원래 상태로 되돌리시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '거부',
          style: 'destructive',
          onPress: async () => {
            const result = await socketService.rejectChange(changeId);
            if (result.success) {
              fetchChanges();  // 성공 시 목록 갱신
            } else {
              setError(result.error || '거부 실패');
            }
          },
        },
      ]
    );
  }, [fetchChanges]);

  /**
   * 새로고침
   */
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchChanges();
  }, [fetchChanges]);

  /**
   * 변경 타입에 따른 아이콘
   */
  const getChangeIcon = (type: FileChange['type']) => {
    switch (type) {
      case 'create':
        return '🟢';
      case 'edit':
        return '🟡';
      case 'delete':
        return '🔴';
      default:
        return '📄';
    }
  };

  /**
   * 변경 타입에 따른 라벨
   */
  const getChangeLabel = (type: FileChange['type']) => {
    switch (type) {
      case 'create':
        return '생성됨';
      case 'edit':
        return '수정됨';
      case 'delete':
        return '삭제됨';
      default:
        return '';
    }
  };

  /**
   * 파일 확장자에서 언어 감지
   */
  const getLanguageFromPath = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      // JavaScript/TypeScript
      js: 'javascript',
      jsx: 'jsx',
      ts: 'typescript',
      tsx: 'tsx',
      // Web
      html: 'html',
      css: 'css',
      scss: 'scss',
      less: 'less',
      // Data
      json: 'json',
      xml: 'xml',
      yaml: 'yaml',
      yml: 'yaml',
      // Backend
      py: 'python',
      java: 'java',
      kt: 'kotlin',
      swift: 'swift',
      go: 'go',
      rs: 'rust',
      rb: 'ruby',
      php: 'php',
      // Shell/Config
      sh: 'bash',
      bash: 'bash',
      zsh: 'bash',
      // Database
      sql: 'sql',
      // Markup
      md: 'markdown',
      // Others
      c: 'c',
      cpp: 'cpp',
      h: 'c',
      hpp: 'cpp',
    };
    return langMap[ext] || 'plaintext';
  };

  /**
   * 시간 포맷팅 (상대 시간)
   */
  const formatTime = (timestamp: string) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now.getTime() - time.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < 1) return '방금 전';
    if (diffMin < 60) return `${diffMin}분 전`;
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) return `${diffHour}시간 전`;
    const diffDay = Math.floor(diffHour / 24);
    return `${diffDay}일 전`;
  };

  // 소켓 이벤트 리스너
  useEffect(() => {
    if (!isConnected) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    fetchChanges();

    // 변경 목록 응답
    const unsubscribeList = socketService.on<ChangesListResult>(
      'changes_list',
      (data) => {
        setIsLoading(false);
        setIsRefreshing(false);
        setChanges(data.changes);
        setPendingCount(data.pendingCount);
      }
    );

    // 실시간 파일 변경 알림 (Claude가 새 파일 변경 시)
    const unsubscribeChanged = socketService.on<FileChangedEvent>(
      'file_changed',
      () => {
        // 새 변경이 생기면 목록 새로고침
        fetchChanges();
      }
    );

    // 에러
    const unsubscribeError = socketService.on<{ message: string }>(
      'error',
      (data) => {
        setIsLoading(false);
        setIsRefreshing(false);
        setError(data.message);
      }
    );

    // 승인/거부 결과는 handleApprove, handleReject에서 직접 처리
    // (Promise 방식으로 통일)

    return () => {
      unsubscribeList();
      unsubscribeChanged();
      unsubscribeError();
    };
  }, [isConnected, fetchChanges]);

  /**
   * 아이템 확장/축소 토글
   */
  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  /**
   * Diff 라인 렌더링
   */
  const renderDiffLine = (line: string, index: number) => {
    const isAddition = line.startsWith('+');
    const isDeletion = line.startsWith('-');

    let lineStyle = styles.diffLineContext;
    let bgStyle = {};
    if (isAddition) {
      lineStyle = styles.diffLineAddition;
      bgStyle = styles.diffLineBgAddition;
    } else if (isDeletion) {
      lineStyle = styles.diffLineDeletion;
      bgStyle = styles.diffLineBgDeletion;
    }

    return (
      <View key={index} style={[styles.diffLineContainer, bgStyle]}>
        <Text style={styles.diffLinePrefix}>
          {isAddition ? '+' : isDeletion ? '-' : ' '}
        </Text>
        <Text style={[styles.diffLineText, lineStyle]} numberOfLines={1}>
          {line.substring(1)}
        </Text>
      </View>
    );
  };

  /**
   * 변경 아이템 렌더링
   */
  const renderChangeItem = ({ item }: { item: FileChange }) => {
    const isPending = item.status === 'pending';
    const isExpanded = expandedId === item.id;
    const hasDiff = item.hunks && item.hunks.length > 0;

    return (
      <View style={styles.changeItem}>
        {/* 헤더 */}
        <View style={styles.changeHeader}>
          {/* 왼쪽: 아이콘 + 파일 정보 (클릭하면 확장/축소) */}
          <TouchableOpacity
            style={styles.changeHeaderLeft}
            onPress={() => toggleExpand(item.id)}
            activeOpacity={0.7}
          >
            <Text style={styles.changeIcon}>{getChangeIcon(item.type)}</Text>
            <View style={styles.changeInfo}>
              <Text style={styles.filePath} numberOfLines={1}>
                {item.filePath}
              </Text>
              <View style={styles.changeMeta}>
                <Text style={styles.changeType}>{getChangeLabel(item.type)}</Text>
                <Text style={styles.changeStats}>
                  {item.additions > 0 && (
                    <Text style={styles.additions}>+{item.additions}</Text>
                  )}
                  {item.deletions > 0 && (
                    <Text style={styles.deletions}> -{item.deletions}</Text>
                  )}
                </Text>
                <Text style={styles.changeTime}>{formatTime(item.timestamp)}</Text>
              </View>
            </View>
            <Text style={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</Text>
          </TouchableOpacity>

          {/* 오른쪽: 전체 보기 버튼 */}
          <TouchableOpacity
            style={styles.viewDetailButton}
            onPress={() => handleViewDetail(item)}
            activeOpacity={0.7}
          >
            <Text style={styles.viewDetailText}>↗️</Text>
          </TouchableOpacity>
        </View>

        {/* Diff 미리보기 (확장 시) */}
        {isExpanded && (
          <View style={styles.diffContainer}>
            {hasDiff ? (
              <ScrollView
                horizontal
                style={styles.diffScroll}
                showsHorizontalScrollIndicator={true}
              >
                <View style={styles.diffContent}>
                  {item.hunks.map((hunk, hunkIndex) => (
                    <View key={hunkIndex}>
                      <Text style={styles.hunkHeader}>
                        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
                      </Text>
                      {hunk.lines.map((line, lineIndex) =>
                        renderDiffLine(line, lineIndex)
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <View style={styles.noDiffContainer}>
                <Text style={styles.noDiffText}>
                  {item.type === 'create'
                    ? '새 파일이 생성되었습니다'
                    : 'Diff 정보가 없습니다'}
                </Text>
                {item.newContent && item.type === 'create' ? (
                  // 생성된 파일: 구문 강조 적용 (스크롤 가능)
                  <ScrollView
                    style={styles.codeBlockWrapper}
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                  >
                    <CodeBlock
                      code={item.newContent}
                      language={getLanguageFromPath(item.filePath)}
                    />
                  </ScrollView>
                ) : item.newContent ? (
                  // 기타: 기존 일반 텍스트 미리보기
                  <ScrollView
                    horizontal
                    style={styles.diffScroll}
                    showsHorizontalScrollIndicator={true}
                  >
                    <View style={styles.diffContent}>
                      {item.newContent.split('\n').slice(0, 20).map((line, i) => (
                        <Text key={i} style={styles.previewLine} numberOfLines={1}>
                          {line}
                        </Text>
                      ))}
                      {item.newContent.split('\n').length > 20 && (
                        <Text style={styles.truncatedText}>
                          ... ({item.newContent.split('\n').length - 20}줄 더 있음)
                        </Text>
                      )}
                    </View>
                  </ScrollView>
                ) : null}
              </View>
            )}
          </View>
        )}

        {/* 승인/거부 버튼 (pending 상태만) */}
        {isPending && (
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.approveButton]}
              onPress={() => handleApprove(item.id)}
            >
              <Text style={styles.approveText}>✓ 승인</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, styles.rejectButton]}
              onPress={() => handleReject(item.id)}
            >
              <Text style={styles.rejectText}>✕ 거부</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 처리 완료 상태 표시 */}
        {!isPending && (
          <View style={styles.statusBadge}>
            <Text
              style={[
                styles.statusText,
                item.status === 'approved'
                  ? styles.approvedStatus
                  : styles.rejectedStatus,
              ]}
            >
              {item.status === 'approved' ? '✓ 승인됨' : '✕ 거부됨'}
            </Text>
          </View>
        )}
      </View>
    );
  };

  // 연결 안됨
  if (!isConnected) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.disconnectedIcon}>🔌</Text>
        <Text style={styles.disconnectedText}>PC에 연결되지 않았습니다</Text>
      </View>
    );
  }

  // 로딩 중
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>변경사항 로딩 중...</Text>
      </View>
    );
  }

  // 에러
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={fetchChanges}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View
        style={[styles.header, { paddingTop: (StatusBar.currentHeight || 24) + 8 }]}
      >
        <Text style={styles.headerTitle}>📝 변경사항</Text>
        {pendingCount > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{pendingCount}</Text>
          </View>
        )}
      </View>

      {/* 변경 목록 */}
      {changes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📭</Text>
          <Text style={styles.emptyText}>변경사항이 없습니다</Text>
          <Text style={styles.emptySubtext}>
            Claude에게 파일 수정을 요청해보세요
          </Text>
        </View>
      ) : (
        <FlatList
          data={changes}
          keyExtractor={(item) => item.id}
          renderItem={renderChangeItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor="#007AFF"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E5EA',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
  },
  badge: {
    marginLeft: 8,
    backgroundColor: '#FF3B30',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
  },
  changeItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  changeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  changeIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  changeInfo: {
    flex: 1,
  },
  filePath: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
    marginBottom: 4,
  },
  changeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
  },
  changeType: {
    fontSize: 12,
    color: '#666',
  },
  changeStats: {
    fontSize: 12,
  },
  additions: {
    color: '#34C759',
    fontWeight: '600',
  },
  deletions: {
    color: '#FF3B30',
    fontWeight: '600',
  },
  changeTime: {
    fontSize: 12,
    color: '#999',
  },
  actionButtons: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#E8F5E9',
  },
  rejectButton: {
    backgroundColor: '#FFEBEE',
  },
  approveText: {
    color: '#2E7D32',
    fontWeight: '600',
    fontSize: 14,
  },
  rejectText: {
    color: '#C62828',
    fontWeight: '600',
    fontSize: 14,
  },
  statusBadge: {
    marginTop: 8,
    alignItems: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  approvedStatus: {
    backgroundColor: '#E8F5E9',
    color: '#2E7D32',
  },
  rejectedStatus: {
    backgroundColor: '#FFEBEE',
    color: '#C62828',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  disconnectedIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  disconnectedText: {
    fontSize: 16,
    color: '#666',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  retryText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // Diff 관련 스타일
  expandIcon: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  // 헤더 레이아웃 스타일
  changeHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  viewDetailButton: {
    padding: 8,
    marginLeft: 16,
  },
  viewDetailText: {
    fontSize: 18,
  },
  diffContainer: {
    marginTop: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    overflow: 'hidden',
  },
  diffScroll: {
    maxHeight: 300,
  },
  diffContent: {
    padding: 8,
    minWidth: '100%',
  },
  hunkHeader: {
    fontFamily: 'monospace',
    fontSize: 11,
    color: '#6A9FB5',
    backgroundColor: '#2D2D2D',
    paddingVertical: 4,
    paddingHorizontal: 8,
    marginBottom: 4,
  },
  diffLineContainer: {
    flexDirection: 'row',
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  diffLineBgAddition: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  diffLineBgDeletion: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  diffLinePrefix: {
    fontFamily: 'monospace',
    fontSize: 12,
    width: 16,
    color: '#888',
  },
  diffLineText: {
    fontFamily: 'monospace',
    fontSize: 12,
    flex: 1,
  },
  diffLineContext: {
    color: '#D4D4D4',
  },
  diffLineAddition: {
    color: '#34C759',
  },
  diffLineDeletion: {
    color: '#FF3B30',
  },
  noDiffContainer: {
    padding: 12,
  },
  noDiffText: {
    fontSize: 13,
    color: '#888',
    marginBottom: 8,
  },
  previewLine: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#D4D4D4',
    paddingVertical: 1,
  },
  truncatedText: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#6A9FB5',
    fontStyle: 'italic',
    marginTop: 8,
  },
  // CodeBlock wrapper (생성 파일 미리보기용 - 스크롤 가능)
  codeBlockWrapper: {
    marginTop: 4,
    maxHeight: 400,
    // overflow 제거 - ScrollView가 스크롤 처리
  },
});
