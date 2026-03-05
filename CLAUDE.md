# Claude Mobile Remote - 모바일 앱

## 프로젝트 구조
```
src/
├── screens/         # 화면 컴포넌트
├── components/      # 재사용 UI 컴포넌트
├── hooks/           # 커스텀 훅 (useConnection 등)
├── services/        # 서비스 (SocketService 등)
├── navigation/      # 네비게이션 설정
└── types/           # TypeScript 타입
```

## 개발 규칙
- 컴포넌트: PascalCase (ChatScreen.tsx)
- 훅: camelCase, use 접두사 (useConnection.tsx)
- 서비스: PascalCase (SocketService.ts)
- 한국어 주석 사용

## 작업 진행 방식
각 작업마다 아래 순서로 진행:
1. 코드 작성
2. 노션 정리 (📱 프론트엔드 설계 DB)
3. 사용자 이해 확인
4. 테스트 (필요시)
5. 다음 작업으로

## 노션 정리 템플릿
- 데이터베이스: 📱 프론트엔드 설계
- 스타일: events.gateway.ts (Part 3) 참고
- 필수 섹션: 코드 설명, "이게 뭐야?", "왜 필요해?", 전체 흐름, 핵심 정리

---

## 📋 개발 현황 (2026-02-25 기준)

### ✅ 완료된 기능
- [x] 연결 기능 (수동 연결, 연결 상태 표시, 자동 재연결)
- [x] 채팅 기능 (프롬프트 입력, 응답 스트리밍, 마크다운 렌더링)
- [x] 코드 블록 (구문 강조, 복사 버튼)
- [x] PC Agent (Claude CLI 실행, WebSocket 서버)
- [x] 파일 탐색기 (폴더 펼치기/접기, 파일 트리)
- [x] 코드 뷰어 (구문 강조, 줄 번호)
- [x] Diff 뷰어 (변경 목록, 전체 파일 + 하이라이트)
- [x] 변경 승인/거부 기능 (Promise 패턴)
- [x] 세션 종료 / 응답 중단 기능
- [x] 파일 관리 (파일/폴더 생성, 삭제, 이름변경, 컨텍스트 메뉴)
- [x] 파일 검색 (파일명/내용 검색, 결과에서 파일/폴더 이동)

### 📝 TODO (우선순위 순)

#### Phase 1 - MVP 완성
1. **설정 화면 완성**
   - [ ] 알림 설정 (응답 완료, 파일 변경, 에러)
   - [ ] 다크 모드 토글
   - [ ] 글꼴 크기 조절
   - [ ] PIN 코드 잠금

#### Phase 2 - 추가 기능
3. **QR 코드 연결**
   - [ ] PC Agent: QR 코드 생성 표시
   - [ ] 모바일: QR 스캐너 연동

4. **편의 기능**
   - [ ] 빠른 명령어 (자주 쓰는 프롬프트 저장)
   - [ ] 프롬프트 템플릿
   - [ ] 대화 히스토리 저장 (AsyncStorage)

#### Phase 3 - 배포
5. **PC Agent 개선**
   - [ ] 시스템 트레이 아이콘
   - [ ] Windows 인스톨러

6. **배포 준비**
   - [ ] 앱 아이콘 & 스플래시 화면
   - [ ] Google Play 등록

---

## 📁 참고 문서
- `docs/ROADMAP.md` - 전체 개발 로드맵
- `docs/FEATURES.md` - 기능 명세서
- `docs/SCREENS.md` - 화면 설계
