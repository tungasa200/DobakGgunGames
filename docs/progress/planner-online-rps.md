# Progress — planner : Online RPS (실시간 멀티플레이 가위바위보)

- 소유 팀원: **planner**
- 기능 키: `online-rps`
- 최종 업데이트: 2026-04-24 (플로우 변경 리비전)
- 관련 문서:
  - PRD: `docs/specs/online-rps-prd.md`
  - 구(舊) PRD (대체 대상): `docs/specs/rsp-game.md`
  - 채팅 WebSocket 참조: `docs/progress/developer-backend-chat-testroom.md`

---

## 현재 상태

- **CP1 승인 대기 (2026-04-24 플로우 변경 리비전 완료)** — 사용자 결정 대기.
- PRD 리비전 `docs/specs/online-rps-prd.md` 저장 완료.
- 사용자에게 전달된 CP1 결정 항목 **4건 (기존 3건 + 신규 1건)**:
  1. 대결 방식 (추천 Option C — 2~4인 동시 선택 + 카드 종류 수 기반 판정)
  2. 타임아웃 정책 (추천 15초 / 랜덤 자동 선택 / 서버 주체)
  3. 랭킹 연동 여부 (추천 MVP 결과 저장만, Phase 2에서 재검토)
  4. **자동 시작 방식 (신규 — 추천 Option α: 카운트다운 자동 시작 5초, 방장/준비 개념 제거)**

---

## 작업 로그

### 2026-04-24 (리비전 — 자동 매칭 플로우 전환)

#### 사용자 긴급 지시
- "유저가 게임방을 생성하고 입장하는 플로우가 아니라, 게임에 접근하면 바로 입장되는 방식으로 할거야"
- 결론: **로비/방 목록/방 생성 UI 완전 제거**, "Online RPS" 버튼 클릭 시 즉시 자동 매칭으로 전환.

#### PRD 변경 사항
1. **상단 메타** — 수정일 2026-04-24 추가, CP1 항목이 4개로 증가했음을 명시.
2. **§1 목표** — "방 목록 → 방 생성/입장" 표현 제거, "게임 진입 즉시 자동 매칭"으로 교체.
3. **§2 유저 스토리** — US-1(목록), US-2(방 생성), US-3(입장) 제거. US-1을 "자동 매칭되기를 원한다"로 교체. US-2는 대기 화면 상태 확인. US-3(자동 시작 조건부)은 CP1-4에 연동.
4. **§4 게임 플로우 (가장 큰 변화)**:
   - 다이어그램 전면 교체: `[홈] → [POST /api/rps/match] → [WebSocket 구독 + 자동 join] → [대기 화면] → [게임] → [결과]`
   - **§4.3 매칭 알고리즘** 신규 섹션 추가 (서버 탐색/신규 생성 로직, Redis 분산락).
5. **§7 WebSocket 이벤트**:
   - 경로 테이블에 각 이벤트의 "CP1-4 방식별 사용 여부" 비고 추가.
   - `/app/rps/room/{roomId}/join` 설명 전면 교체: "유저가 roomId 선택하지 않음. HTTP 매칭 응답의 roomId로 구독 직후 자동 발행. 서버는 slot 예약 검증과 WebSocket 세션 바인딩 수행."
   - `MATCH_COUNTDOWN` / `MATCH_COUNTDOWN_CANCELLED` 서버→클라 메시지 타입 신규 추가 (§7.2.7).
6. **§9 REST API — 전면 재작성**:
   - 제거: `GET /api/rps/rooms`, `POST /api/rps/rooms`, `POST /api/rps/rooms/{roomId}/join`, `GET /api/rps/rooms/{roomId}` (총 4개).
   - 신규: `POST /api/rps/match` 단일 API. 요청/200/201/에러(`401 UNAUTHORIZED`, `409 ALREADY_IN_ROOM`, `429 MATCH_RATE_LIMIT`, `503 MATCH_UNAVAILABLE`), 서버 처리 로직, 클라이언트 후속 동작 모두 상세 기술.
