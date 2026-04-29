# 회귀 테스트 체크리스트

> 소유자: qa-tester
> 최초 작성: 2026-04-24
> 용도: 신규 기능 배포 / 공통 모듈 변경 시 기존 기능 영향도 점검

---

## 사용 방법

1. 신규 게임 추가 또는 공통 모듈 변경 PR 수신 시 이 파일 참조
2. 해당 PR의 변경 영역(열)을 확인하고 영향받는 항목(행)에 체크
3. 모든 Critical 항목 통과 확인 후 PR 승인 가능
4. 새 게임 추가 시 §3에 해당 게임의 smoke test 항목 추가

---

## §1. 공통 모듈 변경 시 영향도 체크

### 1-1. WebSocket 인프라 변경 (`/ws`, `/ws-battle`, SockJS, STOMP, JwtHandshakeInterceptor)

| 확인 항목 | 우선순위 | 확인 방법 |
|---|---|---|
| 채팅 WebSocket 연결 정상 (`/ws` 핸드셰이크) | Critical | 브라우저 DevTools > Network > WS |
| 채팅 메시지 발행/수신 정상 (`/app/chat/**`) | Critical | 실제 채팅 메시지 전송 후 브로드캐스트 확인 |
| 채팅 방 입장/퇴장 이벤트 정상 | Critical | SYSTEM 메시지 수신 확인 |
| RPS WebSocket 연결 정상 (`/topic/rps/**`) | Critical | RPS 매칭 후 ROOM_STATE 수신 확인 |
| 비인증 연결 여전히 거부 (`/ws`) | Critical | JWT 없이 `/ws` 연결 시도 → 거부 확인 |
| `/ws-battle` 엔드포인트 추가가 `/ws` 에 영향 없음 | Critical | 기존 `/ws` 채팅/RPS 연결 정상 확인 |
| guestToken이 `/ws` 핸드셰이크에서 거부됨 | Critical | `guest_xxx` 토큰으로 `/ws` 연결 시도 → 거부 확인 |
| `/user/queue/errors` 에러 채널 정상 작동 | High | 에러 상황 유발 후 에러 메시지 수신 확인 |
| `/user/queue/blockfall-battle/errors` 에러 채널 분리 | High | 배틀 에러 수신 시 채팅/RPS 에러 채널에 영향 없음 확인 |

### 1-2. SecurityConfig 변경

| 확인 항목 | 우선순위 | 확인 방법 |
|---|---|---|
| `/api/rps/**` 인증 필요 | Critical | 비인증으로 `POST /api/rps/match` → 401 |
| `/api/chat/**` 인증 필요 | Critical | 비인증으로 채팅 API → 401 |
| `/api/admin/**` ADMIN 전용 | Critical | USER 역할로 어드민 API → 403 |
| `/api/rankings/**` 정상 접근 | High | 랭킹 조회 API 정상 응답 |
| 기존 public 경로 여전히 허용 | High | 로그인 없이 홈페이지 접근 가능 |

### 1-3. SessionDisconnectEvent 리스너 변경

| 확인 항목 | 우선순위 | 확인 방법 |
|---|---|---|
| 채팅 끊김 처리 정상 (`subscribedRoomIds`) | Critical | 채팅방 접속 중 탭 닫기 → SYSTEM 퇴장 메시지 확인 |
| RPS 끊김 처리 정상 (`rpsSubscribedRoomIds`) | Critical | RPS 대기방 접속 중 탭 닫기 → PLAYER_LEFT 확인 |
| 배틀 끊김 처리 정상 (배틀 세션 키) | Critical | 배틀 진행 중 탭 닫기 → PLAYER_LEFT 브로드캐스트, 기존 채팅/RPS 영향 없음 확인 |
| 세 키 간 간섭 없음 | High | 채팅 + RPS + 배틀 동시 접속 후 각각 독립적 끊김 처리 확인 |

### 1-4. RankingService / 랭킹 API 변경

| 확인 항목 | 우선순위 | 확인 방법 |
|---|---|---|
| Blockfall 랭킹 등록/조회 정상 | Critical | 게임 완료 후 랭킹 API 200 응답 확인 |
| Blockfall Insane 랭킹 등록/조회 정상 | Critical | 게임 완료 후 랭킹 API 200 응답 확인 |
| Apple 랭킹 등록/조회 정상 | High | 게임 완료 후 랭킹 API 200 응답 확인 |
| Baseball 랭킹 등록/조회 정상 | High | 게임 완료 후 랭킹 API 200 응답 확인 |
| Minesweeper 랭킹 등록/조회 정상 | High | 게임 완료 후 랭킹 API 200 응답 확인 |
| HMAC 검증 정상 유지 | Critical | 위조 점수 전송 시 400/403 응답 확인 |
| `battle_record` 신규 테이블이 기존 `rankings` 테이블과 격리 | Critical | 솔로 랭킹 API (`/api/rankings/**`) 정상 응답, battle_record 데이터 혼입 없음 |
| `GET /api/blockfall-battle/rankings` 새 엔드포인트 인증 없이 접근 가능 | High | 비인증으로 200 응답 확인 |

