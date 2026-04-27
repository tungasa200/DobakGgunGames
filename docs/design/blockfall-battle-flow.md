# UX 플로우 — Blockfall Battle (블록폴 배틀 모드)

- 작성자: designer
- 최초 작성일: 2026-04-27
- PRD 참조: `docs/specs/blockfall-battle-prd.md` (CP1 완료)
- 모드 적용 범위: **일반 모드만** (Excel 모드 N/A — PRD §3 명시)

---

## 목차

1. [진입 경로 플로우](#1-진입-경로-플로우)
2. [배틀 전체 상태 플로우](#2-배틀-전체-상태-플로우)
3. [화면 전환 트리거 상세](#3-화면-전환-트리거-상세)
4. [데이터 흐름 다이어그램](#4-데이터-흐름-다이어그램)
5. [도중 입장 큐 플로우](#5-도중-입장-큐-플로우)
6. [엣지케이스 UX 처리](#6-엣지케이스-ux-처리)
7. [OQ 답변 (디자이너 결정 사항)](#7-oq-답변-디자이너-결정-사항)

---

## 1. 진입 경로 플로우

블록폴 배틀은 **Test Lab 섹션에서만 진입** 가능하다. 홈 메인 게임 목록, 상단 내비게이션, 사이드바 어디에도 노출하지 않는다.

```
홈화면 (/)
  └─ 메인 게임 카드 그리드 하단
       └─ "Test Lab" 카드 섹션
            └─ "블록폴 배틀 [BETA]" 링크/버튼 클릭
                 └─ navigate('/test-lab/blockfall-battle')
                      └─ BlockfallBattlePage 렌더링
                           └─ 테스트 단계 경고 배너 표시
                           └─ HTTP POST /api/blockfall-battle/join 호출
                                └─ (A) WAITING 방 배정됨  →  대기 화면
                                └─ (B) 큐 진입됨         →  큐 대기 화면
```

### 1.1 로그인 여부에 따른 분기

```
로그인 유저:
  JWT 포함 → POST /api/blockfall-battle/join
  응답: { isGuest: false, playerId: "<userId>", ... }

비로그인(게스트):
  JWT 없음 → POST /api/blockfall-battle/join (guestToken: null 또는 기존 토큰)
  응답: { isGuest: true, guestToken: "guest_<uuid>", playerId: "guest_<uuid>", ... }
  클라이언트: guestToken을 sessionStorage에 저장
```

> 로그인 유저와 게스트 모두 Test Lab 카드가 표시되는지 여부는 아래 주의 참고.

**주의**: 현재 HomePage.tsx에서 Test Lab 섹션은 `{user && (...)}` 조건부로 로그인 유저에게만 노출되고 있다. 블록폴 배틀의 게스트 허용 정책(PRD §6)과 충돌 가능성이 있다. developer-frontend가 구현 시 Test Lab 섹션 노출 조건 조정 여부를 사용자와 협의하여 결정할 것 (현행 유지 또는 비로그인에게도 노출).

---

## 2. 배틀 전체 상태 플로우

PRD §5.3 상태 전이 다이어그램을 UI 관점에서 재정의한다.

```
[진입]
  HTTP POST /api/blockfall-battle/join
       │
       ▼
[JOINING 상태] — 로딩 스피너 표시, 버튼 비활성
       │
       ├── 응답: status=WAITING ─────────────────┐
       │                                         ▼
       │                              [WAITING 화면]
       │                              대기 화면 표시
       │                              WebSocket 구독 시작
       │                                         │
       │                              playerCount = 1:
       │                              "플레이어 대기 중..." + 펄스 애니메이션
       │                                         │
       │                              playerCount >= 2:
       │                              MATCH_COUNTDOWN 수신
       │                              카운트다운 숫자 표시 (5 → 4 → 3 → 2 → 1)
       │                                         │
       │                              (카운트다운 중 인원 감소 → 1명)
       │                              MATCH_COUNTDOWN_CANCELLED 수신
       │                              → "플레이어 대기 중..." 상태로 복귀
       │                                         │
       │                              GAME_STARTED 수신
       │                                         │
       └── 응답: status=PLAYING ───┐              ▼
                                   │    [PLAYING 화면] — 게임 진행 중
                                   │    멀티 게임판 레이아웃 렌더링
                                   │    본인 보드: 조작 활성
                                   │    상대 보드: 실시간 BOARD_UPDATE 수신 반영
                                   │             │
                                   │    PLAYER_FINISHED (본인):
                                   │    본인 보드에 "GAME OVER" 오버레이
                                   │    조작 비활성 (보드 어둡게)
                                   │    계속 상대 보드 관전 가능
                                   │             │
                                   │    PLAYER_FINISHED (상대):
                                   │    해당 상대 보드에 "GAME OVER" 오버레이
                                   │             │
                                   │    GAME_RESULT 수신
                                   │             │
                                   ▼             ▼
                         [QUEUE 대기 화면]   [RESULT 화면]
                         "현재 게임 진행 중"  순위 + 점수 + TOP 10 랭킹
                         대기열 위치 표시     "다시 배틀" / "홈으로" 버튼
                                   │             │
                                   │    "다시 배틀" 클릭:
                                   │    POST /api/blockfall-battle/join 재호출
                                   │             │
                                   │    10초 자동 전환:
                                   │    FINISHED → WAITING
                                   │    큐 대기자 자동 합류
                                   ▼             │
                         큐 처리 → WAITING 합류   │
                         (FIFO 4인까지 승격)       │
                                   │             │
                                   └─────────────┘
                                         │
                                         ▼
                                   [WAITING 화면]
                                   (다음 라운드 대기)
```

---

## 3. 화면 전환 트리거 상세

### 3.1 화면 목록

| 화면 이름 | 조건/트리거 | 이전 화면 |
|---|---|---|
| JOINING (로딩) | 페이지 진입 즉시 | - |
| WAITING (대기) | join 응답 status=WAITING | JOINING |
| QUEUE (큐 대기) | join 응답 status=PLAYING (queuePosition 있음) | JOINING |
| COUNTDOWN (카운트다운 오버레이) | MATCH_COUNTDOWN 수신 (playerCount >= 2) | WAITING |
| PLAYING (게임 진행) | GAME_STARTED 수신 | WAITING 또는 COUNTDOWN |
| RESULT (결과) | GAME_RESULT 수신 | PLAYING |
| ERROR (오류) | 연결 실패 / WebSocket 에러 | 모든 화면 |

### 3.2 WAITING 화면 내 서브 상태

| 서브 상태 | 트리거 | 종료 조건 |
|---|---|---|
| 혼자 대기 (`playerCount=1`) | 초기 진입 또는 다른 플레이어 퇴장 | playerCount >= 2 |
| 카운트다운 중 | `MATCH_COUNTDOWN` 수신 + playerCount >= 2 | 카운트 만료 또는 `MATCH_COUNTDOWN_CANCELLED` |
| 카운트다운 취소 | `MATCH_COUNTDOWN_CANCELLED` 수신 | playerCount >= 2 (재시작) |

### 3.3 PLAYING 화면 내 서브 상태

| 서브 상태 | 트리거 | 표시 변화 |
|---|---|---|
| 정상 진행 | GAME_STARTED 후 | 모든 보드 활성 |
| 본인 게임오버 | 본인 블록 Block Out | 본인 보드 어둡게 + "GAME OVER" 오버레이, 조작 비활성 |
| 상대 게임오버 | PLAYER_FINISHED (상대 playerId) | 해당 보드 어둡게 + "GAME OVER" |
| Garbage 수신 애니메이션 | GARBAGE_ATTACK (본인 targetPlayerId) | 보드 하단에서 회색 줄 밀려올라오는 애니메이션 |
| Combo 공격 발동 | 본인 콤보 >= 2 발생 | 본인 화면에 "ATTACK!" + "COMBO x{N}" 텍스트 표시 |
| 플레이어 이탈 | PLAYER_LEFT 수신 | 해당 보드 영역에 이탈 처리 + 상단 토스트 알림 |

### 3.4 RESULT 화면 전환

```
GAME_RESULT 수신
  → 현재 PLAYING 화면에서 RESULT 화면으로 전환 (fade 또는 슬라이드)
  → 결과 데이터 렌더링 (results 배열, topRankings)
  → 10초 카운트다운 바 표시 (자동 다음 라운드 예고)
  → 10초 후 서버가 WAITING 전이 → 클라이언트는 ROOM_STATE 수신으로 감지
     (또는 "다시 배틀" 버튼으로 즉시 재참가)
```

---

## 4. 데이터 흐름 다이어그램

### 4.1 WAITING 화면 데이터 흐름

```
[클라이언트]                    [서버]
     │                           │
     │── POST /join ────────────>│
     │<── { roomId, status,      │
     │      playerCount, ... } ──│
     │                           │
     │── WS 구독: /topic/blockfall-battle/room/{roomId} ──>│
     │                           │
     │<── ROOM_STATE ────────────│  (playerCount, players[], queueCount)
     │  → 화면 갱신 (인원수 등)  │
     │                           │
     │<── MATCH_COUNTDOWN ───────│  (secondsRemaining: 5→4→3→2→1)
     │  → 카운트다운 오버레이    │
     │                           │
     │<── GAME_STARTED ──────────│  (players[], startAt)
     │  → PLAYING 화면 전환      │
```

### 4.2 PLAYING 화면 데이터 흐름

```
[클라이언트]                    [서버]
     │                           │
     │── BOARD_STATE (200ms) ───>│  (board[][], score, lines, level, combo)
     │                           │── BOARD_UPDATE ──> 다른 참가자들
     │<── BOARD_UPDATE ──────────│  (다른 플레이어들의 보드 상태)
     │  → 상대 보드 실시간 갱신  │
     │                           │
     │── COMBO_ATTACK ──────────>│  (combo, targetPlayerId: null)
     │                           │── GARBAGE_ATTACK ──> 대상 플레이어
     │<── GARBAGE_ATTACK ────────│  (lines, fromPlayerId)
     │  → 다음 piece lock 시 적용│
     │                           │
     │<── PLAYER_FINISHED ───────│  (playerId, rank, score)
     │  → 해당 보드 GAME OVER    │
     │                           │
     │<── PLAYER_LEFT ───────────│  (playerId, nickname)
     │  → 이탈 토스트 알림       │
     │                           │
     │<── GAME_RESULT ───────────│  (results[], topRankings[])
     │  → RESULT 화면 전환       │
```

### 4.3 QUEUE 대기 데이터 흐름

```
[클라이언트]                    [서버]
     │                           │
     │── POST /join ────────────>│  (방이 PLAYING 상태)
     │<── { status: PLAYING,     │
     │      queuePosition: N, …} │
     │  → QUEUE 대기 화면 표시   │
     │                           │
     │<── QUEUE_POSITION ────────│  (position, totalInQueue)
     │  → 대기열 위치 실시간 갱신│  (앞 사람 빠질 때마다)
     │                           │
     │<── GAME_RESULT ───────────│  (현재 판 종료)
     │<── ROOM_STATE ────────────│  (status: WAITING, 본인 players[]에 포함)
     │  → WAITING 화면 자동 전환 │
```

---

## 5. 도중 입장 큐 플로우

PRD §11을 UX 관점으로 정리한다.

```
신규 플레이어 입장 시도
        │
        ▼
  POST /api/blockfall-battle/join
        │
  ┌─────┴──────┐
  │            │
방이 WAITING   방이 PLAYING
(정원 미달)    (진행 중)
  │            │
  ▼            ▼
WAITING 방에  큐에 추가
참가자 추가   queuePosition=N 수신
  │            │
ROOM_STATE    QUEUE 대기 화면
브로드캐스트  표시
  │
  playerCount >= 2?
  ├─ YES: 카운트다운 시작
  └─ NO:  대기 유지

        ┌──────────────────────────┐
        │ 큐 대기 중 상태 변화     │
        │                          │
        │ QUEUE_POSITION 수신 시:  │
        │   position / totalInQueue│
        │   실시간 텍스트 갱신     │
        │                          │
        │ 현재 판 GAME_RESULT 수신:│
        │   결과 화면은 표시 안 함 │
        │   (큐 대기자는 관전 X)   │
        │   10초 후 WAITING 전환   │
        │   → ROOM_STATE 수신으로  │
        │     자동 WAITING 화면 진입│
        └──────────────────────────┘
```

### 5.1 큐 이탈

```
큐 대기 중 "나가기" 클릭
  → LEAVE_BATTLE 발행
  → WebSocket 연결 종료
  → 홈(/) 이동
  → 서버: 큐에서 제거 + 다른 대기자 QUEUE_POSITION 갱신
```

---

## 6. 엣지케이스 UX 처리

| EC ID | 상황 | UX 처리 |
|---|---|---|
| EC-1 | 방 정원 초과 | 자동으로 큐 진입. 클라이언트는 queuePosition 있으면 QUEUE 화면 표시 |
| EC-6 | 전원 연결 끊김 | 본인도 연결 끊기면 WebSocket error 감지 → 재연결 배너 표시 → 실패 시 오류 화면 |
| EC-7 | 게임 중 본인만 남음 | GAME_RESULT 수신 (rank=1 자동 우승) → RESULT 화면 즉시 전환 |
| EC-8 | 동일 계정 중복 참가 | 409 ALREADY_IN_ROOM 응답 → 인라인 토스트 표시 + 기존 방으로 자동 재접속 유도 |
| EC-12 | RESULT 후 혼자 남음 | WAITING 화면으로 전환되나 카운트다운 미발동. "다른 플레이어 대기 중..." 상태 표시 |
| EC-13 | 카운트다운 중 1명 이탈 | MATCH_COUNTDOWN_CANCELLED → 카운트다운 숫자 사라지고 "플레이어 대기 중..." 복귀 |
| EC-14 | 게스트 닉네임 충돌 | 닉네임에 `#{playerId 앞 4자리}` 접미어 표시 — 예: `손님-A3F2 #b3f1` (디자이너 결정, OQ-8 참고) |

---

## 7. OQ 답변 (디자이너 결정 사항)

PRD §17 오픈 퀘스천 중 designer 담당 항목에 대한 결정을 기록한다.

### OQ-5 — 결과 화면 10초 자동 전환 + 큐 잔류자 컨펌 여부

**결정**: 별도 컨펌 없이 자동 진행.

- 큐 잔류자는 10초 대기 후 WAITING 화면으로 자동 전환된다.
- QUEUE 대기 화면에 "다음 라운드까지 남은 시간: N초" 카운트다운 텍스트를 표시하여 대기 예상 시간을 인지시킨다.
- 컨펌 없이 자동 진입하는 이유: 큐 대기자는 플레이 의사가 있음을 이미 표명한 상태. 불필요한 인터럽션 제거.

### OQ-6 — 모바일 UX (보드 다수 표시 방식)

**결정**: 모바일(480px 이하)에서는 본인 보드 메인 + 상대 보드 소형 미리보기 스트립.

- 본인 보드: 화면 상단, 최대 너비 활용
- 상대 보드: 화면 하단 가로 스크롤 스트립 (각 보드 축소판, 클릭 불가)
- 태블릿(481~768px): 2열 그리드 (본인 보드 크게, 나머지 작게)
- 데스크톱(769px+): §E 멀티 게임판 레이아웃 명세 적용 (인원수별 그리드)

### OQ-7 — Test Lab 페이지 경고 배너 톤

**결정**: 노란색 경고 배너 (주황색 액센트 테두리).

- 배경: `#FEF3C7` (Amber-50)
- 테두리: `#F59E0B` (Amber-400) — 좌측 4px 두꺼운 강조 테두리
- 텍스트: `#92400E` (Amber-900)
- 문구: "테스트 단계 기능입니다. 운영 게임이 아니므로 기록이 저장되지 않을 수 있습니다."
  - 게스트 접속 시 추가: "게스트 전적은 저장되지 않습니다."
- 위치: 페이지 최상단, 헤더 아래 고정 배너

### OQ-8 — 게스트 닉네임 충돌 표시 보강

**결정**: `손님-{4자리}` 기본 닉네임에서 동일 닉네임 충돌 시 `손님-{4자리} #{uuid 뒤 4자리}` 형태로 접미어 추가.

- 예: `손님-A3F2` → 충돌 시 `손님-A3F2 #d7e9`
- 닉네임 표시 영역 너비 제한으로 인해 너무 길면 `손님-A3F2` 기본 표시 유지 (충돌 케이스 자체가 희박)
- 실제 충돌 감지 로직은 developer-backend 또는 developer-frontend가 결정

---

> 본 문서는 `docs/progress/designer-blockfall-battle.md`와 함께 관리됨. 스펙 변경은 planner 경유 필수.
> Excel 모드 명세는 PRD §3에 따라 N/A (일반 모드 전용).
