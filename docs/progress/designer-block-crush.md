# Progress — designer : Block Crush (블록 크러시)

- 소유 팀원: **designer**
- 기능 키: `block-crush`
- 최종 업데이트: 2026-05-18
- 관련 문서:
  - PRD: `docs/specs/block-crush-prd.md`
  - UX 플로우: `docs/design/block-crush-flow.md`
  - 컴포넌트 명세: `docs/design/designer-block-crush.md`
  - 참조 패턴: `docs/design/blockfall-battle-components.md`

---

## 현재 상태

- **CP1 완료 — 2026-05-18**
- `docs/design/block-crush-flow.md` 신규 작성 완료
- `docs/design/designer-block-crush.md` 신규 작성 완료
- CSS Custom Properties (`--bcr-` 접두사) 전체 목록 확정
- developer-frontend 팀에게 명세 전달 가능 상태

---

## 산출물 목록

| 파일 | 설명 | 상태 |
|---|---|---|
| `docs/design/block-crush-flow.md` | 게임 전체 UX 플로우, 상태 다이어그램, 화면 전환, 인터랙션 차이 | 완료 |
| `docs/design/designer-block-crush.md` | 전체 컴포넌트 명세 (레이아웃, 보드, 트레이, 팔레트, HUD, 모달, 랭킹, CSS 변수, keyframes, 반응형, 접근성) | 완료 |

---

## 작업 로그

### 2026-05-18 (CP1 — UX 명세 작성)

**읽은 파일**
- `docs/design/blockfall-battle-components.md` — 가장 최근 게임 디자인 명세 패턴 참고
- `docs/design/blockfall-battle-flow.md` — 플로우 문서 구조 패턴 참고
- `docs/specs/blockfall-battle-prd.md` — 프로젝트 전반 게임 스펙 파악
- `docs/design/blockfall-insane-overhaul.md` — 블록폴 계열 색상/스타일 분리 기준 확인
- `frontend/src/pages/GamePage.tsx` — 페이지 구조, 색상 변수, NormalHeader 사용 방식 확인
- `frontend/src/components/normal/NormalHeader.tsx` — 헤더 컴포넌트 Props 인터페이스 확인
- `docs/progress/designer-blockfall-battle.md` — 이전 작업 로그 패턴 참고

**핵심 발견 사항 및 설계 결정**

1. **색상 팔레트 분리**: blockfall의 `#8e44ad` 보라 계열, blockfall-insane의 `#ff2d55` 핑크/레드 계열과 구분되는 **따뜻한 주황-크림 계열** 채택. `--bcr-accent: #E67E22`.

2. **셀 크기 결정**: blockfall-battle 명세의 브레이크포인트(desktop 769px+, tablet 481~768px, mobile 480px-)를 동일하게 적용. 셀 크기는 PC 56px / 태블릿 46px / 모바일 38px.

3. **트레이 셀 크기**: 보드 셀 대비 약 39% 크기로 설정 (PC 22px). 폴리오미노 형태 인식에 충분한 크기.

4. **드래그 미리보기**: 유효 위치 초록 반투명(`rgba(46,204,113,0.45)`) / 무효 위치 빨간 반투명(`rgba(231,76,60,0.40)`). 기존 블록폴 계열과 다른 색상 체계 사용.

5. **줄 클리어 애니메이션**: 플래시 + 스케일 축소 후 fade-out 방식. 280ms.

6. **게임 오버 모달**: backdrop-filter blur 사용. 기존 blockfall-battle 결과 화면 패턴 참고.

7. **랭킹 테이블**: blockfall-battle 랭킹 패널 디자인 일관성 유지. 탭으로 주간/전체 구분.

8. **CSS 변수 네임스페이스**: `--bcr-` 접두사로 기존 `--battle-`, `--rps-`, `--insane-` 변수와 충돌 방지.

9. **PRD 미존재 대응**: `docs/specs/block-crush-prd.md` 파일이 존재하지 않아, 블록 크러시 장르의 표준 메커니즘(8×8 보드, 드래그 배치, 행/열 클리어, 트레이 3슬롯)을 기반으로 명세 작성. PRD 확정 시 재조정 필요 항목 명시.

**주요 설계 결정**

- **Excel 모드**: N/A — 일반 모드 전용.
- **폴리오미노 18종 색상**: PRD §4.3 블록 정의 미확정 상태에서 표준 분류 코드(I4/I3/I2/I1/L4/J4/T4/O4/S4/Z4/L3/J3/T3/P5/U3/C5/PLUS5/DIAG4) 사용. PRD 확정 후 재매핑 필요.
- **트레이 드래그 중 원본 슬롯**: opacity 0.35로 반투명 유지 (완전 숨김 아님 — 배치 취소 가이드 역할).
- **팝업 점수**: Should 항목으로 명세에 포함. 클리어된 줄 근처 보드 테두리 바깥에 상승 애니메이션.

