# PRD — Brick Breaker (벽돌깨기)

- 작성자: planner
- 최초 작성일: 2026-05-06
- 상태: 초안 (Phase 1 — 구현 착수 가능)
- 라우트: `/brickbreaker`
- 모드 적용 범위: **일반 모드 Only** (Excel 모드 N/A — 사용자 지시)
- 접근 권한: **로그인 불필요** (전체 공개)
- 관련 문서:
  - 참조 PRD: `docs/specs/blockfall-battle-prd.md`, `docs/specs/yacht-prd.md`
  - 베이스 로직: `sample.html` (Canvas 기반 벽돌깨기 레퍼런스)
  - Progress: `docs/progress/planner-brickbreaker.md` (작업 로그)

---

## 1. 게임 개요

### 1.1 목적
- DobakGgun Games의 솔로플레이 미니게임 라인업에 클래식 아케이드 장르(벽돌깨기)를 추가하여 라이트 유저의 짧은 세션 플레이 흡수.
- 기존 솔로 게임(Minesweeper, Solitaire, Sudoku 등)이 두뇌형 위주인 데 반해, 반사신경/조작감 위주의 콘텐츠를 보강.
- 10스테이지 단계적 난이도 + 4종 아이템 + 랭킹으로 재플레이 동기 부여.

### 1.2 대상 유저
- 모바일/PC 웹에서 5~15분 단위 짧은 플레이를 원하는 라이트 게이머.
- 로그인 없이 즉시 플레이 가능 → 비회원 방문자 진입 장벽 최소화.
- Test Lab 카드를 통한 신규 콘텐츠 탐색자 (BETA 뱃지 노출).

### 1.3 플레이 방식 요약
- Canvas 기반 2D 아케이드.
- 화면 하단의 **패들**을 좌우로 움직여(키보드 ←/→, 마우스, 터치) 떨어지는 **공**을 받아 위쪽 **벽돌**을 모두 부수면 스테이지 클리어.
- 공이 화면 바닥에 닿으면 **생명 1 소모**. 생명이 0이 되면 게임 오버.
- 스테이지 진행에 따라 벽돌 내구도/배치/공 속도가 점점 어려워지고, **아이템 벽돌**을 부수면 4종 아이템 중 하나가 드롭되어 패들로 받으면 효과 발동.
- 10스테이지 모두 클리어 시 **엔딩 + 최종 점수 등록 화면**.
- 게임 오버/엔딩 시 닉네임을 입력하면 일별/전체 랭킹에 등재.

### 1.4 비목표 (Out of Scope)
- **Excel 모드 N/A** — 일반 모드만 지원.
- 멀티플레이/실시간 대결.
- 스테이지 에디터/유저 커스텀 맵.
- 세이브/이어하기 (게임 오버 시 처음부터).
- 11스테이지 이후 (차후 업데이트 예정).
- BGM/SFX 의무 사항 아님 (designer 재량으로 추후 추가 가능).

---

## 2. 유저 스토리

- **US-1 (핵심)** — As a casual visitor, I want to click "벽돌깨기" on the Test Lab card and start playing without logging in, so that I can enjoy the game immediately.
- **US-2** — As a player, I want to control the paddle smoothly with keyboard, mouse, or touch, so that I can react to the ball precisely.
- **US-3** — As a player, I want bricks to have varying durability across stages, so that the difficulty curve stays engaging.
- **US-4** — As a player, I want item bricks to drop power-ups (multi-ball, wider paddle, piercing ball, slow ball), so that I have strategic moments.
- **US-5** — As a player, I want a stage-clear bonus and a stage transition screen, so that I feel rewarded for progress.
- **US-6** — As a player, I want a clear HUD showing stage, score, lives, and active item timers, so that I know my status at a glance.
- **US-7** — As a player, I want to register my final score with a nickname after game over or full clear, so that I can compete on the ranking board.
- **US-8** — As a returning player, I want to see daily and all-time rankings, so that I can chase top scores.
- **US-9** — As a mobile player, I want touch controls (drag to move paddle), so that I can play without a keyboard.

---

## 3. 모드 적용 범위

- **일반 모드: 필수 (Must)**
- **Excel 모드: 해당 없음 (N/A)** — 사용자 지시: "Excel 모드는 이번 버전 제외"
- designer는 일반 모드만 명세 작성.
- developer-frontend는 일반 모드만 구현.
- qa-tester는 일반 모드만 검증.

