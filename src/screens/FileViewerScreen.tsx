/**
 * 파일 뷰어 화면
 * 선택한 파일의 내용을 구문 강조와 함께 표시
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
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import CodeHighlighter from 'react-native-code-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

import type { RootStackParamList } from '../navigation/types';
import { socketService } from '../services';
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
    navigation.goBack();
  }, [navigation]);

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
        <View style={styles.languageBadge}>
          <Text style={styles.languageText}>{language}</Text>
        </View>
      </View>

      {/* 파일 정보 */}
      {fileInfo && (
        <View style={styles.infoContainer}>
          <Text style={styles.infoText}>
            📁 {filePath} • {formatFileSize(fileInfo.size)} • {formatDate(fileInfo.lastModified)}
          </Text>
        </View>
      )}

      {/* 코드 뷰어 */}
      <ScrollView style={styles.codeContainer} horizontal>
        <ScrollView style={styles.codeScroll}>
          <CodeHighlighter
            hljsStyle={atomOneDark}
            language={language}
            customStyle={styles.codeBlock}
            textStyle={styles.codeText}
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
  languageBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#007AFF',
    borderRadius: 4,
    marginLeft: 8,
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
