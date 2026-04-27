# developer-frontend — blockfall-battle 진행 로그

- 최초 작성일: 2026-04-27
- 최종 업데이트: 2026-04-27
- 상태: designer UX 명세 반영 완료 (CSS 변수/레이아웃/컴포넌트 디자인 명세 적용)

---

## 구현 완료 파일

| 파일 | 설명 |
|---|---|
| `frontend/src/games/blockfall/types/battle.types.ts` | WebSocket/REST 타입 정의 전체 |
| `frontend/src/lib/battleStompClient.ts` | STOMP 클라이언트 (/ws-battle 엔드포인트) |
| `frontend/src/api/blockfallBattleApi.ts` | REST 래퍼 + useBattleWebSocket 훅 |
| `frontend/src/styles/blockfall-battle.css` | 배틀 전용 CSS — `--battle-` 변수 네임스페이스, keyframes, 디자인 명세 §11~15 반영 |
| `frontend/src/games/blockfall/battle/OpponentBoard.tsx` | 상대 보드 렌더링 컴포넌트 (읽기 전용) |
| `frontend/src/games/blockfall/battle/BlockfallBattleBoard.tsx` | 배틀 레이아웃 + 내 게임판 (싱글 로직 재구현) |
| `frontend/src/pages/BlockfallBattlePage.tsx` | 배틀 라우트 페이지 (designer 명세 반영: 배너, 대기화면, 결과화면 2열, 10초 카운트다운 바) |
| `frontend/src/App.tsx` | `/test-lab/blockfall-battle` 라우트 등록 |
| `frontend/src/pages/HomePage.tsx` | Test Lab 카드에 블록폴 배틀 항목 추가 (디자인 명세 §1.2 와이어프레임 준수) |

---

## 이번 세션 변경 내용 (designer UX 명세 반영)

### blockfall-battle.css 주요 변경

1. **`--battle-` CSS 변수 네임스페이스** (명세 §11)
   - `--battle-accent`, `--battle-garbage-color`, `--battle-banner-bg/border/text` 등 전체 토큰 선언
   - 기존 하드코딩 색상값을 CSS 변수로 교체

2. **keyframes 추가** (명세 §15)
   - `bb-icon-pulse`, `bb-dot-blink`, `bb-num-pop`, `bb-garbage-in`
   - `bb-attack-flash`, `bb-border-flash`, `bb-gameover-in`, `bb-toast-in`

3. **경고 배너 재설계** (명세 §2)
   - `.battle-lab-banner`: 전체 너비, sticky, `#FEF3C7` 배경, `#F59E0B` 하단 테두리
   - `.battle-lab-banner-icon`: 원형 `!` 아이콘
   - 게스트 추가 문구 표시 조건부 렌더링

4. **대기 화면 CSS 개선** (명세 §3)
   - 아이콘 pulse 애니메이션 (혼자 대기 시)
   - 로딩 dot 3개 순차 깜빡임
   - 카운트다운 숫자 인라인 (64px)
   - 참가자 목록 스타일 (배지 시스템)
   - 인원 표시 강조

5. **게임판 그리드 레이아웃 변경** (명세 §5.3)
   - 2인: `1fr 1fr` (기존 `2fr 1fr`에서 변경)
   - 3인: `3fr 2fr` + 본인 row span 2
   - 4인: `1fr 1fr` + `1fr 1fr` rows
   - 모바일/태블릿 반응형 추가

6. **보드 아이템 스타일** (명세 §5.4)
   - 흰 배경 + `#E5E7EB` 테두리 (기존 다크 테마에서 변경)
   - 본인 보드: `--battle-accent` 테두리 + subtle shadow
   - 배지 시스템: `battle-board-badge-me`, `battle-board-badge-guest`

7. **게임오버 오버레이** (명세 §5.5)
   - `bb-gameover-in` 애니메이션 적용
   - `--battle-gameover-bg` 변수 사용

