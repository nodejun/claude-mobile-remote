/**
 * 파일 뷰어 화면
 * 선택한 파일의 내용을 구문 강조와 함께 표시
 * 편집 모드에서 파일 수정 및 저장 가능
 *
 * 새로운 편집 방식:
 * - TextInput의 내장 스크롤 기능 사용 (scrollEnabled={true})
 * - 드래그 = 스크롤, 탭 = 커서 위치 지정
 * - Android: softwareKeyboardLayoutMode="pan"으로 키보드 자동 처리
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
  TextInput,
  Alert,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import CodeHighlighter from 'react-native-code-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

import type { RootStackParamList } from '../navigation/types';
import { socketService, storageService } from '../services';
import type { FileContentResult } from '../types/file';

type Props = NativeStackScreenProps<RootStackParamList, 'FileViewer'>;

export default function FileViewerScreen({ navigation, route }: Props) {
  const { filePath, fileName } = route.params;

  // 파일 내용 상태
  const [content, setContent] = useState<string>('');
  const [language, setLanguage] = useState<string>('text');
  const [fileInfo, setFileInfo] = useState<{
    size: number;
    lastModified: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // 편집 모드 상태
  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const [editContent, setEditContent] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  // 커서 위치 (selection)
  const [selection, setSelection] = useState<{ start: number; end: number }>({ start: 0, end: 0 });

  // TextInput ref (포커스 제어용)
  const textInputRef = useRef<TextInput>(null);

  // 설정에서 불러온 글꼴 크기
  const [codeFontSize, setCodeFontSize] = useState<number>(13);

  // 설정에서 글꼴 크기 로드
  useEffect(() => {
    storageService.getSettings().then((settings) => {
      setCodeFontSize(settings.codeFontSize);
    });
  }, []);

  /**
   * 파일 크기 포맷팅
   */
  const formatFileSize = useCallback((bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }, []);

  /**
   * 날짜 포맷팅
   */
  const formatDate = useCallback((isoString: string): string => {
    const date = new Date(isoString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, []);

  // 파일 내용 요청
  useEffect(() => {
    setIsLoading(true);
    setError(null);

    // 파일 내용 요청
    socketService.emit('get_file_content', { filePath });

    // 응답 리스너 등록
    const unsubscribeContent = socketService.on<FileContentResult>(
      'file_content',
      (data) => {
        setIsLoading(false);
        setContent(data.content);
        setEditContent(data.content); // 편집용 내용도 초기화
        setLanguage(data.language);
        setFileInfo({
          size: data.size,
          lastModified: data.lastModified,
        });
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
      unsubscribeContent();
      unsubscribeError();
    };
  }, [filePath]);

  /**
   * 뒤로 가기 핸들러
   */
  const handleGoBack = useCallback(() => {
    // 편집 모드에서 변경사항이 있으면 확인
    if (isEditMode && editContent !== content) {
      Alert.alert(
        '변경사항 저장',
        '저장하지 않은 변경사항이 있습니다. 저장하지 않고 나가시겠습니까?',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '저장하지 않고 나가기',
            style: 'destructive',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } else {
      navigation.goBack();
    }
  }, [navigation, isEditMode, editContent, content]);

  /**
   * 편집 모드 시작
   */
  const handleStartEdit = useCallback(() => {
    setEditContent(content);
    setSelection({ start: 0, end: 0 }); // 커서를 맨 위로
    setIsEditMode(true);
  }, [content]);

  /**
   * 편집 취소
   */
  const handleCancelEdit = useCallback(() => {
    if (editContent !== content) {
      Alert.alert(
        '편집 취소',
        '변경사항이 저장되지 않습니다. 취소하시겠습니까?',
        [
          { text: '계속 편집', style: 'cancel' },
          {
            text: '취소',
            style: 'destructive',
            onPress: () => {
              setEditContent(content);
              setIsEditMode(false);
            },
          },
        ]
      );
    } else {
      setIsEditMode(false);
    }
  }, [editContent, content]);

  /**
   * 파일 저장
   */
  const handleSave = useCallback(async () => {
    setIsSaving(true);

    try {
      const result = await socketService.saveFile(filePath, editContent);

      if (result.success) {
        // 저장 성공: 원본 content 업데이트
        setContent(editContent);
        setIsEditMode(false);
        if (result.size) {
          setFileInfo((prev) =>
            prev
              ? { ...prev, size: result.size!, lastModified: new Date().toISOString() }
              : null
          );
        }
        Alert.alert('저장 완료', '파일이 저장되었습니다.');
      } else {
        Alert.alert('저장 실패', result.error || '파일 저장에 실패했습니다.');
      }
    } catch (err) {
      Alert.alert('저장 실패', '파일 저장 중 오류가 발생했습니다.');
    } finally {
      setIsSaving(false);
    }
  }, [filePath, editContent]);

  // 로딩 상태
  if (isLoading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>파일 로딩 중...</Text>
      </View>
    );
  }

  // 에러 상태
  if (error) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorIcon}>❌</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
          <Text style={styles.backButtonText}>돌아가기</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* 헤더 */}
      <View style={[styles.header, { paddingTop: (StatusBar.currentHeight || 24) + 8 }]}>
        <TouchableOpacity style={styles.backButtonSmall} onPress={handleGoBack}>
          <Text style={styles.backButtonSmallText}>← 뒤로</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {fileName}
        </Text>

        {/* 편집 모드에 따른 버튼 */}
        {isEditMode ? (
          <View style={styles.editButtons}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleCancelEdit}
              disabled={isSaving}
            >
              <Text style={styles.cancelButtonText}>✕ 취소</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.saveButton, isSaving && styles.saveButtonDisabled]}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.saveButtonText}>💾 저장</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.headerButtons}>
            <TouchableOpacity style={styles.editButton} onPress={handleStartEdit}>
              <Text style={styles.editButtonText}>✏️ 편집</Text>
            </TouchableOpacity>
            <View style={styles.languageBadge}>
              <Text style={styles.languageText}>{language}</Text>
            </View>
          </View>
        )}
      </View>

      {/* 파일 정보 */}
      {fileInfo && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            📁 {filePath} • {formatFileSize(fileInfo.size)} •{' '}
            {formatDate(fileInfo.lastModified)}
            {isEditMode && editContent !== content && (
              <Text style={styles.modifiedBadge}> • 수정됨</Text>
            )}
          </Text>
        </View>
      )}

      {/* 편집 모드: TextInput (Android: softwareKeyboardLayoutMode="pan"으로 키보드 처리) */}
      {isEditMode ? (
        <TextInput
          ref={textInputRef}
          style={[styles.editorTextInput, { fontSize: codeFontSize, lineHeight: codeFontSize * 1.54 }]}
          value={editContent}
          onChangeText={setEditContent}
          multiline
          scrollEnabled={true}
          selection={selection}
          onSelectionChange={(e) => setSelection(e.nativeEvent.selection)}
          autoCapitalize="none"
          autoCorrect={false}
          spellCheck={false}
          textAlignVertical="top"
          selectionColor="#007AFF"
          placeholder="코드를 입력하세요..."
          placeholderTextColor="#666"
        />
      ) : (
        <ScrollView style={styles.codeContainer} horizontal>
          <ScrollView style={styles.codeScroll}>
            <CodeHighlighter
              hljsStyle={atomOneDark}
              language={language}
              customStyle={styles.codeBlock}
              textStyle={[styles.codeText, { fontSize: codeFontSize }]}
              scrollViewProps={{
                horizontal: true,
                contentContainerStyle: {
                  minWidth: '100%',
                  flexGrow: 0,
                },
                style: {
                  flexGrow: 0,
                  flexShrink: 1,
                },
              }}
            >
              {content}
            </CodeHighlighter>
          </ScrollView>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1e1e1e',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e1e1e',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 12,
    backgroundColor: '#2d2d2d',
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  backButtonSmall: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginRight: 8,
  },
  backButtonSmallText: {
    fontSize: 14,
    color: '#007AFF',
    fontWeight: '500',
  },
  headerTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#404040',
    borderRadius: 4,
    marginRight: 8,
  },
  editButtonText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  editButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cancelButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#404040',
    borderRadius: 4,
    marginRight: 8,
  },
  cancelButtonText: {
    fontSize: 13,
    color: '#FF3B30',
    fontWeight: '500',
  },
  saveButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#34C759',
    borderRadius: 4,
    minWidth: 70,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#2a5a2e',
  },
  saveButtonText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
  },
  languageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#007AFF',
    borderRadius: 4,
  },
  languageText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
    textTransform: 'uppercase',
  },
  infoContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#252525',
    borderBottomWidth: 1,
    borderBottomColor: '#404040',
  },
  infoText: {
    fontSize: 11,
    color: '#888',
  },
  modifiedBadge: {
    color: '#FF9500',
    fontWeight: '600',
  },
  codeContainer: {
    flex: 1,
  },
  codeScroll: {
    flex: 1,
  },
  codeBlock: {
    padding: 12,
    margin: 0,
    backgroundColor: '#1e1e1e',
  },
  codeText: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  editorTextInput: {
    flex: 1,
    padding: 12,
    fontSize: 13,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    color: '#d4d4d4',
    lineHeight: 20,
    backgroundColor: '#1e1e1e',
    textAlignVertical: 'top',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#ccc',
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    color: '#ccc',
    textAlign: 'center',
    marginBottom: 16,
  },
  backButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
