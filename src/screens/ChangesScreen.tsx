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
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useConnection } from '../hooks';
import { socketService } from '../services';
import { CodeBlock } from '../components';
import { useTheme } from '../theme';
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
  const { colors } = useTheme();

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
   * 개별 변경사항 삭제 (승인/거부 완료 항목만)
   */
  const handleDelete = useCallback((changeId: string, filePath: string) => {
    Alert.alert(
      '변경사항 삭제',
      `"${filePath}" 변경 기록을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            const result = await socketService.deleteChange(changeId);
            if (result.success) {
              fetchChanges();
            } else {
              setError(result.error || '삭제 실패');
            }
          },
        },
      ]
    );
  }, [fetchChanges]);

  /**
   * 처리 완료 항목 일괄 삭제
   */
  const handleDeleteResolved = useCallback(() => {
    const resolvedCount = changes.filter(
      (c) => c.status === 'approved' || c.status === 'rejected'
    ).length;

    if (resolvedCount === 0) return;

    Alert.alert(
      '완료 항목 정리',
      `처리 완료된 ${resolvedCount}개의 변경 기록을 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            const result = await socketService.deleteChange(undefined, true);
            if (result.success) {
              fetchChanges();
            } else {
              setError(result.error || '삭제 실패');
            }
          },
        },
      ]
    );
  }, [changes, fetchChanges]);

  /**
   * 새로고침
   */
  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchChanges();
  }, [fetchChanges]);

  /**
   * 변경 타입에 따른 아이콘 정보 (Feather 아이콘)
   */
  const getChangeIconInfo = (type: FileChange['type']): { name: string; color: string } => {
    switch (type) {
      case 'create':
        return { name: 'plus-circle', color: colors.success };
      case 'edit':
        return { name: 'edit', color: colors.warning };
      case 'delete':
        return { name: 'minus-circle', color: colors.danger };
      default:
        return { name: 'file', color: colors.textSecondary };
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

  // 소켓 이벤트 리스너 (컴포넌트 생명주기)
  useEffect(() => {
    if (!isConnected) {
      setIsLoading(false);
      return;
    }

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

    return () => {
      unsubscribeList();
      unsubscribeChanged();
      unsubscribeError();
    };
  }, [isConnected, fetchChanges]);

  // 화면 포커스 시 데이터 새로고침 (탭 전환, 뒤로가기 등)
  useFocusEffect(
    useCallback(() => {
      if (isConnected) {
        setIsLoading(true);
        setError(null);
        fetchChanges();
      }
    }, [isConnected, fetchChanges])
  );

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
    const iconInfo = getChangeIconInfo(item.type);

    return (
      <View style={[styles.changeItem, { backgroundColor: colors.surface, shadowColor: colors.shadow }]}>
        {/* 헤더 */}
        <View style={styles.changeHeader}>
          {/* 왼쪽: 아이콘 + 파일 정보 (클릭하면 확장/축소) */}
          <TouchableOpacity
            style={styles.changeHeaderLeft}
            onPress={() => toggleExpand(item.id)}
            activeOpacity={0.7}
          >
            <Feather name={iconInfo.name as any} size={20} color={iconInfo.color} style={{ marginRight: 10 }} />
            <View style={styles.changeInfo}>
              <Text style={[styles.filePath, { color: colors.textHeading }]} numberOfLines={1}>
                {item.filePath}
              </Text>
              <View style={styles.changeMeta}>
                <Text style={[styles.changeType, { color: colors.textSecondary }]}>{getChangeLabel(item.type)}</Text>
                <Text style={styles.changeStats}>
                  {item.additions > 0 && (
                    <Text style={[styles.additions, { color: colors.success }]}>+{item.additions}</Text>
                  )}
                  {item.deletions > 0 && (
                    <Text style={[styles.deletions, { color: colors.danger }]}> -{item.deletions}</Text>
                  )}
                </Text>
                <Text style={[styles.changeTime, { color: colors.textTertiary }]}>{formatTime(item.timestamp)}</Text>
              </View>
            </View>
            <Feather name={isExpanded ? "chevron-down" : "chevron-right"} size={16} color={colors.textTertiary} style={{ marginLeft: 8 }} />
          </TouchableOpacity>

          {/* 오른쪽: 전체 보기 버튼 */}
          <TouchableOpacity
            style={styles.viewDetailButton}
            onPress={() => handleViewDetail(item)}
            activeOpacity={0.7}
          >
            <Feather name="external-link" size={18} color={colors.primary} />
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
              style={[styles.actionButton, { backgroundColor: colors.approveBackground }]}
              onPress={() => handleApprove(item.id)}
            >
              <Text style={[styles.approveText, { color: colors.approveText }]}>✓ 승인</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: colors.rejectBackground }]}
              onPress={() => handleReject(item.id)}
            >
              <Text style={[styles.rejectText, { color: colors.rejectText }]}>✕ 거부</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* 처리 완료 상태 표시 + 삭제 버튼 */}
        {!isPending && (
          <View style={styles.statusRow}>
            <Text
              style={[
                styles.statusText,
                item.status === 'approved'
                  ? { backgroundColor: colors.approveBackground, color: colors.approveText }
                  : { backgroundColor: colors.rejectBackground, color: colors.rejectText },
              ]}
            >
              {item.status === 'approved' ? '✓ 승인됨' : '✕ 거부됨'}
            </Text>
            <TouchableOpacity
              style={styles.deleteButton}
              onPress={() => handleDelete(item.id, item.filePath)}
              activeOpacity={0.6}
            >
              <Feather name="trash-2" size={14} color={colors.textTertiary} />
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  // 연결 안됨
  if (!isConnected) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Feather name="wifi-off" size={48} color={colors.textTertiary} style={{ marginBottom: 12 }} />
        <Text style={[styles.disconnectedText, { color: colors.textSecondary }]}>PC에 연결되지 않았습니다</Text>
      </View>
    );
  }

  // 로딩 중
  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>변경사항 로딩 중...</Text>
      </View>
    );
  }

  // 에러
  if (error) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={48} color={colors.danger} style={{ marginBottom: 12 }} />
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
        <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={fetchChanges}>
          <Text style={[styles.retryText, { color: colors.textOnPrimary }]}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View
        style={[styles.header, { paddingTop: (StatusBar.currentHeight || 24) + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}
      >
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: colors.textHeading }]}>변경사항</Text>
          {pendingCount > 0 && (
            <View style={[styles.badge, { backgroundColor: colors.danger }]}>
              <Text style={[styles.badgeText, { color: colors.textOnPrimary }]}>{pendingCount}</Text>
            </View>
          )}
        </View>
        {/* 처리 완료 항목이 있을 때만 정리 버튼 표시 */}
        {changes.length > 0 && changes.some((c) => c.status !== 'pending') && (
          <TouchableOpacity
            style={styles.clearResolvedButton}
            onPress={handleDeleteResolved}
            activeOpacity={0.6}
          >
            <Feather name="trash-2" size={16} color={colors.textSecondary} />
            <Text style={[styles.clearResolvedText, { color: colors.textSecondary }]}>정리</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* 변경 목록 */}
      {changes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Feather name="inbox" size={48} color={colors.textTertiary} style={{ marginBottom: 12 }} />
          <Text style={[styles.emptyText, { color: colors.textPrimary }]}>변경사항이 없습니다</Text>
          <Text style={[styles.emptySubtext, { color: colors.textSecondary }]}>
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
              tintColor={colors.primary}
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
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  badge: {
    marginLeft: 8,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 12,
  },
  changeItem: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  changeHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  // changeIcon 스타일 제거됨 - Feather 아이콘의 인라인 스타일로 대체
  changeInfo: {
    flex: 1,
  },
  filePath: {
    fontSize: 14,
    fontWeight: '600',
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
  },
  changeStats: {
    fontSize: 12,
  },
  additions: {
    fontWeight: '600',
  },
  deletions: {
    fontWeight: '600',
  },
  changeTime: {
    fontSize: 12,
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
  approveText: {
    fontWeight: '600',
    fontSize: 14,
  },
  rejectText: {
    fontWeight: '600',
    fontSize: 14,
  },
  statusRow: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  deleteButton: {
    padding: 6,
  },
  clearResolvedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearResolvedText: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // emptyIcon 스타일 제거됨 - Feather 아이콘으로 대체
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 4,
  },
  // disconnectedIcon 스타일 제거됨 - Feather 아이콘으로 대체
  disconnectedText: {
    fontSize: 16,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  // errorIcon 스타일 제거됨 - Feather 아이콘으로 대체
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 16,
    fontWeight: '600',
  },
  // expandIcon 스타일 제거됨 - Feather 아이콘의 인라인 스타일로 대체
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
  // viewDetailText 스타일 제거됨 - Feather 아이콘으로 대체
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
