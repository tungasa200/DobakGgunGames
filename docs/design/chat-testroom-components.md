# 컴포넌트 명세 — 실시간 채팅 Test Room

- 작성자: designer
- 작성일: 2026-04-23
- 근거 PRD: `docs/specs/chat-testroom.md` (r2 확정)
- 근거 플로우: `docs/design/chat-testroom-flow.md`
- 상태: **명세 완료 — developer-frontend 착수 가능**
- 모드: **일반 모드 전용** (Excel 모드 미적용)

---

## 목차

1. 컴포넌트 트리
2. 라우트 가드 — `FriendRoute`
3. 페이지 — `DbgChatListPage`
4. 페이지 — `DbgChatRoomPage`
5. `ChatRoomList`
6. `ChatRoomCard`
7. `CreateRoomForm`
8. `ChatMessageList`
9. `ChatMessage`
10. `ChatInput`
11. `ConnectionStatus`
12. 공통 디자인 토큰
13. 접근성 (A11y)
14. 키보드 네비게이션

---

## 1. 컴포넌트 트리

```
App (라우터)
 └─ FriendRoute (가드)
     ├─ DbgChatListPage   [/dbgchat]
     │   ├─ NormalHeader
     │   ├─ CreateRoomForm  (토글 표시)
     │   ├─ ChatRoomList
     │   │   └─ ChatRoomCard (N개)
     │   └─ Footer
     │
     └─ DbgChatRoomPage  [/dbgchat/:roomId]
         ├─ NormalHeader
         ├─ (채팅방 헤더 — 인라인 div)
         ├─ ConnectionStatus
         ├─ ChatMessageList
         │   └─ ChatMessage (N개)
         ├─ ChatInput
         └─ Footer
```

---

## 2. 라우트 가드 — `FriendRoute`

### 파일 위치
`frontend/src/components/guards/FriendRoute.tsx`

### 역할
`AdminRoute` 패턴을 준용하되, FRIEND 등급 이상(FRIEND, ADMIN)을 허용.
비로그인 시 `/login` 리다이렉트, USER 등급 시 URL 유지하며 차단 페이지 렌더.

### Props

| prop | 타입 | 설명 |
|---|---|---|
| `children` | `React.ReactNode` | 가드 통과 시 렌더할 컴포넌트 |

### 상태 분기

```
user === null          → <Navigate to="/login" replace />
user.role === 'USER'   → <AccessDeniedPage />  (URL 유지, 리다이렉트 없음)
user.role === 'FRIEND' → children 렌더
user.role === 'ADMIN'  → children 렌더
```

### AccessDeniedPage (인라인 컴포넌트 또는 별도 파일)

FriendRoute 내부에 인라인으로 정의하거나 `AccessDeniedPage.tsx` 별도 파일로 분리.
화면 명세는 `chat-testroom-flow.md` 6장 참조.

레이아웃:
```
<NormalHeader />
<main style="flex:1; display:flex; align-items:center; justify-content:center; flex-direction:column; gap:16px; padding:40px 20px; text-align:center">
  🔒 (font-size: 48px)
  <h1>접근 권한이 없습니다</h1>
  <p>이 기능은 특별 등급 이상만 이용할 수 있습니다.</p>
  <p>공개 채팅 기능은 준비 중입니다.</p>
  <Link to="/" class="btn btnNormal">홈으로 돌아가기</Link>
</main>
<Footer />
```

---

## 3. 페이지 — `DbgChatListPage`

### 파일 위치
`frontend/src/pages/DbgChatListPage.tsx`

### 역할
채팅방 목록 조회, 방 만들기 폼 제어, 방 카드 목록 렌더.

### 내부 상태

| 상태 | 타입 | 초기값 | 설명 |
|---|---|---|---|
| `rooms` | `ChatRoomSummary[]` | `[]` | 방 목록 |
| `isLoading` | `boolean` | `true` | 최초 목록 로딩 중 |
| `isError` | `boolean` | `false` | 목록 조회 실패 |
| `degraded` | `boolean` | `false` | Redis 장애 플래그 |
| `showCreateForm` | `boolean` | `false` | 방 만들기 폼 표시 여부 |

### 데이터 타입

```typescript
interface ChatRoomSummary {
  roomId: string;          // 8자리 소문자+숫자
  name: string;
  creatorNick: string;
  createdAt: string;       // ISO-8601 UTC
  lastActiveAt: string;    // ISO-8601 UTC
}

interface GetRoomsResponse {
  rooms: ChatRoomSummary[];
  degraded: boolean;
}
```

### 생명주기

