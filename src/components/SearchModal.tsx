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
import { socketService } from '../services';
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

  /**
   * 파일 확장자에 따른 아이콘
   */
  const getIcon = (item: SearchMatch): string => {
    if (item.isDirectory) return '📁';
    const ext = item.name.split('.').pop()?.toLowerCase() || '';
    const icons: Record<string, string> = {
      ts: '📘', tsx: '⚛️', js: '📒', jsx: '⚛️',
      py: '🐍', json: '📋', md: '📝', html: '🌐',
      css: '🎨', yaml: '📋', yml: '📋',
    };
    return icons[ext] || '📄';
  };

  /**
   * 검색 결과 아이템 렌더링
   */
  const renderItem = useCallback(
    ({ item }: { item: SearchMatch }) => (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => handleItemPress(item)}
        activeOpacity={0.6}
      >
        {/* 파일 정보 */}
        <View style={styles.resultHeader}>
          <Text style={styles.resultIcon}>{getIcon(item)}</Text>
          <View style={styles.resultInfo}>
            <Text style={styles.resultName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.resultPath} numberOfLines={1}>
              {item.relativePath}
            </Text>
          </View>
        </View>

        {/* 내용 검색 시 매치된 라인 표시 */}
        {item.matches && item.matches.length > 0 && (
          <View style={styles.matchesContainer}>
            {item.matches.map((match, index) => (
              <View key={index} style={styles.matchLine}>
                <Text style={styles.matchLineNumber}>{match.line}</Text>
                <Text style={styles.matchLineText} numberOfLines={1}>
                  {match.text}
                </Text>
              </View>
            ))}
          </View>
        )}
      </TouchableOpacity>
    ),
    [handleItemPress]
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
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>🔍 파일 검색</Text>
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* 검색 타입 토글 */}
        <View style={styles.typeToggle}>
          <TouchableOpacity
            style={[
              styles.typeButton,
              searchType === 'filename' && styles.typeButtonActive,
            ]}
            onPress={() => setSearchType('filename')}
          >
            <Text
              style={[
                styles.typeButtonText,
                searchType === 'filename' && styles.typeButtonTextActive,
              ]}
            >
              파일명
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.typeButton,
              searchType === 'content' && styles.typeButtonActive,
            ]}
            onPress={() => setSearchType('content')}
          >
            <Text
              style={[
                styles.typeButtonText,
                searchType === 'content' && styles.typeButtonTextActive,
              ]}
            >
              내용
            </Text>
          </TouchableOpacity>
        </View>

        {/* 검색 입력 */}
        <View style={styles.searchBar}>
          <TextInput
            ref={inputRef}
            style={styles.searchInput}
            placeholder={
              searchType === 'filename'
                ? '파일명을 입력하세요...'
                : '검색할 내용을 입력하세요...'
            }
            placeholderTextColor="#999"
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
              (!query.trim() || isSearching) && styles.searchButtonDisabled,
            ]}
            onPress={handleSearch}
            disabled={!query.trim() || isSearching}
          >
            {isSearching ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Text style={styles.searchButtonText}>검색</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 검색 결과 */}
        {isSearching ? (
          <View style={styles.centerContainer}>
            <ActivityIndicator size="large" color="#007AFF" />
            <Text style={styles.searchingText}>검색 중...</Text>
          </View>
        ) : hasSearched && results.length === 0 ? (
          <View style={styles.centerContainer}>
            <Text style={styles.emptyIcon}>🔍</Text>
            <Text style={styles.emptyText}>검색 결과가 없습니다</Text>
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
                <Text style={styles.resultCount}>
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
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 48,
    paddingBottom: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 20,
    color: '#666',
  },
  // 검색 타입 토글
  typeToggle: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    gap: 8,
  },
  typeButton: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
  },
  typeButtonActive: {
    backgroundColor: '#007AFF',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
  },
  typeButtonTextActive: {
    color: '#fff',
  },
  // 검색바
  searchBar: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    gap: 8,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: '#fafafa',
    color: '#333',
  },
  searchButton: {
    height: 40,
    paddingHorizontal: 16,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchButtonDisabled: {
    backgroundColor: '#B0B0B0',
  },
  searchButtonText: {
    color: '#fff',
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
    color: '#666',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  resultItem: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  resultIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  resultInfo: {
    flex: 1,
  },
  resultName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#333',
  },
  resultPath: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  // 내용 검색 매치 라인
  matchesContainer: {
    marginTop: 8,
    marginLeft: 28,
    backgroundColor: '#f8f9fa',
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
    color: '#007AFF',
    fontFamily: 'monospace',
    textAlign: 'right',
    marginRight: 8,
  },
  matchLineText: {
    flex: 1,
    fontSize: 12,
    color: '#555',
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
    color: '#666',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
  },
});
