# developer-frontend: 벽돌깨기 (Brick Breaker)

## 세션 날짜
2026-05-06

## 구현 완료 파일 목록

### 신규 파일
- `frontend/src/games/brickbreaker/types.ts` — GameStatus, ItemType, Ball, Brick, ItemCapsule, ActiveItem 타입 정의
- `frontend/src/games/brickbreaker/stages.ts` — STAGE_CONFIGS(10스테이지), generateBricks() 함수, 벽돌 배치 상수
- `frontend/src/games/brickbreaker/scoring.ts` — calcBrickScore(), calcClearBonus(), STAGE_CLEAR_BONUS
- `frontend/src/games/brickbreaker/useBrickBreakerGame.ts` — useReducer 기반 게임 훅 (TICK 물리, 멀티볼, 아이템, 충돌 전체 포함)
- `frontend/src/games/brickbreaker/BrickBreakerCanvas.tsx` — Canvas 렌더러 (네온 시안 공, 퍼플 패들, 잔상, 아이템 HUD)
- `frontend/src/pages/BrickBreakerPage.tsx` — 게임 페이지 (세션 mock, 랭킹 mock, 닉네임 모달, 스테이지 자동 진행)

### 수정 파일
- `frontend/src/App.tsx` — `/brickbreaker` 라우트 추가 (로그인 불필요)
- `frontend/src/pages/HomePage.tsx` — Test Lab 카드에 벽돌깨기 버튼 추가 (BETA 뱃지 포함)

## 타입/린트 결과
- `tsc --noEmit`: 오류 없음
- `eslint src/games/brickbreaker/ src/pages/BrickBreakerPage.tsx`: 오류 없음
- 전체 ESLint: 벽돌깨기 파일 오류 없음 (기존 파일의 기존 오류만 존재)

## 목 데이터 사용 중인 부분

BrickBreakerPage.tsx에서 다음 위치가 mock으로 처리됨:

1. **세션 생성** (line ~29):
   ```
   const id = 'mock-session-id'; // MOCK
   ```
   실 API 연결 시 → `const id = await startSession(GAME_KEY, LEVEL);`

2. **랭킹 조회** (line ~50):
   ```
   setRankings([]); // MOCK
   ```
   실 API 연결 시 → `const data = await rankingsApi.getWeekly(GAME_KEY, LEVEL);`

3. **랭킹 등록** (line ~90):
   ```
   await new Promise(r => setTimeout(r, 300)); // MOCK
   ```
   실 API 연결 시 → `await rankingsApi.submit(GAME_KEY, { ... })`

모든 mock 위치에 `// MOCK` 또는 `// TODO: 실 API 연결 시` 주석 표시됨.

## CSS 처리
- `BrickBreaker.module.css` 파일 없음 (designer 작성 대기)
- 현재 **인라인 스타일**로 임시 구현 (BrickBreakerPage.tsx 하단 헬퍼 함수)
- Canvas 자체 스타일은 BrickBreakerCanvas.tsx 내 style prop으로 처리
- CSS Modules 파일 생성 후 교체 필요

## 백엔드 API 대기 사항
- `POST /api/brickbreaker/session/start`
- `POST /api/brickbreaker/rankings`
- `GET /api/brickbreaker/rankings?level=normal`

developer-backend 연결 필요. DTO 계약:
```typescript
// 제출 payload (기존 SubmitPayload 재사용)
{
  level: 'normal',
  name: string,
  score: number,
  gameLevel: number,  // 도달한 스테이지 번호
  sessionId: string,
}
```

## 진행 중인 것
없음 (모두 완료)

## 다음 세션에서 할 것
1. designer가 BrickBreaker.module.css 작성 후 인라인 스타일을 CSS Modules로 교체
2. developer-backend가 API 구현 후 mock 코드를 실 API 호출로 교체
3. qa-tester에게 검증 요청