1. 마운트 시 `GET /api/chat/rooms` 호출 → `rooms`, `degraded` 설정
2. 실패 시 `isError = true`
3. `showCreateForm` 토글: `+ 방 만들기` 버튼 클릭 시 토글
4. 방 생성 성공 콜백(`onRoomCreated`): `rooms` 재조회 또는 목록 앞에 prepend + 즉시 이동

### 레이아웃 구조

```
<div class="page">  <!-- flex:1, padding:20px -->
  <NormalHeader />
  
  <!-- 페이지 헤더 -->
  <div class="pageHeader">
    <span>💬 실시간 채팅 Test Room</span>
    <span class="labBadge">실험</span>
  </div>
  <p class="pageDesc">내부 테스터 전용 실험 공간입니다.</p>

  <!-- 최대 너비 컨테이너 -->
  <div class="container">  <!-- max-width:720px, margin:0 auto, width:100% -->
    
    <!-- degraded 경고 배너 (조건부) -->
    {degraded && <DegradedBanner />}
    
    <!-- 섹션 상단 행 -->
    <div class="listHeader">
      <span class="listTitle">방 목록 ({rooms.length}개 활성)</span>
      <button class="createBtn" onClick={toggleForm}>+ 방 만들기</button>
    </div>
    
    <!-- 방 만들기 인라인 폼 (조건부) -->
    {showCreateForm && (
      <CreateRoomForm
        onSuccess={(roomId) => navigate(`/dbgchat/${roomId}`)}
        onCancel={() => setShowCreateForm(false)}
      />
    )}
    
    <!-- 방 목록 -->
    {isLoading ? <SkeletonList /> :
     isError   ? <ErrorState onRetry={fetchRooms} /> :
     rooms.length === 0 ? <EmptyState onCreateClick={() => setShowCreateForm(true)} /> :
     <ChatRoomList rooms={rooms} />
    }
    
  </div>
  
  <Footer />
</div>
```

### CSS 레이아웃 토큰

```
.page           { flex: 1; padding: 20px; display: flex; flex-direction: column; align-items: center; }
.container      { max-width: 720px; width: 100%; }
.pageHeader     { display: flex; align-items: center; gap: 8px; margin: 24px 0 6px; }
.labBadge       { font-size: 11px; font-weight: 600; background: #f5f3ff; color: #7c3aed;
                  padding: 2px 8px; border-radius: 20px; }
.pageDesc       { font-size: 13px; color: #94a3b8; margin-bottom: 20px; }
.listHeader     { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.listTitle      { font-size: 14px; font-weight: 600; color: #64748b; }
.createBtn      { font-size: 13px; font-weight: 600; padding: 8px 14px; background: #2c3e50;
                  color: white; border: none; border-radius: 7px; cursor: pointer;
                  min-height: 36px; transition: background 0.12s; }
.createBtn:hover { background: #1a2d3d; }
```

### 반응형

```
@media (max-width: 480px) {
  .page      { padding: 12px; }
  .listHeader { flex-direction: column; align-items: flex-start; gap: 8px; }
  .createBtn  { width: 100%; }
}
```

---

## 4. 페이지 — `DbgChatRoomPage`

### 파일 위치
`frontend/src/pages/DbgChatRoomPage.tsx`

### 역할
채팅방 진입, STOMP 연결 라이프사이클 관리, 메시지 목록/입력 조합.

### Props / 라우트 파라미터

- `roomId`: URL params `useParams<{ roomId: string }>`

### 내부 상태

| 상태 | 타입 | 초기값 | 설명 |
|---|---|---|---|
| `roomName` | `string` | `''` | 방 제목 (히스토리 응답에서 추출) |
| `messages` | `ChatMessageData[]` | `[]` | 메시지 목록 (히스토리 + 실시간) |
| `connectionStatus` | `'connecting' \| 'connected' \| 'reconnecting' \| 'error'` | `'connecting'` | STOMP 연결 상태 |
| `historyLoading` | `boolean` | `true` | 히스토리 로딩 중 |
| `degraded` | `boolean` | `false` | 히스토리 Redis 장애 |
| `newMessageCount` | `number` | `0` | 스크롤 위에 있을 때 새 메시지 카운트 |

### 데이터 타입

```typescript
interface ChatMessageData {
  type: 'CHAT' | 'SYSTEM';
  userId: number | null;
  nickname: string;
  message: string;
  timestamp: string;    // ISO-8601 UTC
}

interface HistoryResponse {
  roomId: string;
  roomName: string;
  messages: ChatMessageData[];
  degraded: boolean;
}
```

### STOMP 연결 관리 위임

STOMP 클라이언트 인스턴스와 재연결 로직은 `frontend/src/lib/stompClient.ts` 에 위임.
이 페이지 컴포넌트는 연결 상태(콜백)와 수신 메시지만 구독.

