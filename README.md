# Claude Mobile Remote

> 모바일에서 PC의 Claude Code를 원격으로 제어하는 앱

## 프로젝트 개요

### 문제점
- 기존 원격 데스크톱(Chrome Remote Desktop, TeamViewer)으로 PC 접속 가능
- 하지만 **모바일 UI가 불편함**: 글씨 작음, 터치 조작 어려움, 데이터 많이 사용

### 솔루션
- 모바일에 최적화된 UI로 프롬프트 작성
- PC의 Claude Code에 텍스트만 전송 (화면 스트리밍 X)
- 결과를 모바일 친화적으로 표시

### 타겟 사용자
- 이미 PC에서 Claude Code를 사용하는 개발자
- 이동 중에도 코딩 작업을 이어가고 싶은 사람
- 침대/소파에서 편하게 AI와 대화하며 개발하고 싶은 사람

---

## 핵심 가치

| 기존 원격 데스크톱 | Claude Mobile Remote |
|-------------------|---------------------|
| 전체 화면 스트리밍 (무거움) | 텍스트만 전송 (가벼움) |
| 작은 글씨, 확대 필요 | 모바일 최적화 UI |
| 마우스 조작 어색 | 터치 네이티브 |
| 데이터 많이 사용 | 최소 데이터 |
| 배터리 빨리 닳음 | 효율적 |

---

## 기술 스택

### 모바일 앱 (Mobile App)
- **프레임워크**: React Native + Expo
- **언어**: TypeScript
- **상태관리**: React Context 또는 Zustand
- **통신**: WebSocket (socket.io-client)

### PC 에이전트 (PC Agent)
- **런타임**: Node.js
- **언어**: TypeScript
- **통신**: WebSocket (socket.io)
- **CLI 제어**: child_process (spawn)

### 통신 프로토콜
- WebSocket (실시간 양방향 통신)
- JSON 메시지 포맷

---

## 시스템 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                         네트워크                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────┐              ┌──────────────────┐         │
│  │   📱 모바일 앱    │              │   🖥️ PC Agent    │         │
│  │  (React Native)  │◄────────────►│    (Node.js)     │         │
│  │                  │  WebSocket   │                  │         │
│  ├──────────────────┤              ├──────────────────┤         │
│  │ • 프롬프트 입력   │              │ • Claude Code    │         │
│  │ • 마크다운 렌더링 │              │   CLI 실행       │         │
│  │ • 대화 히스토리   │              │ • 출력 스트리밍   │         │
│  │ • 코드 하이라이팅 │              │ • 세션 관리      │         │
│  │ • 연결 상태 표시  │              │ • 파일 변경 알림  │         │
│  └──────────────────┘              └────────┬─────────┘         │
│                                             │                   │
│                                    ┌────────▼─────────┐         │
│                                    │  Claude Code CLI │         │
│                                    │  (기존 설치된 것)  │         │
│                                    └──────────────────┘         │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 프로젝트 구조

```
claude-mobile-remote/
├── README.md                 # 프로젝트 개요 (이 파일)
├── docs/
│   ├── FEATURES.md          # 기능 명세서
│   ├── SCREENS.md           # 화면 설계
│   ├── ROADMAP.md           # 개발 로드맵
│   └── FRONTEND-DESIGN.md   # 프론트엔드 설계 (상태관리, 컴포넌트)
│
├── mobile-app/              # React Native 앱 (Expo)
│   ├── src/
│   │   ├── components/      # UI 컴포넌트
│   │   ├── screens/         # 화면들
│   │   ├── services/        # WebSocket 통신 등
│   │   ├── hooks/           # 커스텀 훅
│   │   └── types/           # TypeScript 타입
│   └── package.json
│
└── pc-agent/                # Node.js PC 에이전트
    ├── src/
    │   ├── server.ts        # WebSocket 서버
    │   ├── claude-cli.ts    # Claude Code CLI 제어
    │   └── types/           # TypeScript 타입
    └── package.json
```

---

## 개발 환경 요구사항

### 모바일 앱 개발
- Node.js 18+
- Expo CLI
- iOS: Xcode (Mac 필요) 또는 Expo Go 앱으로 테스트
- Android: Android Studio 또는 Expo Go 앱으로 테스트

### PC Agent 개발
- Node.js 18+
- Claude Code CLI 설치 및 로그인 완료

---

## 라이센스

MIT License