7. **§10 엣지 케이스** — EC-11(중복 참가) → `ALREADY_IN_ROOM` 정책으로 교체. EC-13(이름 금칙어) 삭제. EC-14 → `MATCH_RATE_LIMIT`으로 교체. EC-16 → "자동 생성 빈 방 TTL"로 교체. EC-17/18/19 추가 (카운트다운 취소, 락 타임아웃, 동시 생성 race).
8. **§12 DB 스키마** — `rps_room.name` 컬럼 설명에 "서버 자동 생성, 유저 미입력" 명시.
9. **§15 CP1 결정** — CP1-4 "자동 시작 방식" 신규 추가. Option α(카운트다운 자동 시작) 추천 + 근거 5가지 + Option β(호스트 시작 버튼) 대안 명시.
10. **§16 오픈 퀘스천** — OQ-1(이름 금칙어), OQ-2(방 생성 개수), OQ-7(방 목록 갱신) 해소 처리. OQ-9(매칭 Rate Limit 임계치), OQ-10(카운트다운 중 4인 꽉 찼을 때 동작), OQ-11(매칭 정렬 FIFO vs 최신순) 신규 추가.

#### Option α (카운트다운 자동 시작) 추천 근거 요약
1. 방 생성이 자동인데 "방장" UX 도입은 일관성 깨짐.
2. AFK 호스트가 게임 시작을 막는 문제 원천 차단.
3. WebSocket 이벤트 2종(`ready`/`start`) 및 `ready` 필드, `HOST_CHANGED` 로직 단순화 가능.
4. 모바일에서 버튼 터치 단계 감소 → UX 부드러움.
5. 대기 시간 상한 5초 내로 보장.

#### 다음 세션 준비
- 사용자가 CP1-1/2/3/4 승인하면 PRD v1.0 확정 + designer 착수 가능.
- designer CP2에서 대기 화면/카운트다운 UI/결과 화면 명세 작성 필요.
- 로비 페이지가 없어졌으므로 designer 작업 범위가 줄어듦 (기존 4화면 → 3화면: 대기/게임/결과).

---

### 2026-04-24 (초기 세션 — 온라인 RPS 전환 PRD 초안)

#### 사전 조사
- `docs/progress/planner-rsp-game.md` 읽기 — 기존 RSP는 어드민 솔로 게임, CP1~CP5 완료, QA 생략 상태.
- `docs/progress/developer-backend-chat-testroom.md` 읽기 — STOMP/SockJS/JWT/Redis 인프라 완비 확인. 재사용 범위:
  - `JwtHandshakeInterceptor` (JWT 검증)
  - `StompChannelInterceptor` (CONNECT/SUBSCRIBE/SEND 재인증 + 파이프라인 차단)
  - `ChatPrincipal` 패턴 (Principal 구현체)
  - `SimpMessagingTemplate` (`convertAndSend` / `convertAndSendToUser`)
  - `SessionDisconnectEvent` / `SessionSubscribeEvent` 리스너 패턴
- `frontend/src/lib/stompClient.ts` 읽기 — 기존 SockJS 클라이언트 패턴 (JWT 쿼리 fallback, 재연결 로직). RPS 클라이언트도 동일 패턴으로 분기 권장.
- `backend/.../config/WebSocketConfig.java` 읽기 — 브로커 prefix `/topic`, `/queue` / 앱 prefix `/app` / 유저 prefix `/user` 이미 구성됨. **수정 불필요** — `/topic/rps/**`, `/app/rps/**` 네임스페이스가 기존 SimpleBroker 설정 하에서 그대로 동작.
- `frontend/public/games/rcp/` 확인 — `rock.png`, `paper.png`, `scissors.png` 3장 존재 (designer가 그대로 재활용 가능).
- 기존 RSP 제거 대상 파일 목록 확정:
  - 프론트: `games/rsp/RspBoard.tsx`, `RspBoard.module.css`, `useRspGame.ts`, `pages/admin/AdminRspPage.tsx`, `pages/admin/AdminRspExcelPage.tsx`, `api/admin.ts` 내 `adminRspApi` 섹션
  - 백엔드: `controller/AdminRspController.java`, `service/AdminRspService.java`, `entity/AdminRspPlay.java`, `entity/RspChoice.java`, `entity/RspResult.java`, `repository/AdminRspPlayRepository.java`, `dto/rsp/` 전체
  - SecurityConfig 내 `/api/admin/rsp/**` 규칙 제거