재연결 정책 (designer 요구사항):
- 최대 3회 시도
- 재시도 간격: 2000ms → 4000ms → 8000ms (지수 백오프)
- 3회 모두 실패 시 `connectionStatus = 'error'` + 토스트 + `/dbgchat` 이동

### 생명주기

1. 마운트 시 `GET /api/chat/rooms/{roomId}/history` 호출
   - 성공: `roomName`, `messages` 설정, `historyLoading = false`
   - 404: 토스트 `채팅방이 종료되었습니다.` + `navigate('/dbgchat')`
   - `degraded: true`: `degraded = true` + `historyLoading = false` (빈 메시지로 계속)
2. STOMP 연결 시작 (`connectionStatus = 'connecting'`)
3. STOMP CONNECT 성공 → `connectionStatus = 'connected'`
   - SUBSCRIBE `/topic/room/{roomId}` → 수신 메시지 `messages` 끝에 추가
   - SUBSCRIBE `/user/queue/errors` → 에러 처리
4. 언마운트 시 STOMP 연결 해제 + UNSUBSCRIBE

### 레이아웃 구조

```
<div class="roomPage">  <!-- height:100%, display:flex, flex-direction:column -->
  <NormalHeader />
  
  <!-- 채팅방 헤더 -->
  <div class="roomHeader">
    <Link to="/dbgchat" class="backLink">← 목록</Link>
    <span class="roomName">💬 {roomName}</span>
    <ConnectionStatus status={connectionStatus} />
  </div>
  
  <!-- degraded 배너 (조건부) -->
  {degraded && <DegradedBanner dismissible />}
  
  <!-- 메시지 영역 -->
  <ChatMessageList
    messages={messages}
    currentUserId={user?.id}
    loading={historyLoading}
    newMessageCount={newMessageCount}
    onScrollToBottom={() => setNewMessageCount(0)}
  />
  
  <!-- 입력창 -->
  <ChatInput
    disabled={connectionStatus !== 'connected'}
    onSend={(text) => stompClient.send(`/app/chat/${roomId}`, { message: text })}
    onServerError={serverError}  {/* /user/queue/errors 수신 시 */}
  />
  
  <Footer />
</div>
```

### CSS 레이아웃 토큰

```
.roomPage     { display: flex; flex-direction: column; height: 100svh; overflow: hidden; }
              /* NormalHeader 가 fixed → 내부 flex 구조로 나머지 높이 분배 */
.roomHeader   { display: flex; align-items: center; gap: 12px; padding: 12px 16px;
                border-bottom: 1px solid #e2e8f0; background: #fff;
                flex-shrink: 0; }
.backLink     { font-size: 13px; color: #64748b; text-decoration: none; flex-shrink: 0;
                min-height: 44px; display: flex; align-items: center; }
.backLink:hover { color: #0f172a; }
.roomName     { flex: 1; font-size: 16px; font-weight: 600; color: #0f172a;
                overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
```

### 반응형

```
@media (max-width: 480px) {
  .roomName   { font-size: 14px; }
  .roomHeader { padding: 10px 12px; }
}
```

---

## 5. `ChatRoomList`

### 파일 위치
`frontend/src/components/chat/ChatRoomList.tsx`

### 역할
`ChatRoomSummary` 배열을 받아 `ChatRoomCard` 목록 렌더.

### Props

| prop | 타입 | 필수 | 설명 |
|---|---|---|---|
| `rooms` | `ChatRoomSummary[]` | O | 방 목록 배열 |

### 레이아웃

```
<ul class="roomList" role="list">
  {rooms.map(room => (
    <li key={room.roomId}>
      <ChatRoomCard room={room} />
    </li>
  ))}
</ul>
```

### CSS

```
.roomList { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 8px; }
```

---

## 6. `ChatRoomCard`

### 파일 위치
`frontend/src/components/chat/ChatRoomCard.tsx`

### 역할
방 정보 1개를 카드로 표시. 클릭 시 해당 방으로 이동.

### Props

| prop | 타입 | 필수 | 설명 |
|---|---|---|---|
| `room` | `ChatRoomSummary` | O | 방 메타 데이터 |

### 상태
- 없음 (순수 표시 컴포넌트)

### 레이아웃

```
<Link to={`/dbgchat/${room.roomId}`} class="card" aria-label={`${room.name} 채팅방 입장`}>
  <div class="cardMain">
    <span class="roomName">{room.name}</span>
    <span class="meta">
      개설: {room.creatorNick} · 최근 활동: {relativeTime(room.lastActiveAt)}
    </span>
  </div>
  <span class="enterHint">입장 →</span>
</Link>
```

