/**
 * 네비게이션 타입 정의
 * React Navigation에서 타입 안전성을 위해 필요
 */

/**
 * RootStack - 최상위 스택 네비게이터
 * 연결 화면과 메인 탭을 전환
 */
export type RootStackParamList = {
  Connection: undefined; // 파라미터 없음
  MainTabs: undefined; // 파라미터 없음
};

/**
 * MainTabs - 하단 탭 네비게이터
 * 채팅, 파일, 설정 화면
 */
export type MainTabParamList = {
  Chat: undefined;
  Files: undefined;
  Settings: undefined;
};
