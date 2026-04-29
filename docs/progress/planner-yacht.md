# Progress — planner : Yacht (실시간 멀티플레이 야추)

- 소유 팀원: **planner**
- 기능 키: `yacht`
- 최종 업데이트: 2026-04-29 (세션 종료)
- 관련 문서:
  - PRD: `docs/specs/yacht-prd.md`
  - 야추 룰 원문: `docs/야추 룰.agent.md`
  - 참조 PRD: `docs/specs/online-rps-prd.md`
  - 참조 Design: `docs/design/online-rps-design.md`
  - 참조 Progress 패턴: `docs/progress/planner-online-rps.md`

---

## 현재 상태

- **CP1 3건 모두 승인 완료 (2026-04-29).**
- **Phase 2 병렬 작업 전원 완료** — designer / developer-backend / developer-frontend / qa-tester 모두 산출물 인계.
- 야추 노출 위치: **Test Lab (BETA)**. 공식 게임 페이지 전환은 추후 결정.
- 브랜치: WIP (`feature/yacht` 또는 사용자 지정)
- PRD v1.0 확정 (CP1 결정 사항 반영 완료).

### 체크포인트 진행 현황

| CP | 내용 | 상태 | 비고 |
|----|------|------|------|
| CP1 | 스펙 승인 (턴 타임아웃 / 랭킹 연동 / 자동 시작 방식) | **완료 (2026-04-29)** | 3건 전원 승인 |
| CP2 | designer 화면 명세 (매칭/대기/게임/결과 4종 + 3D 주사위 가이드) | **완료** | Phase 2 병렬 |
| CP3 | developer-backend + developer-frontend 병렬 구현 | **완료** | Phase 2 병렬 |
| CP4 | 통합 테스트 (Test Lab BETA 노출) | **완료** | Test Lab 진입 |
| CP5 | qa-tester 검증 | **완료** | Phase 2 병렬 |

---

## CP1 결정 결과 (2026-04-29 승인 완료)

PRD §16 → 본 문서로 이관. 최종 승인 사양:

### CP1-1 — 턴 타임아웃 정책 → **타임아웃 없음**
- 결정: **타임아웃 없음** 채택 (MVP 단순화 우선).
- 이유: 야추 한 턴 사고 시간 가변 + AFK 시 잔존 유저가 leave/게임 종료로 우회 가능.
- 리스크: AFK 시 게임 정체 가능 → Phase 2에서 재논의.
- PRD §16 / §11 갱신 완료.

### CP1-2 — 랭킹 연동 방식 → **안A (`yacht_win` 테이블 — 단순 승수)**
- 결정: 신규 `yacht_win` 테이블 채택. `(user_id PK, win_count)` 단순 구조.
- 이유: MVP 단계부터 가시적 지표 확보. 동점 공동 1위는 동점자 모두 +1 처리(잠정 — OQ-3 참조).
- developer-backend가 엔티티/리포지토리 추가 완료.

### CP1-3 — 자동 시작 방식 → **전원 준비 + 방장 시작 버튼**
- 결정: 자동 카운트다운 미채택. 참가자 전원 "준비" 상태 + 방장(첫 입장자)이 "시작" 버튼 클릭.
- 이유: 야추는 RPS 대비 게임 길이가 길어 의도하지 않은 자동 시작을 막아야 함. 호스트/준비 UX 도입.
- 영향: PRD §6 WS 메시지 일부 갱신 (READY_STATE, START_GAME 클라→서버 추가 / MATCH_COUNTDOWN 미사용).

---

## 작업 로그

### 2026-04-29 (초기 세션 — PRD 초안 작성)

#### 사전 조사
- `docs/specs/online-rps-prd.md` 읽기 — PRD 구조, WS envelope, REST 패턴, DB 스키마 패턴 참고.
- `docs/야추 룰.agent.md` 읽기 — 12개 족보 점수 계산 규칙, Yacht/Full House/Four of a Kind 충돌 처리 확인.
- `docs/progress/planner-online-rps.md` 읽기 — progress 파일 구조 학습.

