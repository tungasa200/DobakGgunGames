# API 계약 — Block Crush (블록 크러시)

- 작성자: planner
- 최초 작성일: 2026-05-18
- 상태: 초안 (developer-backend 검토 후 확정)
- 관련 PRD: `docs/specs/block-crush-prd.md`
- 게임 키: `block-crush`
- 레벨 키: `classic`

본 문서는 기존 `RankingService` / `BrickBreakerRanking` / `SessionService` 패턴을 기반으로 한
**최소 변경**으로 Block Crush를 추가하기 위한 API 계약입니다.

---

## 1. 엔드포인트 요약

| Method | Path | 설명 | 기존/신규 |
|:------:|:-----|:-----|:---------:|
| POST | `/api/block-crush/session/start` | 게임 세션 시작 (sessionId 발급) | **기존 SessionController 재사용** |
| POST | `/api/block-crush/rankings` | 랭킹 등록 | **기존 RankingController 재사용** |
| GET  | `/api/block-crush/rankings?level=classic` | 주간 랭킹 조회 | **기존 재사용** |
| GET  | `/api/block-crush/rankings/alltime?level=classic` | 전체 최고 기록 조회 | **기존 재사용** |

- 모든 엔드포인트는 기존 `SessionController` / `RankingController`가 `@PathVariable String game`을
  받는 구조이므로 **컨트롤러 신규 작성 불필요**.
- `RankingService.VALID_GAMES` 집합 + dispatch 스위치 분기 확장만 필요.

---

## 2. POST /api/block-crush/session/start

### 2.1 요청

```
POST /api/block-crush/session/start
Content-Type: application/json
```

```json
{
  "level": "classic"
}
```

**필드**:
- `level` (string, required): 반드시 `"classic"`. 다른 값은 400.
- `portrait` (boolean, optional): 사용 안 함(사과게임 large 전용 필드). 무시.

### 2.2 응답

```json
{
  "sessionId": "550e8400-e29b-41d4-a716-446655440000",
  "startedAt": 1747526400000,
  "expiresAt": 1747533600000,
  "digitCount": null
}
```

**필드**:
- `sessionId` (string): UUID v4. 랭킹 등록 시 필수.
- `startedAt` (long): 세션 생성 시각 (Unix ms).
- `expiresAt` (long): 세션 만료 시각 (Unix ms). `startedAt + 7200초`.
- `digitCount` (integer | null): 숫자야구 전용 필드 — Block Crush는 항상 `null`.

### 2.3 동작
- `SessionService.createSession("block-crush", req, httpReq)` 호출.
- DB `game_sessions`에 `game = "block-crush"`, `level = "classic"`, `state = ACTIVE` 로 저장.
- IP 해시는 서버에서 자동 계산.

### 2.4 변경 필요 사항
- `SessionService.EXPIRE_SECONDS` Map에 `"block-crush" -> 7200L` 추가 (다른 게임과 동일).
- 그 외 컨트롤러/DTO 변경 불필요.

---

## 3. POST /api/block-crush/rankings

### 3.1 요청

```
POST /api/block-crush/rankings
Content-Type: application/json
```

```json
{
  "level": "classic",
  "name": "닉네임",
  "score": 12345,
  "linesCleared": 87,
  "sessionId": "550e8400-e29b-41d4-a716-446655440000"
}
```

**필드** (기존 `RankingRequest` DTO 재사용 — **신규 필드 추가 없음**):
- `level` (string, required, max 20): 반드시 `"classic"`.
- `name` (string, required, max 50): 닉네임. 클라이언트에서 1~12자 권장, 서버는 1~50자.
- `score` (integer, required): 0 이상 9,999,999 이하.
- `linesCleared` (integer, required): 0 이상 100,000 이하.
- `sessionId` (string, required): `/session/start`에서 발급받은 UUID.
- 그 외 필드(`time`, `attempts`, `moves`, `gameLevel`, `events`)는 사용 안 함 → 무시.

### 3.2 응답

