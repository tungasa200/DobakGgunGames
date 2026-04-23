# Progress — developer-frontend — chat-testroom

- 작성자: developer-frontend
- 최초 작성일: 2026-04-23
- 기준 PRD: `docs/specs/chat-testroom.md` r2

---

## 상태: QA 버그 수정 완료 (2026-04-23)

---

## 1. 구현 완료 파일 목록

### 신규 파일

| 파일 | 역할 |
|---|---|
| `frontend/src/api/chat.ts` | REST API 래퍼 (getRooms / createRoom / getHistory / deleteRoom) |
| `frontend/src/lib/stompClient.ts` | STOMP 클라이언트 팩토리 (SockJS + 재연결 3회 + 지수 백오프) |
| `frontend/src/types/sockjs-client.d.ts` | sockjs-client 패키지 설치 전 tsc 통과용 타입 선언 |
| `frontend/src/types/stomp.d.ts` | @stomp/stompjs 패키지 설치 전 tsc 통과용 타입 선언 |
| `frontend/src/components/guards/FriendRoute.tsx` | FRIEND/ADMIN 라우트 가드 + 차단 페이지 인라인 |
| `frontend/src/components/guards/FriendRoute.module.css` | 차단 페이지 스타일 |
| `frontend/src/components/chat/ConnectionStatus.tsx` | 연결 상태 배지 (4가지 상태, 점멸 애니메이션) |
| `frontend/src/components/chat/ConnectionStatus.module.css` | |
| `frontend/src/components/chat/CreateRoomForm.tsx` | 방 만들기 폼 (유효성 검사 + 서버 에러 인라인) |
| `frontend/src/components/chat/CreateRoomForm.module.css` | |
| `frontend/src/components/chat/ChatRoomCard.tsx` | 방 카드 (상대 시간, 호버 스타일) |
| `frontend/src/components/chat/ChatRoomCard.module.css` | |
| `frontend/src/components/chat/ChatRoomList.tsx` | 방 목록 ul/li 래퍼 |
| `frontend/src/components/chat/ChatRoomList.module.css` | |
| `frontend/src/components/chat/ChatMessage.tsx` | 개별 메시지 버블 (CHAT/SYSTEM, 내/타인 구분) |
| `frontend/src/components/chat/ChatMessage.module.css` | |
| `frontend/src/components/chat/ChatMessageList.tsx` | 메시지 목록 (자동스크롤 + 날짜구분선 + 새메시지배지 + 스켈레톤) |
| `frontend/src/components/chat/ChatMessageList.module.css` | |
| `frontend/src/components/chat/ChatInput.tsx` | 입력창 (200자 제한, Enter전송, 자동높이, 서버에러 3초) |
| `frontend/src/components/chat/ChatInput.module.css` | |
| `frontend/src/pages/DbgChatListPage.tsx` | 방 목록 페이지 (스켈레톤/에러/빈상태/degraded 처리) |
| `frontend/src/pages/DbgChatListPage.module.css` | |
| `frontend/src/pages/DbgChatRoomPage.tsx` | 채팅방 페이지 (히스토리→STOMP 순서, 언마운트 disconnect) |
| `frontend/src/pages/DbgChatRoomPage.module.css` | |

### 수정 파일

| 파일 | 변경 내용 |
|---|---|
| `frontend/src/App.tsx` | `/dbgchat`, `/dbgchat/:roomId` 라우트 추가 + FriendRoute 가드 적용 |
| `frontend/src/pages/HomePage.tsx` | Test Lab 빈 카드 → user 조건부 렌더 + "💬 실시간 채팅 랩" 버튼 추가 |
| `frontend/package.json` | @stomp/stompjs, sockjs-client 의존성 추가 |
| `frontend/vite.config.ts` | optimizeDeps.include sockjs-client, /ws 프록시 추가 |

---

## 2. 사용자 필수 액션 (코드 머지 전)

### 2-1. npm install (반드시 먼저)

```bash
cd frontend
npm install
```