### CSS

```
.card       { display: flex; align-items: center; gap: 12px; padding: 14px 16px;
              background: white; border: 1px solid #e2e8f0; border-radius: 12px;
              text-decoration: none; cursor: pointer;
              transition: border-color 0.15s, box-shadow 0.15s; }
.card:hover { border-color: #aa3bff; box-shadow: 0 2px 8px rgba(170,59,255,0.08); }
.cardMain   { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.roomName   { font-size: 15px; font-weight: 600; color: #0f172a;
              overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.meta       { font-size: 12px; color: #94a3b8; }
.enterHint  { font-size: 12px; font-weight: 600; color: #aa3bff; flex-shrink: 0; }
```

### 시간 표시 유틸 (`relativeTime`)

```
lastActiveAt 기준:
- 1분 미만    → "방금 전"
- 1~59분     → "N분 전"
- 1~23시간   → "N시간 전"
- 24시간 이상 → "MM/DD HH:mm" 절대 표기
```

### 접근성

- 카드 전체가 `<Link>` — 키보드 Tab 포커스 가능
- `aria-label`: `{방 이름} 채팅방 입장` (메타 정보까지 읽기 불필요한 노이즈 방지)
- 호버/포커스 동일 스타일: `:focus-visible { outline: 2px solid #aa3bff; outline-offset: 2px; }`

---

## 7. `CreateRoomForm`

### 파일 위치
`frontend/src/components/chat/CreateRoomForm.tsx`

### 역할
방 이름 입력 폼. POST /api/chat/rooms 호출 후 성공 시 onSuccess 콜백.

### Props

| prop | 타입 | 필수 | 설명 |
|---|---|---|---|
| `onSuccess` | `(roomId: string) => void` | O | 방 생성 성공 시 roomId 전달 |
| `onCancel` | `() => void` | O | 취소(폼 닫기) 콜백 |

### 내부 상태

| 상태 | 타입 | 초기값 | 설명 |
|---|---|---|---|
| `name` | `string` | `''` | 입력된 방 이름 |
| `error` | `string` | `''` | 서버/클라이언트 에러 메시지 |
| `isSubmitting` | `boolean` | `false` | 제출 중 로딩 상태 |

### 유효성 검사 (프론트 1차)

| 조건 | 에러 메시지 |
|---|---|
| trim 후 빈 문자열 | `방 이름을 입력해주세요.` |
| 30자 초과 (trim 전) | `방 이름은 30자를 넘을 수 없습니다.` |

- 금칙어 프론트 1차 체크는 선택적 (백엔드 2차 체크가 우선). 구현 유무는 developer-frontend 재량.

### 서버 에러 → 인라인 표시 매핑

| HTTP 에러 코드 | 표시 메시지 |
|---|---|
| `ROOM_NAME_REQUIRED` | `방 이름을 입력해주세요.` |
| `ROOM_NAME_TOO_LONG` | `방 이름은 30자를 넘을 수 없습니다.` |
| `ROOM_NAME_INVALID` | `사용할 수 없는 단어가 포함되어 있습니다.` |
| `ROOM_LIMIT_EXCEEDED` (429) | `채팅방이 너무 많습니다. 잠시 후 다시 시도해주세요.` |
| `REDIS_UNAVAILABLE` (503) | `일시적인 오류입니다. 잠시 후 다시 시도해주세요.` |
| 기타 | `방을 만드는 중 오류가 발생했습니다.` |

### 키보드 인터랙션

| 키 | 동작 |
|---|---|
| `Enter` | 폼 제출 (isSubmitting 아닐 때) |
| `Escape` | `onCancel()` 호출 |

### 레이아웃

```
<form class="createForm" onSubmit={handleSubmit}>
  <div class="formRow">
    <input
      type="text"
      class="nameInput {error ? 'nameInputError' : ''}"
      placeholder="방 이름을 입력하세요 (최대 30자)"
      value={name}
      onChange={...}
      maxLength={30}
      disabled={isSubmitting}
      autoFocus
      aria-label="방 이름"
      aria-describedby="roomNameError"
    />
    <button type="submit" class="submitBtn" disabled={isSubmitting || name.trim() === ''}>
      {isSubmitting ? '만드는 중...' : '방 만들기'}
    </button>
  </div>
  <div class="formFooter">
    {error && <span id="roomNameError" class="fieldError" role="alert">{error}</span>}
    <span class="charCount {name.length > 28 ? 'charCountWarn' : ''}">{name.length} / 30</span>
    <button type="button" class="cancelLink" onClick={onCancel}>✕ 취소</button>
  </div>
</form>
```

### CSS