```json
{
  "id": 42,
  "name": "닉네임",
  "level": "classic",
  "time": null,
  "score": 12345,
  "attempts": null,
  "moves": null,
  "gameLevel": null,
  "createdAt": "2026-05-18T12:34:56"
}
```

**필드** (기존 `RankingResponse` DTO 재사용):
- 기존 필드를 그대로 사용.
- `linesCleared`는 **응답에 노출하지 않음** (기존 응답 DTO에 필드 없음). 필요 시 별도 확장(아래 §7 참조).

### 3.3 검증 규칙 (RankingService.submit 흐름)
1. **VALID_GAMES 검증**: `"block-crush"`가 집합에 포함되어야 함.
2. **validateLevel**: `"classic"`만 허용.
3. **Rate Limit**: 동일 IP 해시, 분당 3건 (기존 `RATE_LIMIT_PER_MINUTE = 3` 동일 적용). 초과 시 429.
4. **sessionId 검증**:
   - 비어있으면 400.
   - `SessionService.validateAndConsume("block-crush", ...)` — state가 ACTIVE가 아니거나 만료면 400.
   - IP 불일치는 거부하지 않고 `ip_mismatch` 플래그만 기록(기존 패턴 동일).
   - 검증 통과 시 state를 `SUBMITTED`로 변경 → 같은 sessionId 재사용 차단.
5. **점수 범위 검증** (`validateScoreBounds` 분기에 `case "block-crush"` 추가):
   - 단순안 (권장):
     ```java
     case "block-crush" -> {
         int score = req.getScore() != null ? req.getScore() : -1;
         int lines = req.getLinesCleared() != null ? req.getLinesCleared() : -1;
         yield !(score >= 0 && score <= 9_999_999
              && lines >= 0 && lines <= 100_000);
     }
     ```
   - 비율안 (선택):
     ```java
     case "block-crush" -> {
         Integer s = req.getScore();
         Integer l = req.getLinesCleared();
         if (s == null || l == null) yield true;
         if (s < 0 || s > 9_999_999) yield true;
         if (l < 0 || l > 100_000) yield true;
         long maxByLines = 1000L + (long) l * 5000L + 240L * 9L;
         yield s > maxByLines;
     }
     ```
   - 위반 시 400 `"점수가 유효 범위를 초과했습니다."`.

### 3.4 저장 분기 (`saveRanking` 메서드)
```java
case "block-crush" -> BlockCrushRankingRepository.save(BlockCrushRanking.builder()
        .level(req.getLevel())
        .name(req.getName().trim())
        .score(req.getScore())
        .linesCleared(req.getLinesCleared())
        .ipHash(ipHash)
        .userId(userId)
        .build());
```

---

## 4. GET /api/block-crush/rankings?level=classic

### 4.1 요청
```
GET /api/block-crush/rankings?level=classic
```

- 쿼리 파라미터 `level=classic` 필수.

### 4.2 응답
```json
[
  {
    "id": 1,
    "name": "고수",
    "level": "classic",
    "time": null,
    "score": 25400,
    "attempts": null,
    "moves": null,
    "gameLevel": null,
    "createdAt": "2026-05-18T11:22:33"
  },
  ...
]
```

- **List 형태** (기존 `RankingController.getWeeklyRankings` 시그니처 그대로).
- 최대 100건 반환.
- 정렬: `score DESC, createdAt ASC`
- 기간: 현재 주 월요일 00:00 KST 이후 등록분만 (기존 `weekStart` 로직 동일).

### 4.3 dispatch 분기 (`queryWeekly`)
```java
case "block-crush" -> BlockCrushRankingRepository.findWeekly(level, weekStart);
```

---

## 5. GET /api/block-crush/rankings/alltime?level=classic

### 5.1 요청
```
GET /api/block-crush/rankings/alltime?level=classic
```

### 5.2 응답 (기존 패턴 동일 — 단일 객체)
```json
{
  "id": 7,
  "name": "최강자",
  "level": "classic",
  "time": null,
  "score": 87600,
  "attempts": null,
  "moves": null,
  "gameLevel": null,
  "createdAt": "2026-05-12T08:30:00"
}
```

