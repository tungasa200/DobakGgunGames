# API 계약 — 어드민 RSP 게임 (최종 확정)

- 작성자: developer-backend
- 확정일: 2026-04-21
- 상태: **CP4 확정** (OQ-1 ~ OQ-7 전부 결정됨)
- 근거 PRD: `docs/specs/rsp-game.md`

---

## 공통 사항

### Base URL
```
/api/admin/rsp
```

### 인증
- 모든 엔드포인트: `Authorization: Bearer <JWT>` 헤더 필수
- ADMIN role 없으면 **403 Forbidden**
- JWT 없거나 만료 시 **401 Unauthorized**
- SecurityConfig 기존 `/api/admin/**` → `hasRole("ADMIN")` 매핑으로 자동 보호 (별도 설정 없음)

### Content-Type
- 요청: `application/json`
- 응답: `application/json`

### userId 처리
- 클라이언트는 userId를 body/query에 **절대 포함하지 않음**
- 서버가 JWT의 `principal`에서 `Long adminId`를 추출 (`@AuthenticationPrincipal Long adminId`)

---

## 엔드포인트

### 1. POST /api/admin/rsp/plays

어드민이 선택한 가위/바위/보를 서버로 전송. 서버가 컴퓨터 선택과 판정을 수행 후 결과를 저장하고 반환.

#### Request

```
POST /api/admin/rsp/plays
Authorization: Bearer <JWT>
Content-Type: application/json
```

```json
{
  "userChoice": "ROCK"
}
```

| 필드 | 타입 | 필수 | 설명 |
|---|---|---|---|
| `userChoice` | `string` (enum) | O | `ROCK` / `SCISSORS` / `PAPER` 중 하나 |

#### Response 200 OK