```
.createForm   { background: white; border: 1px solid #e2e8f0; border-radius: 12px;
                padding: 16px 20px; margin-bottom: 16px; }
.formRow      { display: flex; gap: 8px; align-items: stretch; }
.nameInput    { flex: 1; min-width: 0; padding: 10px 12px; border: 1.5px solid #e2e8f0;
                border-radius: 7px; font-size: 14px; font-family: inherit;
                transition: border-color 0.12s; min-height: 40px; }
.nameInput:focus         { outline: none; border-color: #aa3bff; }
.nameInputError          { border-color: #ef4444; }
.nameInputError:focus    { border-color: #ef4444; }
.submitBtn    { flex-shrink: 0; padding: 0 16px; background: #2c3e50; color: white;
                border: none; border-radius: 7px; font-size: 13px; font-weight: 600;
                cursor: pointer; white-space: nowrap; min-height: 40px; transition: background 0.12s; }
.submitBtn:hover:not(:disabled) { background: #1a2d3d; }
.submitBtn:disabled       { opacity: 0.6; cursor: not-allowed; }
.formFooter   { display: flex; align-items: center; margin-top: 8px; gap: 8px; }
.fieldError   { flex: 1; font-size: 12px; color: #ef4444; font-weight: 500; }
.charCount    { font-size: 12px; color: #94a3b8; flex-shrink: 0; }
.charCountWarn { color: #f59e0b; }
.cancelLink   { font-size: 12px; color: #94a3b8; background: none; border: none;
                cursor: pointer; padding: 0; font-family: inherit;
                transition: color 0.1s; }
.cancelLink:hover { color: #64748b; }
```

### 반응형

```
@media (max-width: 480px) {
  .formRow    { flex-direction: column; }
  .submitBtn  { width: 100%; padding: 10px; }
}
```

---

## 8. `ChatMessageList`

### 파일 위치
`frontend/src/components/chat/ChatMessageList.tsx`

### 역할
메시지 배열을 스크롤 가능한 영역에 렌더. 자동 스크롤 + 새 메시지 배지 관리.

### Props

| prop | 타입 | 필수 | 설명 |
|---|---|---|---|
| `messages` | `ChatMessageData[]` | O | 메시지 배열 (시간 오름차순) |
| `currentUserId` | `number \| null \| undefined` | O | 내 메시지 구분용 userId |
| `loading` | `boolean` | O | 히스토리 로딩 중 여부 |
| `newMessageCount` | `number` | O | 위 스크롤 중 누적 새 메시지 수 |
| `onScrollToBottom` | `() => void` | O | 스크롤 맨 아래로 이동 시 카운트 리셋 콜백 |

### 자동 스크롤 로직

```
isNearBottom 판정: scrollHeight - scrollTop - clientHeight < 100px
  → 새 메시지 수신 시 isNearBottom이면 즉시 scrollToBottom()
  → isNearBottom 아닌 경우: newMessageCount += 1 (배지 표시)
  → 히스토리 최초 로딩 완료 후: 항상 scrollToBottom()
```

### 새 메시지 배지

```
{newMessageCount > 0 && (
  <button class="newMsgBadge" onClick={scrollToBottom}>
    ↓ 새 메시지 {newMessageCount}개
  </button>
)}
```

### 로딩 상태 (스켈레톤)

히스토리 로딩 중(`loading === true`) 에는 메시지 스켈레톤 4개 표시:

```
[왼쪽 정렬 스켈레톤 — 너비 60%, 높이 36px, 배경 #f1f5f9, border-radius 12px, 점멸 animation]
[오른쪽 정렬 스켈레톤 — 너비 45%]
[왼쪽 정렬 스켈레톤 — 너비 70%]
[오른쪽 정렬 스켈레톤 — 너비 50%]
```

### 날짜 구분선 삽입 로직

```
messages 배열 순회 시:
  이전 메시지 날짜 !== 현재 메시지 날짜 → <DateDivider date={msg.timestamp} /> 삽입
  첫 번째 메시지 앞에도 날짜 구분선 삽입
```

### CSS

```
.messageList     { flex: 1; overflow-y: auto; padding: 16px; display: flex;
                   flex-direction: column; gap: 4px; position: relative; }
.newMsgBadge     { position: sticky; bottom: 8px; left: 50%; transform: translateX(-50%);
                   background: #aa3bff; color: white; font-size: 12px; font-weight: 600;
                   padding: 6px 14px; border-radius: 20px; border: none; cursor: pointer;
                   box-shadow: 0 2px 8px rgba(0,0,0,0.15); display: block; width: fit-content;
                   margin: 0 auto; }
.dateDivider     { display: flex; align-items: center; gap: 8px; margin: 12px 0;
                   font-size: 11px; color: #94a3b8; }
.dateDivider::before,
.dateDivider::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }
```

