# developer-backend / block-crush

## 완료된 파일 목록

### 신규 생성
| 레이어 | 파일 |
|---|---|
| Entity | `backend/src/main/java/com/dobakggun/entity/BlockCrushRanking.java` |
| Repository | `backend/src/main/java/com/dobakggun/repository/BlockCrushRankingRepository.java` |
| Service (검증) | `backend/src/main/java/com/dobakggun/service/BlockCrushValidationService.java` |
| SQL DDL | `docs/sql/block-crush-ranking-schema.sql` |

### 수정된 파일
| 파일 | 변경 내용 |
|---|---|
| `backend/.../service/RankingService.java` | `VALID_GAMES`에 `"block-crush"` 추가, `blockCrushRankingRepository` + `blockCrushValidationService` 필드 주입, 5개 switch 분기(`queryWeekly` / `queryAlltimeBest` / `countByIpHash` / `saveRanking` / `validateScoreBounds`) + `validateLevel` 분기 추가 |
| `backend/.../service/SessionService.java` | `EXPIRE_SECONDS`를 `Map.of` → `Map.ofEntries`로 교체하고 `"brickbreaker"` 누락분 보완 및 `"block-crush": 7200L` 추가 |

## 구현 세부 사항

### 엔티티 — BlockCrushRanking
- `Ranking` 추상 클래스 상속
- 테이블: `block_crush_ranking`
- 추가 컬럼: `score INT NOT NULL`, `lines_cleared INT NOT NULL`
- 인덱스: `idx_bcr_level_score`, `idx_bcr_level_created`, `idx_bcr_user`

### 레포지토리 — BlockCrushRankingRepository
- `findWeekly(level, weekStart)` — score DESC, createdAt ASC, LIMIT 100
- `findAlltimeBest(level)` — score DESC, createdAt ASC, LIMIT 1
- `countByIpHashAndCreatedAtAfter` — 부모 `RankingRepository`에서 상속

### 검증 서비스 — BlockCrushValidationService (비율안 B 채택)
- score null / linesCleared null 시 예외
- score 범위: 0 ~ 9,999,999
- linesCleared 범위: 0 ~ 100,000
- 비율 정합성: `score > 1000 + linesCleared * 5000 + 240 * 9` 이면 예외
- 예외 메시지 통일: `"점수가 유효 범위를 초과했습니다."`

### API 계약 (기존 공통 엔드포인트 재사용)
| 메서드 | 경로 | 설명 |
|---|---|---|
| POST | `/api/session/start` | `{"game":"block-crush","level":"classic"}` |
| POST | `/api/ranking/{game}` | game = `"block-crush"`, body에 `score`, `linesCleared`, `sessionId` 필수 |
| GET | `/api/ranking/{game}?level=classic` | 주간 랭킹 조회 |
| GET | `/api/ranking/{game}/best?level=classic` | 역대 최고 조회 |

유효 레벨: `classic` (단일)

## 진행 중인 것
- 없음 (모든 백엔드 구현 완료)

## 블로커 / 질문
- 없음

## API 계약 변경사항
- 기존 공통 랭킹/세션 엔드포인트를 그대로 사용하므로 추가 계약 변경 없음
- `RankingRequest.linesCleared` 필드는 blockfall에서 이미 존재 — 재사용

## 다음 세션에서 할 것
- Railway 프로덕션 DB에서 `docs/sql/block-crush-ranking-schema.sql` 실행 (사용자 직접)
- 프론트엔드 연동 후 통합 테스트
