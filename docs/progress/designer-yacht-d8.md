# designer 진행 로그 — yacht-d8 모드

- 담당자: designer
- 최초 작성: 2026-05-10
- 상태: 1차 완료

---

## 2026-05-10 — 최초 작성

### 읽은 파일

- `docs/specs/yacht-d8-mode-prd.md` (확정 PRD, 2026-05-10)
- `docs/design/yacht-game.md` (기존 게임 화면 명세)
- `docs/design/yacht-waiting.md` (기존 대기실 명세)
- `docs/design/yacht-result.md` (기존 결과 화면 명세)
- `frontend/src/games/yacht/components/yacht.module.css` (현행 CSS 토큰 체계)
- `frontend/public/sample/octahedron.html` (D8 3D 주사위 샘플 — Three.js 기반)

### 작성한 파일

`docs/design/yacht-d8-design.md` — 단일 문서에 아래 7개 섹션 통합 작성:

1. **모드 선택 화면 (YachtModeSelectScreen)**
   - 라우트: `/yacht/select`
   - D6 / D8 두 카드 동시 노출 와이어프레임 (데스크탑 / 모바일)
   - 카드 hover·focus·active 상태, CTA 버튼, 랭킹 미리보기 포함
   - 클릭 흐름, 반응형 3단계 브레이크포인트, 접근성 ARIA 명세

2. **14행 점수판 레이아웃 (D8)**
   - D8 전용 16행 목록 (SEVENS / EIGHTS 추가, 모바일 약자 포함)
   - 상단 합계 "/84" 변경 명세, D6는 "/63" 유지
   - 데스크탑·태블릿·모바일별 행 높이 / 폰트 크기 권장값 표
   - 모바일 overflow-y 스크롤, sticky 첫 컬럼, sticky 헤더 행 명세
   - "현재 턴 / 내 행" sticky Should 수준 권장으로 정의

3. **D8 3D 주사위 시각 (YachtDiceOctahedron)**
   - octahedron.html 기반 재질 파라미터 (흰 플라스틱 + clearcoat, D6와 동일 톤)
   - 8면 매핑 정의 표 (마주보는 면 합=9 표준 d8 룰)
   - 굴림 애니메이션 800ms easeOutCubic, D6 동일 RotState 구조 명세
   - KEEP 표시 — 기존 yellow tint 동일 적용
   - 신규 컴포넌트 YachtDiceOctahedron 인터페이스 정의

4. **모드 표식 (헤더 배지)**
   - D6: #4f6cd8 기존 유지, D8: #d86a4f 신규 accent 색상 결정
   - 헤더/대기실/결과 화면 공통 YachtModeBadge 컴포넌트 명세
   - ARIA role·aria-label 명세

5. **결과 / 대기실 변동 사항**
   - 대기실 헤더 모드 배지 추가
   - 매칭 로딩 텍스트 diceType 반영
   - 결과 화면 점수 상세 패널 D8 14행 확장
   - 대기실 랭킹 섹션 D6/D8 탭 분리 (탭 스타일, ARIA role="tab" 명세)

6. **기존 컴포넌트 변경 영향**
   - YachtDiceRow3D: `diceType` prop 추가 props 표
   - YachtScoreBoard: `diceType` prop 추가 props 표
   - YachtPage: mode-select phase 추가 명세
   - 신규 컴포넌트 5개 목록 (YachtModeSelectScreen, YachtModeCard, YachtDiceOctahedron, YachtModeBadge, YachtRankingTabs)

7. **CSS 변경 명세**
   - 신규 CSS 변수 7개 (`--yacht-d8-accent` 등)
   - 신규 클래스 19개 목록 및 역할 기술
   - 기존 클래스 수정 사항 3개 (headerTitle, waitingTitle, resultTitle — 배지 수용)
   - excel.css 수정 금지 / --yacht-accent 기존값 유지 금지사항 명시

### 디자인 결정 사항

| 결정 | 내용 | 근거 |
|---|---|---|
| D8 accent 색상 | `#d86a4f` (따뜻한 주황-적색) | D6 파란 계열(#4f6cd8)과 명확히 구분되는 보색 계열 선택. 모드 혼동 방지 |
| 모바일 점수판 | overflow-y 스크롤 + sticky 헤더/첫열 | PRD §12.2 Must 정책 준수 |
| "현재 턴/내 행" sticky | Should 수준 권장으로 정의 | PRD §12.2 원문 "권장"으로 명시되어 있으므로 강제 구현 요건 아님 |
| 대기실 랭킹 분리 방식 | 탭(Tab) UI 방식 | 카드 공간 제약 내에서 두 랭킹을 깔끔하게 수용하는 가장 일반적인 패턴 |
| D8 행 높이 | 27px (족보) / 29px (계산) | D6 대비 약 85% — PRD §12.2 권장치 기준 |
| D8 주사위 애니메이션 | D6와 완전 동일 800ms easeOutCubic | PRD 요구 "D6와 동일 톤 유지" 준수 |
| 모드 선택 카드 클릭 즉시 매칭 | 별도 확인 모달 없음 | PRD §11.2 요구사항 준수 |

### 미결 사항

- D8 accent(`#d86a4f`) WCAG 4.5:1 대비 미검증 — qa-tester가 구현 후 색상 대비 검증 필요. 미충족 시 #c05a3e 등 어두운 톤으로 planner와 협의 후 조정.
- YachtDiceOctahedron을 YachtDiceRow3D 내 분기로 구현할지 별도 컴포넌트로 분리할지 — developer-frontend 결정 사항. 명세는 인터페이스만 정의함.
- 모드 선택 화면 라우트를 `/yacht/select`로 할지 `/yacht` 내 phase로 처리할지 — developer-frontend가 기존 라우팅 구조에 맞게 결정.

### 다음 단계

- developer-frontend에게 `docs/design/yacht-d8-design.md` 전달 완료
- qa-tester에게 D8 accent 색상 대비 검증 요청 예정 (구현 후)