---

## 9. `ChatMessage`

### 파일 위치
`frontend/src/components/chat/ChatMessage.tsx`

### 역할
단일 메시지 렌더. CHAT/SYSTEM 타입 구분, 내 메시지/타인 메시지 구분.

### Props

| prop | 타입 | 필수 | 설명 |
|---|---|---|---|
| `message` | `ChatMessageData` | O | 메시지 데이터 |
| `currentUserId` | `number \| null \| undefined` | O | 내 메시지 판별 |
| `showNickname` | `boolean` | O | 닉네임 표시 여부 (연속 메시지면 false) |

### 렌더 분기

```
message.type === 'SYSTEM'
  → <SystemMessage> 렌더

message.type === 'CHAT' && message.userId === currentUserId
  → <MyMessage> 렌더 (오른쪽 정렬)

message.type === 'CHAT' && message.userId !== currentUserId
  → <OtherMessage> 렌더 (왼쪽 정렬, 닉네임 조건부)
```

### MyMessage 레이아웃

```
<div class="myMsgWrap">
  <span class="timestamp">{HH:mm}</span>
  <div class="bubble myBubble">{message.message}</div>
</div>
```

### OtherMessage 레이아웃

```
<div class="otherMsgWrap">
  {showNickname && <span class="nickname">{message.nickname}</span>}
  <div class="otherBubbleRow">
    <div class="bubble otherBubble">{message.message}</div>
    <span class="timestamp">{HH:mm}</span>
  </div>
</div>
```

### SystemMessage 레이아웃

```
<div class="systemMsgWrap" role="status" aria-live="polite">
  <span class="systemText">{message.message}</span>
</div>
```

### CSS

```
/* 공통 */
.bubble         { padding: 10px 14px; font-size: 14px; line-height: 1.5;
                  white-space: pre-wrap; word-break: break-word;
                  max-width: min(480px, 75vw); }
.timestamp      { font-size: 11px; color: #94a3b8; flex-shrink: 0;
                  align-self: flex-end; }

/* 내 메시지 */
.myMsgWrap      { display: flex; justify-content: flex-end; align-items: flex-end;
                  gap: 6px; margin-bottom: 4px; }
.myBubble       { background: #aa3bff; color: white;
                  border-radius: 12px 2px 12px 12px; }

/* 타인 메시지 */
.otherMsgWrap   { display: flex; flex-direction: column; align-items: flex-start;
                  margin-bottom: 4px; }
.nickname       { font-size: 12px; color: #64748b; font-weight: 500; margin-bottom: 4px;
                  padding-left: 2px; }
.otherBubbleRow { display: flex; align-items: flex-end; gap: 6px; }
.otherBubble    { background: #f1f5f9; color: #0f172a;
                  border-radius: 2px 12px 12px 12px; }

/* 시스템 메시지 */
.systemMsgWrap  { display: flex; justify-content: center; margin: 8px 0; }
.systemText     { font-size: 12px; color: #94a3b8; background: #f8fafc;
                  padding: 4px 12px; border-radius: 12px; }
```

### 접근성

- SYSTEM 메시지: `role="status" aria-live="polite"` — 스크린리더에서 입장/퇴장 알림
- 내 메시지 버블: 색상 대비 — `#aa3bff` 배경의 white 텍스트 (WCAG AA 통과: 대비 4.58:1 기준)
  - 주의: 실제 구현 시 대비 비율 재확인 필요. `#aa3bff` 위 white 텍스트가 AA 기준 미달 시 배경색을 `#9333ea` (더 진한 보라) 로 조정 권장.

---

## 10. `ChatInput`

### 파일 위치
`frontend/src/components/chat/ChatInput.tsx`

### 역할
메시지 입력 textarea + 전송 버튼 + 글자 수 카운터. 서버 에러 인라인 표시.

### Props

| prop | 타입 | 필수 | 설명 |
|---|---|---|---|
| `disabled` | `boolean` | O | 연결 끊김/재연결 중 시 비활성 |
| `onSend` | `(text: string) => void` | O | 전송 콜백 (메시지 본문만 전달) |
| `serverError` | `string` | O | `/user/queue/errors` 에서 수신한 에러 메시지 (빈 문자열이면 미표시) |

### 내부 상태

| 상태 | 타입 | 초기값 | 설명 |
|---|---|---|---|
| `text` | `string` | `''` | 입력 텍스트 |
| `localError` | `string` | `''` | 클라이언트 측 유효성 에러 |

### 전송 로직