- 기록이 하나도 없으면 빈 객체 `{}` 반환 (기존 `RankingController.getAlltimeBest`가 `Map.of()` 반환).
- 정렬: `score DESC, createdAt ASC`
- 1건만 반환.

### 5.3 dispatch 분기 (`queryAlltimeBest`)
```java
case "block-crush" -> BlockCrushRankingRepository.findAlltimeBest(level);
```

---

## 6. BlockCrushRanking 엔티티

### 6.1 자바 클래스

`backend/src/main/java/com/dobakggun/entity/BlockCrushRanking.java` (신규)

```java
package com.dobakggun.entity;

import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

@Entity
@Table(name = "block_crush_ranking", indexes = {
        @Index(name = "idx_bcr_level_score",   columnList = "level,score,created_at"),
        @Index(name = "idx_bcr_level_created", columnList = "level,created_at"),
        @Index(name = "idx_bcr_user",          columnList = "user_id")
})
@Getter @Setter @NoArgsConstructor @SuperBuilder
public class BlockCrushRanking extends Ranking {

    /** 최종 점수 (0 ~ 9,999,999) */
    @Column(nullable = false)
    private Integer score;

    /** 클리어한 총 줄 수 (0 ~ 100,000) — 통계/검증용 */
    @Column(name = "lines_cleared", nullable = false)
    private Integer linesCleared;
}
```

**상속**: `Ranking` (`id`, `level`, `name`, `ipHash`, `userId`, `createdAt` 자동 포함).

**테이블명**: `block_crush_ranking` (스네이크 케이스, 다른 랭킹 테이블 일관성).

### 6.2 인덱스 전략
| 인덱스 | 컬럼 | 용도 |
|:---|:---|:---|
| `idx_bcr_level_score` | `level, score, created_at` | 주간/전체 랭킹 정렬 쿼리 (`level=classic ORDER BY score DESC, created_at ASC`) |
| `idx_bcr_level_created` | `level, created_at` | 주간 필터 (`created_at >= weekStart`) |
| `idx_bcr_user` | `user_id` | 사용자 본인 기록 조회 (관리자 화면 / 향후 확장) |

> 참고: BrickBreaker는 `(level, game_level DESC, score DESC, created_at)` 복합 인덱스를 썼지만,
> Block Crush는 stage 개념이 없어 단일 score 정렬이라 컬럼이 더 단순함.

---

## 7. BlockCrushRankingRepository

`backend/src/main/java/com/dobakggun/repository/BlockCrushRankingRepository.java` (신규)

```java
package com.dobakggun.repository;

import com.dobakggun.entity.BlockCrushRanking;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

public interface BlockCrushRankingRepository extends RankingRepository<BlockCrushRanking> {

    @Query("""
        SELECT r FROM BlockCrushRanking r
        WHERE r.level = :level AND r.createdAt >= :weekStart
        ORDER BY r.score DESC, r.createdAt ASC
        LIMIT 100
    """)
    List<BlockCrushRanking> findWeekly(
            @Param("level") String level,
            @Param("weekStart") LocalDateTime weekStart
    );

    @Query("""
        SELECT r FROM BlockCrushRanking r
        WHERE r.level = :level
        ORDER BY r.score DESC, r.createdAt ASC
        LIMIT 1
    """)
    BlockCrushRanking findAlltimeBest(@Param("level") String level);
}
```

- `countByIpHashAndCreatedAtAfter`는 부모 `RankingRepository<T>`에서 상속됨 (정의 불필요).

---

## 8. RankingService 변경 분기 요약

`RankingService.java` 다음 5곳에 `block-crush` 분기 추가:

### 8.1 VALID_GAMES
```java
private static final Set<String> VALID_GAMES = Set.of(
    "minesweeper", "baseball", "blockfall", "blockfall-insane",
    "solitaire", "apple", "sudoku", "brickbreaker",
    "block-crush"  // 추가
);
```

### 8.2 validateLevel
```java
case "block-crush" -> Set.of("classic");
```

### 8.3 queryWeekly
```java
case "block-crush" -> BlockCrushRankingRepository.findWeekly(level, weekStart);
```

