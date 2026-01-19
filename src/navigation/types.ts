/**
 * 네비게이션 타입 정의
 * React Navigation에서 타입 안전성을 위해 필요
 */

import type { FileChange } from '../types/changes';

/**
 * RootStack - 최상위 스택 네비게이터
 * 연결 화면과 메인 탭을 전환
 */
export type RootStackParamList = {
  Connection: undefined; // 파라미터 없음
  MainTabs: undefined; // 파라미터 없음
  FileViewer: {
    filePath: string; // 파일 경로 (상대 경로)
    fileName: string; // 파일 이름
  };
  ChangeDetail: {
    change: FileChange; // 변경 상세 정보
  };
};

/**
 * MainTabs - 하단 탭 네비게이터
 * 채팅, 파일, 변경사항, 설정 화면
 */
export type MainTabParamList = {
  Chat: undefined;
  Files: undefined;
  Changes: undefined;
  Settings: undefined;
};