---

## 4. 게임 규칙 (상세)

### 4.1 기본 규칙
- 시작 시 **생명 3개**, 점수 0, 스테이지 1.
- 패들 위에 공이 얹힌 상태로 시작 → Space 또는 클릭/탭으로 공 발사.
- 공이 벽돌에 닿으면 해당 벽돌의 내구도 1 감소. 내구도 0 → 파괴, 점수 가산.
- 모든 벽돌(아이템 벽돌 포함) 파괴 시 스테이지 클리어 → 1.5초 전환 연출 → 다음 스테이지.
- 공이 바닥에 닿으면 생명 1 감소, 패들 위에 공 리셋 (활성 아이템 효과는 모두 해제).
- 생명 0 + 공 추락 → 게임 오버 → 점수 등록 화면.
- 스테이지 10 클리어 → 엔딩 → 점수 등록 화면 (최종 보너스 포함).

### 4.2 충돌 규칙
- **공 ↔ 벽**: 좌/우/상단 벽에 닿으면 반사 (`dx = -dx` 또는 `dy = -dy`).
- **공 ↔ 패들**: 패들 충돌 시 공이 패들의 어느 위치에 맞았는지에 따라 `dx` 보정 (중앙 = 직진, 가장자리 = 큰 각도). 공식:
  ```
  hitOffset = (ballX - paddleCenterX) / (paddleWidth / 2)  // -1 ~ +1
  dx = baseSpeed * hitOffset * 1.2
  dy = -|dy|
  ```
- **공 ↔ 벽돌**: AABB 충돌. 충돌 면을 좌우/상하 중 가까운 쪽으로 판단해 해당 축 반사.
- **관통볼 활성 시**: 벽돌 충돌해도 반사하지 않고 통과 (관통볼 효과 종료까지 지속).

### 4.3 패들 / 공 / 캔버스
- **캔버스 크기**: 720×480 (기존 sample.html 480×320 대비 1.5배 확장 — HUD 가독성 + 스테이지 후반 벽돌 수 수용)
- **패들 기본 크기**: width=90, height=12, y=460
- **패들 확장 시**: width=150 (1.67배)
- **공 반지름**: 8
- **공 최대 동시 개수**: 3 (멀티볼)
- **공 속도**: 스테이지별 정의 (§5 참조). 단위는 px/frame (60fps 기준).

---

## 5. 스테이지 배치 테이블

> 모든 스테이지는 캔버스 폭 720 안에 좌우 여백 30px씩 두고 벽돌 배치. 벽돌 크기: width=64, height=22, padding=4.
>
> 내구도 표기: D1(파괴 1회), D2(파괴 2회), D3(파괴 3회), ITEM(아이템 벽돌, 1회 파괴 시 50% 확률 아이템 드롭).
>
> dx/dy는 발사 시 초기 절대값. 부호는 발사 방향에 따라 결정.

| Stage | 행×열 | 배치 패턴 | D1 | D2 | D3 | ITEM | dx (초기) | dy (초기) | 비고 |
|------:|:-----:|:---------|---:|---:|---:|-----:|:---------:|:---------:|:-----|
| 1 | 3×9 | 단순 직사각형 (전부 D1) | 27 | 0 | 0 | 0 | ±2.5 | -3.0 | 입문, 가장 느림 |
| 2 | 4×9 | 직사각형, 4행에 ITEM 2개 (양 끝) | 34 | 0 | 0 | 2 | ±2.8 | -3.2 | 아이템 첫 등장 |
| 3 | 4×9 | 체스판 패턴 (D1/D2 교차) | 18 | 16 | 0 | 2 | ±3.0 | -3.4 | D2 첫 등장 |
| 4 | 5×9 | 피라미드 (위로 갈수록 좁아짐) | 21 | 8 | 0 | 2 | ±3.2 | -3.6 | 31블록 |
| 5 | 5×9 | 직사각형, 중앙 십자에 D2 집중 | 28 | 13 | 0 | 4 | ±3.4 | -3.8 | 중간 난이도 |
| 6 | 6×9 | 역피라미드 (아래로 갈수록 좁음) + 좌우 ITEM 4개 | 24 | 16 | 4 | 4 | ±3.6 | -4.0 | D3 첫 등장 |
| 7 | 6×10 | 체스판 (D1/D2/D3 3색 순환) + ITEM 6개 | 24 | 20 | 10 | 6 | ±3.8 | -4.2 | 60블록, 첫 10열 |
| 8 | 6×10 | 가장자리 D3 액자 + 내부 D2 + ITEM 8개 | 14 | 28 | 18 | 0 | ±4.0 | -4.4 | 액자형 |
| 9 | 7×10 | 다이아몬드 (마름모) 패턴, 중심 D3 밀집 | 26 | 28 | 12 | 4 | ±4.2 | -4.6 | 70블록 |
| 10 | 7×10 | 풀 채움 + 외곽 D3 + 4코너 ITEM 클러스터 | 18 | 32 | 20 | 0 (※) | ±4.5 | -4.8 | 최종 스테이지 |

