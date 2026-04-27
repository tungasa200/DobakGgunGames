# QA 진행 로그 — Blockfall Battle

- 담당자: qa-tester
- 기능: 블록폴 통신배틀 모드 (blockfall-battle)
- 최초 작성: 2026-04-27
- 기반 PRD: `docs/specs/blockfall-battle-prd.md` (CP1 완료본)

---

## 현재 상태

**Phase: BUG-002/BUG-005 CLOSED — 잔존 P1: BUG-001 1건 차단 유지**

- [x] PRD 완독 (§1~§18 전체, 특히 §15 엣지 케이스 15건 전수 분석)
- [x] 기존 테스트 플랜 패턴 검토 (online-rps-test-plan.md, blockfall-insane-test-plan.md)
- [x] `docs/review/blockfall-battle-test-plan.md` 작성 완료
- [x] `docs/review/regression-checklist.md` 업데이트 완료 (배틀 신규 항목 추가)
- [x] developer-frontend 구현 완료 수신 (2026-04-27) — 프론트 정적 분석 완료 (이전 세션)
- [x] developer-backend 구현 완료 수신 (2026-04-27)
- [x] 백엔드 구현 파일 정적 코드 리뷰 완료 (2026-04-27)
- [x] OQ-1 확정(방안 A) / OQ-3 확정(즉시 만료) → 테스트 플랜 반영 완료
- [x] TC-MATCH-01 갱신 완료 (4인 Case B 추가)
- [x] Block Out 감지 경로 미구현 이슈 → TC-GAME-02 보류 + BUG-001 제기
- [x] `docs/review/blockfall-battle-bugs.md` 업데이트 완료 (백엔드 버그 BUG-001~BUG-007 추가)
- [x] BUG-002/BUG-005 재검증 완료 (2026-04-27) — TC-SEC-02, TC-EDGE-02 코드 레벨 PASS, CLOSED
- [ ] BUG-001 수정 대기 (P1 Critical 차단 유지)
- [ ] P2 버그 수정 대기 (BUG-003, BUG-004, BUG-006, BUG-007)
- [ ] 수정 후 TC 실행
- [ ] E2E 통합 TC 실행

---

## 테스트 플랜 요약

파일: `docs/review/blockfall-battle-test-plan.md`

### TC 집계

| 그룹 | TC 수 | P1 Critical | P2 High | P3 Medium | P4 Low |
|---|---|---|---|---|---|
| TC-SEC (보안/인증) | 5 | 4 | 1 | 0 | 0 |
| TC-JOIN (참가/매칭) | 6 | 2 | 3 | 1 | 0 |
| TC-MATCH (방 상태 머신) | 5 | 0 | 3 | 1 | 0 |
| TC-GAME (게임 플레이) | 7 | 1 | 3 | 3 | 0 |
| TC-COMBO (콤보/Garbage) | 6 | 3 | 2 | 1 | 0 |
| TC-CONN (연결 끊김) | 5 | 0 | 4 | 1 | 0 |
| TC-RESULT (결과/랭킹) | 4 | 2 | 2 | 0 | 0 |
| TC-EDGE (엣지 케이스) | 8 | 3 | 3 | 2 | 0 |
| TC-REG (회귀) | 5 | 5 | 0 | 0 | 0 |
| TC-PERF (성능) | 3 | 0 | 0 | 3 | 0 |
| TC-ACCESS (접근성) | 2 | 0 | 0 | 0 | 2 |
| **합계** | **51** | **20** | **21** | **12** | **2** |

### 주요 검증 포인트

1. **게스트 인증 격리**: `/ws-battle` 신규 엔드포인트가 기존 `/ws`와 완전 분리. guestToken이 `/ws`에서 거부됨 (TC-SEC-03).
2. **전적 저장 무결성**: 게스트의 battle_record 미저장, 로그인 유저만 저장 (TC-JOIN-02, TC-RESULT-03).
3. **Garbage Line 매핑**: PRD §7.1 콤보-줄수 매핑 전수 검증 (TC-COMBO-01, TC-COMBO-02).
4. **Test Lab 격리**: 일반 게임 카드/네비게이션에 배틀 미노출 (TC-EDGE-01).
5. **홈 랭킹 미노출**: 배틀 랭킹이 결과 화면에만 표시 (TC-RESULT-04).
6. **회귀 보호**: 싱글 블록폴, 인세인, RPS, 채팅 전체 smoke test (TC-REG-01~05).

### Excel 모드

N/A — PRD §3 명시 확인. 배틀 모드에 Excel 코드 발견 시 즉시 반려.