8. **결과 화면 재설계** (명세 §8)
   - 2열 패널 레이아웃 (모바일 1열)
   - 이번 배틀 순위 패널 + 역대 TOP 10 패널 분리
   - 본인 행 강조 (`.result-item-mine`, `.ranking-item-mine`)
   - 10초 카운트다운 진행 바
   - TOP 10 순위 색상: 금/은/동 (`--battle-result-rank1~3`)

9. **플레이어 이탈 토스트** (명세 §9)
   - `.battle-player-left-toast`: fixed, `#F59E0B` 왼쪽 테두리, `bb-toast-in` 애니메이션

10. **재연결 배너** (명세 §10.1)
    - 40px 높이, `--battle-banner-bg` 사용 (기존 다크 테마에서 변경)

11. **버튼 스타일** (명세 §8.7)
    - `--battle-accent` primary, `#D1D5DB` 테두리 secondary

### BlockfallBattlePage.tsx 주요 변경

1. **경고 배너 분리**: 헤더 인라인 `battle-test-banner` → 별도 `renderLabBanner()` 함수 (전체 너비 sticky)
2. **대기 화면 서브 상태 구현**
   - 서브 상태 A (혼자 대기): pulse 아이콘 + dot 3개 + 서브 텍스트
   - 서브 상태 B (카운트다운): 인라인 숫자 + `waiting-countdown-number`
   - 서브 상태 C (카운트다운 취소): `phase='waiting'`으로 복귀 (기존 동일)
3. **결과 화면**: `result-panels` 2열 그리드, `result-countdown-area` 10초 바
4. **큐 대기 화면**: `queueCountdown` 상태 추가, 진행 바 표시
5. **플레이어 이탈 토스트**: `playerLeftToast` 상태 + `showPlayerLeftToast()` 헬퍼 (PLAYER_LEFT WS 이벤트 수신 시 연결 대기)
6. **접근성 ARIA**: `role="region"`, `aria-live`, `role="timer"`, `role="list"` 등 명세 §14 반영

### HomePage.tsx 변경

- Test Lab 카드 구조: 기존 `{user && (...)}` 조건부 유지 (디자이너 §1.5 권장)
- 순서: 실시간 채팅 랩 → Online RPS → 블록폴 배틀 [BETA] (명세 §1.2 와이어프레임 순서)
- BETA 배지: `#F59E0B` 배경, 인라인 스타일 적용

---

## 진행 중

없음

---

## 블로커 / 질문

1. **developer-backend API 계약 완료 여부 확인 필요**
   - `/api/blockfall-battle/join` REST 엔드포인트
   - `/ws-battle` STOMP 엔드포인트

2. **PLAYER_LEFT WS 이벤트 토스트 연결**
   - 현재 `useBattleWebSocket`이 PLAYER_LEFT payload를 외부로 노출하지 않음
   - `blockfallBattleApi.ts`에 `playerLeftNickname` 상태 추가 필요 (developer-backend와 협의 후)

3. **OpponentBoard.tsx 보드 배경 색상**
   - 현재 다크 배경(`#0d1117`) — 컴포넌트 명세 §5.4에서 흰 배경으로 변경 필요 여부 미결
   - 게임 중 보드는 다크 유지가 가독성에 유리할 수 있음 — QA 검증 후 결정 요청

---

## 환경변수 추가 필요

**Vercel 대시보드에 추가:**
- 변수명: `VITE_WS_BATTLE_URL`
- 값 형식: `https://[backend-railway-domain]/ws-battle`
- 설명: 배틀 WebSocket 엔드포인트 (기존 VITE_WS_URL과 분리)
- 현재 코드: `frontend/src/lib/battleStompClient.ts`에서 참조

---

## 다음 세션에서 할 것

1. developer-backend API 연결 완료 후 실제 WS 통신 검증
2. PLAYER_LEFT 토스트 연결 (`useBattleWebSocket` 훅에 `playerLeftNickname` 노출 요청)
3. OpponentBoard.tsx 보드 배경 색상 결정 (QA 피드백 후)
4. 모바일 레이아웃 실기기 검증
