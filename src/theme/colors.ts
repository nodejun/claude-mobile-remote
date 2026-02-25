/**
 * 시맨틱 색상 토큰 정의
 * 라이트/다크 모드 팔레트
 *
 * 구조: flat 객체 + 도메인별 prefix
 * 예) background, surface (공통) / chatUserBubble (채팅 전용)
 */

// ─── 타입 정의 ──────────────────────────────────────────

export interface ThemeColors {
  // ═══ 기본 배경/표면 ═══
  /** 메인 배경 */
  background: string;
  /** 카드, 헤더, 입력 필드 배경 */
  surface: string;
  /** 보조 표면 (버튼 배경 등) */
  surfaceSecondary: string;
  /** 3차 표면 (경로 표시줄 등) */
  surfaceTertiary: string;

  // ═══ 텍스트 ═══
  /** 주 텍스트 */
  textPrimary: string;
  /** 부 텍스트 */
  textSecondary: string;
  /** 3차 텍스트, 플레이스홀더 */
  textTertiary: string;
  /** 제목 텍스트 */
  textHeading: string;
  /** 사용자 메시지 텍스트 (밝은 배경 위) */
  textOnPrimary: string;

  // ═══ 테두리/구분선 ═══
  /** 일반 테두리 */
  border: string;
  /** 가벼운 구분선 */
  borderLight: string;
  /** 섹션 구분선 */
  divider: string;

  // ═══ 브랜드/액센트 ═══
  /** 주 액센트 (버튼, 링크) */
  primary: string;
  /** 주 액센트 밝은 버전 */
  primaryLight: string;
  /** 성공/승인 */
  success: string;
  /** 위험/거부/에러 */
  danger: string;
  /** 경고 */
  warning: string;

  // ═══ 채팅 특화 ═══
  /** 사용자 메시지 버블 */
  chatUserBubble: string;
  /** AI 메시지 버블 */
  chatAssistantBubble: string;
  /** 입력창 배경 */
  chatInputBackground: string;
  /** 타임스탬프 */
  chatTimestamp: string;
  /** 사용자 라벨 */
  chatUserLabel: string;

  // ═══ 탭바/네비게이션 ═══
  /** 탭바 배경 */
  tabBarBackground: string;
  /** 활성 탭 아이콘 */
  tabBarActive: string;
  /** 비활성 탭 아이콘 */
  tabBarInactive: string;
  /** 탭바 상단 테두리 */
  tabBarBorder: string;

  // ═══ 모달 ═══
  /** 모달 배경 오버레이 */
  modalOverlay: string;
  /** 모달 컨텐츠 배경 */
  modalBackground: string;

  // ═══ 마크다운 특화 ═══
  /** 인라인 코드 배경 */
  inlineCodeBackground: string;
  /** 인라인 코드 텍스트 */
  inlineCodeText: string;
  /** 인용문 배경 */
  blockquoteBackground: string;
  /** 표 헤더 배경 */
  tableHeaderBackground: string;
  /** 표 테두리 */
  tableBorder: string;

  // ═══ 변경사항 특화 ═══
  /** 승인 버튼 배경 */
  approveBackground: string;
  /** 승인 텍스트 */
  approveText: string;
  /** 거부 버튼 배경 */
  rejectBackground: string;
  /** 거부 텍스트 */
  rejectText: string;

  // ═══ 상태 색상 ═══
  /** 연결 중 */
  statusConnecting: string;
  /** 연결됨 */
  statusConnected: string;
  /** 에러 */
  statusError: string;
  /** 연결 안됨 */
  statusDisconnected: string;

  // ═══ 그림자 ═══
  /** 그림자 색 */
  shadow: string;
  /** 그림자 불투명도 */
  shadowOpacity: number;
}

// ─── 라이트 팔레트 ──────────────────────────────────────

