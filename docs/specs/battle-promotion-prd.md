# PRD — 배틀 정식 등록 (지뢰찾기 배틀·사과게임 배틀)

- 작성자: DBG-planner
- 최초 작성일: 2026-11-04
- 상태: 확정 (구현 착수 가능)
- 결정: D-37 (`docs/결정기록.md`)
- 라우트: `/games/minesweeper/battle`, `/games/apple/battle` (바꾸지 않음)
- 모드 적용 범위: **일반 모드만** (Excel 모드는 바꾸지 않음. 사용자 결정 카드 20261104-0140)
- 접근 권한: 로그인 필수 (지금의 `AuthRoute` 유지)

## 1. 목적

Test Lab 안에 BETA로 있던 지뢰찾기 배틀·사과게임 배틀을 홈 '멀티플레이' 칸의 정식 게임으로 올린다. 게임 로직·서버·라우트는 이미 정식 게임과 같은 보호(`AuthRoute`·`GameGuard`·킬스위치)를 쓰므로, 바뀌는 것은 홈 화면에서의 위치와 표시뿐이다.

## 2. 범위

### 2.1 이번에 하는 것 (프론트 `frontend/src/pages/HomePage.tsx`만)

1. `MULTI_GAMES`에 두 게임을 추가한다. 야추 다음에 지뢰찾기 배틀, 사과게임 배틀 순으로 둔다.
   - 지뢰찾기 배틀: 아이콘 💣, 이름 "지뢰찾기 배틀", `to: '/games/minesweeper/battle'`, `gameKey: 'minesweeper-battle'`
   - 사과게임 배틀: 아이콘 🍎, 이름 "사과게임 배틀", `to: '/games/apple/battle'`, `gameKey: 'apple-battle'`
   - `statusKey`는 넣지 않는다(방 상태 표시 없음, [pm 결정]).
2. Test Lab 카드에서 지뢰찾기 배틀·사과게임 배틀 줄(지금 `HomePage.tsx:485-534`, 앞의 구분선 포함)을 뺀다. 벽돌깨기·블록 크러시 줄과 Test Lab 카드 자체는 그대로 둔다.
3. 멀티 카드에는 BETA 배지를 붙이지 않는다.
4. `statusKey`가 없는 멀티 카드는 방 상태 칸에 "현재 활성 방 없음"을 보이지 않는다. 지금 `MultiGameCard`는 `roomStatus`가 `undefined`여도 이 문구를 보이는데(`HomePage.tsx:155-165`), 조회하지 않은 게임에 "없음"이라고 쓰면 사실과 다를 수 있다. 칸을 비우거나 숨기는 방식은 프론트가 고른다. 기존 세 게임(`statusKey` 있음)의 표시는 바꾸지 않는다.

### 2.2 이번에 하지 않는 것

- Excel 모드 홈(`ExcelHomePage.tsx`). 지금 배틀이 없고 이번에도 넣지 않는다.
- 솔로 카드에서 배틀로 가는 링크. 솔로 지뢰찾기 화면 안의 "배틀 모드 →" 링크(T-09)도 이번 범위 밖이다.
- 방 상태("N개 방 활성") 표시. 두 배틀에는 방 상태 조회 API 래퍼가 없다.
- 전적 공개(랭킹·내 전적 화면). 전적은 지금처럼 DB에 기록만 한다.
- 백엔드 변경, 라우트 변경, 어드민 게임 관리 화면 변경, 게임 화면 안의 BETA 표시 정리.
- `/test-lab/blockfall-battle` 호환 경로는 그대로 둔다([pm 결정]).

## 3. 수용 기준

| ID | 기준 |
|---|---|
| AC-1 | 홈 '전체'·'멀티' 탭의 멀티플레이 칸에 지뢰찾기 배틀·사과게임 배틀 카드가 야추 다음에 보인다. '솔로' 탭에는 보이지 않는다. |
| AC-2 | 각 카드의 "플레이"를 누르면 `/games/minesweeper/battle`·`/games/apple/battle`로 간다. 로그인하지 않았으면 지금처럼 `AuthRoute`가 로그인으로 보낸다. |
| AC-3 | '기타' 탭의 Test Lab 카드에는 벽돌깨기·블록 크러시만 남고, 두 배틀 줄과 그 구분선이 없다. 벽돌깨기·블록 크러시의 BETA·점검 중 표시는 그대로다. |
| AC-4 | 두 배틀 카드에 BETA 배지가 없다. |
| AC-5 | 두 배틀 카드에 "N개 방 활성"·"현재 활성 방 없음" 같은 방 상태 문구가 없다. 온라인 가위바위보·블록폴 배틀·야추 카드의 방 상태 표시는 바뀌지 않는다. |
| AC-6 | 어드민에서 `minesweeper-battle`·`apple-battle`을 끄면 해당 멀티 카드에 "🔧 점검 중" 덮개가 보인다(다른 멀티 카드와 같은 방식). 켜면 사라진다. |
| AC-7 | Excel 모드 홈은 바뀌지 않는다. |
| AC-8 | 게임 화면·대전 흐름·전적 기록은 바뀌지 않는다(D-36 판 무효 포함). |
| AC-9 | `frontend/`에서 `npm run build`, `npm run lint`가 통과한다. |

## 4. 관련

- 결정: D-37(이 문서), D-36(시작 전 끊김 판 무효), D-18(멀티플레이 게스트 제거)
- 작업: T-09(솔로 지뢰찾기 배틀 링크, 범위 밖)
- 코드: `frontend/src/pages/HomePage.tsx`(`MULTI_GAMES` 130-134, `MultiGameCard` 138-169, Test Lab 카드 427-536), `frontend/src/App.tsx:134-141`, `backend/.../service/GameStatusService.java:19`