※ 스테이지 10은 ITEM 벽돌 자리에 D3를 배치 (아이템 의존 없이 실력으로 깨도록). 단, 스테이지 6~9에서 충분한 아이템 경험 제공.

### 5.1 스테이지별 클리어 보너스
| Stage | Clear Bonus |
|------:|------------:|
| 1 | 200 |
| 2 | 300 |
| 3 | 500 |
| 4 | 700 |
| 5 | 1,000 |
| 6 | 1,500 |
| 7 | 2,000 |
| 8 | 2,800 |
| 9 | 3,800 |
| 10 | 6,000 (최종 + 엔딩 보너스 포함) |
| **합계** | **18,800** |

### 5.2 추가 규칙
- 스테이지 전환 시 패들 위치 중앙 리셋, 공 리셋, 활성 아이템 모두 해제.
- 스테이지 시작 시 1.5초 카운트다운 ("Stage N", "Ready", "Go!") 후 공 발사 가능.
- 잔여 생명 1개당 스테이지 클리어 시 추가 +50점 (소소한 라이프 보존 인센티브).

---

## 6. 아이템 시스템 (4종 상세)

### 6.1 공통 동작
- 아이템 벽돌(ITEM) 파괴 시 **50% 확률**로 아이템 캡슐 드롭. 드롭된 캡슐은 dy=2.0 으로 낙하.
- 패들로 캡슐을 받으면 효과 발동, 바닥에 닿으면 소멸 (효과 미적용).
- **드롭된 캡슐 중 어떤 아이템이 나올지**는 캡슐 생성 시점에 4종 균등(25% / 25% / 25% / 25%) 랜덤 결정.
- 같은 아이템을 중복 획득 시 **지속 시간만 갱신** (효과 중첩 X).
- 서로 다른 아이템은 동시 활성 가능 (예: 패들 확장 + 관통볼 동시).
- 공이 바닥에 닿아 생명 소모 시 **모든 활성 아이템 즉시 해제**.
- 스테이지 전환 시에도 모든 활성 아이템 해제.

### 6.2 4종 스펙

#### M (멀티볼 / Multi-Ball)
- **효과**: 현재 공의 위치에서 ±15도 각도로 공 2개 추가 생성 (총 최대 3개).
- **지속 시간**: 영구 (해당 공이 모두 사라질 때까지). 추가된 공이 바닥에 닿으면 해당 공만 소멸하고 생명은 차감하지 **않음**. 마지막 1개 남은 공이 바닥에 닿을 때만 생명 차감.
- **드롭 확률**: 25% (캡슐 결정 시)
- **아이콘 텍스트**: `M`
- **색상**: `#FF6B6B` (빨강)

#### W (패들확장 / Wider Paddle)
- **효과**: 패들 width 90 → 150 (1.67배).
- **지속 시간**: 12초
- **드롭 확률**: 25%
- **아이콘 텍스트**: `W`
- **색상**: `#4ECDC4` (민트)

#### P (관통볼 / Piercing Ball)
- **효과**: 공이 벽돌과 충돌해도 반사하지 않고 관통하며 벽돌 파괴. 점수는 정상 가산.
- **지속 시간**: 8초
- **드롭 확률**: 25%
- **아이콘 텍스트**: `P`
- **색상**: `#FFD93D` (노랑)

#### S (공슬로우 / Slow Ball)
- **효과**: 모든 공의 속도 0.6배. 멀티볼로 인한 추가 공에도 동일 적용.
- **지속 시간**: 10초
- **드롭 확률**: 25%
- **아이콘 텍스트**: `S`
- **색상**: `#6C5CE7` (보라)

