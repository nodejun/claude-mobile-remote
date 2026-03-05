/**
 * 파일 검색 모달 컴포넌트
 * 파일명 검색 / 파일 내용 검색을 지원
 */
import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { socketService } from '../services';
import { useTheme } from '../theme';
import type { SearchMatch } from '../types/file';

interface SearchModalProps {
  /** 모달 표시 여부 */
  visible: boolean;
  /** 모달 닫기 핸들러 */
  onClose: () => void;
  /** 검색 결과 파일 클릭 핸들러 */
  onFilePress: (relativePath: string, fileName: string) => void;
  /** 검색 결과 폴더 클릭 핸들러 (해당 폴더로 이동) */
  onFolderPress?: (relativePath: string) => void;
}

/** 검색 타입 */
type SearchType = 'filename' | 'content';

export default function SearchModal({
  visible,
  onClose,
  onFilePress,
  onFolderPress,
}: SearchModalProps) {
  const { colors } = useTheme();
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('filename');
  const [results, setResults] = useState<SearchMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const inputRef = useRef<TextInput>(null);

  /**
   * 검색 실행
   */
  const handleSearch = useCallback(async () => {
    const trimmed = query.trim();
    if (!trimmed) return;

    setIsSearching(true);
    setHasSearched(true);

    const result = await socketService.searchFiles(trimmed, searchType);
    setResults(result.results);
    setIsSearching(false);
  }, [query, searchType]);

  /**
   * 모달 닫기 (상태 초기화)
   */
  const handleClose = useCallback(() => {
    setQuery('');
    setResults([]);
    setHasSearched(false);
    setIsSearching(false);
    onClose();
  }, [onClose]);

  /**
   * 검색 결과 항목 클릭
   * - 파일: FileViewerScreen으로 이동
   * - 폴더: 파일 탐색기에서 해당 폴더로 이동
   */
  const handleItemPress = useCallback(
    (item: SearchMatch) => {
      if (item.isDirectory) {
        onFolderPress?.(item.relativePath);
      } else {
        onFilePress(item.relativePath, item.name);
      }
      handleClose();
    },
    [onFilePress, onFolderPress, handleClose]
  );

  /** 파일 아이콘 정보 (이름 + 색상) */
  const getFileIcon = (item: SearchMatch): { name: string; color: string } => {
    if (item.isDirectory) return { name: 'folder', color: colors.primary };
    const ext = item.name.split('.').pop()?.toLowerCase() || '';
    const icons: Record<string, { name: string; color: string }> = {
      ts: { name: 'file-text', color: '#3178C6' },
      tsx: { name: 'code', color: '#61DAFB' },
      jsx: { name: 'code', color: '#61DAFB' },
      js: { name: 'file-text', color: '#F0DB4F' },
      py: { name: 'terminal', color: '#3776AB' },
      json: { name: 'settings', color: '#8C8C8C' },
      md: { name: 'book-open', color: '#519ABA' },
      html: { name: 'globe', color: '#E44D26' },
      css: { name: 'hash', color: '#A259FF' },
      scss: { name: 'hash', color: '#CD6799' },
      yaml: { name: 'settings', color: '#CB171E' },
      yml: { name: 'settings', color: '#CB171E' },
      png: { name: 'image', color: '#FF6B9D' },
      jpg: { name: 'image', color: '#FF6B9D' },
      svg: { name: 'image', color: '#FFB13B' },
    };
    return icons[ext] || { name: 'file', color: '#8C8C8C' };
  };

  /**
   * 검색 결과 아이템 렌더링
   */
  const renderItem = useCallback(
    ({ item }: { item: SearchMatch }) => (
      <TouchableOpacity
        style={[styles.resultItem, { backgroundColor: colors.surface, borderBottomColor: colors.borderLight }]}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.6}
      >
        {/* 파일 정보 */}
        <View style={styles.resultHeader}>
          <Feather
            name={getFileIcon(item).name as any}
            size={18}
            color={getFileIcon(item).color}
            style={styles.resultIcon}
          />
          <View style={styles.resultInfo}>
            <Text style={[styles.resultName, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={[styles.resultPath, { color: colors.textTertiary }]} numberOfLines={1}>
              {item.relativePath}
            </Text>
          </View>
        </View>

        {/* 내용 검색 시 매치된 라인 표시 */}
        {item.matches && item.matches.length > 0 && (
          <View style={[styles.matchesContainer, { backgroundColor: colors.surfaceSecondary }]}>
            {item.matches.map((match, index) => (
              <View key={index} style={styles.matchLine}>
                <Text style={[styles.matchLineNumber, { color: colors.primary }]}>{match.line}</Text>
                <Text style={[styles.matchLineText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {match.text}
                </Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    ),
    [handleItemPress, colors]
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={handleClose}
      onShow={() => {
        // 모달 열릴 때 입력 포커스
        setTimeout(() => inputRef.current?.focus(), 100);
      }}
    >
      <KeyboardAvoidingView
        style={[styles.container, { backgroundColor: colors.background }]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 헤더 */}
        <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <View style={styles.headerTitleRow}>
            <Feather name="search" size={20} color={colors.textPrimary} style={{ marginRight: 8 }} />
            <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>파일 검색</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Feather name="x" size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        {/* 검색 타입 토글 */}
        <View style={[styles.typeToggle, { backgroundColor: colors.surface }]}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              { backgroundColor: colors.surfaceSecondary },
              searchType === 'filename' && { backgroundColor: colors.primary },
            ]}
            onPress={() => setSearchType('filename')}
          >
            <Text
              style={[
                styles.typeButtonText,
                { color: colors.textSecondary },
                searchType === 'filename' && { color: colors.textOnPrimary },
              ]}
            >
              파일명
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeButton,
              { backgroundColor: colors.surfaceSecondary },
              searchType === 'content' && { backgroundColor: colors.primary },
            ]}
            onPress={() => setSearchType('content')}
          >
            <Text
              style={[
                styles.typeButtonText,
                { color: colors.textSecondary },
                searchType === 'content' && { color: colors.textOnPrimary },
              ]}
            >
              내용
            </Text>
          </TouchableOpacity>
        </View>

        {/* 검색 입력 */}
        <View style={[styles.searchBar, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, { borderColor: colors.border, backgroundColor: colors.surfaceSecondary, color: colors.textPrimary }]}
            placeholder={
              searchType === 'filename'
                ? '파일명을 입력하세요...'
                : '검색할 내용을 입력하세요...'
            }
            placeholderTextColor={colors.textTertiary}
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity
            style={[
              styles.searchButton,
              { backgroundColor: colors.primary },
              (!query.trim() || isSearching) && { backgroundColor: colors.textTertiary },
            ]}
            onPress={handleSearch}
            disabled={!query.trim() || isSearching}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color={colors.textOnPrimary} />
            ) : (
              <Text style={[styles.searchButtonText, { color: colors.textOnPrimary }]}>검색</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 검색 결과 */}
        {isSearching ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.searchingText, { color: colors.textSecondary }]}>검색 중...</Text>
          </View>
        ) : hasSearched && results.length === 0 ? (
          <View style={styles.centerContainer}>
            <Feather name="search" size={48} color={colors.textTertiary} style={{ marginBottom: 12 }} />
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>검색 결과가 없습니다</Text>
          </View>
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item, index) => `${item.relativePath}-${index}`}
            renderItem={renderItem}
            style={styles.resultList}
            contentContainerStyle={results.length === 0 ? styles.emptyList : undefined}
            ListHeaderComponent={
              hasSearched && results.length > 0 ? (
                <Text style={[styles.resultCount, { color: colors.textSecondary }]}>
                  {results.length}개 결과
                </Text>
              ) : null
            }
          />
        )}
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitleRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  // 검색 타입 토글
  typeToggle: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  // 검색바
  searchBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
  },
  searchButton: {
    height: 40,
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  // 결과 목록
  resultList: {
    flex: 1,
  },
  emptyList: {
    flex: 1,
  },
  resultCount: {
    fontSize: 13,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIcon: {
    marginRight: 10,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '500',
  },
  resultPath: {
    fontSize: 12,
    marginTop: 2,
    fontFamily: 'monospace',
  },
  // 내용 검색 매치 라인
  matchesContainer: {
    marginTop: 8,
    marginLeft: 28,
    borderRadius: 6,
    padding: 8,
  },
  matchLine: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 2,
  },
  matchLineNumber: {
    width: 36,
    fontSize: 11,
    fontFamily: 'monospace',
    textAlign: 'right',
    marginRight: 8,
  },
  matchLineText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  // 빈 상태 / 로딩
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  searchingText: {
    marginTop: 12,
    fontSize: 16,
  },
  emptyText: {
    fontSize: 16,
  },
});
