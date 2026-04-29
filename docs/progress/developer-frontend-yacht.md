# developer-frontend-yacht — 작업 진행 로그

- 담당: developer-frontend
- 최초 작성: 2026-04-29
- 최종 수정: 2026-04-29 (세션 1 추가 수정 반영)

---

## 세션 1 (2026-04-29) — 초기 구현 완료

### 구현 완료 파일 목록

| 파일 | 설명 |
|---|---|
| `frontend/src/games/yacht/types/yacht.types.ts` | 전체 타입 정의 (ScoreKey, Participant, PlayerScore, WsMessage 등) + 서버-클라이언트 키 매핑 |
| `frontend/src/games/yacht/types/scoreCalc.ts` | 클라이언트 점수 미리보기 계산 유틸 (PRD §5.6 의사 코드 기반) |
| `frontend/src/api/yacht.ts` | REST 래퍼 (postYachtMatch, getYachtRoom) |
| `frontend/src/lib/yachtStompClient.ts` | STOMP 클라이언트 (rpsStompClient 패턴 기반, /ws 공유 엔드포인트, join/ready/start/roll/score/leave 발행) |
| `frontend/src/games/yacht/hooks/useYachtGame.ts` | 게임 상태 관리 hook (phase, dice, keptIndices, playerScores, rankings 등 전체 상태) |
| `frontend/src/games/yacht/components/yacht.module.css` | CSS Modules (--yacht- 토큰, 다크테마, 반응형) |
| `frontend/src/games/yacht/components/YachtDice3D.tsx` | Three.js + gsap 3D 주사위 컴포넌트 (CanvasTexture, 애니메이션, FACE_ROTATIONS) |
| `frontend/src/games/yacht/components/YachtScoreBoard.tsx` | 점수판 (미리보기 미구현, 클릭 선택, 상단/하단 구분, 총합 표시) |
| `frontend/src/games/yacht/components/YachtWaitingRoom.tsx` | 대기 화면 (CP1-3: 준비/준비취소 + 방장 시작 버튼) |
| `frontend/src/games/yacht/components/YachtGameScreen.tsx` | 게임 화면 (주사위 영역 + 점수판 레이아웃) |
| `frontend/src/games/yacht/components/YachtResultScreen.tsx` | 결과 화면 (순위표, 총합 점수, WIN 배지) |
| `frontend/src/games/yacht/YachtPage.tsx` | 라우트 진입점 (phase 기반 화면 전환) |
| `frontend/src/App.tsx` | `/yacht` 라우트 추가 (AuthRoute 로그인 가드 적용) |
| `frontend/src/pages/HomePage.tsx` | Test Lab 카드에 야추 링크 추가 (BETA 뱃지 적용) |

### CP1 확정 사항 반영 여부

- [x] CP1-1: 턴 타임아웃 없음 — 타임아웃 바/카운트다운 UI 미구현
- [x] CP1-2: yacht_win 테이블 — 결과 화면에 순위 + 총합 점수 표시
- [x] CP1-3: 전원 준비 + 방장 시작 버튼 — WaitingRoom에 ready/start 버튼 구현, MATCH_COUNTDOWN 처리 없음

### tsc -b && eslint . 결과

- `tsc -b`: 오류 0 (STOMP /ws 수정 후 재확인)
- `eslint src/games/yacht/ src/api/yacht.ts src/lib/yachtStompClient.ts`: 오류 0, 경고 0
- (전체 프로젝트 기존 ESLint 오류는 다른 파일에서 이미 존재하던 것, 이번 세션에서 신규 추가 없음)

### 기술 결정 사항

1. **STOMP 엔드포인트**: `/ws` (기존 공유 엔드포인트로 통일 — 초기 `/ws-yacht` 분리안에서 변경)
   - `yachtStompClient.ts`의 `wsBase.replace(/\/ws$/, '') + '/ws-yacht'` 코드를 `wsBase` 그대로 사용하도록 수정 완료
2. **주사위 애니메이션**: gsap timeline — 굴리는 방향(랜덤)은 시각적 효과용, 최종 값은 서버 dice prop만 사용
3. **ScoreKey 매핑**: 서버는 UPPER_CASE (`FOUR_OF_A_KIND`), 클라이언트는 camelCase (`fourOfAKind`) — `SERVER_KEY_MAP` / `CLIENT_KEY_MAP`으로 양방향 변환
4. **점수 미리보기**: 클라이언트 계산 (서버 기록과 별개), `rollsLeft < 3` 이고 내 턴일 때만 표시

---

## 블로커 / 질문

### 해소된 블로커

1. ~~**STOMP 엔드포인트 불일치**~~: `/ws-yacht` → `/ws` 공유 엔드포인트로 통일 완료 (2026-04-29)
2. ~~**`/ws-yacht` vs `/ws`**~~: `yachtStompClient.ts` 수정 완료
3. **ROOM_STATE 페이로드**: `hostUserId` 이중 대응 유지
   - 현재 구현: `payload.hostUserId` 우선 + `Participant.isHost` 폴백 — 백엔드 응답 형태에 무관하게 대응

### 잔여 블로커

1. **ready/start 이벤트**: `/app/yacht/room/{roomId}/ready` 및 `/app/yacht/room/{roomId}/start` — 백엔드 구현 확인 필요
2. **게임 중 잔존 1명 처리 UX** (OQ-3): 백엔드 결정 후 프론트 반영 예정

---

## 다음 세션에서 할 것

1. Railway + Vercel 배포 후 통합 테스트 (엔드-투-엔드 STOMP 연결 확인)
2. 모바일 Three.js 성능 확인 (OQ-9: 저사양 기기 fps 측정)
3. 게임 중 잔존 1명 처리 UX (OQ-3: 백엔드 결정 대기)
4. 백엔드 통합 테스트 후 발견된 payload 불일치 수정
5. Three.js 메모리 누수 확인 (언마운트 시 dispose 정상 동작 여부)

---

## E2E 테스트 요청

qa-tester에게 다음 항목 검증 요청:

1. `/yacht` 접근 시 비로그인 → `/login` 리다이렉트 확인
2. 매칭 → 대기 화면: 참가자 목록, 준비/준비취소 버튼, 방장 시작 버튼
3. 대기 화면: 방장이 아닐 때 시작 버튼 미노출 확인
4. 게임 시작 후 TURN_STATE 수신 → 주사위 초기화 확인
5. 주사위 굴리기 → 3D 애니메이션 재생 → 서버 값 표시 확인
6. keep 토글 → 다시 굴리기 시 kept 주사위 값 유지 확인
7. 점수판 미리보기 (굴린 후 내 턴에서만 미리보기 표시)
8. 족보 선택 클릭 → SCORE_RECORDED 수신 → 점수판 갱신
9. GAME_OVER 수신 → 결과 화면 전환 → 순위 표시
10. 홈으로 버튼 → 홈 이동 확인

---

세션 종료: 2026-04-29. STOMP /ws 통일 완료, Test Lab BETA 노출. 다음 세션: 배포 후 통합 테스트.