### 6.3 아이콘/색상 정책
- 캡슐: 28×16 둥근 사각형, 배경색 = 위 색상, 중앙에 흰색 Bold 14px로 영문 1자 (`M/W/P/S`).
- HUD 활성 아이템 타이머: 우측 상단에 활성 아이템 칩 가로 배열 (아이콘 + 남은 초). 멀티볼은 시간 대신 공 개수 표시.
- **이모지 사용 금지** — Canvas `fillText`로 영문 1자 렌더링.

---

## 7. 점수 계산 공식

### 7.1 벽돌 파괴 점수
| 벽돌 종류 | 1회 타격 | 파괴 시 보너스 | 총점 (내구도 모두 소모 시) |
|:---------|---------:|---------------:|---------------------------:|
| D1 (일반) | +10 | 0 | **10** |
| D2 (단단) | +10 (1차), +20 (2차/파괴) | +30 | **60** |
| D3 (강철) | +10 (1차), +20 (2차), +30 (3차/파괴) | +50 | **110** |
| ITEM (아이템) | 1회 타격으로 즉시 파괴 +20 | +30 (아이템 캡슐 드롭 여부와 무관) | **50** |

### 7.2 보너스
- **스테이지 클리어 보너스**: §5.1 표 (200~6,000)
- **잔여 생명 보너스**: 클리어 시 잔여 생명 × 50점
- **아이템 캡슐 획득**: 패들로 받을 때마다 +100 (효과와 별개)
- **관통볼 콤보**: 관통볼 활성 중 1번의 관통으로 2개 이상 벽돌 동시 파괴 시 추가 +50 × (벽돌 수 - 1)

### 7.3 최대 가능 점수 (이론치)
> 가정: 모든 ITEM 벽돌이 캡슐 드롭(아이템 50% 확률은 무시한 상한치 계산이 아니라, **벽돌 파괴 점수만 산정**), 잔여 생명 3 유지, 모든 캡슐 패들로 회수, 관통볼 콤보는 보수적으로 미반영.

| Stage | D1 점수 | D2 점수 | D3 점수 | ITEM 점수 | 클리어 보너스 | 라이프 보너스 (3 기준) | 캡슐 획득 (50% 가정 × 100) | Stage 합 |
|------:|--------:|--------:|--------:|----------:|--------------:|------------------------:|---------------------------:|---------:|
| 1 | 270 | 0 | 0 | 0 | 200 | 150 | 0 | 620 |
| 2 | 340 | 0 | 0 | 100 | 300 | 150 | 100 | 990 |
| 3 | 180 | 960 | 0 | 100 | 500 | 150 | 100 | 1,990 |
| 4 | 210 | 480 | 0 | 100 | 700 | 150 | 100 | 1,740 |
| 5 | 280 | 780 | 0 | 200 | 1,000 | 150 | 200 | 2,610 |
| 6 | 240 | 960 | 440 | 200 | 1,500 | 150 | 200 | 3,690 |
| 7 | 240 | 1,200 | 1,100 | 300 | 2,000 | 150 | 300 | 5,290 |
| 8 | 140 | 1,680 | 1,980 | 0 | 2,800 | 150 | 0 | 6,750 |
| 9 | 260 | 1,680 | 1,320 | 200 | 3,800 | 150 | 200 | 7,610 |
| 10 | 180 | 1,920 | 2,200 | 0 | 6,000 | 150 | 0 | 10,450 |
| **합계** | — | — | — | — | **18,800** | **1,500** | **1,200** | **약 41,740** |

- **이론적 최대 점수**: 약 **41,740점** (캡슐 50% 드롭 가정 + 관통볼 콤보 보너스 미반영).
- 관통볼 콤보 + 운빨로 50,000점 근처 가능. **검증 상한 99,999,999점** 으로 충분히 안전 마진 확보.

---

## 8. API 계약 (확정)

### 8.1 세션 시작
```
POST /api/brickbreaker/session/start
Content-Type: application/json

Request body:
{
  "game": "brickbreaker"
}

Response 200:
{
  "sessionId": "<uuid-v4>"
}
```
- 비로그인 가능. IP 해시는 서버에서 자동 처리.
- sessionId는 Redis에 TTL 30분으로 저장 (기존 세션 처리 패턴 동일).

