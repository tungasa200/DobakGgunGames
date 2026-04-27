# developer-frontend — blockfall-battle 진행 로그

- 최초 작성일: 2026-04-27
- 상태: Phase 2 목 데이터 구현 완료 (API 계약 대기 중)

---

## 구현 완료 파일

| 파일 | 설명 |
|---|---|
| `frontend/src/games/blockfall/types/battle.types.ts` | WebSocket/REST 타입 정의 전체 |
| `frontend/src/lib/battleStompClient.ts` | STOMP 클라이언트 (/ws-battle 엔드포인트) |
| `frontend/src/api/blockfallBattleApi.ts` | REST 래퍼 + useBattleWebSocket 훅 |
| `frontend/src/styles/blockfall-battle.css` | 배틀 전용 CSS (디자이너 린터가 개선) |
| `frontend/src/games/blockfall/battle/OpponentBoard.tsx` | 상대 보드 렌더링 컴포넌트 (읽기 전용) |
| `frontend/src/games/blockfall/battle/BlockfallBattleBoard.tsx` | 배틀 레이아웃 + 내 게임판 (싱글 로직 재구현) |
| `frontend/src/pages/BlockfallBattlePage.tsx` | 배틀 라우트 페이지 (상태머신: loading→waiting→countdown→playing→finished) |
| `frontend/src/App.tsx` | `/test-lab/blockfall-battle` 라우트 등록 |
| `frontend/src/pages/HomePage.tsx` | Test Lab 섹션에 배틀 카드 추가 (게스트 포함 전체 노출) |

---

## 구현 상세

### 상태 머신 (BlockfallBattlePage)
- loading → joinBattle() REST 호출
- waiting → WAITING 방 대기 (ROOM_STATE 수신으로 플레이어 목록 갱신)
- countdown → MATCH_COUNTDOWN 수신 시 (5초 카운트다운 오버레이)
- queued → PLAYING 방 큐 진입 (QUEUE_POSITION 표시)
- playing → GAME_STARTED 수신 시 실제 게임 시작
- finished → GAME_RESULT 수신 시 결과/랭킹 화면

### 게임 로직 (BlockfallBattleBoard)
- BlockfallBoard.tsx 직접 수정 없이 동일 로직 재구현
- Garbage line: 다음 piece lock 시점에 `garbagePendingRef` 소비 → 보드 하단에 추가
- 콤보 2이상 → onComboAttack 콜백 → sendComboAttack
- 보드 상태 200ms 주기 sendBoardState

### WebSocket (목 데이터 모드)
- connectBattle() 호출 시 실제 /ws-battle 연결 시도
- API 계약 확정 전: 백엔드 미구현으로 연결 실패 → wsStatus='error' → 에러 화면 표시
- 목 데이터 테스트는 서버 없이 UI 전환만 로컬에서 확인 필요

### 홈 Test Lab 카드
- 게스트/비로그인 포함 전체 방문자에게 노출
- 기존 채팅/RPS는 로그인 유저에게만 노출 (변경 없음)

---

## 진행 중

없음 (Phase 2 목 데이터 구현 완료)

---

## 블로커 / 질문

1. **developer-backend API 계약 대기**
   - `/api/blockfall-battle/join` 응답 DTO 확정 필요
   - `/ws-battle` STOMP 엔드포인트 구현 완료 여부
   - 게스트 인증 방안 A/B 최종 선택 (PRD §6.4)

2. **designer UX 명세 대기** (OQ-5~OQ-8)
   - 결과 화면 10초 자동 다음 라운드 → 현재 미구현 (버튼 클릭 방식)
   - 모바일 UX 가이드라인

3. **`VITE_WS_BATTLE_URL` 환경변수**
   - Vercel 대시보드에 추가 필요 (아래 참조)

---

## 환경변수 추가 필요

**Vercel 대시보드에 추가:**
- 변수명: `VITE_WS_BATTLE_URL`
- 값 형식: `https://[backend-railway-domain]/ws-battle`
- 설명: 배틀 WebSocket 엔드포인트 (기존 VITE_WS_URL과 분리)
- 현재 코드: `frontend/src/lib/battleStompClient.ts` 41번째 줄에서 참조

---

## 다음 세션에서 할 것

1. developer-backend API 계약 수신 후 → 목 데이터 → 실제 연결로 교체
2. 결과 화면 10초 자동 다음 라운드 구현 (designer 명세 수신 후)
3. 모바일 레이아웃 최적화 (보드 크기 반응형)
4. `tsc -b && eslint .` 로컬 검증 후 커밋 (사용자가 빌드 결과 제공 시 대응)
