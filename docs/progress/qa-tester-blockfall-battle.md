# QA 진행 로그 — Blockfall Battle

- 담당자: qa-tester
- 기능: 블록폴 통신배틀 모드 (blockfall-battle)
- 최초 작성: 2026-04-27
- 기반 PRD: `docs/specs/blockfall-battle-prd.md` (CP1 완료본)

---

## 현재 상태

**Phase: 프론트엔드 코드 레벨 정적 분석 완료 — P1 버그 발견, PR 반려 판정**

- [x] PRD 완독 (§1~§18 전체, 특히 §15 엣지 케이스 15건 전수 분석)
- [x] 기존 테스트 플랜 패턴 검토 (online-rps-test-plan.md, blockfall-insane-test-plan.md)
- [x] `docs/review/blockfall-battle-test-plan.md` 작성 완료
- [x] `docs/review/regression-checklist.md` 업데이트 완료 (배틀 신규 항목 추가)
- [ ] developer-backend 구현 완료 대기
- [x] developer-frontend 구현 완료 수신 (2026-04-27)
- [x] 프론트엔드 코드 레벨 정적 분석 실행 (2026-04-27)
  - TC-EDGE-01: FAIL — Bug #1 (P1 Critical) 발견
  - TC-RESULT-04: PASS (코드 레벨)
  - 원본 파일 무수정 확인: PASS (BlockfallBoard.tsx, BlockfallInsaneBoard.tsx 변경 없음)
  - Bug #2 (P3), Bug #3 (P3) 추가 발견
- [x] PR 반려 판정 발행 — developer-frontend에게 전달
- [ ] Bug #1 수정 후 재검증
- [ ] developer-backend 구현 완료 후 백엔드 TC 실행
- [ ] E2E 통합 TC 실행 (TC-JOIN-01, TC-JOIN-02, TC-COMBO-06 등)
- [ ] 버그 리포트 작성 (`docs/review/blockfall-battle-bugs.md`)

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

## 다음 액션

1. developer-backend 구현 완료 시: 백엔드 TC (TC-SEC, TC-JOIN, TC-MATCH, TC-COMBO 서버 로직, TC-RESULT API) 실행
2. developer-frontend 구현 완료 시: 프론트엔드 TC (TC-EDGE-01 진입 경로, TC-RESULT-04 결과 화면, TC-ACCESS, TC-GAME UI) 실행
3. 양쪽 완료 시: E2E TC (TC-JOIN-01, TC-JOIN-02, TC-COMBO-06 동시성) 실행
4. 버그 발견 시: `docs/review/blockfall-battle-bugs.md` 작성 + 해당 developer에게 직접 메시지