### 8.2 랭킹 등록
```
POST /api/brickbreaker/rankings
Content-Type: application/json

Request body:
{
  "level": "normal",
  "name": "닉네임",
  "score": 12345,
  "gameLevel": 7,
  "sessionId": "<발급받은 sessionId>"
}

Response 200:
{
  "id": 123,
  "level": "normal",
  "name": "닉네임",
  "score": 12345,
  "gameLevel": 7,
  "createdAt": "2026-05-06T12:34:56Z",
  "rank": 42
}
```

#### 검증 규칙
- `level`: 반드시 `"normal"` (Excel 모드 N/A이지만 DTO 호환성 위해 필드 유지)
- `name`: 1~12자, badwords 필터링 통과
- `score`: 0 이상 99,999,999 이하 (Integer 범위)
- `gameLevel`: 1 이상 10 이하 (스테이지 값)
  - 게임 오버 시 = 게임 오버 직전까지 클리어한 스테이지 (시작만 하고 못 깬 경우는 직전 스테이지 = 클리어한 스테이지 수)
  - 단, 스테이지 1에서 게임 오버 시 `gameLevel = 0`은 **금지** → 최소 1로 클램핑 (등록 자체는 허용)
- `sessionId`: 같은 sessionId로 중복 등록 시 409 Conflict
- `RankingService.VALID_GAMES`에 `"brickbreaker"` 추가 필요 (developer-backend 작업)

### 8.3 랭킹 조회
```
GET /api/brickbreaker/rankings?level=normal[&limit=20]
GET /api/brickbreaker/rankings/alltime?level=normal[&limit=50]

Response 200:
{
  "rankings": [
    {
      "rank": 1,
      "name": "닉네임",
      "score": 41000,
      "gameLevel": 10,
      "createdAt": "2026-05-06T12:34:56Z"
    },
    ...
  ]
}
```
- 정렬: `ORDER BY game_level DESC, score DESC, created_at ASC`
  - **스테이지 우선** (10클리어 > 9클리어), 동률이면 점수, 동률이면 먼저 등록한 사람.
- 일별 랭킹: `created_at >= today 00:00 KST` 필터.

### 8.4 에러 응답
- 400 Bad Request: 검증 실패 (필드별 메시지)
- 404 Not Found: 잘못된 sessionId
- 409 Conflict: 중복 등록
- 422 Unprocessable Entity: badwords 위반

---

## 9. DB 스키마