### 1-5. 인증 시스템 변경 (JWT, OAuth2, Spring Security)

| 확인 항목 | 우선순위 | 확인 방법 |
|---|---|---|
| 로그인 플로우 정상 (일반 로그인) | Critical | 이메일/패스워드 로그인 후 JWT 수신 확인 |
| 로그인 플로우 정상 (OAuth2) | Critical | Google/GitHub OAuth2 로그인 정상 완료 |
| JWT 토큰 갱신 정상 | High | 만료 직전 토큰으로 자동 갱신 확인 |
| 로그아웃 후 기존 토큰 무효화 | High | 로그아웃 후 기존 토큰으로 API 호출 → 401 |

---

## §2. 신규 게임 추가 시 기존 게임 Smoke Test

신규 게임 추가 PR 수신 시 아래 기존 게임 smoke test 전수 실행:

### 2-1. Blockfall (일반)

| 확인 항목 | 우선순위 |
|---|---|
| `/blockfall` 페이지 정상 로드 | Critical |
| 게임 시작 및 블록 낙하 정상 | Critical |
| 점수 등록 (HMAC 포함) 정상 | Critical |
| 랭킹 조회 정상 | High |
| 일반/Excel 모드 전환 정상 | High |

### 2-2. Blockfall Insane

| 확인 항목 | 우선순위 |
|---|---|
| `/blockfall-insane` 페이지 정상 로드 | Critical |
| 게임 시작 및 insane 이벤트 발동 | Critical |
| 점수 등록 정상 (hard 고정) | Critical |
| 랭킹 조회 정상 | High |

### 2-3. Apple Canvas

| 확인 항목 | 우선순위 |
|---|---|
| 게임 페이지 정상 로드 | Critical |
| 게임 시작 및 기본 플레이 정상 | Critical |
| 점수 등록 정상 | High |

### 2-4. Baseball

| 확인 항목 | 우선순위 |
|---|---|
| 게임 페이지 정상 로드 | Critical |
| 게임 시작 및 기본 플레이 정상 | Critical |
| 점수 등록 정상 | High |

### 2-5. Minesweeper

| 확인 항목 | 우선순위 |
|---|---|
| 게임 페이지 정상 로드 | Critical |
| 게임 시작 및 기본 플레이 정상 | Critical |
| 점수 등록 정상 | High |

### 2-6. Sudoku

| 확인 항목 | 우선순위 |
|---|---|
| 게임 페이지 정상 로드 | Critical |
| 게임 시작 및 기본 플레이 정상 | Critical |
| 완료 처리 정상 | High |

### 2-7. Solitaire (CardBoard)

| 확인 항목 | 우선순위 |
|---|---|
| 게임 페이지 정상 로드 | Critical |
| 게임 시작 및 기본 플레이 정상 | Critical |
| 완료 처리 정상 | High |

### 2-8. Online RPS (신규 — 2026-04-24 추가)

| 확인 항목 | 우선순위 |
|---|---|
| `/online-rps` 페이지 정상 로드 | Critical |
| 비로그인 접근 시 로그인 리다이렉트 | Critical |
| `POST /api/rps/match` 정상 응답 (200/201) | Critical |
| WebSocket 연결 + ROOM_STATE 수신 | Critical |
| 2인 대기 후 카운트다운 → GAME_STARTED | Critical |
| 카드 선택 후 ROUND_RESULT 수신 | Critical |
| rps_round_result DB 저장 확인 | High |
| 기존 admin-rsp 라우트/API 404 확인 | Critical |

### 2-9. Blockfall Battle (신규 — 2026-04-27 추가)

| 확인 항목 | 우선순위 |
|---|---|
| Test Lab 섹션에서 배틀 카드 표시 | Critical |
| `/test-lab/blockfall-battle` 페이지 정상 로드 | Critical |
| "테스트 단계" 배너 표시 | Critical |
| 일반 게임 카드 목록에 배틀 카드 미노출 | Critical |
| `POST /api/blockfall-battle/join` 정상 응답 (JWT 없이도 guestToken 발급) | Critical |
| `/ws-battle` WebSocket 연결 + ROOM_STATE 수신 | Critical |
| 2인 대기 후 카운트다운 → GAME_STARTED | Critical |
| 2콤보 이상 시 GARBAGE_ATTACK 수신 | Critical |
| 배틀 종료 후 GAME_RESULT + topRankings 수신 | Critical |
| 로그인 유저 전적 battle_record DB 저장 확인 (읽기 전용) | High |
| 게스트 전적 battle_record 미저장 확인 | Critical |
| `GET /api/blockfall-battle/rankings` 정상 응답 | High |
| 홈화면에 배틀 랭킹 요소 미노출 | Critical |

