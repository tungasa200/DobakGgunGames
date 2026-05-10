# 야추 D8 모드 균형 재조정

- 일자: 2026-05-10
- 동기: D8 면당 적중률(1/8)이 낮아 하단 족보(YACHT/FH/4K/스트레이트) 단판 확률이 D6 대비 절반 이하 → 게임 재미 저하 우려
- 결정: 턴당 굴림 3 → **4**, 상단 보너스 임계 84 → **108** (면 합 비례 63 × 36/21)
- D6 룰은 어떤 코드도 변경하지 않음 (사용자 명시 가드레일)

## 균형 검증 (이론)

| | D6 3롤 | D8 3롤(이전) | D8 4롤(현재) |
|---|---|---|---|
| 1주사위 적중률 | 1−(5/6)³ ≈ 42.1% | 1−(7/8)³ ≈ 33.0% | 1−(7/8)⁴ ≈ 41.4% |
| 상단 합 기대값 | 21 × 2.106 ≈ 44.2 | 36 × 1.650 ≈ 59.4 | 36 × 2.069 ≈ 74.5 |
| 임계 | 63 | 84 | 108 |
| 임계까지 부족분 비율 | ~42% | ~41% | ~45% |

D6 3롤과 D8 4롤은 면당 적중률이 거의 동일. 임계까지의 부족분 비율도 비슷한 수준으로 유지되어 보너스 도달 난이도가 균형.

## 변경 파일

### Backend
- `service/yacht/YachtScoreRules.java` — `default int maxRollsPerTurn() { return 3; }` 추가 (default라 D6Rules 무수정)
- `service/yacht/D8Rules.java` — `maxRollsPerTurn() = 4` override, `upperBonusThreshold() = 108`로 변경
- `service/YachtGameService.java` — 모든 하드코딩 `3`을 `rules.maxRollsPerTurn()`로 교체 (startGame, recordScore, advanceTurnForReconnecting, voteKick, handlePlayingLeave, resetForRestart). `state.rollsLeft == 3` 첫 굴림 검사는 기존 `state.hasRolled` 플래그로 대체.
- `test/.../YachtScoreCalculatorTest.java` — D8 threshold 108, maxRollsPerTurn 4 assertion 추가. D6 maxRollsPerTurn 3 assertion 추가 (default 동작 검증).

### Frontend
- `types/yacht.types.ts` — `UPPER_BONUS_THRESHOLD_BY_MODE.D8 = 108`, `MAX_ROLLS_BY_MODE` 신규 export (D6=3, D8=4)
- `hooks/useYachtGame.ts` — `rollsLeft` 초기값을 모드별로 설정. `rollsLeft === 3` 첫 굴림 검사를 `MAX_ROLLS_BY_MODE[diceType]` 비교로 교체.
- `components/YachtGameScreen.tsx` — `rollsUsed = maxRolls - rollsLeft`, 첫 굴림 텍스트/안내 메시지 모드 분기.
- `components/YachtScoreBoard.tsx` — 주석만 갱신.

### Docs
- `docs/specs/yacht-d8-mode-prd.md` — §3 표, §5.2, §5.7, §11.2 카드 설명, §13 OQ-1/OQ-2, §15 출시 기준, §16 책임 매트릭스, §17 변경 이력
- `docs/specs/yacht-api-contract.md` — `rollsLeft` 의미 갱신, 보너스 임계 갱신, 변경 이력
- `docs/design/yacht-d8-design.md` — 카드 텍스트, 점수판 합계 표기, 컴포넌트 prop 설명
- `docs/review/yacht-d8-test-plan.md` — A-2 임계 케이스 84→108로, E-2/E-4 카드/점수판 표기, G-13/G-14 D6 회귀 추가, **§H 4롤 검증 케이스 신규**
- `docs/progress/planner-yacht-d8.md` — 결정 매핑 표

## D6 무수정 가드 (체크리스트)

- [x] `D6Rules.java` 변경 없음 (`git diff`로 확인됨)
- [x] `D6Rules.maxRollsPerTurn()` 명시 구현 없음 → 인터페이스 default(3) 사용
- [x] D6 모드 게임 흐름에서 `rollsLeft` 초기값 = 3 (default 메서드를 통해 자동 보장)
- [x] D6 회귀 테스트 항목 G-13/G-14 추가
- [x] D6 임계 63점 변경 없음

## 후속 작업
- [ ] 백엔드 `./gradlew test` 통과 확인
- [ ] 프론트 `tsc -b && eslint .` 통과 확인
- [ ] 사용자 환경변수 변경 없음 (재배포만 필요)