### 9.1 brickbreaker_ranking
```sql
CREATE TABLE brickbreaker_ranking (
    id          BIGINT       NOT NULL AUTO_INCREMENT,
    level       VARCHAR(16)  NOT NULL DEFAULT 'normal',
    name        VARCHAR(32)  NOT NULL,
    score       INT          NOT NULL,
    game_level  INT          NOT NULL COMMENT '클리어한 스테이지 (1~10)',
    ip_hash     VARCHAR(64)  NULL,
    user_id     BIGINT       NULL,
    created_at  DATETIME(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    PRIMARY KEY (id),
    KEY idx_bb_level_stage_score (level, game_level DESC, score DESC, created_at),
    KEY idx_bb_level_created (level, created_at),
    KEY idx_bb_user (user_id),
    CONSTRAINT chk_bb_score   CHECK (score >= 0 AND score <= 99999999),
    CONSTRAINT chk_bb_stage   CHECK (game_level >= 1 AND game_level <= 10)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 9.2 BrickBreakerRanking 엔티티 골격
```java
@Entity
@Table(name = "brickbreaker_ranking", indexes = {
    @Index(name = "idx_bb_level_stage_score", columnList = "level,game_level DESC,score DESC,created_at"),
    @Index(name = "idx_bb_level_created", columnList = "level,created_at")
})
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class BrickBreakerRanking extends Ranking {

    @Column(nullable = false)
    private Integer score;

    @Column(name = "game_level", nullable = false)
    private Integer gameLevel;
}
```

---

## 10. 화면 구성 요약

### 10.1 캔버스 / 레이아웃
- **캔버스 크기**: 720×480 (sample.html 480×320 대비 1.5배 확장)
- **반응형**: 캔버스는 CSS로 `max-width: 100%; height: auto;` 비율 유지. 모바일에서는 화면 폭에 맞춤.
- **HUD**: 캔버스 외부 상단/하단 React DOM (Canvas 위에 그리지 않음 — 가독성 우선)
  - 상단 바: `[ 스테이지 N/10 ]  [ 점수 12,345 ]  [ 생명 ♥♥♥ ]  [ 활성 아이템 칩들 ]`
  - 하단 바: `[ 일시정지 ]  [ 그만두기 ]  [ 도움말 ]`

### 10.2 활성 아이템 타이머 표시
- 우측 상단에 28×28 둥근 사각형 칩 가로 정렬 (최대 4개).
- 각 칩 하단에 남은 초 (0.1초 단위). 멀티볼은 활성 공 개수 (`x2`, `x3`).
- 남은 시간 3초 이하 시 칩 깜빡임 (1초 주기 0.5초 on / 0.5초 off).

### 10.3 게임 오버 / 클리어 / 스테이지 전환

#### 스테이지 전환 (Stage Clear)
1. 마지막 벽돌 파괴 → 0.5초 슬로우모션 (공 정지)
2. 캔버스 중앙에 `Stage N Clear!` + 보너스 점수 카운트업 애니메이션 (1.0초)
3. 다음 스테이지 로드 → `Stage N+1` 카운트다운 ("3 → 2 → 1 → Go!" 1.5초)

#### 스테이지 10 엔딩 (Full Clear)
1. `Congratulations!` + 최종 점수 + 엔딩 일러스트 (designer 영역)
2. 닉네임 입력 모달 → 랭킹 등록
3. 랭킹 화면으로 이동 (자기 순위 하이라이트)

#### 게임 오버 (Game Over)
1. 마지막 공 바닥 충돌 → 0.5초 슬로우 + 빨간 플래시
2. `Game Over` + 도달 스테이지 + 점수 표시
3. `[다시하기]` `[랭킹 등록]` `[메인으로]` 버튼

### 10.4 입력
- **키보드**: ←/→ (패들 이동), Space (공 발사 / 일시정지 토글), Esc (그만두기)
- **마우스**: 캔버스 위에서 X좌표를 패들 중심으로 추적, 클릭 (공 발사)
- **터치**: 캔버스 위 드래그 (패들 이동), 탭 (공 발사)

---

## 11. 프론트엔드 파일 목록

```
frontend/src/games/brickbreaker/
  BrickBreakerCanvas.tsx          # Canvas 렌더링 (paddle, ball, brick, item 그리기)
  useBrickBreakerGame.ts          # useReducer 게임 로직 + 3 refs (timerRef, gameStartTimeRef, eventsRef)
  BrickBreaker.module.css         # HUD/모달 스타일 (CSS Modules)
  stages.ts                       # 10스테이지 배치 데이터 (행/열, 내구도 매트릭스, 속도)
  items.ts                        # 4종 아이템 정의 (효과, 지속 시간, 색상)
  scoring.ts                      # 점수 공식 함수 (단위 테스트 가능)
  types.ts                        # GameState, Ball, Brick, Item 타입
