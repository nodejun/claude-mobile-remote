/**
 * 파일 트리 아이템 컴포넌트
 * 파일/폴더를 표시하고 클릭 이벤트 처리
 * Feather 벡터 아이콘 사용
 */
import React, { memo, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import type { FileEntry } from '../types/file';
import { useTheme } from '../theme';

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

/** 파일 아이콘 정보 (이름 + 색상) */
interface FileIconInfo {
  name: string;
  color: string;
}

/**
 * 파일 확장자에 따른 Feather 아이콘 이름 + 색상 반환
 * VS Code 스타일로 파일 타입별 고유 색상 부여
 */
function getFileIcon(fileName: string): FileIconInfo {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';

  const iconMap: Record<string, FileIconInfo> = {
    // TypeScript (파랑)
    ts: { name: 'file-text', color: '#3178C6' },
    // React (시안)
    tsx: { name: 'code', color: '#61DAFB' },
    jsx: { name: 'code', color: '#61DAFB' },
    // JavaScript (노랑)
    js: { name: 'file-text', color: '#F0DB4F' },
    // Python (초록)
    py: { name: 'terminal', color: '#3776AB' },
    // Java/Go/Rust/C (각각 고유 색상)
    java: { name: 'coffee', color: '#E76F00' },
    go: { name: 'file-text', color: '#00ADD8' },
    rs: { name: 'cpu', color: '#CE422B' },
    c: { name: 'file-text', color: '#A8B9CC' },
    cpp: { name: 'file-text', color: '#649AD2' },
    h: { name: 'file-text', color: '#A8B9CC' },
    // 웹 파일
    html: { name: 'globe', color: '#E44D26' },
    css: { name: 'hash', color: '#A259FF' },
    scss: { name: 'hash', color: '#CD6799' },
    // 데이터/설정
    json: { name: 'settings', color: '#8C8C8C' },
    yaml: { name: 'settings', color: '#CB171E' },
    yml: { name: 'settings', color: '#CB171E' },
    xml: { name: 'file', color: '#8C8C8C' },
    // 문서
    md: { name: 'book-open', color: '#519ABA' },
    txt: { name: 'file-text', color: '#8C8C8C' },
    pdf: { name: 'book', color: '#E44D26' },
    // 이미지 (핑크)
    png: { name: 'image', color: '#FF6B9D' },
    jpg: { name: 'image', color: '#FF6B9D' },
    jpeg: { name: 'image', color: '#FF6B9D' },
    gif: { name: 'image', color: '#FF6B9D' },
    svg: { name: 'image', color: '#FFB13B' },
    // 환경/보안 (빨강)
    gitignore: { name: 'git-branch', color: '#E84D31' },
    env: { name: 'lock', color: '#E55B3C' },
    // 쉘 스크립트
    sh: { name: 'terminal', color: '#4EAA25' },
    bash: { name: 'terminal', color: '#4EAA25' },
    // 패키지
    lock: { name: 'package', color: '#8C8C8C' },
  };

  return iconMap[ext] || { name: 'file', color: '#8C8C8C' };
}

function FileTreeItem({
  item,
  level,
  onFolderPress,
  onFilePress,
  onLongPress,
}: FileTreeItemProps) {
  const { colors } = useTheme();

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

  // Feather 아이콘 정보 결정 (폴더/파일 구분)
  const fileIcon = item.isDirectory
    ? null
    : getFileIcon(item.name);
  const iconName = item.isDirectory
    ? (item.isExpanded ? 'folder-minus' : 'folder')
    : fileIcon!.name;
  const iconColor = item.isDirectory
    ? colors.primary
    : fileIcon!.color;

  return (
    <View>
      <TouchableOpacity
        style={[styles.item, { paddingLeft, borderBottomColor: colors.borderLight, backgroundColor: colors.surface }]}
        onPress={handlePress}
        onLongPress={() => onLongPress?.(item)}
        delayLongPress={500}
        activeOpacity={0.6}
      >
        {/* 펼침 화살표 (폴더만 표시, 파일은 빈 공간) */}
        {item.isDirectory ? (
          <Feather
            name={item.isExpanded ? 'chevron-down' : 'chevron-right'}
            size={14}
            color={colors.textSecondary}
            style={styles.expandIcon}
          />
        ) : (
          <View style={styles.expandIcon} />
        )}

        {/* 파일/폴더 아이콘 (Feather 벡터 아이콘) */}
        <Feather
          name={iconName as keyof typeof Feather.glyphMap}
          size={18}
          color={iconColor}
          style={{ marginRight: 8 }}
        />

        {/* 파일/폴더 이름 */}
        <Text
          style={[styles.name, { color: colors.textPrimary }, item.isDirectory && styles.directoryName]}
          numberOfLines={1}
        >
          {item.name}
        </Text>

        {/* 로딩 인디케이터 (폴더 로딩 중) */}
        {item.isLoading && (
          <ActivityIndicator size="small" color={colors.primary} style={styles.loader} />
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
  },
  expandIcon: {
    width: 20,
    textAlign: 'center',
  },
  name: {
    flex: 1,
    fontSize: 15,
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
