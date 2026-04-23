# 진행 로그 — designer / chat-testroom

- 작성자: designer
- 기능: 실시간 채팅 Test Room
- 세션 일자: 2026-04-23

---

## 상태: 완료

모든 명세 파일 작성 완료. developer-frontend 착수 가능.

---

## 완료된 산출물

| 파일 | 내용 | 상태 |
|---|---|---|
| `docs/design/chat-testroom-flow.md` | 유저 플로우 + 화면별 와이어프레임 (4화면) | 완료 |
| `docs/design/chat-testroom-components.md` | 컴포넌트 명세 9개 (props, 상태, CSS 토큰, A11y) | 완료 |
| `docs/progress/designer-chat-testroom.md` | 본 진행 로그 | 완료 |

---

## 핵심 설계 결정 사항

### 1. 방 만들기 UI — 인라인 폼 (토글 방식)

- 모달 없이 목록 상단에 슬라이드 다운하는 인라인 폼으로 결정
- 근거: 단일 필드(방 이름) 입력 → 모달 오버엔지니어링, 모바일 키보드 UX, 기존 코드베이스 모달 미사용
- 동작: `+ 방 만들기` 버튼 클릭 → 폼 표시 → 성공 시 즉시 `/dbgchat/{roomId}` 이동

### 2. 채팅방 레이아웃 — 전체 높이 flex column

- `height: 100svh; overflow: hidden` 페이지 구조
- 메시지 영역: `flex: 1; overflow-y: auto`
- 입력창: `flex-shrink: 0` 하단 고정
- NormalHeader 가 fixed이므로 높이 spacer 위에 채팅방 헤더 추가

### 3. 접근 차단 — URL 유지, 리다이렉트 아님

- PRD 5-1 준수: USER 등급 차단 시 `/dbgchat` URL 유지하며 차단 페이지 렌더
- `FriendRoute` 컴포넌트: `AdminRoute` 패턴 재사용, FRIEND/ADMIN 통과

### 4. Test Lab 카드 — 비로그인 시 전체 숨김

- PRD 5-2 권장사항 수용: 비로그인 시 Test Lab 카드 자체를 렌더하지 않음
- USER 등급 로그인 시는 카드 표시 (클릭 후 라우트 가드에서 처리)

### 5. 자동 스크롤 정책

- 이미 맨 아래(100px 이내)일 때만 자동 스크롤
- 위로 스크롤 중이면 `↓ 새 메시지 N개` 배지 표시
- 히스토리 최초 로딩 후 항상 맨 아래 이동

### 6. 내 메시지 버블 색상 주의

- `#aa3bff` (accent) 배경에 white 텍스트가 WCAG AA (4.5:1) 기준 경계값
- 구현 시 실제 대비비 측정 후 미달 시 `#9333ea` 로 조정 필요

---

## PRD 참조 범위

- PRD `docs/specs/chat-testroom.md` r2 기준 전체 반영
- 모드: 일반 모드만 (Excel 모드 미적용 — PRD 2장 확인)
- 등급명 노출 금지 정책: 차단 페이지, 에러 메시지 전부 준수

---

## 다음 단계

- developer-frontend: `docs/design/chat-testroom-flow.md` + `docs/design/chat-testroom-components.md` 참조하여 구현
- developer-backend: `docs/specs/chat-testroom.md` 7장 API 스펙대로 구현 (별도 진행)
- qa-tester: PRD 8장 에러 시나리오 EC-1~EC-18 기반 테스트 플랜 작성
