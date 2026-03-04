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
  // 배경/표면 — 따뜻한 크림/베이지 톤
  background: '#FAF9F6',
  surface: '#FFFFFF',
  surfaceSecondary: '#F3F0EA',
  surfaceTertiary: '#F0E8DA',

  // 텍스트 — 다크 브라운 계열
  textPrimary: '#2D2A26',
  textSecondary: '#6B6560',
  textTertiary: '#9C9590',
  textHeading: '#1F1C18',
  textOnPrimary: '#FFFFFF',

  // 테두리 — 웜 그레이
  border: '#E0DCD5',
  borderLight: '#EDE9E2',
  divider: '#E0DCD5',

  // 브랜드 — 앰버 브라운
  primary: '#C4783E',
  primaryLight: '#F5EDE4',
  success: '#5A9E6F',
  danger: '#D64545',
  warning: '#E8A838',

  // 채팅 — 앰버 버블
  chatUserBubble: '#C4783E',
  chatAssistantBubble: '#FFFFFF',
  chatInputBackground: '#F3F0EA',
  chatTimestamp: 'rgba(45, 42, 38, 0.4)',
  chatUserLabel: 'rgba(255, 255, 255, 0.85)',

  // 탭바 — 앰버 액센트
  tabBarBackground: '#FFFFFF',
  tabBarActive: '#C4783E',
  tabBarInactive: '#A09A93',
  tabBarBorder: '#E0DCD5',

  // 모달
  modalOverlay: 'rgba(0, 0, 0, 0.5)',
  modalBackground: '#FFFFFF',

  // 마크다운 — 웜 베이지 배경
  inlineCodeBackground: '#F3F0EA',
  inlineCodeText: '#C4783E',
  blockquoteBackground: '#F3F0EA',
  tableHeaderBackground: '#F3F0EA',
  tableBorder: '#E0DCD5',

  // 변경사항
  approveBackground: '#E8F0E8',
  approveText: '#3D7A4A',
  rejectBackground: '#F5E0E0',
  rejectText: '#C43A3A',

  // 상태
  statusConnecting: '#E8A838',
  statusConnected: '#5A9E6F',
  statusError: '#D64545',
  statusDisconnected: '#A09A93',

  // 그림자
  shadow: '#000000',
  shadowOpacity: 0.08,
};

// ─── 다크 팔레트 ────────────────────────────────────────

export const darkColors: ThemeColors = {
  // 배경/표면 — 웜 차콜 톤
  background: '#1A1915',
  surface: '#242219',
  surfaceSecondary: '#302D25',
  surfaceTertiary: '#2A2720',

  // 텍스트 — 웜 화이트 계열
  textPrimary: '#F0EDE6',
  textSecondary: '#B0AAA0',
  textTertiary: '#706B62',
  textHeading: '#F5F2EC',
  textOnPrimary: '#FFFFFF',

  // 테두리 — 웜 다크 그레이
  border: '#3D3A32',
  borderLight: '#302D25',
  divider: '#3D3A32',

  // 브랜드 — 밝은 앰버
  primary: '#D4920B',
  primaryLight: '#3D3020',
  success: '#5A9E6F',
  danger: '#D64545',
  warning: '#E8A838',

  // 채팅 — 앰버 버블
  chatUserBubble: '#D4920B',
  chatAssistantBubble: '#302D25',
  chatInputBackground: '#302D25',
  chatTimestamp: 'rgba(240, 237, 230, 0.4)',
  chatUserLabel: 'rgba(240, 237, 230, 0.7)',

  // 탭바 — 앰버 액센트
  tabBarBackground: '#242219',
  tabBarActive: '#D4920B',
  tabBarInactive: '#706B62',
  tabBarBorder: '#3D3A32',

  // 모달
  modalOverlay: 'rgba(0, 0, 0, 0.7)',
  modalBackground: '#302D25',

  // 마크다운 — 웜 다크 배경
  inlineCodeBackground: '#3D3A32',
  inlineCodeText: '#E8A838',
  blockquoteBackground: '#302D25',
  tableHeaderBackground: '#302D25',
  tableBorder: '#4A4640',

  // 변경사항
  approveBackground: '#1E3320',
  approveText: '#5A9E6F',
  rejectBackground: '#3A2020',
  rejectText: '#D64545',

  // 상태
  statusConnecting: '#E8A838',
  statusConnected: '#5A9E6F',
  statusError: '#D64545',
  statusDisconnected: '#706B62',

  // 그림자
  shadow: '#000000',
  shadowOpacity: 0.4,
};
