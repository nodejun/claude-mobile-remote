/**
 * 파일 탐색 화면
 * PC의 프로젝트 파일 트리를 탐색
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useConnection } from '../hooks';
import { socketService } from '../services';
import { FileTreeItem } from '../components';
import type { FileEntry, FileTreeResult } from '../types/file';
import type { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function FilesScreen() {
  const { isConnected } = useConnection();
  const navigation = useNavigation<NavigationProp>();

  // 파일 트리 상태
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [rootPath, setRootPath] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * 파일 트리 요청
   * @param path - 요청할 경로 (미지정 시 루트)
   */
  const requestFileTree = useCallback((path?: string) => {
    socketService.emit('get_file_tree', { path });
  }, []);

  /**
   * 파일 트리 업데이트 (하위 폴더 내용 추가)
   * @param items - 현재 파일 목록
   * @param targetPath - 업데이트할 폴더 경로
   * @param children - 새로 받은 하위 파일 목록
   * @param isExpanded - 펼침 상태
   */
  const updateFileTree = useCallback(
    (
      items: FileEntry[],
      targetPath: string,
      children: FileEntry[],
      isExpanded: boolean
    ): FileEntry[] => {
      return items.map((item) => {
        if (item.path === targetPath) {
          // 대상 폴더 찾음 → 업데이트
          return {
            ...item,
            isExpanded,
            isLoading: false,
            children: isExpanded ? children : [],
          };
        } else if (item.children && item.children.length > 0) {
          // 하위 폴더 재귀 탐색
          return {
            ...item,
            children: updateFileTree(item.children, targetPath, children, isExpanded),
          };
        }
        return item;
      });
    },
    []
  );

  /**
   * 폴더 로딩 상태 설정
   */
  const setFolderLoading = useCallback(
    (items: FileEntry[], targetPath: string, loading: boolean): FileEntry[] => {
      return items.map((item) => {
        if (item.path === targetPath) {
          return { ...item, isLoading: loading };
        } else if (item.children && item.children.length > 0) {
          return {
            ...item,
            children: setFolderLoading(item.children, targetPath, loading),
          };
        }
        return item;
      });
    },
    []
  );

  /**
   * 폴더 클릭 핸들러
   * - 펼쳐진 폴더: 접기
   * - 접힌 폴더: 하위 내용 요청
   */
  const handleFolderPress = useCallback(
    (item: FileEntry) => {
      if (item.isExpanded) {
        // 접기: 로컬 상태만 업데이트
        setFiles((prev) => updateFileTree(prev, item.path, [], false));
      } else {
        // 펼치기: 서버에 하위 내용 요청
        setFiles((prev) => setFolderLoading(prev, item.path, true));
        socketService.emit('get_file_tree', { path: item.relativePath });
      }
    },
    [updateFileTree, setFolderLoading]
  );

  /**
   * 파일 클릭 핸들러
   * 파일 뷰어 화면으로 이동
   */
  const handleFilePress = useCallback((item: FileEntry) => {
    navigation.navigate('FileViewer', {
      filePath: item.relativePath,
      fileName: item.name,
    });
  }, [navigation]);

  /**
   * 새로고침 핸들러
   * rootPath 초기화 → useEffect 재실행 → requestFileTree 자동 호출
   */
  const handleRefresh = useCallback(() => {
    setFiles([]);
    setRootPath(''); // rootPath 변경으로 useEffect가 재실행됨
    setError(null);
    // requestFileTree()는 useEffect에서 자동 호출됨
  }, []);

  // 연결 상태에 따른 초기 로드
  useEffect(() => {
    if (!isConnected) {
      setIsLoading(false);
      setError('서버에 연결되지 않았습니다');
      return;
    }

    // 파일 트리 요청
    setIsLoading(true);
    requestFileTree();

    // 응답 리스너 등록
    const unsubscribeFileTree = socketService.on<FileTreeResult>(
      'file_tree',
      (data) => {
        setIsLoading(false);
        setError(null);

        if (!rootPath) {
          // 첫 로드: 루트 경로 저장 및 전체 트리 설정
          setRootPath(data.path);
          setFiles(data.children);
        } else {
          // 하위 폴더 로드: 트리에 병합
          const targetPath = data.path;
          setFiles((prev) =>
            updateFileTree(prev, targetPath, data.children, true)
          );
        }
      }
    );

    // 에러 리스너 등록
    const unsubscribeError = socketService.on<{ message: string }>(
      'error',
      (data) => {
        setIsLoading(false);
        setError(data.message);
      }
    );

    // 클린업
    return () => {
      unsubscribeFileTree();
      unsubscribeError();
    };
  }, [isConnected, requestFileTree, updateFileTree, rootPath]);

  // 연결 안됨 상태
  if (!isConnected) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>🔌</Text>
        <Text style={styles.errorText}>서버에 연결되지 않았습니다</Text>
      </View>
    );
  }

  // 로딩 상태
  if (isLoading && files.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>파일 트리 로딩 중...</Text>
      </View>
    );
  }

  // 에러 상태
  if (error && files.length === 0) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={handleRefresh}>
          <Text style={styles.retryButtonText}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: (StatusBar.currentHeight || 24) + 8 }]}>
        <Text style={styles.headerTitle}>📁 파일 탐색기</Text>
        <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
          <Text style={styles.refreshButtonText}>🔄</Text>
        </TouchableOpacity>
      </View>

      {/* 현재 경로 표시 */}
      <View style={styles.pathContainer}>
        <Text style={styles.pathLabel}>경로:</Text>
        <Text style={styles.pathText} numberOfLines={1}>
          {rootPath}
        </Text>
      </View>

      {/* 파일 트리 */}
      <ScrollView style={styles.fileList}>
        {files.length > 0 ? (
          files.map((item) => (
            <FileTreeItem
              key={item.path}
              item={item}
              level={0}
              onFolderPress={handleFolderPress}
              onFilePress={handleFilePress}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={styles.emptyText}>파일이 없습니다</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
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
  refreshButton: {
    padding: 8,
  },
  refreshButtonText: {
    fontSize: 20,
  },
  pathContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#e8f4ff',
    borderBottomWidth: 1,
    borderBottomColor: '#d0e8ff',
  },
  pathLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
    marginRight: 8,
  },
  pathText: {
    flex: 1,
    fontSize: 12,
    color: '#555',
    fontFamily: 'monospace',
  },
  fileList: {
    flex: 1,
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
  retryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
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