#### PRD 구조 결정
- 총 17개 섹션. CP1 승인 필요 항목 3건은 §5, §6, §13에 각각 명시 + §15에 취합.
- WebSocket 경로는 `/topic/rps/room/{roomId}`, `/app/rps/room/{roomId}/{action}` 형식으로 결정 (action: join/ready/start/choose/rematch/leave).
- 서버→클라이언트 메시지 envelope 통일: `{ type, timestamp, payload }` 형식.
- 에러 코드 12종 정의 (`ROOM_NOT_FOUND`, `ROOM_FULL`, `NOT_HOST`, `ALREADY_CHOSEN` 등).
- REST API 4종 (GET 목록, POST 생성, POST 입장, GET 상세).
- DB 스키마 2테이블 (`rps_room`, `rps_round_result`). 참가자/준비 상태는 Redis/메모리 보관 (실시간성).

#### 주요 추천 근거
- **Option C (2~4인 동시)** 추천: 매칭/브래킷 불필요, 판정 로직 단순(카드 종류 수 1/2/3), 즉시 결과, 소규모 세션 친화.
- **15초 + 랜덤 자동선택**: 즉흥 게임 긴장감 유지 + AFK 편향 최소화 + 클라 조작 방지.
- **MVP 랭킹 미연동**: 운 기반 게임 특성, `RankingService.VALID_GAMES` 스키마(단일 점수 단일 유저)와 멀티플레이어 결과 호환성 떨어짐.

#### 후속 파일 업데이트
- `docs/progress/planner-rsp-game.md` 맨 아래 "후속 액션 (online-rps로 교체됨)" 메모 추가 예정.
- 본 파일(planner-online-rps.md) 신규 작성.

---

## 다음 단계 (순서)

1. **사용자 CP1 승인** — **현재 대기 중 (4건)**
   - 대결 방식 (Option C 승인 or 다른 옵션 지정)
   - 타임아웃 (15초/랜덤 승인 or 다른 값 지정)
   - 랭킹 연동 (MVP 결과 저장만 승인 or MVP에 포함 지정)
   - **자동 시작 방식 (Option α 카운트다운 자동 시작 승인 or Option β 호스트 버튼 지정)**
2. CP1 승인 후 PRD 확정 리비전 (v1.0) + 본 progress 업데이트
3. designer 착수 (CP2) — `docs/design/online-rps.md`
   - 화면: **대기 화면 / 게임 / 결과** (로비 화면 제거됨)
   - 상태 전이 시각화 (홈 → 매칭 중 → 대기 → 카운트다운 → 게임 → 결과)
   - OQ-4 (결과→대기 화면 복귀 시간), OQ-8 (모바일 UX)
   - CP1-4 결정에 따라 "카운트다운 UI" 또는 "호스트 시작 버튼 UI" 둘 중 하나만 명세
4. developer-backend / developer-frontend 병렬 착수 (CP3)
   - 백엔드: 엔티티 2종 + Repository + `RpsController` (REST — `POST /api/rps/match` 단일) + `RpsStompController` (WebSocket) + `RpsMatchService` + `RpsGameService` + 타임아웃 스케줄러 + **카운트다운 스케줄러 (CP1-4 Option α 채택 시)**
   - 프론트: **홈의 "Online RPS" 진입 버튼 + 매칭 페이지 + 대기/게임/결과 페이지** + RPS 전용 STOMP 클라이언트 (`rpsStompClient.ts`)
   - 기존 admin-rsp 제거 (같은 PR)
