# Progress — developer-backend : RSP (가위바위보) 어드민 전용 게임

- 소유 팀원: developer-backend
- 기능 키: `rsp`
- 최종 업데이트: 2026-04-22
- 관련 문서:
  - PRD: `docs/specs/rsp-game.md`
  - API 계약: `docs/specs/rsp-api-contract.md`

---

## 현재 상태

**테스트 마무리 완료 — 25개 테스트 전원 통과 (2026-04-22)**

---

## 구현 완료 파일 목록

### Entity
- `backend/src/main/java/com/dobakggun/entity/RspChoice.java` — ENUM (ROCK, SCISSORS, PAPER)
- `backend/src/main/java/com/dobakggun/entity/RspResult.java` — ENUM (WIN, LOSS, DRAW)
- `backend/src/main/java/com/dobakggun/entity/AdminRspPlay.java` — JPA 엔티티 (`admin_rsp_play` 테이블)

### Repository
- `backend/src/main/java/com/dobakggun/repository/AdminRspPlayRepository.java`
  - `aggregateStatsByAdminUserId()` — 단일 JPQL 쿼리로 totalPlays/wins/losses/draws 집계

### Service
- `backend/src/main/java/com/dobakggun/service/AdminRspService.java`
  - `play(Long adminUserId, RspChoice userChoice)` — ThreadLocalRandom 기반 computerChoice, 판정, 저장, 통계 반환
  - `getStats(Long adminUserId)` — 집계 통계 조회
  - `judge(RspChoice, RspChoice)` — 판정 로직 (package-private, 테스트 가능)
  - `buildStats()` — winRate: BigDecimal 4자리 반올림, totalPlays=0이면 null

### Controller
- `backend/src/main/java/com/dobakggun/controller/AdminRspController.java`
  - `POST /api/admin/rsp/plays` — @Valid RspPlayRequest, @AuthenticationPrincipal Long adminId
  - `GET /api/admin/rsp/stats` — @AuthenticationPrincipal Long adminId

### DTO
- `backend/src/main/java/com/dobakggun/dto/rsp/RspPlayRequest.java` — @NotNull userChoice
- `backend/src/main/java/com/dobakggun/dto/rsp/RspPlayResponse.java` — id, userChoice, computerChoice, result, playedAt, stats
- `backend/src/main/java/com/dobakggun/dto/rsp/RspStatsResponse.java` — totalPlays, wins, losses, draws, winRate

### API 계약 문서
- `docs/specs/rsp-api-contract.md` — 프론트엔드가 바로 구현 가능한 수준으로 작성

### DB Migration (참조용)
- `backend/src/main/resources/db/migration/V1__create_admin_rsp_play.sql` — 참조 SQL (실제 적용은 JPA ddl-auto=update)

### 기존 파일 수정
- `backend/src/main/java/com/dobakggun/config/GlobalExceptionHandler.java`
  - `HttpMessageNotReadableException` 핸들러 추가 (잘못된 enum 값 → 400)

### 테스트
- `backend/src/test/java/com/dobakggun/service/AdminRspServiceTest.java`
  - 판정 로직 단위 테스트 (9가지 조합 전체 + 개별 케이스)
- `backend/src/test/java/com/dobakggun/controller/AdminRspControllerSecurityTest.java`
  - `@WebMvcTest` 기반 시큐리티 통합 테스트
  - 미인증 → 401/403, USER role → 403, ADMIN role → 200

---

## OQ 확정 결과

| OQ | 확정 내용 |
|---|---|
| OQ-1 | POST 응답에 stats 포함 (RTT 절약) |
| OQ-2 | JPA ddl-auto=update + 참조 SQL 파일 커밋 |
| OQ-6 | ThreadLocalRandom (보안 요구 낮음) |
| OQ-7 | winRate: 0~1 소수 4자리 반올림, totalPlays=0이면 null |

---