### 8.4 queryAlltimeBest
```java
case "block-crush" -> BlockCrushRankingRepository.findAlltimeBest(level);
```

### 8.5 countByIpHash
```java
case "block-crush" -> BlockCrushRankingRepository.countByIpHashAndCreatedAtAfter(ipHash, after);
```

### 8.6 saveRanking
```java
case "block-crush" -> BlockCrushRankingRepository.save(BlockCrushRanking.builder()
        .level(req.getLevel())
        .name(req.getName().trim())
        .score(req.getScore())
        .linesCleared(req.getLinesCleared())
        .ipHash(ipHash)
        .userId(userId)
        .build());
```

### 8.7 validateScoreBounds
§3.3에 정의된 분기 추가 (단순안 또는 비율안 중 선택).

### 8.8 의존성 주입
```java
private final BlockCrushRankingRepository BlockCrushRankingRepository;
```

---

## 9. RankingRequest / RankingResponse 변경 검토

### 9.1 RankingRequest — 재사용 가능 (변경 없음)
- 기존 DTO에 이미 `Integer linesCleared` 필드가 존재 (Blockfall이 사용 중).
- Block Crush도 동일 필드를 그대로 사용 가능.
- **신규 필드 추가 불필요**.

### 9.2 RankingResponse — 선택 사항
- 기존 DTO에는 `linesCleared` 필드가 없음.
- 응답에 `linesCleared`를 노출하지 않아도 PRD §1.4 기능에는 영향 없음 (랭킹 표시는 score만 사용).
- **선택지 A (권장, 변경 없음)**: 응답에 노출 안 함. 클라이언트는 score만 표시.
- **선택지 B (확장)**: `RankingResponse`에 `private final Integer linesCleared;` 추가 + `BlockCrushRanking` instanceof 분기 추가. 다른 게임 응답은 항상 `null`.
  - 클라이언트가 "이번 게임에서 N줄 클리어!" 같은 부가 정보를 표시하려면 필요.
- developer-backend 판단으로 결정. PRD는 선택지 A로 충분.

---

## 10. DB 스키마 (DDL)

> Railway 직접 쓰기 금지. 아래 SQL을 `docs/sql/block-crush-ranking-schema.sql`로 저장 후 사용자가 직접 실행.

```sql
CREATE TABLE block_crush_ranking (
    id            BIGINT       NOT NULL AUTO_INCREMENT,
    level         VARCHAR(20)  NOT NULL DEFAULT 'classic',
    name          VARCHAR(50)  NOT NULL,
    score         INT          NOT NULL,
    lines_cleared INT          NOT NULL,
    ip_hash       VARCHAR(64)  NOT NULL,
    user_id       BIGINT       NULL,
    created_at    DATETIME(6)  NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    PRIMARY KEY (id),
    KEY idx_bcr_level_score   (level, score, created_at),
    KEY idx_bcr_level_created (level, created_at),
    KEY idx_bcr_user          (user_id),
    CONSTRAINT chk_bcr_score        CHECK (score >= 0 AND score <= 9999999),
    CONSTRAINT chk_bcr_lines        CHECK (lines_cleared >= 0 AND lines_cleared <= 100000),
    CONSTRAINT chk_bcr_level_value  CHECK (level = 'classic')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

- `created_at`의 정밀도 `DATETIME(6)`은 다른 랭킹 테이블 관행에 맞춰 조정 가능(`DATETIME(3)`도 무방).
- `level` CHECK 제약은 향후 모드 확장 시 제거 또는 enum 확대 필요.

---

## 11. Rate Limit 정책 (기존과 동일)

- **분당 등록 제한**: 동일 IP 해시 기준 **3건/분**.
- 초과 시 HTTP 429 + `"잠시 후 다시 시도해주세요."`.
- 기존 `RankingService.RATE_LIMIT_PER_MINUTE = 3` 상수 그대로 적용.
- 별도 정책 변경 없음.

---

## 12. 에러 응답 매트릭스

| 상황 | HTTP | 메시지 |
|:---|---:|:---|
| 잘못된 게임 키 (e.g., `block-crush` 미등록) | 404 | "존재하지 않는 게임입니다." |
| 잘못된 level (e.g., `easy`) | 400 | "유효하지 않은 레벨입니다." |
| sessionId 누락 | 400 | "유효하지 않은 요청입니다." |
| sessionId 없음/잘못됨 | 400 | "유효하지 않은 세션입니다." |
| sessionId 이미 사용/만료 | 400 | "이미 사용되었거나 만료된 세션입니다." 또는 "세션이 만료되었습니다." |
| 세션 게임 키 불일치 | 400 | "세션 게임 정보가 일치하지 않습니다." |
| 점수/줄 범위 초과 | 400 | "유효하지 않은 점수입니다." 또는 "점수가 유효 범위를 초과했습니다." |
| 분당 등록 횟수 초과 | 429 | "잠시 후 다시 시도해주세요." |
| 닉네임 badwords 위반 | 422 또는 400 | "사용할 수 없는 닉네임입니다." (클라이언트 1차 검증 우선) |

> badwords 검증은 클라이언트의 `containsProfanity` 검증을 거치는 것이 현재 패턴. 서버는 별도 422 응답 처리하지 않음(기존 게임과 동일).

---

## 13. 프론트엔드 API 사용 예시

### 13.1 세션 시작
```ts
import { startSession } from '../api/rankings';