frontend/src/pages/BrickBreakerPage.tsx
frontend/src/App.tsx              # (수정) /brickbreaker 라우트 추가
frontend/src/pages/HomePage.tsx   # (수정) Test Lab 카드에 "벽돌깨기" 버튼 + BETA 뱃지
frontend/src/api/rankings.ts      # (수정) brickbreaker 게임 키 추가
```

---

## 12. 백엔드 파일 목록

```
backend/src/main/java/com/dobakggun/entity/BrickBreakerRanking.java                (신규)
backend/src/main/java/com/dobakggun/repository/BrickBreakerRankingRepository.java  (신규)
backend/src/main/java/com/dobakggun/service/RankingService.java                    (수정 — VALID_GAMES + dispatch 분기)
backend/src/main/java/com/dobakggun/controller/RankingController.java              (수정 여부 검토 — 기존 패턴이 게임명으로 path variable이면 무수정)
backend/src/main/java/com/dobakggun/dto/RankingRequest.java                        (검토 — gameLevel 1~10 검증 추가 가능)
docs/sql/brickbreaker-ranking-schema.sql                                            (신규)
```

---

## 13. 엣지 케이스 & 에러 시나리오

| # | 케이스 | 기대 동작 |
|--:|:-------|:---------|
| 1 | 스테이지 1에서 첫 공이 즉시 추락 | 생명 1 차감 (3→2), 공 리셋, 게임 계속 |
| 2 | 멀티볼 활성 중 공 1개만 바닥에 닿음 | 해당 공만 소멸, 생명 차감 X, 다른 공 계속 |
| 3 | 멀티볼 활성 중 마지막 공 바닥 닿음 | 생명 1 차감 + 모든 활성 아이템 해제 + 공 리셋 |
| 4 | 관통볼 활성 + 한 프레임에 5개 벽돌 동시 파괴 | 5개 모두 점수 가산 + 콤보 보너스 +50×4 |
| 5 | 패들 확장 활성 중 다시 패들 확장 캡슐 획득 | 효과 중첩 X, 타이머만 12초로 리셋 |
| 6 | 일시정지 중 브라우저 탭 전환 | requestAnimationFrame 자동 정지 (브라우저 동작), 탭 복귀 시 게임은 일시정지 상태 유지 |
| 7 | 게임 중 페이지 새로고침 | 진행 상태 사라짐 (저장 X). sessionId만 만료 후 무효 |
| 8 | sessionId 없이 랭킹 등록 시도 | 400 Bad Request |
| 9 | 같은 sessionId로 두 번째 등록 시도 | 409 Conflict (어뷰징 방지) |
| 10 | 닉네임에 badwords 포함 | 422, 클라이언트 토스트 "사용할 수 없는 닉네임" |
| 11 | 점수가 99,999,999 초과 (이론상 불가능하지만) | 400 Bad Request |
| 12 | 아이템 캡슐이 패들 옆을 스쳐 지나감 | 바닥 닿을 때까지 낙하 후 소멸, 효과 미적용 |
| 13 | 패들 좌측 끝/우측 끝에서 키 입력 지속 | 캔버스 경계에서 멈춤 (벽 통과 X) |
| 14 | 모바일 가로/세로 회전 | 캔버스 비율 유지, HUD는 reflow |
| 15 | 매우 작은 화면 (320px 폭) | 캔버스 max-width 100%, 패들 이동은 정상 |
| 16 | 공이 벽돌 사이 끼임 (수직 반사 무한 루프) | 0.5초 이상 같은 X 좌표 머무르면 dx에 ±0.5 강제 보정 |
| 17 | 백엔드 500 에러 시 랭킹 등록 실패 | 클라이언트는 점수와 닉네임을 LocalStorage에 임시 저장 + 재시도 버튼 노출 |
| 18 | 비로그인으로 랭킹 등록 | 정상 (user_id NULL, ip_hash로 어뷰징 추적만) |

---

## 14. 성공 지표 (KPI)

| 지표 | 측정 | 목표 (출시 4주) |
|:----|:-----|:--------------|
| DAU (벽돌깨기 진입) | `/brickbreaker` 페이지뷰 | 100+ |
| 평균 세션 길이 | 첫 진입 → 게임 오버/엔딩 까지 | 6분 이상 |
| 스테이지 클리어율 | (Stage N 클리어 세션 / 진입 세션) | Stage 5: 40%, Stage 10: 5% |
| 랭킹 등록률 | 랭킹 등록 / 게임 오버+엔딩 | 30% 이상 |
| 재방문률 | 7일 내 2회 이상 플레이 IP 비율 | 15% 이상 |
| 모바일 비율 | 모바일 디바이스에서 1게임 이상 완주 | 35% 이상 |

---

## 15. 테스트 체크리스트 (qa-tester 인계용, 18항목)

### 기능 (Functional)
- [ ] T01. `/brickbreaker` 진입 시 비로그인 상태에서도 정상 로드된다
- [ ] T02. 키보드(←/→), 마우스, 터치 3가지 입력 모두 패들이 정상 이동한다
- [ ] T03. Space로 공 발사 + 일시정지 토글이 정상 작동한다
- [ ] T04. 패들 가장자리 충돌 시 공 각도가 더 크게 꺾인다 (중앙 충돌은 직진)
- [ ] T05. 공이 벽돌과 좌/우/상/하 4면에서 충돌해도 올바른 축으로 반사된다

### 스테이지 (Stage)
- [ ] T06. 스테이지 1~10 모두 정의된 배치/내구도/속도대로 로드된다
- [ ] T07. 스테이지 클리어 시 보너스 점수 + 잔여 생명 보너스가 가산된다
- [ ] T08. 스테이지 전환 카운트다운(3-2-1-Go) + 패들/공/아이템 리셋이 정확하다
- [ ] T09. 스테이지 10 클리어 시 엔딩 화면 → 닉네임 입력 → 랭킹 등록이 자연스럽다

### 아이템 (Items)
- [ ] T10. M(멀티볼): 캡슐 획득 시 공이 ±15도 각도로 2개 추가 생성된다
- [ ] T11. W(패들확장): 12초간 패들이 1.67배로 늘어나고 시간 종료 시 원복된다
- [ ] T12. P(관통볼): 8초간 벽돌 통과 + 콤보 보너스(2개 이상 동시 파괴 시) 가산
- [ ] T13. S(공슬로우): 10초간 모든 공 속도 0.6배 적용
- [ ] T14. 같은 아이템 중복 획득 시 효과 중첩 없이 타이머만 갱신된다

### 점수/랭킹 (Scoring & Ranking)
- [ ] T15. D1=10, D2=60, D3=110, ITEM=50점이 정확히 가산된다
- [ ] T16. 게임 오버 시 도달 스테이지(gameLevel)가 정확히 기록되어 등록된다
- [ ] T17. 랭킹 정렬이 `gameLevel DESC, score DESC, createdAt ASC` 순으로 표시된다
- [ ] T18. 같은 sessionId로 중복 등록 시 409 응답을 받고 클라이언트가 안내한다

### 엣지 케이스 (Edge Cases)
- [ ] T19. 공이 벽돌 사이에 끼는 무한 루프가 0.5초 보정으로 풀린다
- [ ] T20. 멀티볼 마지막 공 추락 시에만 생명 차감 + 활성 아이템 해제가 동작한다
- [ ] T21. 닉네임 badwords 위반 시 422 + 클라이언트 토스트 노출
- [ ] T22. 백엔드 500 에러 시 LocalStorage 임시 저장 + 재시도 동작

---

## 16. 오픈 퀘스천 (답변 필요)

| ID | 질문 | 영향 영역 | 우선순위 |
|---:|:----|:---------|:--------|
| OQ-1 | BGM/SFX(벽돌 파괴, 공 발사, 패들 충돌)를 MVP에 포함할지 | designer, frontend | Low (없어도 출시 가능) |
| OQ-2 | 모바일 자이로 입력 추가 여부 (현재는 드래그만) | frontend | Low |
| OQ-3 | "다시하기" 버튼이 sessionId를 새로 발급받아야 하는지 (혹은 처음부터 다시) | backend | Medium — 답변: **새 sessionId 발급** (중복 랭킹 방지) |
| OQ-4 | Stage 10 클리어 후 "Stage 11 잠금" UI를 보여줄지, "엔딩"으로 끝낼지 | designer | Low — 답변: **엔딩으로 끝냄** (차후 추가 시 변경) |
| OQ-5 | 일별 랭킹 컷오프 시간대 (KST 00:00 vs UTC) | backend | Medium — 답변: **KST 00:00** (기존 게임과 동일) |

> OQ-3, OQ-4, OQ-5는 본 PRD에서 잠정 결정 적용. 사용자 추가 의견 시 변경 가능.

---

## 17. 작업 핸드오프

이 PRD가 확정되는 즉시 다음 팀원에게 인계:

- **designer** → `docs/design/brickbreaker-design.md` 작성
  - 캔버스 색상 팔레트, 벽돌 디자인(D1/D2/D3 시각 차이), 캡슐 디자인, HUD 레이아웃, 게임 오버/엔딩 화면 모션
- **developer-frontend** → §11 파일 목록 기준 구현
  - `useBrickBreakerGame.ts` (useReducer + 3 refs 패턴), `BrickBreakerCanvas.tsx`, `stages.ts`, `items.ts`, `scoring.ts`
  - `App.tsx` 라우트, `HomePage.tsx` Test Lab 카드 BETA 뱃지
- **developer-backend** → §9 + §12 기준 구현
  - `BrickBreakerRanking` 엔티티, Repository, `RankingService.VALID_GAMES`에 `"brickbreaker"` 추가
  - `docs/sql/brickbreaker-ranking-schema.sql` 작성 → 사용자가 Railway에서 직접 실행
- **qa-tester** → §15 22항목 테스트 플랜 → `docs/review/brickbreaker-test-plan.md`

---

## 18. 변경 이력

| 날짜 | 작성자 | 내용 |
|:----|:------|:----|
| 2026-05-06 | planner | 초안 작성 (10스테이지, 4아이템, API 계약, DB 스키마 확정) |