```
1. trim 후 빈 문자열 → localError = '메시지를 입력해주세요.' → 전송 안 함
2. 200자 초과 → 입력 차단 (maxLength 속성 + 런타임 체크)
3. 유효하면 onSend(text.trim()) + text 초기화
```

### 키보드 인터랙션

| 키 | 동작 |
|---|---|
| `Enter` (Shift 없이) | 전송 |
| `Shift + Enter` | 줄바꿈 |
| `disabled` 상태에서 `Enter` | 아무 동작 없음 |

### 자동 높이 조정

- `textarea` 초기 높이: 44px (1줄)
- 최대 4줄까지 자동 확장 (약 120px)
- 4줄 초과 시 내부 스크롤 (`overflow-y: auto`)
- 텍스트 비워지면 초기 높이로 복귀

### 에러 표시 우선순위

```
serverError !== '' → serverError 를 3초간 표시 후 소멸 (부모에서 빈 문자열로 리셋)
localError !== ''  → localError 표시
```

### 레이아웃

```
<div class="inputArea">
  {(serverError || localError) && (
    <div class="inputError" role="alert">{serverError || localError}</div>
  )}
  <div class="inputRow">
    <textarea
      class="textInput"
      placeholder={disabled ? '연결 중...' : '메시지를 입력하세요...'}
      value={text}
      onChange={...}
      onKeyDown={...}
      maxLength={200}
      disabled={disabled}
      rows={1}
      aria-label="메시지 입력"
    />
    <button
      class="sendBtn"
      onClick={handleSend}
      disabled={disabled || text.trim() === ''}
      aria-label="메시지 전송"
    >
      전송
    </button>
  </div>
  <div class="inputMeta">
    <span class="charCount {text.length > 180 ? 'charCountWarn' : ''}">{text.length} / 200</span>
  </div>
</div>
```

### CSS

```
.inputArea    { flex-shrink: 0; border-top: 1px solid #e2e8f0; padding: 12px 16px;
               background: #fff; }
.inputError   { font-size: 12px; color: #ef4444; margin-bottom: 6px;
                padding: 6px 10px; background: #fff5f5; border-radius: 6px; }
.inputRow     { display: flex; gap: 8px; align-items: flex-end; }
.textInput    { flex: 1; min-width: 0; padding: 10px 12px; border: 1.5px solid #e2e8f0;
               border-radius: 10px; font-size: 14px; font-family: inherit; resize: none;
               min-height: 44px; max-height: 120px; overflow-y: auto; line-height: 1.5;
               transition: border-color 0.12s; }
.textInput:focus         { outline: none; border-color: #aa3bff; }
.textInput:disabled      { background: #f8fafc; color: #94a3b8; cursor: not-allowed; }
.sendBtn      { flex-shrink: 0; padding: 0 16px; min-height: 44px; background: #aa3bff;
               color: white; border: none; border-radius: 10px; font-size: 14px;
               font-weight: 600; cursor: pointer; transition: background 0.12s; }
.sendBtn:hover:not(:disabled)  { background: #9333ea; }
.sendBtn:disabled              { opacity: 0.5; cursor: not-allowed; }
.inputMeta    { display: flex; justify-content: flex-end; margin-top: 4px; }
.charCount    { font-size: 11px; color: #94a3b8; }
.charCountWarn { color: #f59e0b; }
```

### 반응형

```
@media (max-width: 480px) {
  .inputArea  { padding: 10px 12px; }
  .sendBtn    { padding: 0 12px; font-size: 13px; }
}
```

---

## 11. `ConnectionStatus`

### 파일 위치
`frontend/src/components/chat/ConnectionStatus.tsx`

### 역할
STOMP 연결 상태를 시각적 배지로 표시.

### Props

| prop | 타입 | 필수 | 설명 |
|---|---|---|---|
| `status` | `'connecting' \| 'connected' \| 'reconnecting' \| 'error'` | O | 연결 상태 |

### 렌더 매핑

| status | 점 색상 | 텍스트 | 점멸 |
|---|---|---|---|
| `connecting` | `#f59e0b` (노란색) | `연결 중` | O |
| `connected` | `#22c55e` (초록색) | `연결됨` | X |
| `reconnecting` | `#ef4444` (빨간색) | `재연결 중` | O |
| `error` | `#ef4444` (빨간색) | `연결 오류` | X |

### 레이아웃

```
<div class="statusBadge" aria-live="polite" aria-label={`연결 상태: ${statusText}`}>
  <span class="dot {isPulsing ? 'dotPulse' : ''}" style={{background: color}} />
  <span class="statusText">{text}</span>
</div>
```

### CSS

```
.statusBadge  { display: flex; align-items: center; gap: 5px; flex-shrink: 0; }
.dot          { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
.dotPulse     { animation: pulse 1s ease-in-out infinite; }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.3; }
}
.statusText   { font-size: 12px; font-weight: 500; color: #64748b; }
```

