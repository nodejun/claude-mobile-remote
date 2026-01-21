/**
 * 파일 트리 아이템 컴포넌트
 * 파일/폴더를 표시하고 클릭 이벤트 처리
 */
import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import type { FileEntry } from '../types/file';

interface FileTreeItemProps {
  /** 파일/폴더 정보 */
  item: FileEntry;
  /** 들여쓰기 레벨 (0부터 시작) */
  level: number;
  /** 폴더 클릭 핸들러 */
  onFolderPress: (item: FileEntry) => void;
  /** 파일 클릭 핸들러 */
  onFilePress: (item: FileEntry) => void;
  /** 길게 누르기 핸들러 (파일 관리 메뉴용) */
  onLongPress?: (item: FileEntry) => void;
}

/**
 * 파일 확장자에 따른 아이콘 반환
 */
function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  const iconMap: Record<string, string> = {
    // 코드 파일
    ts: '📘',
    tsx: '⚛️',
    js: '📒',
    jsx: '⚛️',
    py: '🐍',
    java: '☕',
    go: '🐹',
    rs: '🦀',
    c: '🔵',
    cpp: '🔵',
    h: '📎',
    // 웹 파일
    html: '🌐',
    css: '🎨',
    scss: '🎨',
    // 데이터 파일
    json: '📋',
    yaml: '📋',
    yml: '📋',
    xml: '📋',
    // 문서 파일
    md: '📝',
    txt: '📄',
    pdf: '📕',
    // 이미지
    png: '🖼️',
    jpg: '🖼️',
    jpeg: '🖼️',
    gif: '🖼️',
    svg: '🎨',
    // 기타
    gitignore: '🔒',
    env: '🔐',
  };

  return iconMap[ext] || '📄';
}

function FileTreeItem({
  item,
  level,
  onFolderPress,
  onFilePress,
  onLongPress,
}: FileTreeItemProps) {
  // 폴더/파일 클릭 핸들러
  const handlePress = useCallback(() => {
    if (item.isDirectory) {
      onFolderPress(item);
    } else {
      onFilePress(item);
    }
  }, [item, onFolderPress, onFilePress]);

  // 들여쓰기 계산 (레벨당 16px)
  const paddingLeft = 12 + level * 16;

  // 아이콘 결정
  const icon = item.isDirectory
    ? item.isExpanded
      ? '📂'
      : '📁'
    : getFileIcon(item.name);

  // 펼침 화살표 (폴더만)
  const expandIcon = item.isDirectory
    ? item.isExpanded
      ? '▼'
      : '▶'
    : '  ';

  return (
    <View>
      <TouchableOpacity
        style={[styles.item, { paddingLeft }]}
        onPress={handlePress}
        onLongPress={() => onLongPress?.(item)}
        delayLongPress={500}
        activeOpacity={0.6}
      >
        {/* 펼침 화살표 */}
        <Text style={styles.expandIcon}>{expandIcon}</Text>

        {/* 파일/폴더 아이콘 */}
        <Text style={styles.icon}>{icon}</Text>

        {/* 파일/폴더 이름 */}
        <Text
          style={[styles.name, item.isDirectory && styles.directoryName]}
          numberOfLines={1}
        >
          {item.name}
        </Text>

        {/* 로딩 인디케이터 (폴더 로딩 중) */}
        {item.isLoading && (
          <ActivityIndicator size="small" color="#007AFF" style={styles.loader} />
        )}
      </TouchableOpacity>

      {/* 하위 아이템 (폴더가 펼쳐진 경우) */}
      {item.isDirectory && item.isExpanded && item.children && (
        <View>
          {item.children.map((child) => (
            <FileTreeItem
              key={child.path}
              item={child}
              level={level + 1}
              onFolderPress={onFolderPress}
              onFilePress={onFilePress}
              onLongPress={onLongPress}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingRight: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#fff',
  },
  expandIcon: {
    width: 20,
    fontSize: 10,
    color: '#666',
    textAlign: 'center',
  },
  icon: {
    fontSize: 18,
    marginRight: 8,
  },
  name: {
    flex: 1,
    fontSize: 15,
    color: '#333',
  },
  directoryName: {
    fontWeight: '500',
  },
  loader: {
    marginLeft: 8,
  },
});

// React.memo로 불필요한 리렌더링 방지
export default memo(FileTreeItem);