`package.json`에 아래 패키지가 추가됨:
- `@stomp/stompjs@^7.1.1`
- `sockjs-client@^1.6.1`
- `@types/sockjs-client@^1.5.4` (devDependencies)

npm install 완료 후 `src/types/stomp.d.ts`, `src/types/sockjs-client.d.ts` 는 실제 패키지 타입으로 대체됩니다. 두 파일을 삭제해도 됩니다.

### 2-2. Vercel 환경변수 추가

| 변수명 | 추가 위치 | 값 형식 |
|---|---|---|
| `VITE_WS_URL` | Vercel 대시보드 > 프로젝트 설정 > Environment Variables | `wss://[백엔드 도메인]/ws` (예: `wss://api.dobakggun.com/ws`) |

로컬 개발 시 `.env.local`에 `VITE_WS_URL=http://localhost:8080/ws` 추가 권장.

### 2-3. tsc + eslint 통과 확인

```bash
cd frontend && npx tsc -b && npx eslint .
```

---

## 3. 설계 결정 사항

- **newMessageCount 관리**: 페이지가 아닌 ChatMessageList 내부에서 완전히 관리. isNearBottomRef도 내부화.
- **STOMP 재연결**: onDisconnect/onStompError/onWebSocketError 모두 attemptReconnect 호출. reconnectDelay=0으로 수동 관리. 지수 백오프: 2s/4s/8s.
- **히스토리 404**: ChatApiError.status === 404 감지 시 즉시 /dbgchat navigate.
- **방 삭제 감지**: SYSTEM 메시지 "채팅방이 종료되었습니다." + /user/queue/errors의 ROOM_NOT_FOUND / ROOM_DELETED / FORBIDDEN 모두 onRoomDeleted 콜백.
- **내 메시지 색상**: `#9333ea` 사용 (WCAG AA 기준 `#aa3bff` 대비비 미달 우려로 designer 명세 권장에 따라 더 진한 보라 사용).

---

## 4. 완료된 것

- PRD r2, UX 플로우 명세, 컴포넌트 명세 전문 분석
- 전체 파일 구현 (신규 24개, 수정 4개)
- 디자인 명세 레이아웃 CSS 적용
- 접근성(aria-label, aria-live, role 등) 적용
- 키보드 인터랙션 (Enter전송, Shift+Enter줄바꿈, Escape폼닫기) 적용
- **[QA 버그 수정 — 2026-04-23]**
  - `FriendRoute.tsx`: 블랙리스트 방식(`USER` 차단) → 화이트리스트 방식(`FRIEND`, `ADMIN` 허용) 변경. 미지 role 값 차단 누락 보안 버그 수정.
  - `DbgChatListPage.tsx`: `useLocation` 추가, navigate state의 `toast` 값 읽어 인라인 배너 표시. `window.history.replaceState({}, '')` 호출로 뒤로가기 시 반복 표시 방지.
  - `DbgChatListPage.module.css`: `.toastBanner` 스타일 추가 (초록 계열, degradedBanner와 시각적 구분).

## 5. 진행 중인 것

- 없음

## 6. 블로커 / 질문

- **npm install 미실행**: 사용자가 직접 `cd frontend && npm install` 실행 필요
- **VITE_WS_URL**: Vercel 대시보드에 추가 필요
- **백엔드 구현 여부 미확인**: 실제 STOMP 연결 테스트는 백엔드 구현 후 가능
- **기존 전체 lint 에러**: `ChatInput.tsx`, `ExcelShell.tsx`, `LoginPage.tsx` 등 이번 수정과 무관한 기존 에러 53개 존재 (이번 수정 파일에는 에러 없음)

## 7. 다음 세션에서 할 것

- npm install + tsc + eslint 통과 확인
- 필요 시 기존 lint 에러 일괄 수정 (별도 태스크)
- 백엔드 API 연동 후 통합 테스트
- types/stomp.d.ts, types/sockjs-client.d.ts 삭제 (실제 패키지 설치 후)