---

## 반려 기준 (즉시 차단)

- Test Lab 외 진입 경로 노출
- 홈화면에 배틀 랭킹 요소 노출
- 게스트 전적 DB 저장
- 기존 싱글/인세인/RPS/채팅 기능 회귀
- Garbage 줄수 매핑 오류
- guestToken이 `/ws`에서 허용되는 경우 (WebSocket 엔드포인트 격리 파손)

---

## 미결 사항

| ID | 항목 | 담당 | TC 영향 |
|---|---|---|---|
| OQ-1 | 게스트 인증 방안 A/B 선택 | developer-backend | 방안 B 선택 시 TC-SEC 회귀 범위 전체 확대 |
| OQ-3 | 4인 꽉 찼을 때 카운트다운 즉시 만료 여부 | developer-backend | TC-MATCH-01 조건 조정 필요 |
| OQ-9 | 콤보 중복 시퀀스 ID 도입 여부 | developer-backend | EC-15 대응 TC 추가 필요 |
| OQ-5 | 결과 화면 후 큐 대기자 컨펌 여부 | designer | TC-MATCH-05 플로우 조정 가능 |

---

## 발견된 버그 목록

### 프론트엔드 버그 (이전 세션)

| ID | 제목 | 우선순위 | 파일 | 상태 |
|---|---|---|---|---|
| Bug #1 | [HomePage] 게스트/비로그인에게 Test Lab 카드 미노출 | P1 Critical | `frontend/src/pages/HomePage.tsx` L246 | 반려 판정 — 수정 대기 |
| Bug #2 | [배틀 게스트] GAME_RESULT 즉시 토큰 폐기로 재사용 의도 불일치 | P3 Medium | `frontend/src/pages/BlockfallBattlePage.tsx` L207 | 백엔드 연동 후 재현 확인 필요 |
| Bug #3 | [카운트다운 취소] countdown=0 초기값 동일로 MATCH_COUNTDOWN_CANCELLED 처리 불안정 가능성 | P3 Medium | `frontend/src/api/blockfallBattleApi.ts` / `BlockfallBattlePage.tsx` L217 | 백엔드 연동 후 재현 확인 필요 |

### 백엔드 버그 (이번 세션 — BUG-001~007)

| ID | 제목 | 우선순위 | 상태 |
|---|---|---|---|
| BUG-001 | Block Out 게임오버 신호 경로 미구현 | P1 Critical | OPEN — 수정 대기, TC-GAME-02 보류 |
| BUG-002 | `guest_` 빈 uuid 토큰 401 미반환 | P1 Critical | CLOSED — UUID v4 정규식 검증 추가 해결, TC-SEC-02/TC-EDGE-02 PASS |
| BUG-003 | REST join 시 sessionId=null → sessionRoomMap NPE 가능 | P2 High | OPEN — 수정 대기 |
| BUG-004 | 이탈자 전적 저장 방어 로직 없음 | P2 High | OPEN — 수정 대기 |
| BUG-005 | uuid 4자 미만 guestToken 허용 | P1 Critical | CLOSED — BUG-002와 통합 해결, TC-EDGE-02 PASS |
| BUG-006 | tryStartCountdown 중복 브로드캐스트 경쟁 조건 | P2 High | OPEN — 수정 대기 |
| BUG-007 | battle_record FK 참조 테이블명 불일치 (`users` vs `user`) | P2 High | OPEN — 수정 대기 |

상세 내용: `/c/Users/YJMEDIA/Desktop/김성우/장난감/dobakggun/docs/review/blockfall-battle-bugs.md`

---

## 다음 액션

1. **즉시 (developer-backend)**: BUG-001 수정 우선 — Block Out 감지 경로 구현 (방안 A 권장: handleBoardState()에서 서버 직접 감지)
2. **P2 수정 (developer-backend)**: BUG-003, BUG-004, BUG-006, BUG-007 수정
3. **즉시 (developer-frontend)**: Bug #1 수정 (`{user && (...)}` 조건 수정으로 게스트 접근 허용)
4. **BUG-001 수정 후**: TC-GAME-02 조건 최종 확정 및 실행, TC-EDGE-01 재검증
5. **모든 P1 해결 후**: 백엔드 TC (TC-SEC, TC-JOIN, TC-MATCH, TC-COMBO, TC-RESULT API) 실행
6. **양쪽 완료 후**: E2E TC (TC-JOIN-01, TC-JOIN-02, TC-COMBO-06 동시성) 실행
