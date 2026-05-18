# developer-frontend — Block Crush 진행 로그

- 역할: developer-frontend
- 기능: Block Crush (블록 크러시)
- 최초 작성: 2026-05-18

---

## 구현 완료 파일 목록

| 파일 | 상태 |
|:---|:---|
| `frontend/src/games/block-crush/types.ts` | 완료 |
| `frontend/src/games/block-crush/pieces.ts` | 완료 |
| `frontend/src/games/block-crush/scoring.ts` | 완료 |
| `frontend/src/games/block-crush/useBlockCrushGame.ts` | 완료 |
| `frontend/src/games/block-crush/useDragDrop.ts` | 완료 |
| `frontend/src/games/block-crush/BlockCrushBoard.tsx` | 완료 |
| `frontend/src/games/block-crush/BlockCrushTray.tsx` | 완료 |
| `frontend/src/games/block-crush/BlockCrush.module.css` | 완료 |
| `frontend/src/pages/BlockCrushPage.tsx` | 완료 |
| `frontend/src/App.tsx` (수정 — /block-crush 라우트 추가) | 완료 |
| `frontend/src/pages/HomePage.tsx` (수정 — Test Lab 카드 블록 크러시 버튼) | 완료 |

## 구현 세부 사항

### 게임 로직
- `useReducer` 패턴 사용 (brickbreaker 패턴 준수)
- 액션: `INIT`, `PLACE_PIECE`, `GAME_OVER`, `RESET`
- PRD §4.3 18종 폴리오미노 전부 구현 (Fisher-Yates 셔플)
- PRD §5 점수 공식 (배치 점수 + 다중 클리어 보너스 + 콤보 보너스) 순수 함수로 구현
- 게임 오버: 트레이 3개 모두 어디에도 배치 불가 시

### 드래그&드롭
- Pointer Events 방식 (onPointerDown / onPointerMove / onPointerUp)
- 전역 window 이벤트 핸들러로 보드 밖 드롭도 처리
- 모바일: 손가락 위 2셀 오프셋으로 미리보기 표시
- 유효/무효 미리보기 색상 구분 (초록/빨강)
- 멀티터치 첫 포인터만 인식

### CSS
- CSS Custom Properties (`--bcr-*` 접두사)
- designer 명세 미도착 → 임시 색상 (인디고/보라 계열 테마)
- PC/모바일 반응형 미디어 쿼리 (600px, 400px breakpoint)
- 줄 클리어 페이드아웃 애니메이션 클래스 (`cellClearing`)

### API 연동
- `startSession('block-crush', 'classic')` 세션 시작
- `rankingsApi.getWeekly` + `rankingsApi.getAlltimeBest` 주간 + 전체 최고 기록 조회
- `rankingsApi.submit` — `linesCleared` 필드 포함 제출
- `containsProfanity` 비속어 검사

### 라우트 / 홈페이지
- `/block-crush` 라우트 등록 (brickbreaker 바로 아래)
- Test Lab 카드에 BETA 뱃지 포함 버튼 추가 (기본 ON)
- `gameStatus['block-crush'] !== false` 조건으로 점검 중 표시 지원

## 진행 중인 것

없음 (1차 구현 완료)

## 블로커 / 질문

- **백엔드 대기**: developer-backend가 `block-crush` 게임 키를 `RankingService.VALID_GAMES`에 추가해야 세션 시작 + 랭킹 등록이 동작함.
  - `SessionService.EXPIRE_SECONDS`에 `"block-crush" -> 7200L` 추가 필요
  - `BlockCrushRanking` 엔티티 / Repository 신규 작성 필요
  - `docs/sql/block-crush-ranking-schema.sql` 작성 후 사용자가 Railway에서 실행 필요

- **designer 명세 미도착**: 현재 임시 색상 사용 중. `docs/design/block-crush-design.md` 작성 완료 시 `BlockCrush.module.css`의 `--bcr-*` 변수 교체 필요.

## 다음 세션에서 할 것

1. 백엔드 구현 완료 후 연동 테스트
2. designer 명세 도착 시 CSS 색상 교체 (`--bcr-*` 변수 일괄 수정)
3. qa-tester가 제출한 버그 리포트 대응
4. PRD §7.2 Should 항목 구현 검토:
   - LocalStorage 최근 점수 저장
   - 게임 오버 시 배치 불가 블록 시각화

## 검증 상태

- `tsc -b`: 통과 (오류 없음)
- `eslint src/games/block-crush/ src/pages/BlockCrushPage.tsx src/App.tsx src/pages/HomePage.tsx`: 통과 (오류 없음)
- 기존 코드 ESLint 오류: 이번 작업 이전부터 존재하던 것으로 신규 작성 파일과 무관
