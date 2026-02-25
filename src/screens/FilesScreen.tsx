/**
 * 파일 탐색 화면
 * PC의 프로젝트 파일 트리를 탐색
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';

// Android에서 LayoutAnimation 활성화
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useConnection } from '../hooks';
import { socketService } from '../services';
import { FileTreeItem, SearchModal } from '../components';
import { useTheme } from '../theme';
import type { FileEntry, FileTreeResult } from '../types/file';
import type { RootStackParamList } from '../navigation/types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export default function FilesScreen() {
  const { isConnected } = useConnection();
  const navigation = useNavigation<NavigationProp>();
  const { colors } = useTheme();

  // 파일 트리 상태
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [rootPath, setRootPath] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set()); // 펼쳐진 폴더 경로 저장

  // ref로 추적 (useEffect 의존성 문제 해결용)
  const rootPathRef = useRef<string>('');
  const expandedPathsRef = useRef<Set<string>>(new Set());

  // 파일 관리 모달 상태
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isRenameModalVisible, setIsRenameModalVisible] = useState(false);
  const [createType, setCreateType] = useState<'file' | 'folder'>('file');
  const [newItemName, setNewItemName] = useState('');
  const [renameTarget, setRenameTarget] = useState<FileEntry | null>(null);
  const [createPath, setCreatePath] = useState<string>(''); // 생성 위치 (빈 문자열 = 루트)
  const [isOptionModalVisible, setIsOptionModalVisible] = useState(false); // 옵션 모달
  const [selectedItem, setSelectedItem] = useState<FileEntry | null>(null); // 선택된 파일/폴더
  const [isSearchModalVisible, setIsSearchModalVisible] = useState(false); // 검색 모달

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
   * 파일 트리에서 특정 항목 제거 (로컬 상태 업데이트)
   * 삭제 시 서버 재요청 없이 부드럽게 제거
   */
  const removeFromFileTree = useCallback(
    (items: FileEntry[], targetPath: string): FileEntry[] => {
      return items
        .filter((item) => item.path !== targetPath)
        .map((item) => {
          if (item.children && item.children.length > 0) {
            return {
              ...item,
              children: removeFromFileTree(item.children, targetPath),
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
   * - expandedPaths에 펼침 상태 저장 (새로고침 후 복원용)
   */
  const handleFolderPress = useCallback(
    (item: FileEntry) => {
      if (item.isExpanded) {
        // 접기: 로컬 상태만 업데이트 + expandedPaths에서 제거
        // LayoutAnimation으로 부드러운 전환
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFiles((prev) => updateFileTree(prev, item.path, [], false));
        expandedPathsRef.current.delete(item.relativePath); // ref도 업데이트
        setExpandedPaths((prev) => {
          const next = new Set(prev);
          next.delete(item.relativePath);
          return next;
        });
      } else {
        // 펼치기: 서버에 하위 내용 요청 + expandedPaths에 추가
        setFiles((prev) => setFolderLoading(prev, item.path, true));
        expandedPathsRef.current.add(item.relativePath); // ref도 업데이트
        setExpandedPaths((prev) => new Set(prev).add(item.relativePath));
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
   * 검색 결과에서 파일 클릭 → 파일 뷰어로 이동
   */
  const handleSearchFilePress = useCallback(
    (relativePath: string, fileName: string) => {
      navigation.navigate('FileViewer', {
        filePath: relativePath,
        fileName,
      });
    },
    [navigation]
  );

  /**
   * 검색 결과에서 폴더 클릭 → 해당 폴더까지 자동 펼침
   * 경로의 모든 상위 폴더를 expandedPaths에 추가하면
   * 기존 file_tree 리스너의 체인 펼침 로직이 자동으로 처리
   *
   * 예: "src/screens" 클릭 시
   *   → expandedPaths에 "src", "src/screens" 추가
   *   → 루트 새로고침 → src 자동 펼침 → src/screens 자동 펼침
   */
  const handleSearchFolderPress = useCallback(
    (relativePath: string) => {
      // Windows(\)와 Unix(/) 경로 구분자 모두 처리
      // "src\screens\auth" 또는 "src/screens/auth"
      //   → ["src", "src\screens", "src\screens\auth"] (원본 구분자 유지)
      const separator = relativePath.includes('\\') ? '\\' : '/';
      const parts = relativePath.split(separator);
      const pathsToExpand: string[] = [];
      for (let i = 0; i < parts.length; i++) {
        pathsToExpand.push(parts.slice(0, i + 1).join(separator));
      }

      // expandedPaths에 일괄 추가
      pathsToExpand.forEach((p) => expandedPathsRef.current.add(p));
      setExpandedPaths((prev) => {
        const next = new Set(prev);
        pathsToExpand.forEach((p) => next.add(p));
        return next;
      });

      // 루트부터 새로고침 → 체인 반응으로 자동 펼침
      setRootPath('');
      rootPathRef.current = '';
      requestFileTree();
    },
    [requestFileTree]
  );

  /**
   * 새로고침 핸들러
   * rootPath 초기화 → useEffect 재실행 → requestFileTree 자동 호출
   */
  const handleRefresh = useCallback(() => {
    // setFiles([]) 제거 - 화면 깜빡임 방지 (새 데이터가 오면 자동 교체됨)
    setRootPath('');
    rootPathRef.current = ''; // ref도 초기화 (첫 로드로 인식되도록)
    setError(null);
    requestFileTree(); // 명시적으로 파일 트리 요청
  }, [requestFileTree]);

  /**
   * 특정 폴더만 새로고침 (부분 업데이트)
   * 전체 트리 대신 해당 폴더 내용만 다시 로드하여 깜빡임 최소화
   * @param folderPath - 새로고침할 폴더 경로 (빈 문자열 = 루트)
   */
  const refreshFolder = useCallback((folderPath: string) => {
    if (!folderPath) {
      // 루트 폴더: 전체 새로고침
      handleRefresh();
    } else {
      // 하위 폴더: 해당 폴더만 다시 요청
      socketService.emit('get_file_tree', { path: folderPath });
    }
  }, [handleRefresh]);

  /**
   * + 버튼 클릭 핸들러 (루트에 생성)
   * 파일/폴더 중 선택
   */
  const handleAddPress = useCallback(() => {
    Alert.alert('새로 만들기 (루트)', '무엇을 만드시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '📁 폴더',
        onPress: () => {
          setCreateType('folder');
          setCreatePath(''); // 루트에 생성
          setNewItemName('');
          setIsCreateModalVisible(true);
        },
      },
      {
        text: '📄 파일',
        onPress: () => {
          setCreateType('file');
          setCreatePath(''); // 루트에 생성
          setNewItemName('');
          setIsCreateModalVisible(true);
        },
      },
    ]);
  }, []);

  /**
   * 특정 폴더에 새로 만들기
   */
  const handleCreateInFolder = useCallback((folder: FileEntry) => {
    Alert.alert(`📁 ${folder.name}`, '무엇을 만드시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '📁 폴더',
        onPress: () => {
          setCreateType('folder');
          setCreatePath(folder.relativePath); // 선택한 폴더에 생성
          setNewItemName('');
          setIsCreateModalVisible(true);
        },
      },
      {
        text: '📄 파일',
        onPress: () => {
          setCreateType('file');
          setCreatePath(folder.relativePath); // 선택한 폴더에 생성
          setNewItemName('');
          setIsCreateModalVisible(true);
        },
      },
    ]);
  }, []);

  /**
   * 파일/폴더 생성 핸들러
   */
  const handleCreate = useCallback(async () => {
    const name = newItemName.trim();
    if (!name) {
      Alert.alert('오류', '이름을 입력해주세요');
      return;
    }

    // 경로 조합: createPath가 있으면 그 안에 생성, 없으면 루트
    const fullPath = createPath ? `${createPath}/${name}` : name;
    const targetFolder = createPath; // 생성 위치 저장 (부분 새로고침용)

    const result = await socketService.createFile(fullPath, createType === 'folder');
    if (result.success) {
      setIsCreateModalVisible(false);
      setNewItemName('');
      setCreatePath('');
      // 부분 새로고침: 생성된 폴더만 새로고침
      refreshFolder(targetFolder);
    } else {
      Alert.alert('오류', result.error?.message || '생성에 실패했습니다');
    }
  }, [newItemName, createType, createPath, refreshFolder]);

  /**
   * 삭제 확인 핸들러
   */
  const confirmDelete = useCallback((item: FileEntry) => {
    const typeText = item.isDirectory ? '폴더' : '파일';

    Alert.alert(
      '삭제 확인',
      `"${item.name}" ${typeText}을(를) 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            const result = await socketService.deleteFile(item.relativePath);
            if (result.success) {
              // 로컬에서 직접 제거 (서버 재요청 없이 부드럽게)
              LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
              setFiles((prev) => removeFromFileTree(prev, item.path));
              // expandedPaths에서도 제거 (폴더인 경우)
              if (item.isDirectory) {
                expandedPathsRef.current.delete(item.relativePath);
                setExpandedPaths((prev) => {
                  const next = new Set(prev);
                  next.delete(item.relativePath);
                  return next;
                });
              }
            } else {
              Alert.alert('오류', result.error?.message || '삭제에 실패했습니다');
            }
          },
        },
      ]
    );
  }, [removeFromFileTree]);

  /**
   * 길게 누르기 핸들러 (파일 관리 메뉴)
   * Android Alert는 3개 버튼 제한이 있어서 커스텀 모달 사용
   */
  const handleLongPress = useCallback((item: FileEntry) => {
    setSelectedItem(item);
    setIsOptionModalVisible(true);
  }, []);

  /**
   * 옵션 모달에서 "여기에 새로 만들기" 선택
   */
  const handleOptionCreateInFolder = useCallback(() => {
    if (!selectedItem) return;
    setIsOptionModalVisible(false);
    handleCreateInFolder(selectedItem);
  }, [selectedItem, handleCreateInFolder]);

  /**
   * 옵션 모달에서 "이름 변경" 선택
   */
  const handleOptionRename = useCallback(() => {
    if (!selectedItem) return;
    setIsOptionModalVisible(false);
    setRenameTarget(selectedItem);
    setNewItemName(selectedItem.name);
    setIsRenameModalVisible(true);
  }, [selectedItem]);

  /**
   * 옵션 모달에서 "삭제" 선택
   */
  const handleOptionDelete = useCallback(() => {
    if (!selectedItem) return;
    setIsOptionModalVisible(false);
    confirmDelete(selectedItem);
  }, [selectedItem, confirmDelete]);

  /**
   * 이름 변경 핸들러
   */
  const handleRename = useCallback(async () => {
    const name = newItemName.trim();
    if (!name || !renameTarget) {
      Alert.alert('오류', '새 이름을 입력해주세요');
      return;
    }

    if (name === renameTarget.name) {
      setIsRenameModalVisible(false);
      return;
    }

    // 부모 폴더 경로 계산
    const parentPath = renameTarget.relativePath.includes('/')
      ? renameTarget.relativePath.substring(0, renameTarget.relativePath.lastIndexOf('/'))
      : '';

    const result = await socketService.renameFile(renameTarget.relativePath, name);
    if (result.success) {
      setIsRenameModalVisible(false);
      setRenameTarget(null);
      setNewItemName('');
      // 부분 새로고침: 부모 폴더만 새로고침
      refreshFolder(parentPath);
    } else {
      Alert.alert('오류', result.error?.message || '이름 변경에 실패했습니다');
    }
  }, [newItemName, renameTarget, refreshFolder]);

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

        // rootPathRef를 사용하여 첫 로드인지 확인 (의존성 문제 해결)
        if (!rootPathRef.current) {
          // 첫 로드: 루트 경로 저장 및 전체 트리 설정
          rootPathRef.current = data.path;
          setRootPath(data.path);
          // LayoutAnimation으로 부드러운 전환
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setFiles(data.children);

          // 펼침 상태 복원: expandedPathsRef에 있는 폴더 자동 펼치기
          data.children.forEach((child) => {
            if (child.isDirectory && expandedPathsRef.current.has(child.relativePath)) {
              socketService.emit('get_file_tree', { path: child.relativePath });
            }
          });
        } else {
          // 하위 폴더 로드: 트리에 병합
          const targetPath = data.path;
          // LayoutAnimation으로 부드러운 전환
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setFiles((prev) =>
            updateFileTree(prev, targetPath, data.children, true)
          );

          // 펼침 상태 복원: 하위 폴더 중 펼쳐야 할 것들 요청
          data.children.forEach((child) => {
            if (child.isDirectory && expandedPathsRef.current.has(child.relativePath)) {
              socketService.emit('get_file_tree', { path: child.relativePath });
            }
          });
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
  }, [isConnected, requestFileTree, updateFileTree]); // expandedPathsRef 사용으로 의존성 제거

  // 연결 안됨 상태
  if (!isConnected) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={styles.errorIcon}>🔌</Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>서버에 연결되지 않았습니다</Text>
      </View>
    );
  }

  // 로딩 상태
  if (isLoading && files.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>파일 트리 로딩 중...</Text>
      </View>
    );
  }

  // 에러 상태
  if (error && files.length === 0) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: colors.primary }]}
          onPress={handleRefresh}
        >
          <Text style={[styles.retryButtonText, { color: colors.textOnPrimary }]}>다시 시도</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: (StatusBar.currentHeight || 24) + 8, backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>📁 파일 탐색기</Text>
        <View style={styles.headerButtons}>
          <TouchableOpacity
            style={styles.searchButton}
            onPress={() => setIsSearchModalVisible(true)}
          >
            <Text style={styles.searchButtonText}>🔍</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.addButton} onPress={handleAddPress}>
            <Text style={styles.addButtonText}>➕</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.refreshButton} onPress={handleRefresh}>
            <Text style={styles.refreshButtonText}>🔄</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 현재 경로 표시 */}
      <View style={[styles.pathContainer, { backgroundColor: colors.surfaceTertiary, borderBottomColor: colors.border }]}>
        <Text style={[styles.pathLabel, { color: colors.primary }]}>경로:</Text>
        <Text style={[styles.pathText, { color: colors.textSecondary }]} numberOfLines={1}>
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
              onLongPress={handleLongPress}
            />
          ))
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>📭</Text>
            <Text style={[styles.emptyText, { color: colors.textTertiary }]}>파일이 없습니다</Text>
          </View>
        )}
      </ScrollView>

      {/* 생성 모달 */}
      <Modal
        visible={isCreateModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCreateModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.modalBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {createType === 'folder' ? '📁 새 폴더' : '📄 새 파일'}
            </Text>
            {createPath ? (
              <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>위치: {createPath}/</Text>
            ) : null}
            <TextInput
              style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="이름 입력"
              placeholderTextColor={colors.textTertiary}
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setIsCreateModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleCreate}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary, { color: colors.textOnPrimary }]}>
                  만들기
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 이름 변경 모달 */}
      <Modal
        visible={isRenameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsRenameModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.modalBackground }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>✏️ 이름 변경</Text>
            <TextInput
              style={[styles.modalInput, { borderColor: colors.border, color: colors.textPrimary }]}
              placeholder="새 이름 입력"
              placeholderTextColor={colors.textTertiary}
              value={newItemName}
              onChangeText={setNewItemName}
              autoFocus
              autoCapitalize="none"
              autoCorrect={false}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => setIsRenameModalVisible(false)}
              >
                <Text style={[styles.modalButtonText, { color: colors.textSecondary }]}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, { backgroundColor: colors.primary }]}
                onPress={handleRename}
              >
                <Text style={[styles.modalButtonText, styles.modalButtonTextPrimary, { color: colors.textOnPrimary }]}>
                  변경
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 검색 모달 */}
      <SearchModal
        visible={isSearchModalVisible}
        onClose={() => setIsSearchModalVisible(false)}
        onFilePress={handleSearchFilePress}
        onFolderPress={handleSearchFolderPress}
      />

      {/* 옵션 모달 (길게 누르기 메뉴) */}
      <Modal
        visible={isOptionModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOptionModalVisible(false)}
      >
        <TouchableOpacity
          style={[styles.modalOverlay, { backgroundColor: colors.modalOverlay }]}
          activeOpacity={1}
          onPress={() => setIsOptionModalVisible(false)}
        >
          <View style={[styles.optionModalContent, { backgroundColor: colors.modalBackground }]}>
            <Text style={[styles.optionModalTitle, { color: colors.textPrimary, borderBottomColor: colors.borderLight }]}>
              {selectedItem?.isDirectory ? '📁' : '📄'} {selectedItem?.name}
            </Text>

            {/* 폴더일 때만 "여기에 새로 만들기" 표시 */}
            {selectedItem?.isDirectory && (
              <TouchableOpacity
                style={[styles.optionItem, { borderBottomColor: colors.borderLight }]}
                onPress={handleOptionCreateInFolder}
              >
                <Text style={[styles.optionText, { color: colors.textPrimary }]}>➕ 여기에 새로 만들기</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.optionItem, { borderBottomColor: colors.borderLight }]}
              onPress={handleOptionRename}
            >
              <Text style={[styles.optionText, { color: colors.textPrimary }]}>✏️ 이름 변경</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionItem, { borderBottomColor: colors.borderLight }]}
              onPress={handleOptionDelete}
            >
              <Text style={[styles.optionText, { color: colors.danger }]}>
                🗑️ 삭제
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.optionItem, styles.optionItemCancel, { backgroundColor: colors.surfaceSecondary }]}
              onPress={() => setIsOptionModalVisible(false)}
            >
              <Text style={[styles.optionTextCancel, { color: colors.textSecondary }]}>취소</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
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
    borderBottomWidth: 1,
  },
  pathLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginRight: 8,
  },
  pathText: {
    flex: 1,
    fontSize: 12,
    fontFamily: 'monospace',
  },
  fileList: {
    flex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
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
  retryButtonText: {
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
  },
  // 헤더 버튼 그룹
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  searchButton: {
    padding: 8,
  },
  searchButtonText: {
    fontSize: 20,
  },
  addButton: {
    padding: 8,
  },
  addButtonText: {
    fontSize: 20,
  },
  // 모달 스타일
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 320,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  modalInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  modalButtonText: {
    fontSize: 16,
  },
  modalButtonTextPrimary: {
    fontWeight: '600',
  },
  // 옵션 모달 스타일
  optionModalContent: {
    borderRadius: 12,
    width: '100%',
    maxWidth: 300,
    overflow: 'hidden',
  },
  optionModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  optionItem: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
  },
  optionItemCancel: {
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: 16,
    textAlign: 'center',
  },
  optionTextCancel: {
    fontSize: 16,
    textAlign: 'center',
  },
});