```json
{
  "id": 123,
  "userChoice": "ROCK",
  "computerChoice": "SCISSORS",
  "result": "WIN",
  "playedAt": "2026-04-21T12:34:56",
  "stats": {
    "totalPlays": 17,
    "wins": 8,
    "losses": 7,
    "draws": 2,
    "winRate": 0.4706
  }
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `id` | `number` | 저장된 play record PK |
| `userChoice` | `string` | 어드민이 낸 것 (에코) |
| `computerChoice` | `string` | 서버가 랜덤 생성한 컴퓨터 선택 |
| `result` | `string` | 판정 결과: `WIN` / `LOSS` / `DRAW` |
| `playedAt` | `string` (ISO-8601) | 플레이 시각 (서버 로컬타임, yyyy-MM-dd'T'HH:mm:ss) |
| `stats.totalPlays` | `number` | 누적 총 플레이 수 |
| `stats.wins` | `number` | 누적 승 |
| `stats.losses` | `number` | 누적 패 |
| `stats.draws` | `number` | 누적 무 |
| `stats.winRate` | `number \| null` | 0~1 소수 4자리 반올림. `totalPlays=0`이면 `null` |

> OQ-1 결정: `stats` 포함 (RTT 절약). 저장 직후 최신 통계를 함께 반환하므로 GET /stats 별도 호출 불필요.

#### 판정 테이블 (서버 SSOT)

| user \ computer | ROCK | SCISSORS | PAPER |
|---|---|---|---|
| **ROCK** | DRAW | WIN | LOSS |
| **SCISSORS** | LOSS | DRAW | WIN |
| **PAPER** | WIN | LOSS | DRAW |

#### 에러 응답

| HTTP | 조건 | 응답 body 예시 |
|---|---|---|
| 400 | `userChoice`가 `ROCK`/`SCISSORS`/`PAPER` 외 값 | `{"error": "Invalid userChoice: INVALID_VALUE"}` |
| 401 | JWT 없음 / 만료 | Spring Security 기본 응답 |
| 403 | ADMIN role 아님 | Spring Security 기본 응답 |
| 500 | DB 저장 중 예외 | `{"error": "Internal server error"}` |

---

### 2. GET /api/admin/rsp/stats

어드민 본인의 누적 게임 통계 조회. 본인 데이터만 반환 (타 어드민 데이터 접근 불가).

#### Request

```
GET /api/admin/rsp/stats
Authorization: Bearer <JWT>
```

요청 body 없음.

#### Response 200 OK

```json
{
  "totalPlays": 42,
  "wins": 20,
  "losses": 18,
  "draws": 4,
  "winRate": 0.4762
}
```

| 필드 | 타입 | 설명 |
|---|---|---|
| `totalPlays` | `number` | 누적 총 플레이 수 |
| `wins` | `number` | 누적 승 |
| `losses` | `number` | 누적 패 |
| `draws` | `number` | 누적 무 |
| `winRate` | `number \| null` | 0~1 소수 4자리 반올림. `totalPlays=0`이면 `null` |

> EC-6 처리: 플레이 기록 0건이면 `{ totalPlays: 0, wins: 0, losses: 0, draws: 0, winRate: null }` 반환

#### 에러 응답

| HTTP | 조건 | 응답 body 예시 |
|---|---|---|
| 401 | JWT 없음 / 만료 | Spring Security 기본 응답 |
| 403 | ADMIN role 아님 | Spring Security 기본 응답 |

---

## ENUM 정의

### RspChoice (userChoice / computerChoice)
```
ROCK      — 바위
SCISSORS  — 가위
PAPER     — 보
```

### RspResult (result)
```
WIN   — 승리
LOSS  — 패배
DRAW  — 무승부
```

---

## 확정된 OQ 목록

| OQ | 질문 | 확정 |
|---|---|---|
| OQ-1 | POST 응답에 stats 포함? | **포함** (RTT 절약) |
| OQ-2 | migration SQL vs JPA auto? | **JPA ddl-auto=update** + 참조 SQL 파일 별도 커밋 |
| OQ-6 | 컴퓨터 선택 랜덤: SecureRandom vs ThreadLocalRandom? | **ThreadLocalRandom** (보안 요구 낮음, 충분) |
| OQ-7 | winRate 포맷? | **0~1 소수, 소수점 4자리 반올림**, totalPlays=0이면 null |

---

## 프론트엔드 구현 가이드

### API 래퍼 권장 패턴

`frontend/src/api/admin.ts` 에 다음 함수 추가 권장 (기존 `adminXxxApi` 패턴 재사용):

```typescript
// POST /api/admin/rsp/plays
async playRound(token: string, userChoice: 'ROCK' | 'SCISSORS' | 'PAPER'): Promise<RspPlayResponse>

// GET /api/admin/rsp/stats
async getStats(token: string): Promise<RspStatsResponse>
```

> `api/rsp.ts` 별도 파일에 `request<T>()` 재작성 금지 (architecture.md High #4 재발 방지)

### 타입 정의 (TypeScript)

```typescript
type RspChoice = 'ROCK' | 'SCISSORS' | 'PAPER';
type RspResult = 'WIN' | 'LOSS' | 'DRAW';

interface RspPlayRequest {
  userChoice: RspChoice;
}

interface RspStats {
  totalPlays: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number | null;
}

interface RspPlayResponse {
  id: number;
  userChoice: RspChoice;
  computerChoice: RspChoice;
  result: RspResult;
  playedAt: string; // ISO-8601
  stats: RspStats;
}

type RspStatsResponse = RspStats;
```

### 연승/연패 스트릭 (프론트 로컬 상태)

- 무승부(DRAW)는 스트릭 유지 (변경 없음)
- WIN 시 연패 초기화 → 연승 +1
- LOSS 시 연승 초기화 → 연패 +1

### 에러 처리 권장

- 네트워크 에러 또는 서버 500: 토스트/배너 에러 표시, 세션 카운트 올리지 않음 (EC-3)
- 응답 대기 중 버튼 비활성화 (EC-4, FR-S5)

---

## 라우트 정보

| 경로 | 설명 |
|---|---|
| `/admin/rsp` | 일반 모드 — AdminRoute로 감쌈 |
| `/admin/rsp/excel` | Excel 모드 — AdminRoute로 감쌈 |

> 홈/Excel 홈/사이드바/AdminGamesPage 카탈로그에 **등록하지 않음**
