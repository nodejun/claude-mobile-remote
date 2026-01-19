/**
 * 변경 상세 화면
 * 파일 변경사항을 전체 화면으로 보여줌 (diff 또는 생성된 코드)
 */
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';

import { socketService } from '../services';
import { CodeBlock, DiffCodeLine } from '../components';
import type { FileChange, DiffHunk } from '../types/changes';

// 라우트 파라미터 타입
type ChangeDetailRouteParams = {
  ChangeDetail: {
    change: FileChange;
  };
};

export default function ChangeDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<ChangeDetailRouteParams, 'ChangeDetail'>>();
  const { change } = route.params;

  // 상태
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>(
    change.status
  );
  const [isProcessing, setIsProcessing] = useState(false);

  // 파일 확장자에서 언어 감지
  const getLanguageFromPath = (filePath: string): string => {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    const langMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'jsx',
      ts: 'typescript',
      tsx: 'tsx',
      html: 'html',
      css: 'css',
      scss: 'scss',
      json: 'json',
      py: 'python',
      java: 'java',
      go: 'go',
      rs: 'rust',
      sh: 'bash',
      sql: 'sql',
      md: 'markdown',
      c: 'c',
      cpp: 'cpp',
    };
    return langMap[ext] || 'plaintext';
  };

  // 변경 타입 아이콘
  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'create':
        return '✨';
      case 'edit':
        return '✏️';
      case 'delete':
        return '🗑️';
      default:
        return '📄';
    }
  };

  // 변경 타입 라벨
  const getChangeLabel = (type: string) => {
    switch (type) {
      case 'create':
        return '새 파일';
      case 'edit':
        return '수정됨';
      case 'delete':
        return '삭제됨';
      default:
        return '';
    }
  };

  // 승인 처리
  const handleApprove = useCallback(async () => {
    setIsProcessing(true);
    try {
      const result = await socketService.approveChange(change.id);
      if (result.success) {
        setStatus('approved');
        Alert.alert('승인됨', '변경사항이 승인되었습니다.');
      } else {
        Alert.alert('오류', result.error || '승인 실패');
      }
    } catch (error) {
      Alert.alert('오류', '승인 처리 중 오류가 발생했습니다.');
    } finally {
      setIsProcessing(false);
    }
  }, [change.id]);

  // 거부 처리
  const handleReject = useCallback(async () => {
    Alert.alert(
      '변경 거부',
      '이 변경을 거부하고 원래 상태로 되돌리시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '거부',
          style: 'destructive',
          onPress: async () => {
            setIsProcessing(true);
            try {
              const result = await socketService.rejectChange(change.id);
              if (result.success) {
                setStatus('rejected');
                Alert.alert('거부됨', '변경사항이 거부되고 복원되었습니다.');
              } else {
                Alert.alert('오류', result.error || '거부 실패');
              }
            } catch (error) {
              Alert.alert('오류', '거부 처리 중 오류가 발생했습니다.');
            } finally {
              setIsProcessing(false);
            }
          },
        },
      ]
    );
  }, [change.id]);

  // Diff 라인 렌더링
  const renderDiffLine = (line: string, index: number) => {
    const isAddition = line.startsWith('+');
    const isDeletion = line.startsWith('-');
    const isContext = !isAddition && !isDeletion;

    return (
      <View
        key={index}
        style={[
          styles.diffLine,
          isAddition && styles.diffLineAddition,
          isDeletion && styles.diffLineDeletion,
        ]}
      >
        <Text style={styles.lineNumber}>{index + 1}</Text>
        <Text
          style={[
            styles.lineContent,
            isAddition && styles.lineAddition,
            isDeletion && styles.lineDeletion,
            isContext && styles.lineContext,
          ]}
        >
          {line}
        </Text>
      </View>
    );
  };

  // Hunk 렌더링
  const renderHunk = (hunk: DiffHunk, index: number) => (
    <View key={index} style={styles.hunkContainer}>
      <Text style={styles.hunkHeader}>
        @@ -{hunk.oldStart},{hunk.oldLines} +{hunk.newStart},{hunk.newLines} @@
      </Text>
      {hunk.lines.map((line, lineIndex) => renderDiffLine(line, lineIndex))}
    </View>
  );

  const isPending = status === 'pending';
  const hasDiff = change.hunks && change.hunks.length > 0;

  // 머지된 diff 라인 타입
  type MergedLine = {
    type: 'context' | 'addition' | 'deletion';
    content: string;
    oldLineNum?: number;
    newLineNum?: number;
  };

  // hunks를 머지된 diff 라인으로 변환
  const getMergedDiffLines = (): MergedLine[] => {
    if (!change.newContent) return [];

    const newLines = change.newContent.split('\n');
    const result: MergedLine[] = [];

    // 디버깅: hunks 데이터 확인
    console.log('🔍 ChangeDetail - hunks 데이터:', {
      hasHunks: !!change.hunks,
      hunksLength: change.hunks?.length || 0,
      hunks: change.hunks,
      additions: change.additions,
      deletions: change.deletions,
    });

    // hunks가 없으면 전체 파일을 컨텍스트로 표시
    if (!change.hunks || change.hunks.length === 0) {
      console.log('⚠️ hunks가 없어서 전체 파일을 컨텍스트로 표시');
      return newLines.map((line, i) => ({
        type: 'context' as const,
        content: line,
        newLineNum: i + 1,
      }));
    }

    let currentNewLine = 1;

    // 각 hunk 처리
    change.hunks.forEach((hunk) => {
      // hunk 시작 전까지의 컨텍스트 줄 추가
      while (currentNewLine < hunk.newStart) {
        result.push({
          type: 'context',
          content: newLines[currentNewLine - 1] || '',
          newLineNum: currentNewLine,
        });
        currentNewLine++;
      }

      // hunk 내용 처리
      let oldLineNum = hunk.oldStart;
      let newLineNum = hunk.newStart;

      hunk.lines.forEach((line) => {
        if (line.startsWith('-')) {
          // 삭제된 줄
          result.push({
            type: 'deletion',
            content: line.substring(1), // '-' 제거
            oldLineNum: oldLineNum,
          });
          oldLineNum++;
        } else if (line.startsWith('+')) {
          // 추가된 줄
          result.push({
            type: 'addition',
            content: line.substring(1), // '+' 제거
            newLineNum: newLineNum,
          });
          newLineNum++;
          currentNewLine++;
        } else {
          // 컨텍스트 줄
          result.push({
            type: 'context',
            content: line.startsWith(' ') ? line.substring(1) : line,
            oldLineNum: oldLineNum,
            newLineNum: newLineNum,
          });
          oldLineNum++;
          newLineNum++;
          currentNewLine++;
        }
      });
    });

    // 마지막 hunk 이후 남은 줄 추가
    while (currentNewLine <= newLines.length) {
      result.push({
        type: 'context',
        content: newLines[currentNewLine - 1] || '',
        newLineNum: currentNewLine,
      });
      currentNewLine++;
    }

    return result;
  };

  // 전체 파일 + 하이라이트 렌더링 (edit 타입용)
  // DiffCodeLine을 사용해서 구문 강조 + diff 배경색 적용
  const renderFullFileWithHighlight = () => {
    const mergedLines = getMergedDiffLines();
    if (mergedLines.length === 0) return null;

    const language = getLanguageFromPath(change.filePath);

    return (
      <View style={styles.fullFileContainer}>
        {mergedLines.map((line, index) => {
          const isDeletion = line.type === 'deletion';
          const lineNumDisplay = isDeletion
            ? `- ${line.oldLineNum || ''}`
            : `${line.newLineNum || ''}`;

          return (
            <DiffCodeLine
              key={index}
              content={line.content}
              lineNumber={lineNumDisplay}
              type={line.type}
              language={language}
            />
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={styles.backButtonText}>← 뒤로</Text>
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={styles.headerIcon}>{getChangeIcon(change.type)}</Text>
          <Text style={styles.headerLabel}>{getChangeLabel(change.type)}</Text>
        </View>
      </View>

      {/* 파일 경로 */}
      <View style={styles.filePathContainer}>
        <Text style={styles.filePath}>{change.filePath}</Text>
        <View style={styles.statsContainer}>
          {change.additions > 0 && (
            <Text style={styles.additions}>+{change.additions}</Text>
          )}
          {change.deletions > 0 && (
            <Text style={styles.deletions}>-{change.deletions}</Text>
          )}
        </View>
      </View>

      {/* 상태 배지 */}
      {!isPending && (
        <View
          style={[
            styles.statusBadge,
            status === 'approved' ? styles.approvedBadge : styles.rejectedBadge,
          ]}
        >
          <Text style={styles.statusText}>
            {status === 'approved' ? '✓ 승인됨' : '✗ 거부됨'}
          </Text>
        </View>
      )}

      {/* 컨텐츠 영역 - 가로/세로 스크롤 모두 지원 */}
      <ScrollView
        style={styles.contentScroll}
        contentContainerStyle={styles.contentContainer}
        horizontal={false}
      >
        <ScrollView
          horizontal={true}
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={styles.horizontalScrollContent}
        >
        {/* edit 타입: 전체 파일 + 변경된 줄 하이라이트 */}
        {change.type === 'edit' && change.newContent ? (
          renderFullFileWithHighlight()
        ) : change.type === 'create' && change.newContent ? (
          /* 생성된 파일: 구문 강조 */
          <CodeBlock
            code={change.newContent}
            language={getLanguageFromPath(change.filePath)}
          />
        ) : hasDiff ? (
          /* Diff 표시 */
          <View style={styles.diffContainer}>
            {change.hunks.map((hunk, index) => renderHunk(hunk, index))}
          </View>
        ) : change.newContent ? (
          /* 기타: 일반 텍스트 */
          <View style={styles.plainTextContainer}>
            {change.newContent.split('\n').map((line, i) => (
              <Text key={i} style={styles.plainTextLine}>
                {line}
              </Text>
            ))}
          </View>
        ) : (
          <View style={styles.noContentContainer}>
            <Text style={styles.noContentText}>내용이 없습니다</Text>
          </View>
        )}
        </ScrollView>
      </ScrollView>

      {/* 승인/거부 버튼 (pending 상태만) */}
      {isPending && (
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.actionButton, styles.rejectButton]}
            onPress={handleReject}
            disabled={isProcessing}
          >
            <Text style={styles.rejectText}>✗ 거부</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, styles.approveButton]}
            onPress={handleApprove}
            disabled={isProcessing}
          >
            <Text style={styles.approveText}>✓ 승인</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    paddingTop: 20, // 상단 패딩 (StatusBar 영역)
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2d2d44',
  },
  backButton: {
    padding: 8,
  },
  backButtonText: {
    color: '#7B68EE',
    fontSize: 16,
    fontWeight: '500',
  },
  headerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIcon: {
    fontSize: 20,
  },
  headerLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  filePathContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#16213e',
  },
  filePath: {
    flex: 1,
    color: '#E0E0E0',
    fontSize: 14,
    fontFamily: 'monospace',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  additions: {
    color: '#34C759',
    fontSize: 14,
    fontWeight: '600',
  },
  deletions: {
    color: '#FF3B30',
    fontSize: 14,
    fontWeight: '600',
  },
  statusBadge: {
    alignSelf: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginVertical: 12,
  },
  approvedBadge: {
    backgroundColor: 'rgba(52, 199, 89, 0.2)',
  },
  rejectedBadge: {
    backgroundColor: 'rgba(255, 59, 48, 0.2)',
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  contentScroll: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  horizontalScrollContent: {
    minWidth: '100%',
  },
  diffContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    overflow: 'hidden',
  },
  hunkContainer: {
    marginBottom: 16,
  },
  hunkHeader: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#6A9FB5',
    backgroundColor: '#2D2D2D',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  diffLine: {
    flexDirection: 'row',
    paddingVertical: 2,
    paddingHorizontal: 8,
  },
  diffLineAddition: {
    backgroundColor: 'rgba(52, 199, 89, 0.15)',
  },
  diffLineDeletion: {
    backgroundColor: 'rgba(255, 59, 48, 0.15)',
  },
  lineNumber: {
    width: 40,
    fontFamily: 'monospace',
    fontSize: 12,
    color: '#6A6A6A',
    textAlign: 'right',
    marginRight: 12,
  },
  lineContent: {
    flex: 1,
    fontFamily: 'monospace',
    fontSize: 13,
  },
  lineAddition: {
    color: '#34C759',
  },
  lineDeletion: {
    color: '#FF3B30',
  },
  lineContext: {
    color: '#D4D4D4',
  },
  plainTextContainer: {
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
  },
  plainTextLine: {
    fontFamily: 'monospace',
    fontSize: 13,
    color: '#D4D4D4',
    lineHeight: 20,
  },
  noContentContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  noContentText: {
    color: '#6A6A6A',
    fontSize: 16,
  },
  actionButtons: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    padding: 16,
    gap: 12,
    backgroundColor: '#1a1a2e',
    borderTopWidth: 1,
    borderTopColor: '#2d2d44',
  },
  actionButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: '#34C759',
  },
  rejectButton: {
    backgroundColor: '#FF3B30',
  },
  approveText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  rejectText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  // 전체 파일 + 구문 강조 컨테이너 (DiffCodeLine 사용)
  fullFileContainer: {
    backgroundColor: '#282c34', // atomOneDark 배경색과 일치
    borderRadius: 8,
    overflow: 'hidden',
    paddingVertical: 4,
  },
});
