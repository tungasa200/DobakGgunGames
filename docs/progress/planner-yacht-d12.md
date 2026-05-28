# planner-yacht-d12 진행 로그

## 2026-05-28

### 작업
- D12 모드 PRD 최초 작성 — `docs/specs/yacht-d12-mode-prd.md`
- D8 PRD(`yacht-d8-mode-prd.md`) 균형 정책 및 코드 분석 결과를 기반으로 D12 수치 산정.

### 핵심 결정 사항 (잠정)
- 한 턴 굴림 횟수: **5회** (1주사위 적중률 1-(11/12)^5 ≈ 35.5% — D6 3롤(42.1%) 대비 ~84%)
- 상단 보너스 임계: **245점** (D8 비율 동일 적용: 234 × 1.037 ≈ 243 → 정수 정합 245)
- 상단 보너스 점수: **+35** (모드 공통 유지)
- 하단 신규 족보: **도입 안 함** (D6/D8 공통 6개 유지)
- 총 족보 수: **18** (상단 12 + 하단 6)
- LITTLE_STRAIGHT: 9셋, BIG_STRAIGHT: 8셋
- 라운드 수: 참가자수 × 18

### 사용자 결정 필요 사항 (Open Questions)
1. **OQ-EXCEL**: Excel 모드 적용 여부 (현재 N/A 가정)
2. **OQ-ROLLS**: 한 턴 5회 굴림 적정성 (4회 / 6회 비교)
3. **OQ-2**: 보너스 임계 245점 적정성 (240 / 252 비교)
4. **OQ-DP**: 봇 AI를 풀 DP / Heuristic / 봇 없음 중 어느 방식으로 출시
5. **OQ-MEM**: Railway 백엔드 메모리 한도 (풀 DP는 ~515MB W 테이블 + 사전 계산 수십 시간 추정)
6. **OQ-PACKBITS**: YachtDpContext.packKey rollsLeft 비트 2→3 확장으로 D6/D8 캐시 invalidate 여부
7. **OQ-NEWPATTERN**: 12면 활용 신규 족보 도입 여부 (현재 미도입)
8. **OQ-TIMEOUT**: 턴 타임아웃 정책 (게임 시간 ~27분 예상에 따른 조정)
9. **OQ-MOBILE**: 18행 점수판 모바일 sticky 미구현 시 UX 허용 수준
10. **OQ-WAITING**: 초기 매칭 풀 부족 대응

### 핵심 리스크
- **풀 DP 메모리 (515MB)**: 가장 큰 인프라 리스크. Phase 1은 봇 없음/Heuristic 권장.
- **packKey 비트 변경**: 기존 D6/D8 W 테이블 캐시 파일(`yacht-d6/d8-dp.bin`) 재계산 필요할 수 있음.
- **게임 시간 ~27분**: 중도 이탈 우려.
- **18행 점수판 모바일 가독성**: D8(14행)보다 한 단계 더 어려움.

### 다음 단계
1. 사용자에게 PRD 검토 요청 (특히 OQ 10건 답변 확보)
2. OQ-EXCEL / OQ-DP 답변 확정 후 designer / developer-backend / developer-frontend 호출
3. 단계적 출시(Phase 1: PvP 전용 / Phase 2: 풀 DP / Phase 3: 운영 조정) 추진

### 산출물
- `C:\Users\YJMEDIA\Desktop\김성우\dbggames\DobakGgunGames\docs\specs\yacht-d12-mode-prd.md`
- `C:\Users\YJMEDIA\Desktop\김성우\dbggames\DobakGgunGames\docs\progress\planner-yacht-d12.md` (본 파일)
