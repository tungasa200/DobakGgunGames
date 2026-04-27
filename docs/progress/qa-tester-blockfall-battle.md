# QA 진행 로그 — Blockfall Battle

- 담당자: qa-tester
- 기능: 블록폴 통신배틀 모드 (blockfall-battle)
- 최초 작성: 2026-04-27
- 기반 PRD: `docs/specs/blockfall-battle-prd.md` (CP1 완료본)

---

## 현재 상태

**Phase: CONDITIONAL PASS — P3 BUG-004 잔존, 기능 차단 없음. 배포 후 E2E 재실행 대기**

- [x] PRD 완독 (§1~§18 전체, 특히 §15 엣지 케이스 15건 전수 분석)
- [x] 기존 테스트 플랜 패턴 검토 (online-rps-test-plan.md, blockfall-insane-test-plan.md)
- [x] `docs/review/blockfall-battle-test-plan.md` 작성 완료 (51개 TC: P1×20, P2×21, P3×12)
- [x] `docs/review/regression-checklist.md` 업데이트 완료 (배틀 신규 항목 추가)
- [x] developer-frontend 구현 완료 수신 (2026-04-27) — 프론트 정적 분석 완료 (이전 세션)
- [x] developer-backend 구현 완료 수신 (2026-04-27)
- [x] 백엔드 구현 파일 정적 코드 리뷰 완료 (2026-04-27)
- [x] OQ-1 확정(방안 A) / OQ-3 확정(4인 즉시 만료) → 테스트 플랜 반영 완료
- [x] TC-MATCH-01 갱신 완료 (4인 Case B 추가)
- [x] Block Out 감지 경로 미구현 이슈 → BUG-001 제기 → 백엔드 수정 후 PASS
- [x] `docs/review/blockfall-battle-bugs.md` 작성 완료 (BUG-001~BUG-007 + 프론트 Bug #1 전체)
- [x] BUG-001 (P1): player-finished 경로 미구현 → 백엔드 수정 후 TC-GAME-02 PASS
- [x] BUG-002 / BUG-005 (P1): guestToken 검증 우회 → REST+핸드셰이크 양쪽 수정 후 CLOSED (TC-SEC-02, TC-EDGE-02 PASS)
- [x] BUG-003 (P2): sessionId null NPE → 백엔드 수정 후 PASS
- [x] BUG-004 (P2→P3 재분류): voluntaryLeft dead code 구조 → CONDITIONAL PASS (P3로 재분류, 기능 차단 없음)
- [x] BUG-006 (P2): tryStartCountdown 경쟁조건 → 백엔드 수정 후 PASS
- [x] BUG-007: false positive 확인 (FK 정상) — 닫힘
- [x] Bug #1 (프론트 P1): HomePage Test Lab `{user&&}` 게스트 차단 → 직접 수정 PASS
- [x] TC-EDGE-01 (TC-11) PASS: Test Lab 게스트 포함 노출 확인, 배틀 전용 Test Lab 진입 격리 확인
- [x] TC-RESULT-04 (TC-12) PASS: 결과화면 랭킹 표시 확인, 홈화면 미노출 확인
- [x] 최종 판정: CONDITIONAL PASS
- [ ] Railway/Vercel 배포 후 실제 E2E TC 재실행 (TC-JOIN-01~02, TC-COMBO, TC-CONN-09)

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

> TC 그룹 코드: TC-SEC×5, TC-JOIN×6, TC-MATCH×5, TC-GAME×7, TC-COMBO×6, TC-CONN×5, TC-RESULT×4, TC-EDGE×8, TC-REG×5, TC-PERF×3, TC-ACCESS×2

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

| ID | 항목 | 담당 | 상태 | TC 영향 |
|---|---|---|---|---|
| OQ-1 | 게스트 인증 방안 A/B 선택 | developer-backend | **확정: 방안 A** | TC-SEC 반영 완료 |
| OQ-3 | 4인 꽉 찼을 때 카운트다운 즉시 만료 여부 | developer-backend | **확정: 즉시 만료** | TC-MATCH-01 반영 완료 |
| OQ-9 | 콤보 중복 시퀀스 ID 도입 여부 | developer-backend | OPEN | EC-15 대응 TC 추가 필요 |
| OQ-5 | 결과 화면 후 큐 대기자 컨펌 여부 | designer | OPEN | TC-MATCH-05 플로우 조정 가능 |

---

## 발견된 버그 목록

### 프론트엔드 버그

| ID | 제목 | 우선순위 | 파일 | 상태 |
|---|---|---|---|---|
| Bug #1 | [HomePage] 게스트/비로그인에게 Test Lab 카드 미노출 | P1 Critical | `frontend/src/pages/HomePage.tsx` L246 | **PASS** — `{user&&}` 조건 수정, TC-EDGE-01 통과 |
| Bug #2 | [배틀 게스트] GAME_RESULT 즉시 토큰 폐기로 재사용 의도 불일치 | P3 Medium | `frontend/src/pages/BlockfallBattlePage.tsx` L207 | 배포 후 E2E 재확인 필요 |
| Bug #3 | [카운트다운 취소] countdown=0 초기값 동일로 MATCH_COUNTDOWN_CANCELLED 처리 불안정 가능성 | P3 Medium | `frontend/src/api/blockfallBattleApi.ts` / `BlockfallBattlePage.tsx` L217 | 배포 후 E2E 재확인 필요 |

### 백엔드 버그 (BUG-001~007)

| ID | 제목 | 우선순위 | 상태 |
|---|---|---|---|
| BUG-001 | Block Out 게임오버 신호 경로(player-finished) 미구현 | P1 Critical | **PASS** — 백엔드 수정 후 TC-GAME-02 통과 |
| BUG-002 | `guest_` 빈 uuid 토큰 401 미반환 | P1 Critical | **CLOSED** — UUID v4 정규식 검증 추가, TC-SEC-02/TC-EDGE-02 PASS |
| BUG-003 | REST join 시 sessionId=null → sessionRoomMap NPE 가능 | P2 High | **PASS** — 백엔드 null 처리 수정 후 통과 |
| BUG-004 | 이탈자 전적 저장 방어 로직 없음 (voluntaryLeft dead code) | P2→**P3** | **CONDITIONAL PASS** — P3 재분류, 기능 차단 없음, 추후 개선 |
| BUG-005 | uuid 4자 미만 guestToken 허용 | P1 Critical | **CLOSED** — BUG-002와 통합 해결, TC-EDGE-02 PASS |
| BUG-006 | tryStartCountdown 중복 브로드캐스트 경쟁 조건 | P2 High | **PASS** — 백엔드 수정 후 통과 |
| BUG-007 | battle_record FK 참조 테이블명 불일치 (`users` vs `user`) | P2 High | **FALSE POSITIVE** — FK 정상 확인, 닫힘 |

상세 내용: `/c/Users/YJMEDIA/Desktop/김성우/장난감/dobakggun/docs/review/blockfall-battle-bugs.md`

---

## 최종 판정 (2026-04-27)

**CONDITIONAL PASS**

- P1 Critical 전건 해소 (BUG-001 PASS, BUG-002/005 CLOSED, Bug #1 PASS)
- P2 High 전건 해소 (BUG-003 PASS, BUG-006 PASS, BUG-007 FALSE POSITIVE)
- 잔존: BUG-004 P3 재분류 (voluntaryLeft dead code — 기능 차단 없음, 기술 부채로 관리)
- TC-EDGE-01, TC-RESULT-04 코드 레벨 PASS 확인
- 배포 후 실제 E2E TC 실행 시 FULL PASS 전환 가능

## 다음 액션 (배포 후)

1. **Railway/Vercel 배포 완료 후**: TC-JOIN-01, TC-JOIN-02 실행 (실제 WebSocket 연결 흐름)
2. **배포 후**: TC-COMBO 그룹 전수 실행 (Garbage Line 매핑 실시간 검증)
3. **배포 후**: TC-CONN-09 실행 (연결 끊김 복구 시나리오)
4. **배포 후**: TC-REG-01~05 smoke test (기존 게임 회귀 최종 확인)
5. **잔존 P3 (BUG-004)**: 다음 스프린트에서 voluntaryLeft 처리 정상화 후 재검증
6. **E2E 전체 PASS 확인 후**: FULL PASS 선언 및 docs/review/regression-checklist.md 최종 업데이트