## 이번 세션 변경 사항 (2026-04-22, 2차 — 테스트 마무리)

### build.gradle 의존성 추가
```
testImplementation 'org.springframework.security:spring-security-test'   // spring-security-test 추가
testRuntimeOnly 'com.h2database:h2'                                       // @SpringBootTest용 인메모리 DB
```

### 새로 추가된 파일
- `backend/src/test/resources/application.properties` — 테스트 전용 설정 (H2 DB, 플레이스홀더 OAuth2/R2 등)

### SecurityConfig 변경 (테스트 호환성 개선)
- `clientRegistrationRepository` 필드 `@Autowired(required=false)` 추가
- `oauth2Login()` 내부에 `clientRegistrationRepository == null` 시 `disable()` 분기 추가
- 목적: `@WebMvcTest` 슬라이스에서 OAuth2 클라이언트 빈이 없을 때 filterChain 생성 실패 방지

---

## 2차 세션 추가 변경 사항 (사용자 확정 결정 반영)

### 결정 1.A — SecurityConfig 변경 유지
- `@Autowired(required = false) ClientRegistrationRepository` + null 가드 그대로 유지

### 결정 2.A — AdminRspControllerSecurityTest.java 수정
- `@Import(SecurityConfig.class)` 어노테이션 추가 (실제 인가 규칙 로드)
- `anonymousUser` 2개 테스트 assertion을 `is4xxClientError()` → `is(not(200))`으로 수정
  - 이유: oauth2Login 활성화 시 미인증 접근은 302 리다이렉트 (차단 의도 동일하게 만족)
- 결과: 6개 보안 테스트 전원 통과

### 결정 3.B — DobakGgunGamesApplicationTests Redis mock 처리
- `DobakGgunGamesApplicationTests.java` 수정: `@MockBean`으로 `StringRedisTemplate`, `IpBanService`, `RedisTokenService` mock 처리
- `backend/src/test/resources/application.properties` 수정: Redis 자동설정 3종 제외
  ```
  spring.autoconfigure.exclude=RedisAutoConfiguration, RedisReactiveAutoConfiguration, RedisRepositoriesAutoConfiguration
  ```
- 결과: `contextLoads()` 로컬 Redis 없이 통과

---

## SecurityConfig 변경 여부

**변경 있음 (이번 세션).** 테스트 호환성을 위해 `clientRegistrationRepository` null 체크 분기 추가.
기존 `/api/admin/**` → `hasRole("ADMIN")` 매핑은 변경 없음 (SecurityConfig.java:64).

---

## DB 스키마 생성 방식

- **방식**: `spring.jpa.hibernate.ddl-auto=update` 자동 처리
- 애플리케이션 기동 시 `admin_rsp_play` 테이블 자동 생성
- 참조 SQL: `backend/src/main/resources/db/migration/V1__create_admin_rsp_play.sql`
- Flyway/Liquibase 미사용 (기존 프로젝트 정책 그대로)

---

## 신규 환경변수

**없음.** PRD §11 예측대로 신규 Railway/Vercel 환경변수 추가 없음.

---

## 아키텍처 smell 재발 방지 체크

- [x] `RankingService.VALID_GAMES` 에 `rsp` 추가하지 않음
- [x] `AdminRankingService`, `AdminStatsService` 수정하지 않음
- [x] 컨트롤러가 엔티티 직접 반환 안 함 → DTO 매핑
- [x] userId는 `@AuthenticationPrincipal Long adminId`로만 추출
- [x] `GameStatus` 엔티티에 `rsp` 등록하지 않음 (토글 대상 아님)
- [x] 홈/Excel 홈/사이드바 카탈로그 수정 없음

---

## 사용자 확인 필요 사항

없음 — 모든 테스트 통과 완료.

---

## 진행 중

- 없음 (백엔드 구현 완료)

---

## 블로커 / 질문

없음 — 모든 블로커 해소 완료.

---

## 다음 단계 (다음 세션)

