# Progress — planner : Blockfall Battle

- 소유 팀원: planner
- 기능 키: `blockfall-battle`
- 최초 시작일: 2026-04-27
- 최종 업데이트: 2026-04-27 (Phase 2 구현 완료, 운영 반영 대기)
- 기반 PRD: `docs/specs/blockfall-battle-prd.md`

---

## 현재 상태

**Phase 2 전체 구현 완료 — 커밋/푸시 완료 (commit: 1caad2b).**

- CP1 PRD 작성 완료 → 사용자 승인 완료
- Phase 2 병렬 작업 (designer / developer-backend / developer-frontend) 모두 완료
- 코드 변경분 main 반영 완료

**잔여 (사용자 액션 필요):**
1. Railway DB 마이그레이션 실행 (`battle_record` 테이블 생성 SQL)
2. Vercel 환경변수 추가: `VITE_WS_BATTLE_URL` (WebSocket `/ws-battle` 엔드포인트 URL)
3. 운영 환경 통합 테스트 (게스트 입장 → 매칭 → 게임 진행 → 결과 화면 → 랭킹 갱신)

---

## 작업 로그

### 2026-04-27 — CP1 PRD 작성 완료 → 사용자 승인 → Phase 2 구현 완료

#### Phase 1: PRD 작성 (CP1)

작성 파일:
- `docs/specs/blockfall-battle-prd.md` (본 PRD, 18개 섹션)
- `docs/progress/planner-blockfall-battle.md` (본 파일)

사용자 지시 사항 반영:
- **모드 적용 범위**: 일반 모드만 (Excel 모드 제외) — 사용자 명시
- **랭킹 표시 위치**: 배틀 결과 화면 내에만, 홈화면 미적용 — 사용자 명시
- **진입 경로**: Test Lab 섹션을 통해서만 — 사용자 명시
- **주간 랭킹**: 제외 (역대 랭킹만)
- **신규 API 분리**: 기존 `rankingsApi` 재사용 X, `/api/blockfall-battle/rankings` 신설

핵심 결정 사항:
1. **상태 머신**: WAITING / PLAYING / FINISHED + 큐 대기.
2. **자동 시작**: 2인 이상 시 5초 카운트다운, 만료 시 GAME_STARTED.
3. **게스트 정책**: `guest_{uuid}` HTTP join 시 발급, 30초 비활성 시 만료 (방안 A 채택).
4. **인증 인프라**: `/ws-battle` 별도 엔드포인트 + 신규 `BlockfallBattleHandshakeInterceptor` (방안 A) — 기존 `/ws`와 분리 (회귀 위험 차단).
5. **콤보 → garbage 매핑**: 2콤보→1줄, 3콤보→2줄, 4콤보→3줄, 5+콤보→4줄.
6. **공격 대상**: 기본 랜덤, 클라이언트가 명시 시 우선.
7. **garbage line**: 회색, 줄당 랜덤 1칸 빈 자리, 같은 공격 내 줄들은 hole 동일.
8. **전적 DB**: `battle_record` 테이블 신설 (rankings와 분리), 로그인만 저장, 게스트 미저장.
9. **랭킹**: win_count DESC, TOP 10, 결과 화면 내에서만 표시.
10. **WebSocket 메시지**: 9종 서버→클라(ROOM_STATE, GAME_STARTED, BOARD_UPDATE, GARBAGE_ATTACK, PLAYER_FINISHED, GAME_RESULT, QUEUE_POSITION, PLAYER_LEFT, ERROR), 4종 클라→서버(JOIN_BATTLE, BOARD_STATE, COMBO_ATTACK, LEAVE_BATTLE).
11. **도중 입장**: 큐(FIFO 무제한), QUEUE_POSITION으로 안내, 다음 라운드 시 4인까지 자동 승격.
12. **비기능**: BOARD_UPDATE 200ms 주기, 동시 방 수 제한 없음, Redis 미사용 (현재).

CP1 결과: **사용자 승인 완료** → Phase 2 병렬 시작 선언.

#### Phase 2: 구현 병렬 작업

- designer: `docs/design/blockfall-battle.md` 작성, Test Lab 페이지/배틀 화면/결과 화면 컴포넌트 명세 확정
- developer-backend: 엔티티(`BattleRecord`), Repository, Service, Controller(`/api/blockfall-battle`), `/ws-battle` 핸드셰이크 인터셉터, WebSocket 핸들러, 콤보→garbage 매핑 로직, 큐 매니저 모두 구현
- developer-frontend: `BlockfallBattleBoard.tsx`, Test Lab 진입 페이지, 결과 화면(랭킹 TOP10 포함), WebSocket 클라이언트 훅 구현

Phase 2 결과: **commit 1caad2b로 main 반영 완료**.

---

## 오픈 퀘스천 처리 결과

CP1 단계에서 던졌던 오픈 퀘스천 중 Phase 2에서 해소된 항목:
- OQ-1 (게스트 인증 방안 A vs B): **방안 A 채택** — `/ws-battle` 별도 엔드포인트.
- OQ-2 (BOARD_UPDATE batching): developer-backend가 200ms 주기 직접 송신으로 결정.
- OQ-3 (4인 꽉 찼을 때 카운트다운 즉시 만료): developer-backend 구현 시 즉시 만료로 결정.
- OQ-5 (결과 화면 10초 자동 다음 라운드): designer가 큐 잔류자에게 자동 승격 알림 노출로 확정.
- OQ-6 (모바일 UX): designer가 자기 보드 우선 + 상대 보드 축소 표시로 확정.
- OQ-7 (Test Lab 페이지 디자인): designer 명세 반영 완료.
- OQ-8 (게스트 닉네임 충돌): designer가 `guest_xxxx` 접미 4자리 표시로 확정.

운영 단계로 넘긴 항목 (필요 시 별도 추적):
- OQ-4 (LEAVE/disconnect 전적 처리 차이): 운영 데이터 보고 필요 시 후속 PRD.
- OQ-9 (콤보 시퀀스 ID 중복 방지): developer-backend 구현부 내부 결정.
- OQ-10 (큐 무제한 운영 검증): 통합 테스트 후 트래픽 패턴 보고 결정.

---

## 참조 문서

- 본 PRD: `docs/specs/blockfall-battle-prd.md`
- 디자인 명세: `docs/design/blockfall-battle.md`
- WebSocket 인프라 레퍼런스: `docs/specs/online-rps-prd.md`
- 백엔드 구현 패턴: `docs/progress/developer-backend-online-rps.md`
- 기존 싱글 게임: `frontend/src/games/blockfall/BlockfallBoard.tsx`
- 본 기능 커밋: `1caad2b`

---

## 다음 세션

1. **사용자가 Railway 마이그레이션 실행** → 결과 보고받고 이슈 시 developer-backend로 라우팅
2. **사용자가 Vercel `VITE_WS_BATTLE_URL` 추가** → 재배포 후 동작 확인 보고받음
3. **운영 통합 테스트 결과 수신** → 발견 이슈를 originator(designer/developer-frontend/developer-backend)에 라우팅
4. 큐 무제한 정책의 실 트래픽 검증 결과 검토 (OQ-10)
5. LEAVE/disconnect 전적 처리 정책 재검토 필요성 확인 (OQ-4)