export const lightColors: ThemeColors = {
  // 배경/표면
  background: '#f5f5f5',
  surface: '#ffffff',
  surfaceSecondary: '#f0f0f0',
  surfaceTertiary: '#e8f4ff',

  // 텍스트
  textPrimary: '#333333',
  textSecondary: '#666666',
  textTertiary: '#999999',
  textHeading: '#1a1a1a',
  textOnPrimary: '#ffffff',

  // 테두리
  border: '#e0e0e0',
  borderLight: '#f0f0f0',
  divider: '#e1e4e8',

  // 브랜드
  primary: '#007AFF',
  primaryLight: '#e8f4ff',
  success: '#34C759',
  danger: '#FF3B30',
  warning: '#FF9500',

  // 채팅
  chatUserBubble: '#007AFF',
  chatAssistantBubble: '#FFFFFF',
  chatInputBackground: '#F0F0F0',
  chatTimestamp: 'rgba(0, 0, 0, 0.4)',
  chatUserLabel: 'rgba(255, 255, 255, 0.8)',

  // 탭바
  tabBarBackground: '#FFFFFF',
  tabBarActive: '#007AFF',
  tabBarInactive: '#8E8E93',
  tabBarBorder: '#E5E5EA',

  // 모달
  modalOverlay: 'rgba(0, 0, 0, 0.5)',
  modalBackground: '#ffffff',

  // 마크다운
  inlineCodeBackground: '#f6f8fa',
  inlineCodeText: '#e01e5a',
  blockquoteBackground: '#f6f8fa',
  tableHeaderBackground: '#f6f8fa',
  tableBorder: '#e1e4e8',

  // 변경사항
  approveBackground: '#E8F5E9',
  approveText: '#2E7D32',
  rejectBackground: '#FFEBEE',
  rejectText: '#C62828',

  // 상태
  statusConnecting: '#FFA500',
  statusConnected: '#34C759',
  statusError: '#FF3B30',
  statusDisconnected: '#8E8E93',

  // 그림자
  shadow: '#000000',
  shadowOpacity: 0.05,
};

// ─── 다크 팔레트 ────────────────────────────────────────

export const darkColors: ThemeColors = {
  // 배경/표면
  background: '#121212',
  surface: '#1c1c1e',
  surfaceSecondary: '#2c2c2e',
  surfaceTertiary: '#1a2a3a',

  // 텍스트
  textPrimary: '#f5f5f5',
  textSecondary: '#ababab',
  textTertiary: '#636366',
  textHeading: '#ffffff',
  textOnPrimary: '#ffffff',

  // 테두리
  border: '#38383a',
  borderLight: '#2c2c2e',
  divider: '#38383a',

  // 브랜드
  primary: '#0A84FF',
  primaryLight: '#0a3d6b',
  success: '#30D158',
  danger: '#FF453A',
  warning: '#FF9F0A',

  // 채팅
  chatUserBubble: '#0A84FF',
  chatAssistantBubble: '#2c2c2e',
  chatInputBackground: '#2c2c2e',
  chatTimestamp: 'rgba(255, 255, 255, 0.4)',
  chatUserLabel: 'rgba(255, 255, 255, 0.7)',

  // 탭바
  tabBarBackground: '#1c1c1e',
  tabBarActive: '#0A84FF',
  tabBarInactive: '#636366',
  tabBarBorder: '#38383a',

  // 모달
  modalOverlay: 'rgba(0, 0, 0, 0.7)',
  modalBackground: '#2c2c2e',

  // 마크다운
  inlineCodeBackground: '#3a3a3c',
  inlineCodeText: '#ff6b8a',
  blockquoteBackground: '#2c2c2e',
  tableHeaderBackground: '#2c2c2e',
  tableBorder: '#48484a',

  // 변경사항
  approveBackground: '#1b3a1b',
  approveText: '#30D158',
  rejectBackground: '#3a1b1b',
  rejectText: '#FF453A',

  // 상태
  statusConnecting: '#FF9F0A',
  statusConnected: '#30D158',
  statusError: '#FF453A',
  statusDisconnected: '#636366',

  // 그림자
  shadow: '#000000',
  shadowOpacity: 0.4,
};
