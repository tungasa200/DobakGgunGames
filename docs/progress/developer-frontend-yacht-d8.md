# developer-frontend: yacht-d8

## 구현 완료 파일 목록

### 신규 생성
- `frontend/src/games/yacht/YachtSelectPage.tsx` — D6/D8 모드 선택 페이지
- `frontend/src/games/yacht/components/YachtModeCard.tsx` — 모드 선택 카드 (랭킹 미리보기, 활성 방 수)
- `frontend/src/games/yacht/components/YachtModeBadge.tsx` — 게임 헤더/대기실/결과 화면용 모드 배지
- `frontend/src/games/yacht/components/dice/createOctahedronGeometry.ts` — D8 정팔면체 Three.js 지오메트리 (아틀라스 텍스처, 모서리 스무딩, 법선 처리)

### 수정
- `frontend/src/games/yacht/types/yacht.types.ts` — `DiceType`, `sevens/eights` ScoreKey, `SCORE_KEYS_BY_MODE`, `UPPER_SCORE_KEYS_BY_MODE`, `UPPER_BONUS_THRESHOLD_BY_MODE`, 업데이트된 API 타입
- `frontend/src/games/yacht/types/scoreCalc.ts` — D8 `sevens`/`eights` 케이스, D8 straight 규칙 ({4567}/{5678} little, {34567}/{45678} big)
- `frontend/src/api/yacht.ts` — `postYachtMatch(token, diceType)` 바디, D6/D8 분리 랭킹 응답, `getYachtRoomStatus()` → `YachtRoomStatusByMode`
- `frontend/src/games/yacht/hooks/useYachtGame.ts` — `diceType` 상태+ref, D8 주사위 범위(1–8), 서버 페이로드 동기화
- `frontend/src/games/yacht/components/YachtDiceRow3D.tsx` — `diceType` prop, FACE_ROT_D8 매핑, D8 초기화 분기
- `frontend/src/games/yacht/components/YachtScoreBoard.tsx` — `diceType` prop, D8 14행 지원, `/84` 보너스 임계값
- `frontend/src/games/yacht/components/YachtGameScreen.tsx` — `diceType` prop 전달, `YachtModeBadge` 헤더 삽입
- `frontend/src/games/yacht/components/YachtWaitingRoom.tsx` — `diceType` prop, D6/D8 랭킹 탭
- `frontend/src/games/yacht/YachtPage.tsx` — `?mode=` URL 파싱, `/yacht/select` 리다이렉트, D8 액센트 컬러
- `frontend/src/App.tsx` — `/yacht/select` 라우트 추가
- `frontend/src/pages/HomePage.tsx` — yacht 링크 → `/yacht/select`, D6+D8 방 수 합산 표시
- `frontend/src/games/yacht/components/yacht.module.css` — D8 CSS 토큰, 모드 배지, 랭킹 탭, 모드 카드, 스코어보드 D8 반응형

## 진행 중인 것

없음 — 모든 구현 완료

## 블로커 / 질문

없음

백엔드 계약 확정 필요 항목 (developer-backend에서 구현 확인 필요):
- `POST /yacht/match` 요청 바디에 `diceType` 필드 추가
- `GET /yacht/rankings` 응답 형태 `{D6: [...], D8: [...]}` 변경
- `GET /yacht/rooms/status` 응답 형태 `{D6: {activeRooms, activePlayers}, D8: {...}}` 변경
- STOMP `ROOM_STATE` / `GAME_STARTED` 페이로드에 `diceType` 필드 추가

## 다음 세션에서 할 것

없음 — qa-tester 검증 대기 중
