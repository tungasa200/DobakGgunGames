# Progress — planner : Blockfall Battle

- 소유 팀원: planner
- 기능 키: `blockfall-battle`
- 최초 시작일: 2026-04-27
- 최종 업데이트: 2026-04-27 (CP1 PRD 작성 완료)
- 기반 PRD: `docs/specs/blockfall-battle-prd.md`

---

## 현재 상태

**CP1 PRD 작성 완료 — Phase 2 병렬 시작 준비 완료.**

다음 팀원에게 인계:
- designer → CP2: `docs/design/blockfall-battle.md` 작성
- developer-backend → CP2 병렬: 엔티티/서비스/컨트롤러/`/ws-battle` 인터셉터 구현
- developer-frontend → CP2 병렬: `BlockfallBattleBoard.tsx` 신규 작성

---

## 작업 로그

### 2026-04-27 — CP1 PRD 작성 완료

#### 작성한 파일
- `docs/specs/blockfall-battle-prd.md` (본 PRD, 18개 섹션)
- `docs/progress/planner-blockfall-battle.md` (본 파일)

#### 사용자 지시 사항 반영
- **모드 적용 범위**: 일반 모드만 (Excel 모드 제외) — 사용자 명시
- **랭킹 표시 위치**: 배틀 결과 화면 내에만, 홈화면 미적용 — 사용자 명시
- **진입 경로**: Test Lab 섹션을 통해서만 — 사용자 명시
- **주간 랭킹**: 제외 (역대 랭킹만)
- **신규 API 분리**: 기존 `rankingsApi` 재사용 X, `/api/blockfall-battle/rankings` 신설

#### 핵심 결정 사항
1. **상태 머신**: WAITING / PLAYING / FINISHED + 큐 대기.
2. **자동 시작**: 2인 이상 시 5초 카운트다운, 만료 시 GAME_STARTED.
3. **게스트 정책**: `guest_{uuid}` HTTP join 시 발급, 30초 비활성 시 만료.
4. **인증 인프라**: `/ws-battle` 별도 엔드포인트 + 신규 `BlockfallBattleHandshakeInterceptor` 권장 (방안 A) — 기존 `/ws`와 분리 (회귀 위험 차단).
5. **콤보 → garbage 매핑**: 2콤보→1줄, 3콤보→2줄, 4콤보→3줄, 5+콤보→4줄.
6. **공격 대상**: 기본 랜덤, 클라이언트가 명시 시 우선.
7. **garbage line**: 회색, 줄당 랜덤 1칸 빈 자리, 같은 공격 내 줄들은 hole 동일.
8. **전적 DB**: `battle_record` 테이블 신설 (rankings와 분리), 로그인만 저장, 게스트 미저장.
9. **랭킹**: win_count DESC, TOP 10, 결과 화면 내에서만 표시.
10. **WebSocket 메시지**: 9종 서버→클라(ROOM_STATE, GAME_STARTED, BOARD_UPDATE, GARBAGE_ATTACK, PLAYER_FINISHED, GAME_RESULT, QUEUE_POSITION, PLAYER_LEFT, ERROR), 4종 클라→서버(JOIN_BATTLE, BOARD_STATE, COMBO_ATTACK, LEAVE_BATTLE).
11. **도중 입장**: 큐(FIFO 무제한), QUEUE_POSITION으로 안내, 다음 라운드 시 4인까지 자동 승격.
12. **비기능**: BOARD_UPDATE 200ms 주기, 동시 방 수 제한 없음, Redis 미사용 (현재).

#### 오픈 퀘스천 (CP2/CP3에서 답변)
- OQ-1: 게스트 인증 방안 A vs B 최종 선택 (developer-backend, CP3)
- OQ-2: BOARD_UPDATE batching 전략 (developer-backend, CP3)
- OQ-3: 4인 꽉 찼을 때 카운트다운 즉시 만료 여부 (developer-backend, CP3)
- OQ-4: LEAVE/disconnect의 전적 처리 차이 (planner, Phase 2)
- OQ-5: 결과 화면 10초 자동 다음 라운드 — 큐 잔류자 컨펌? (designer, CP2)
- OQ-6: 모바일 UX 보드 표시 방식 (designer, CP2)
- OQ-7: Test Lab 페이지 디자인 (designer, CP2)
- OQ-8: 게스트 닉네임 충돌 표시 (designer, CP2)
- OQ-9: 콤보 시퀀스 ID 중복 방지 (developer-backend, CP3)
- OQ-10: 큐 무제한 운영 검증 (planner, Phase 2)

---

## 참조 문서

- 본 PRD: `docs/specs/blockfall-battle-prd.md`
- WebSocket 인프라 레퍼런스: `docs/specs/online-rps-prd.md` (CP1 승인 완료)
- 백엔드 구현 패턴: `docs/progress/developer-backend-online-rps.md` (커밋 367c623)
- 기존 싱글 게임: `frontend/src/games/blockfall/BlockfallBoard.tsx`

---

## 다음 세션

- designer / developer-backend / developer-frontend 의 CP2 작업 산출물 검토
- 그 과정에서 발생하는 스펙 질문 빠르게 답변
- 사용자 승인 받은 후 본 PRD 상태를 "CP1 승인 완료"로 갱신