### 2-11. Yacht (신규 — 2026-04-29 추가)

| 확인 항목 | 우선순위 |
|---|---|
| `/yacht` 페이지 정상 로드 | Critical |
| 비로그인 접근 시 로그인 리다이렉트 | Critical |
| `POST /api/yacht/match` 정상 응답 (200/201) | Critical |
| WebSocket 연결 + ROOM_STATE 수신 | Critical |
| 비방장 ready:true 발행 → ROOM_STATE 반영 | Critical |
| 방장 /start 후 GAME_STARTED 브로드캐스트 | Critical |
| /roll 발행 → ROLL_RESULT 수신 (5개 dice, rollsLeft 감소) | Critical |
| kept 주사위 값 유지 재굴림 정상 동작 | Critical |
| /score 발행 → SCORE_RECORDED 수신 (점수 서버 재계산) | Critical |
| GAME_OVER 브로드캐스트 (12개 족보 완료 시) | Critical |
| yacht_win win_count 증가 확인 (읽기 전용 DB 조회) | High |
| `/topic/yacht/**` ↔ `/topic/rps/**` 크로스 수신 없음 | Critical |
| yachtSubscribedRoomIds 세션 키 분리 (기존 chat/rps 세션 키 간섭 없음) | Critical |
| 기존 admin-rsp 라우트/API 영향 없음 확인 | High |

### 2-10. 채팅 (chat-testroom)

| 확인 항목 | 우선순위 |
|---|---|
| 채팅방 목록 조회 (`GET /api/chat/rooms`) | Critical |
| 채팅방 생성 정상 | High |
| WebSocket 연결 + 메시지 발행/수신 | Critical |
| 입장/퇴장 시스템 메시지 정상 | High |

---

## §3. 게임 목록 (현행 기준)

| 게임명 | 컴포넌트 파일 | 추가일 | 비고 |
|---|---|---|---|
| Blockfall | `frontend/src/games/blockfall/BlockfallBoard.tsx` | — | Excel 모드 있음 |
| Blockfall Insane | `frontend/src/games/blockfall/BlockfallInsaneBoard.tsx` | 2026-04-22 | hard 고정, Excel 없음 |
| Apple | `frontend/src/games/apple/AppleCanvas.tsx` | — | |
| Baseball | `frontend/src/games/baseball/BaseballBoard.tsx` | — | |
| Minesweeper | `frontend/src/games/minesweeper/MinesweeperBoard.tsx` | — | |
| Sudoku | `frontend/src/games/sudoku/SudokuBoard.tsx` | — | |
| Solitaire | `frontend/src/games/solitaire/CardBoard.tsx` | — | |
| Online RPS | `frontend/src/games/` (예정) | 2026-04-24 (배포 예정) | 멀티플레이, Excel 없음 |
| Blockfall Battle | `frontend/src/games/blockfall/` (예정) | 2026-04-27 (구현 예정) | Test Lab 전용, 멀티플레이, Excel 없음, 게스트 허용 |
| Yacht | `frontend/src/games/yacht/` (예정) | 2026-04-29 (구현 예정) | 멀티플레이, Excel 없음, 로그인 필수, three.js 3D 주사위 |
| ~~어드민 솔로 RSP~~ | ~~`frontend/src/games/rsp/RspBoard.tsx`~~ | — | **Online RPS로 대체 — 제거 예정** |

---

## §4. 변경 이력

| 날짜 | 변경 내용 | 작성자 |
|---|---|---|
| 2026-04-24 | 최초 작성. Online RPS 추가 및 어드민 솔로 RSP 제거 맥락에서 신규 생성. §1~3 전체 초안 작성. | qa-tester |
| 2026-04-27 | Blockfall Battle 추가. §1-1에 `/ws-battle` 격리 항목 추가. §1-3에 배틀 끊김 처리 항목 추가. §1-4에 battle_record 분리 항목 추가. §2-9 배틀 smoke test 항목 신규 추가. §3 게임 목록에 배틀 행 추가. | qa-tester |
| 2026-04-29 | Yacht 추가. §2-11 Yacht smoke test 항목 신규 추가 (14개). §3 게임 목록에 Yacht 행 추가. | qa-tester |
