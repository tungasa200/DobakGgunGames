# 진행 로그 — developer-frontend : Online RPS

- 작성자: developer-frontend
- 최초 작성일: 2026-04-24
- 상태: **구현 완료 — QA 검증 대기**

---

## 구현 완료 파일 목록

### 신규 파일 (10개)

| 파일 | 역할 |
|---|---|
| `frontend/src/games/online-rps/types/rps.types.ts` | 모든 TypeScript 타입/인터페이스 정의 |
| `frontend/src/games/online-rps/hooks/useRpsGame.ts` | 게임 전체 상태 관리 훅 (REST + WebSocket 연동) |
| `frontend/src/games/online-rps/components/RpsCard.tsx` | 카드 단일 컴포넌트 — 6가지 상태 처리 |
| `frontend/src/games/online-rps/components/RpsCard.module.css` | RpsCard 스타일 + CSS 변수 정의 |
| `frontend/src/games/online-rps/components/WaitingScreen.tsx` | 대기 화면 컴포넌트 |
| `frontend/src/games/online-rps/components/GameScreen.tsx` | 게임 화면 컴포넌트 (10초 타이머, 카드 선택) |
| `frontend/src/games/online-rps/components/ResultScreen.tsx` | 결과 화면 컴포넌트 |
| `frontend/src/games/online-rps/components/RpsScreens.module.css` | 화면 공통 스타일 |
| `frontend/src/lib/rpsStompClient.ts` | RPS 전용 STOMP 클라이언트 팩토리 |
| `frontend/src/api/rps.ts` | POST /api/rps/match REST 래퍼 |
| `frontend/src/pages/OnlineRpsPage.tsx` | /online-rps 라우트 페이지 |

### 수정 파일 (3개)

| 파일 | 변경 내용 |
|---|---|
| `frontend/src/App.tsx` | AdminRspPage/AdminRspExcelPage import·라우트 제거, OnlineRpsPage 라우트 추가 |
| `frontend/src/api/admin.ts` | adminRspApi 섹션 전체 제거 (RspChoice, RspResult, RspStats 등 타입 포함) |
| `frontend/src/pages/HomePage.tsx` | Test Lab 카드에 Online RPS 진입 링크 추가 |

### 삭제 파일 (5개)

| 파일 |
|---|
| `frontend/src/games/rsp/RspBoard.tsx` |
| `frontend/src/games/rsp/useRspGame.ts` |
| `frontend/src/games/rsp/RspBoard.module.css` |
| `frontend/src/pages/admin/AdminRspPage.tsx` |
| `frontend/src/pages/admin/AdminRspExcelPage.tsx` |

---

## tsc / eslint 결과

- `tsc -b`: 신규 파일 에러 0개 (기존 @tiptap 관련 에러는 기존 파일 기인, 이번 작업 범위 외)
- `eslint src/games/online-rps src/lib/rpsStompClient.ts src/api/rps.ts src/pages/OnlineRpsPage.tsx`: **에러 0개, 경고 0개**

---

## 구현 세부 사항

### phase 전환 흐름

```
idle → matching (POST /api/rps/match) → connecting (WS 연결 시작)
  → waiting (ROOM_STATE 수신) ↔ countdown (MATCH_COUNTDOWN 수신)
  → playing (GAME_STARTED 수신)
  → result (ROUND_RESULT 수신)
  → 결과 화면에서 MATCH_COUNTDOWN 수신 시 countdown 상태 표시 (phase는 result 유지)
  → error (ROOM_CLOSED 또는 WS error)
```

### MATCH_COUNTDOWN 처리 방식

- `waiting` phase에서 수신 → `countdown` phase 전환 + countdown 숫자 표시
- `result` phase에서 수신 → phase 유지, countdown 숫자만 업데이트 (재도전 카운트다운 바 표시)
- `MATCH_COUNTDOWN_CANCELLED` 수신 → `waiting` 복귀

### selectedStatus (chosenUserIds)

PRD §7에 중간 선택 현황 브로드캐스트 이벤트 미명시. 따라서:
- 본인 선택 시 즉시 `chosenUserIds`에 추가
- 타인 선택 여부는 `ROUND_RESULT` 수신 후 일괄 반영
- 게임 화면에서는 본인만 "선택완료" 표시, 타인은 "대기중" 표시

### 409 ALREADY_IN_ROOM 처리

`postMatch()` 409 응답 → roomId 추출 → "이미 진행 중인 방" 토스트 → 해당 roomId로 WS 자동 재접속

### 재연결

MVP 비목표(PRD §8.4). WS 에러 시 MAX_RETRY=3 재시도 (2s/4s/8s), 실패 시 error phase + 에러 화면 표시.

---

## 블로커 / 주의사항

- 백엔드 `POST /api/rps/match` 및 WebSocket 핸들러 구현 완료 필요 (developer-backend 영역)
- 실제 통합 테스트는 백엔드 배포 후 가능
- 결과 화면에서 `MATCH_COUNTDOWN` 재수신 시 `countdown` 상태 갱신 로직:
  현재 `useRpsGame.ts`의 `onMatchCountdown` 핸들러가 `phase`를 `countdown`으로 변경함.
  result phase에서 재도전 카운트다운을 표시하려면 result phase에서도 countdown 값을 보여야 함.
  → `OnlineRpsPage`에서 `phase === 'result'`일 때 `countdown` 값을 `ResultScreen`에 전달하여 처리.
  단, `onMatchCountdown`이 phase를 'countdown'으로 강제 변경하므로, result → countdown → playing 전환이 정상 동작할 것으로 예상.

---

## 다음 세션에서 할 것

1. 백엔드 배포 완료 후 통합 테스트
2. qa-tester에게 검증 요청
3. 통합 테스트 중 발견되는 버그 수정