const sessionId = await startSession('block-crush', 'classic');
```

### 13.2 주간 랭킹
```ts
import { rankingsApi } from '../api/rankings';

const weekly = await rankingsApi.getWeekly('block-crush', 'classic');
```

### 13.3 전체 최고 기록
```ts
const best = await rankingsApi.getAlltimeBest('block-crush', 'classic');
// best가 {} (Record<string, never>)면 기록 없음, 아니면 RankingEntry.
```

### 13.4 랭킹 등록
```ts
await rankingsApi.submit('block-crush', {
  level:        'classic',
  name:         playerName,
  score:        state.score,
  linesCleared: state.linesCleared,
  sessionId:    sessionIdRef.current,
});
```

- `frontend/src/api/rankings.ts`의 `SubmitPayload`에 이미 `linesCleared?: number` 필드가 존재 → **API 래퍼 수정 불필요**.

---

## 14. 작업 순서 권장 (developer-backend)

1. `BlockCrushRanking` 엔티티 작성
2. `BlockCrushRankingRepository` 작성
3. `RankingService` 분기 추가 (VALID_GAMES, validateLevel, queryWeekly, queryAlltimeBest, countByIpHash, saveRanking, validateScoreBounds)
4. `SessionService.EXPIRE_SECONDS` 맵에 `"block-crush"` 추가
5. `docs/sql/block-crush-ranking-schema.sql` 작성
6. (선택) `RankingResponse`에 `linesCleared` 노출 분기 추가 (frontend 요청 시)
7. 로컬 테스트: `./gradlew test` + 수동 curl 테스트
8. 사용자에게 Railway DDL 실행 지시

## 15. 작업 순서 권장 (developer-frontend)

1. `pieces.ts` (18종 폴리오미노) + `types.ts` 작성
2. `scoring.ts` (배치/줄/콤보 점수) 작성
3. `useBlockCrushGame.ts` (useReducer 로직, sessionIdRef)
4. `BlockCrushBoard.tsx` + `BlockCrushTray.tsx` (드래그&드롭, Pointer Events)
5. `BlockCrushPage.tsx` (HUD, 모달, 랭킹 표시)
6. `App.tsx`에 `/block-crush` 라우트 추가
7. `HomePage.tsx`에 Test Lab 카드 노출 (기본 ON, BETA 뱃지)
8. `BlockCrush.module.css` 스타일 적용
9. 로컬 테스트: `tsc -b && eslint .` 통과

---

## 16. 변경 이력

| 날짜 | 작성자 | 내용 |
|:----|:------|:----|
| 2026-05-18 | planner | 초안 작성 (기존 RankingService 패턴 재사용, RankingRequest 무변경, BlockCrushRanking 엔티티 신규) |