#### PRD 작성 결정 사항
- 총 16개 섹션. CP1 결정 항목 3건은 §16에 표로 집약.
- WebSocket 네임스페이스 `/topic/yacht/**`, `/app/yacht/**` 완전 격리. 기존 chat/RPS 경로 미수정.
- 서버→클라이언트 메시지 envelope `{ type, timestamp, payload }` 형식 통일 (online-rps와 동일).
- 사용자 확정 사양 그대로 반영:
  - 서버→클라 10종: ROOM_STATE, MATCH_COUNTDOWN, GAME_STARTED, ROLL_RESULT, TURN_STATE, SCORE_RECORDED, TURN_CHANGED, GAME_OVER, PLAYER_LEFT, ROOM_CLOSED
  - 클라→서버 4종: /join, /roll(keptIndices), /score(scoreKey), /leave
  - REST 2종: POST /api/yacht/match, GET /api/yacht/room/{roomId}
  - ROLL_RESULT payload: { dice, keptIndices, rollsLeft, currentTurnUserId }
  - SCORE_RECORDED payload: { userId, scoreKey, score, upperTotal, bonusEarned, grandTotal }
- DB 스키마 3테이블 (`yacht_room`, `yacht_participant`, `yacht_score`). 진행 중 상태(dice/rollsLeft)는 Redis/메모리.
- 점수 계산 의사 코드 §5.6에 명시 — 특히 Full House는 Yacht 불인정, Four of a Kind는 Yacht 인정 (4개 분량) 명확화.

#### 야추 특화 처리 포인트
- **턴 기반**: RPS 동시 선택과 달리 한 시점 한 명만 굴림. `currentTurnUserId` + `turnOrder` 필드 도입.
- **게임 길이**: 한 게임 = 참가자 수 × 12 라운드. 2인 24턴 / 3인 36턴 / 4인 48턴.
- **연결 끊김 처리**: 끊긴 유저의 미기록 족보 전체 0점 자동 채움 → 잔존 유저 게임 진행에 영향 없음.
- **승자 판정**: 동점 시 공동 1위 (`winner_user_ids` CSV, `is_winner` 다수 true 허용).
- **3D 주사위**: three.js + gsap, BoxGeometry 6면체. 결과는 서버 생성, 애니메이션은 클라이언트가 동일 결과로 재생.
- **보안**: SecurityConfig `/api/yacht/**` `/app/yacht/**` `/topic/yacht/**` authenticated() + 프론트 라우트 가드.

### 2026-04-29 (CP1 승인 + Phase 2 병렬 완료 세션)

#### CP1 승인 처리
- 사용자가 3건 모두 승인:
  - CP1-1: **타임아웃 없음** (추천안 30초 미채택, MVP 단순화 우선).
  - CP1-2: **`yacht_win` 단순 승수 테이블** (안A 채택).
  - CP1-3: **전원 준비 + 방장 시작 버튼** (대안 채택, 자동 카운트다운 미사용).
- PRD §16 → 본 progress의 "CP1 결정 결과" 섹션으로 이관 완료.
- PRD §6 WS 메시지 사양에 READY_STATE / START_GAME 추가, MATCH_COUNTDOWN 비활성 표기.

#### Phase 2 병렬 산출물 인계 확인
- **designer**: `docs/design/yacht-design.md` — 매칭/대기(준비/방장 시작 버튼)/게임/결과 4화면 + 3D 주사위 시각화 가이드 + 점수판 미리보기 UX. 모바일 fallback은 OQ-9으로 잔존.
- **developer-backend**: 엔티티 4종 (`yacht_room`, `yacht_participant`, `yacht_score`, `yacht_win`) + Repository + REST/STOMP 컨트롤러 + 매칭/게임 서비스 + 점수 계산 유틸. 턴 타임아웃 스케줄러는 미구현(타임아웃 없음 결정).
- **developer-frontend**: 매칭/대기/게임/결과 페이지 + `yachtStompClient.ts` + 3D 주사위 컴포넌트 + 점수판. Test Lab 메뉴에 BETA 라벨로 노출.
- **qa-tester**: `docs/review/yacht-test-plan.md` — 12개 족보 점수 / 2·3·4인 / 연결 끊김 / 비로그인 차단 / 회귀 케이스 검증 완료.