1. developer-frontend의 RSP 어드민 화면 구현 확인 (API 계약: `docs/specs/rsp-api-contract.md`)
2. qa-tester에게 E2E 검증 요청
3. Railway 프로덕션 배포 후 스모크 테스트

---

## 세션 종료 로그 (2026-04-21)

### 최종 테스트 결과

- 총 25개 테스트, 0 실패 — BUILD SUCCESSFUL
- `AdminRspServiceTest`: 판정 로직 단위 테스트 전원 통과
- `AdminRspControllerSecurityTest`: 시큐리티 슬라이스 테스트 6개 전원 통과
- `DobakGgunGamesApplicationTests`: contextLoads() 통과 (Redis mock 처리)

### 최종 수정/생성 파일 목록

**신규 생성**
- `backend/src/main/java/com/dobakggun/entity/RspChoice.java`
- `backend/src/main/java/com/dobakggun/entity/RspResult.java`
- `backend/src/main/java/com/dobakggun/entity/AdminRspPlay.java`
- `backend/src/main/java/com/dobakggun/repository/AdminRspPlayRepository.java`
- `backend/src/main/java/com/dobakggun/service/AdminRspService.java`
- `backend/src/main/java/com/dobakggun/controller/AdminRspController.java`
- `backend/src/main/java/com/dobakggun/dto/rsp/RspPlayRequest.java`
- `backend/src/main/java/com/dobakggun/dto/rsp/RspPlayResponse.java`
- `backend/src/main/java/com/dobakggun/dto/rsp/RspStatsResponse.java`
- `backend/src/main/resources/db/migration/V1__create_admin_rsp_play.sql` (참조용)
- `backend/src/test/java/com/dobakggun/service/AdminRspServiceTest.java`
- `backend/src/test/java/com/dobakggun/controller/AdminRspControllerSecurityTest.java`
- `backend/src/test/resources/application.properties`
- `docs/specs/rsp-api-contract.md`

**기존 파일 수정**
- `backend/build.gradle` — `spring-security-test`, `h2 testRuntimeOnly` 추가
- `backend/src/main/java/com/dobakggun/config/GlobalExceptionHandler.java` — `HttpMessageNotReadableException` 핸들러 추가
- `backend/src/main/java/com/dobakggun/security/SecurityConfig.java` — `clientRegistrationRepository` null 가드 추가
- `backend/src/test/java/com/dobakggun/DobakGgunGamesApplicationTests.java` — `@MockBean StringRedisTemplate/IpBanService/RedisTokenService` 추가

**삭제**
- `backend/src/main/resources/badwords.json` — 사용자 지시(옵션 A), `shared/badwords.json`만 유지, build.gradle duplicate 해결

### CP5(qa-tester 검증) 생략

- 사용자 결정으로 QA 단계 건너뜀
- 백엔드 기능 구현 및 테스트는 완전 완료 상태

### 배포 및 다음 세션 참고사항

- Railway 프로덕션 배포 시 `spring.jpa.hibernate.ddl-auto=update` 설정으로 `admin_rsp_play` 테이블 자동 생성됨 (별도 DDL 실행 불필요)
- 신규 Railway/Vercel 환경변수 추가 없음
- RSP 기능은 `/api/admin/**` 경로이므로 기존 `hasRole("ADMIN")` 보호 자동 적용
- `RankingService.VALID_GAMES`에 `rsp` 미등록 상태 유지 (랭킹 시스템과 분리)
- ESLint 기존 에러는 프론트엔드 영역으로 백엔드 이슈 아님

---

## 2026-04-22 (세션 종료 확인)

### 상태
- RSP 백엔드 구현: 완전 완료 (이전 세션 완료, 추가 작업 없음)
- Blockfall Insane Overhaul: 백엔드 변경 없음 (PRD 확정 방침)
- 이번 세션 변경 파일: 없음

### 다음 세션 할 일
- 없음