5. qa-tester 검증 (CP5) — `docs/review/online-rps-test-plan.md`
   - 매칭 케이스: 빈 서버(신규 생성), 대기방 존재(합류), 꽉 찬 방(다른 방 생성), ALREADY_IN_ROOM
   - 동시 참가자 2/3/4인 케이스
   - 타임아웃 자동선택 케이스
   - 연결끊김 (대기중/게임중/카운트다운 중)
   - 기존 채팅 회귀 테스트
6. 릴리스 — main 머지 + 사용자가 Railway MySQL에서 `drop-admin-rsp.sql` 실행

---

## 대기 중 질문 (프로젝트 오너 답변 필요)

- **CP1 결정 4건** (§15 참조)
  - Q1. 대결 방식: Option C(2~4인 동시, 카드 종류 수 판정) 승인?
  - Q2. 타임아웃: 15초 + 랜덤 자동선택 + 서버 주체 승인?
  - Q3. 랭킹 연동: MVP 결과 저장만 승인?
  - Q4. **자동 시작 방식: Option α(5초 카운트다운 자동 시작, 방장 개념 제거) 승인?**

---

## 블로커 / 리스크

- 블로커: CP1 승인 대기 (4건).
- 리스크:
  - **기존 채팅 경로 간섭 가능성**: STOMP subscribe 누적이 잘못되면 RPS 메시지가 chat topic으로 새거나 그 반대. → `StompChannelInterceptor`에서 경로별 권한/존재 검증 확실히 분기 필요 (developer-backend가 CP3에서 주의).
  - **동시성**: 여러 클라이언트가 동시에 `/choose` 전송 시 race condition 가능 → developer-backend가 `synchronized` or Redis Lua 스크립트로 원자성 보장 필요.
  - **매칭 동시성 (신규)**: 대규모 동시 매칭 요청 시 같은 빈 방이 여러 개 동시 생성될 수 있음 → Redis 분산락으로 1차 방지, 100% 방지 불가이므로 TTL 기반 빈 방 정리 병행.
  - **카운트다운 타이머 누수 (신규, Option α 채택 시)**: 카운트다운 중 전원 퇴장 시 타이머 취소 안 하면 누수 → `ScheduledFuture.cancel()` 필수.
  - **타임아웃 스케줄러 누수**: 방 해산 시 pending 태스크 취소 안 하면 메모리 누수 → `ScheduledFuture.cancel()` 필수.
  - **ddl-auto=update 제약**: 기존 `admin_rsp_play` 테이블은 update로 자동 DROP되지 않음 → 사용자가 직접 SQL 실행해야 함을 PRD §11에 명시.
  - **기존 RspChoice/RspResult enum 재사용 유혹**: 어드민 솔로 전용이었으므로 online-rps에서 새 enum(`RpsChoice`, `RpsResult`)으로 분리 권장. PRD §11 제거 대상에 포함.
  - **ALREADY_IN_ROOM 유저 경험 (신규)**: 브라우저 강제 종료 후 재진입 시 이전 방에 "유령 세션"으로 기록돼 매칭 차단될 수 있음 → `SessionDisconnectEvent`에서 확실한 참가자 제거 로직 필수. developer-backend CP3 검증 필요.

---

## 파일 소유권 메모

- `docs/specs/online-rps-prd.md` — planner 소유 (본인)
- `docs/progress/planner-online-rps.md` — planner 소유 (본 파일)
- `docs/progress/planner-rsp-game.md` — 교체 메모 추가 대상 (본 세션에서 1회 편집)
- 다른 팀원은 스펙 변경 필요 시 반드시 planner 경유

---

## 신규 환경변수

- **없음**. 기존 `JWT_SECRET`, `REDIS_URL`, `app.cors.allowed-origins` 재사용. Vercel/Railway UI 수정 불필요.