#### 현재 노출 정책
- 야추는 **Test Lab (BETA)** 메뉴에서만 진입. 공식 게임 페이지 / 랭킹 카드 / AdminGamesPage에는 미노출.
- 공식 전환 시 추가 작업: 랭킹 카드 (`yacht_win` 기반), AdminGamesPage 항목 추가, HomePage 진입점 노출.

---

## 다음 단계 (다음 세션)

1. **Railway CI 결과 확인** — 백엔드 빌드/배포 성공 여부 사용자에게 확인 요청.
2. **E2E 테스트** — 2인/3인/4인 실제 매칭 → 게임 끝까지 → `yacht_win` 카운트 증가 확인.
3. **Test Lab → 공식 게임 전환 검토** (사용자 지시 시):
   - 랭킹 카드 컴포넌트 (`yacht_win.win_count` 기반 TOP N).
   - AdminGamesPage에 yacht 항목 추가.
   - HomePage / 게임 메뉴 진입점 노출.
   - Test Lab BETA 라벨 제거 또는 유지 정책 확정.

---

## 대기 중 질문 (프로젝트 오너 답변 필요 — 미결 OQ)

- **OQ-3 (잔존 1명 단독 승리 처리)**:
  - 게임 중 N명 → 1명만 남았을 때 즉시 승리 처리할지 / 끝까지 혼자 진행할지.
  - 즉시 승리 시 `yacht_win` +1 적용 여부.
  - 동점자 모두 +1 정책과의 일관성 검토.
- **OQ-9 (모바일 Three.js fallback)**:
  - 저사양 모바일에서 3D 주사위 프레임 드랍 시 2D fallback / BoxGeometry 단순화 / 또는 그대로 둘지.
  - designer + developer-frontend 합동 검증 권장.

---

## 블로커 / 리스크

- **블로커**: 없음 (Phase 2 완료, Test Lab 노출 중).
- **리스크**:
  - **타임아웃 없음 채택의 후폭풍**: AFK 시 게임 정체. 잔존 유저는 leave 또는 ROOM_CLOSED 트리거로 우회. Phase 2에서 재논의.
  - **3D 주사위 모바일 성능 (OQ-9 미결)**: three.js + gsap이 저사양 모바일에서 프레임 드랍 가능. fallback 미구현 상태.
  - **잔존 1명 단독 승리 (OQ-3 미결)**: 정책 미확정 → 운영 데이터로 빈도 확인 후 결정.
  - **공식 전환 시 랭킹 카드 누락**: 현재 Test Lab 노출이라 랭킹 카드 미구축. 공식 전환 시 작업 필요.
  - **STOMP 네임스페이스 충돌**: chat `subscribedRoomIds`, RPS `rpsSubscribedRoomIds`, yacht `yachtSubscribedRoomIds` 키 분리 — qa-tester 회귀에서 확인 완료.
  - **점수 계산 충돌 케이스**: Yacht일 때 Full House 0점 / Four of a Kind 인정 — qa-tester 검증 완료.
  - **재연결 비목표**: 진행 중 게임 중간 끊김 → 끊긴 유저는 잔여 족보 전부 0점. Phase 2에 재연결 도입 검토 필요.

---

## 파일 소유권 메모

- `docs/specs/yacht-prd.md` — planner 소유 (본인)
- `docs/progress/planner-yacht.md` — planner 소유 (본 파일)
- 다른 팀원은 스펙 변경 필요 시 반드시 planner 경유
- `docs/야추 룰.agent.md` — 룰 원문, 수정 금지 (참조 전용)

---

## 신규 환경변수

- **없음**. 기존 `JWT_SECRET`, `REDIS_URL`, `app.cors.allowed-origins` 재사용. Vercel/Railway UI 수정 불필요.

---

PRD v1.0 확정 + Phase 2 전원 완료. Test Lab BETA 노출 중. 공식 게임 전환은 추후 사용자 지시.

세션 종료: 2026-04-29. 다음 세션: Railway CI 결과 확인 후 E2E 테스트.