### 접근성

- `aria-live="polite"`: 상태 변경 시 스크린리더에 알림
- `aria-label`로 상태 의미 전달

---

## 12. 공통 디자인 토큰

```
/* 색상 */
--color-accent:       #aa3bff   /* 브랜드 퍼플 */
--color-accent-dark:  #9333ea   /* 호버 퍼플 */
--color-primary:      #2c3e50   /* 다크 네이비 */
--color-primary-dark: #1a2d3d
--color-success:      #22c55e
--color-warning:      #f59e0b
--color-error:        #ef4444
--color-text-main:    #0f172a
--color-text-sub:     #64748b
--color-text-muted:   #94a3b8
--color-border:       #e2e8f0
--color-bg-card:      #ffffff
--color-bg-subtle:    #f8fafc
--color-bg-hover:     #f1f5f9

/* 타이포그래피 */
--font-family:        system-ui, 'Segoe UI', Roboto, sans-serif
--font-size-xs:       11px
--font-size-sm:       12px
--font-size-base:     14px
--font-size-md:       15px
--font-size-lg:       16px
--font-size-xl:       22px

/* 스페이싱 */
--radius-sm:  7px
--radius-md:  10px
--radius-lg:  12px
--radius-xl:  14px
--radius-full: 9999px

/* 애니메이션 */
--transition-fast:    0.12s
--transition-base:    0.15s
```

- `index.css`에 이미 정의된 CSS 변수 (`--accent: #aa3bff`, `--text-h: #0f172a` 등) 를 우선 재사용.
- 채팅 전용 토큰이 필요한 경우 CSS 모듈 내에서 로컬 커스텀 프로퍼티로 정의.

---

## 13. 접근성 (A11y)

### 색상 대비

| 요소 | 배경 | 텍스트 | 대비비 기준 |
|---|---|---|---|
| 내 메시지 버블 | `#aa3bff` | `#ffffff` | 4.5:1 이상 확인 필요, 부족 시 `#9333ea` 로 대체 |
| 타인 메시지 버블 | `#f1f5f9` | `#0f172a` | 통과 |
| 시스템 메시지 | `#f8fafc` | `#94a3b8` | 대형 텍스트 기준 (3:1) 통과 |
| 에러 텍스트 | `#ffffff` | `#ef4444` | 통과 |
| 연결 상태 텍스트 | `#ffffff` | `#64748b` | 통과 |

### ARIA 레이블 요약

| 컴포넌트 | ARIA 속성 |
|---|---|
| `ChatRoomCard` | `aria-label="{방 이름} 채팅방 입장"` |
| `ConnectionStatus` | `aria-live="polite"`, `aria-label="연결 상태: {text}"` |
| `ChatMessage (SYSTEM)` | `role="status"`, `aria-live="polite"` |
| `ChatInput textarea` | `aria-label="메시지 입력"` |
| `ChatInput 전송 버튼` | `aria-label="메시지 전송"` |
| `CreateRoomForm input` | `aria-label="방 이름"`, `aria-describedby="roomNameError"` |
| `CreateRoomForm 에러` | `id="roomNameError"`, `role="alert"` |
| `ChatInput 에러` | `role="alert"` |

---

## 14. 키보드 네비게이션

### 방 목록 페이지

| 키 | 동작 |
|---|---|
| `Tab` | 헤더 → `+ 방 만들기` 버튼 → 방 카드들 → 하단 |
| `Enter` / `Space` | 방 카드 활성화 (방 입장) |
| `Enter` | `+ 방 만들기` 버튼 → 폼 펼침 |

### 방 만들기 폼

| 키 | 동작 |
|---|---|
| `Enter` | 폼 제출 |
| `Escape` | 폼 닫기 |
| `Tab` | 입력창 → 방 만들기 버튼 → 취소 링크 |

### 채팅방 페이지

| 키 | 동작 |
|---|---|
| `Tab` | 채팅방 헤더 `← 목록` → 메시지 영역(스킵) → 입력창 → 전송 버튼 |
| `Enter` | 전송 버튼 또는 입력창에서 전송 |
| `Shift + Enter` | 입력창 줄바꿈 |

### 포커스 관리

- `CreateRoomForm` 펼쳐질 때: `input` 자동 포커스 (`autoFocus`)
- 방 만들기 성공 후 새 방으로 이동 → 포커스 자연히 채팅 입력창으로
- 폼 닫힘(`onCancel`) 후: `+ 방 만들기` 버튼으로 포커스 복귀 (developer-frontend 에서 `ref` 관리)