---

## PRD 재확인 필요 항목

PRD(`docs/specs/block-crush-prd.md`)가 확정되면 아래 항목을 재검토해야 한다.

| 항목 | 현재 가정 | 재확인 필요 내용 |
|---|---|---|
| 보드 크기 | 8×8 | PRD §3 보드 크기 명시 여부 |
| 폴리오미노 종류 | 18종 (표준 분류) | PRD §4.3 블록 18종 정의 목록 |
| 블록 코드명 | I4, I3, L4 등 표준 | PRD 실제 코드 명칭 |
| 트레이 슬롯 수 | 3개 | PRD §4 트레이 슬롯 수 |
| 줄 클리어 조건 | 행 또는 열 8셀 채움 | PRD 클리어 조건 |
| 콤보 정의 | 연속 클리어 | PRD §5 콤보 정의 |
| 점수 산식 | (줄 수 × 기본점수 × 콤보배수) 가정 | PRD 점수 공식 |
| gameKey | 'block-crush' | 백엔드 rankings API gameKey 값 |
| 랭킹 구분 | 주간/전체 탭 | PRD 랭킹 정책 |

---

## developer-frontend 인계 사항

1. **CSS 변수 선언 위치**: `BlockCrush.module.css` 상단 또는 `.blockCrushRoot` 스코프에 `--bcr-*` 변수 선언.
2. **셀 크기 반응형**: `--bcr-cell-size`와 `--bcr-tray-cell`을 미디어 쿼리로 재정의하면 보드/트레이 크기 자동 조정.
3. **드래그 구현**: `mousedown`/`mousemove`/`mouseup` + `touchstart`/`touchmove`/`touchend` 모두 처리. `touch-action: none` 필수.
4. **드래그 아이템 y offset**: 모바일에서 손가락 가림 방지를 위해 touch 위치에서 y -80px offset 적용 권장.
5. **게임 오버 판정 타이밍**: 클리어 애니메이션(280ms) 완료 후 판정. 애니메이션 도중 판정 안 함.
6. **줄 클리어 애니메이션**: `.clearing` 클래스 추가 → 280ms 후 셀 데이터 empty 처리.
7. **NormalHeader accentColor**: `#E67E22` 전달.
8. **Excel 모드 버튼 숨김**: `GamePage.tsx`에 `block-crush`를 Excel 미지원 목록에 추가 (또는 NormalHeader 조건부 처리).
9. **랭킹 API**: 기존 `/api/rankings` endpoint에 `gameKey: 'block-crush'` 파라미터로 호출 (기존 패턴과 동일한지 백엔드 확인 필요).

---

## 블로커 / 리스크

- **PRD 미존재**: `docs/specs/block-crush-prd.md` 파일 없음. planner가 PRD를 작성하면 블록 코드명, 점수 공식, 콤보 정의 등 재조정 필요.
- **폴리오미노 18종 코드명**: PRD 확정 전 임시 코드(I4, L4 등)로 명세 작성됨. 확정 후 `--bcr-block-*` CSS 변수명 재매핑 필요.
- **랭킹 API gameKey**: 백엔드에서 `block-crush` gameKey 지원 여부 developer-backend 확인 필요.

---

## 다음 단계

1. **planner**: `docs/specs/block-crush-prd.md` 작성 (블록 종류 정의, 점수 산식, 콤보 규칙 등)
2. **designer**: PRD 확정 후 블록 코드명/색상 매핑 재조정 (소규모 수정 예상)
3. **developer-frontend**: 본 명세 기반 구현 착수
   - `frontend/src/games/block-crush/` 디렉토리 신설
   - `BlockCrush.module.css` 생성 및 CSS 변수 선언
   - `BlockCrushBoard.tsx`, `BlockCrushTray.tsx`, `BlockCrushPage.tsx` 구현
4. **developer-backend**: `block-crush` gameKey 랭킹 API 지원 확인/추가
5. **qa-tester**: 구현 완료 후 테스트 플랜 작성

---

## 세션 종료 로그

| 세션 날짜 | 작업 | 완료 내용 |
|---|---|---|
| 2026-05-18 | CP1 디자인 명세 작성 | block-crush-flow.md, designer-block-crush.md 작성, CSS 변수 전체 목록 확정, developer-frontend 인계 완료 |

---

## 파일 소유권 메모

- `docs/design/block-crush-flow.md` — designer 소유
- `docs/design/designer-block-crush.md` — designer 소유
- `docs/progress/designer-block-crush.md` — designer 소유 (본 파일)
- `frontend/src/styles/excel.css` — 수정 금지 (block-crush 무관)
- `frontend/` 실제 코드 — developer-frontend 소유
