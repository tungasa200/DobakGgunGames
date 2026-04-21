# Review Priorities — main branch (통합)

**Date**: 2026-04-21
**Source reports**:
- `docs/review/architecture.md` — 13 findings (1 Critical / 5 High / 5 Medium / 2 Low)
- `docs/review/security.md` — 14 findings (2 Critical / 4 High / 6 Medium / 2 Low) + 9 긍정 관찰
- `docs/review/test-coverage.md` — 13 gap findings (4 Critical / 5 High / 3 Medium / 1 Low) + 12 shared-module 회귀 리스크

## 종합 진단
세 리뷰어가 독립적으로 가장 많이 가리킨 근원은 한 개로 수렴합니다 — **랭킹 제출 경로 전체가 검증 부족 상태**입니다.
아키텍처는 "`blockfall-insane`이 `VALID_GAMES`에 누락되어 조용히 실패 중"이라는 **라이브 버그**를 발견했고, 보안은 "HMAC 검증이 문서에만 존재하고 실제론 없으며, Sudoku/Minesweeper는 클라이언트에 정답을 넘기고 서버가 재검증을 안 함"을 Critical로 보고했으며, 테스트 커버리지는 "`RankingService.submit`, `SessionService.validateAndConsume`, per-game validator가 전부 0% 테스트"라고 Critical로 매칭했습니다. 즉 **핵심 비즈니스 로직이 구멍 난 채로 테스트도 없다** — 세 리뷰어의 우선순위가 모두 이 지점을 최상위에 놓고 있습니다.

추가로 `SecurityConfig` 구조(기본 permitAll + URL-prefix-only 어드민 인가), 환경변수 폴백(dev 기본값이 프로덕션에서 활성화될 위험), 그리고 CI가 실제로 테스트를 실행하지 않는다는 점 — 이 세 가지가 나머지 모든 리스크를 증폭시키는 **시스템적 원인**입니다. 개별 코드 수정보다 이 세 가지 기반을 먼저 다잡는 편이 ROI가 큽니다.

---

## 통합 우선순위 — 표

각 항목에 `[A]` 아키텍처, `[S]` 보안, `[T]` 테스트 리뷰어 표기. 여러 개 붙은 항목이 교차 근거입니다.

### P0 — Emergency (라이브 버그 또는 공격 가능)

| # | 항목 | 근거 | 담당 |
|---|------|------|------|
| P0-1 | **`blockfall-insane`이 `VALID_GAMES`/`EXPIRE_SECONDS`/validator 테이블에 없음 → 인세인 모드 점수 등록 전원 404/거부** | `[A]` Critical | developer-backend |
| P0-2 | **Sudoku `session/start` 응답이 `solution` 전체를 클라이언트에 반환** → 봇이 `clearTime ≥ 5` 내 아무 값이나 제출 시 리더보드 탈취 | `[S]` Critical · `[T]` High (validator 0% 테스트) | developer-backend |
| P0-3 | **Minesweeper `session/start` 응답이 지뢰 위치 포함(`adjMines=-1`)** + 서버 재검증 없음 → 미플레이 점수 등록 가능 | `[S]` Critical · `[T]` High | developer-backend |
| P0-4 | **HMAC 랭킹 검증이 문서·env엔 있으나 코드엔 없음** — `RankingRequest`에 signature 필드 없음, 서비스에서 `app.hmac.secret` 비사용. 세션 ID + 범위 체크만으로 제출 허용 | `[S]` Critical · `[T]` Critical · `[A]` High (switch god-class가 누락 유발) | planner → developer-backend |
| P0-5 | **dev 기본 secret 폴백(`JWT_SECRET`/`HMAC_SECRET`/`IP_HASH_SALT`)이 `application.properties`에 하드코딩** — Railway env 누락 시 공개된 dev 키로 부팅되어 ADMIN JWT 위조 가능 | `[S]` Critical | developer-backend |

> **P0는 즉시 처리**. 아무 코드 리팩토링보다 먼저. 각 항목이 1일 이내 분량이며, 수정 후 QA로 블랙박스 재현 시도하여 막혔는지 확인해야 합니다.

### P1 — Critical (다음 릴리스 전까지)

| # | 항목 | 근거 | 담당 |
|---|------|------|------|
| P1-1 | **어드민 인가가 URL 프리픽스 1줄에만 의존** (`.anyRequest().permitAll()` 폴백). `@EnableMethodSecurity` + `@PreAuthorize` 미사용 → 신규 엔드포인트가 기본 allow | `[S]` High · `[T]` Critical (어드민 가드 0% 테스트) | developer-backend |
| P1-2 | **OAuth2 `accessToken` + `refreshToken`을 URL 쿼리로 리다이렉트** (브라우저 히스토리·Referer·프록시 로그 노출) | `[S]` High · `[T]` Critical (OAuth2SuccessHandler 0% 테스트) | developer-backend + frontend |
| P1-3 | **refresh token을 `localStorage`에 저장** + access token 블랙리스트 없음 (로그아웃 후 15분간 AT 유효) | `[S]` High · `[T]` Critical (AuthService.refresh 0% 테스트) | developer-frontend + developer-backend |
| P1-4 | **CI가 테스트를 실행하지 않음** — `backend-ci.yml`은 `gradlew build -x test`, `frontend-ci.yml`은 `vite build`만. ESLint도 CI에 없음 (CLAUDE.md 정책 위반). 어떤 런타임 회귀도 머지 차단 못 함 | `[T]` Critical × 3 (CI + frontend 러너 부재 + backend 테스트 인프라 부재) | planner → full team |
| P1-5 | **프론트엔드 테스트 러너 미설치** (Vitest/Jest 0) + `package.json`에 `test` 스크립트 없음. 6개 게임 reducer 전부 테스트 대상 제로 | `[T]` Critical · `[A]` High (거대 컴포넌트 때문에 테스트 불가능한 상태) | developer-frontend |
| P1-6 | **백엔드 테스트 인프라 부재** — `application-test.properties`·H2·Testcontainers 전부 없음. 단일 `contextLoads()`조차 실행 환경 없음 | `[T]` Critical | developer-backend |

### P2 — High (1~2 스프린트 내)

| # | 항목 | 근거 | 담당 |
|---|------|------|------|
| P2-1 | **`X-Forwarded-For`·`X-Real-IP` 무신뢰 파싱** — 8개 파일에 copy-paste, `IpBanFilter`만 `X-Real-IP` 폴백 포함 → IP 해시/밴/레이트리밋이 서로 다른 IP 사용 가능. 헤더 스푸핑으로 밴·레이트리밋 우회 | `[A]` Medium (중복) · `[S]` Medium (우회) · `[T]` High (IpBanFilter 0% 테스트) | developer-backend |
| P2-2 | **`RankingService`·`AdminRankingService`·`AdminStatsService`가 6-arm `switch(game)` 여러 벌** — 게임 추가 시 6곳 편집 필요. P0-1 누락 사고의 구조적 원인 | `[A]` High | developer-backend |
| P2-3 | **거대 게임 보드 컴포넌트 (700 LoC × 6, 블록폴 인세인 1,675 LoC)** — `useRankingSubmit` 훅, `<NameEntryModal>`, `weekRange`/`colLabel`/`formatTime` 공통화 필요. 시각·동작 변경이 6곳 편집 | `[A]` High · `[T]` High (테스트 가능한 크기로 쪼개야 함) | developer-frontend |
| P2-4 | **BlockfallBoard vs BlockfallInsaneBoard ~80% 엔진 중복** — T-spin·lock-delay 수정 시 두 파일 동기화 수동 | `[A]` High | developer-frontend |
| P2-5 | **프론트엔드 `api/*.ts` 10개에 `request<T>()` 중복** + `games.ts`·`contact.ts`는 raw `fetch` 우회. 401 핸들링·토큰 refresh 인터셉터·타임아웃 공통 없음 | `[A]` High · `[T]` High (에러 경로 0% 테스트) | developer-frontend |
| P2-6 | **컨트롤러가 JPA 엔티티를 응답 바디로 노출** (`IpBan`, `Ranking`, `GameStatus`) | `[A]` High | developer-backend |
| P2-7 | **어드민 랭킹 프론트가 `[key:string]:unknown`로 받는 이유** — P2-6의 결과. DTO 도입 후 연쇄 해소 | `[A]` High | developer-frontend + backend |
| P2-8 | **Per-game server validator 전부 0% 테스트** — `AppleValidationService`, `BlockfallValidationService`, `SolitaireMoveService`, `SudokuService.generateSolution/Puzzle`, `BaseballSessionService.validateWinAndConsume` | `[T]` High | qa-tester + developer-backend |

### P3 — Medium (다음 분기)

| # | 항목 | 근거 | 담당 |
|---|------|------|------|
| P3-1 | `ContactController`가 `UserRepository` 직접 주입 + null/blank 검증 + JSON 수기 인코딩 (레이어링 위반) | `[A]` High | developer-backend |
| P3-2 | `AuthService.validateNickname` vs `UserService.validateNickname` 두 벌 — 후자는 하드코딩 badwords, `ProfanityService` 우회. 가입/프로필 수정 정책 불일치 | `[A]` Medium | developer-backend |
| P3-3 | `HomePage`·`ExcelHomePage`·`ExcelShell`·`GamePage`에 게임 카탈로그 4중 중복. 이미 drift 존재 (blockfall 기본 레벨 `'normal'` vs `'easy'`) | `[A]` Medium | developer-frontend |
| P3-4 | 페이지 응답 봉투 `Map.of("content","hasNext","totalCount")`가 6곳에 수기 생성 — `PageResponse<T>` record 필요 | `[A]` Medium | developer-backend |
| P3-5 | `ExcelShellContext` 결합 — 모든 보드가 `useExcelShell()` 무조건 호출 + `excel?: boolean` 프롭과 두 개의 진실 소스 | `[A]` Medium | developer-frontend + designer |
| P3-6 | `VITE_HMAC_SECRET`이 `frontend-ci.yml`·`.env.local.example`·`README.md`에 잔존 — Vite는 `VITE_*`을 번들에 인라인함. 재사용 시 즉시 공개 키가 됨 | `[S]` Medium | developer-frontend |
| P3-7 | `ContactController`가 클라이언트 지정 파일명을 그대로 DB·이메일 첨부로 전달 (경로탐색·제어문자·exec 확장자 필터 없음) + 파일 크기 상한 없음 | `[S]` Medium | developer-backend |
| P3-8 | 운영자 개인 Gmail (`ksoung140w@gmail.com`)이 `EmailService`·개인정보처리방침·이용약관·어드민 시딩 쿼리에 하드코딩. 침해 시 단일점 장애 | `[S]` Medium | developer-backend + designer |
| P3-9 | CORS `setAllowedOriginPatterns + allowCredentials=true` — 운영자가 `https://*.vercel.app` 추가 시 모든 PR 프리뷰가 인증 포함 cross-site 가능 | `[S]` Medium | developer-backend |
| P3-10 | 프론트 form validator (`validateEmail`, `validatePassword`, `getPasswordStrength`, `containsProfanity`) — 순수함수인데 0% 테스트 | `[T]` High (저비용 first test) | developer-frontend |
| P3-11 | Patch note CRUD 전부 0% 테스트 (어드민 write 가드 포함) | `[T]` Medium | qa-tester |
| P3-12 | R2 프로필 이미지 업로드 (MIME 스푸핑·`ImageIO` 실패·S3 예외) 0% 테스트 + `IllegalStateException` 노출 | `[T]` Medium · `[S]` Low (`GlobalExceptionHandler`가 설정값 문자열 그대로 응답) | developer-backend |
| P3-13 | `ExcelShellContext` `newGameCallbackRef` 누수 위험 — 이전 게임 콜백이 다음 게임에 살 수 있음 | `[T]` Medium · `[A]` Medium | developer-frontend |
| P3-14 | 6개 `*RankingRepository.findWeekly` `@Query`·`TemporalAdjusters` Monday 경계 DST 케이스 0% 테스트 | `[T]` Medium | developer-backend |

### P4 — Low (백로그)

| # | 항목 | 근거 | 담당 |
|---|------|------|------|
| P4-1 | `BlockfallInsaneBoard.tsx` 상단 8줄 "STEP 1…STEP 6 ✓" 체크리스트 (stale 예약) | `[A]` Low | developer-frontend |
| P4-2 | `api/admin.ts`의 `AdminLeaderboardEntry` ≡ `AdminRanking` 중복 선언 | `[A]` Low | developer-frontend |
| P4-3 | `SecurityConfig` 경로 `{game}` whitelist 미적용 (서비스 레벨만) | `[S]` Low | developer-backend |
| P4-4 | `spring.jpa.hibernate.ddl-auto=update` — 프로덕션에서 위험. Flyway/Liquibase 도입 필요 (CLAUDE.md 정책 미이행) | `[S]` Low · `[T]` Low | developer-backend |
| P4-5 | `GlobalExceptionHandler`가 `IllegalStateException.getMessage()`를 응답에 그대로 노출 (e.g. `R2_PUBLIC_URL 환경변수가 설정되지 않았습니다`) | `[S]` Low | developer-backend |
| P4-6 | `SessionCleanupScheduler` 크론 작업 0% 테스트 — 조용히 실패 시 `game_session` 테이블 무제한 증가 | `[T]` Medium | developer-backend |

---

## 긍정 관찰 (역행 방지 차원 유지 대상)
security 리뷰 기준:
- BCrypt + 비밀번호 `@Pattern` 강제
- JPQL 통일 사용 (raw SQL 주입면 없음)
- refresh token rotation + 재사용 시 전체 세션 폐기 (`AuthService:152-163`)
- Password reset = UUID + Redis 30분 TTL + RT 전원 폐기
- Email enumeration 대비 `requestPasswordReset` 고정 응답
- HTML 이메일 `escapeHtml` 적용
- 어드민 self-modify 방지
- 야구게임 `won==true` 서버 관찰 후에만 기록
- 프론트 `dangerouslySetInnerHTML` 0건

→ **이 8가지는 회귀 테스트 대상 1순위** (P3-10, P3-11 작업 시 함께 커버).

---

## 실행 권고 순서 (의존성 기반)

1. **P0 전부** (≤ 2일): P0-1, P0-2, P0-3은 단독 패치 가능. P0-4·P0-5는 같은 PR이 자연스러움 (secret 고정 + HMAC 도입 or 문서 정리).
2. **P1-4, P1-6, P1-5 먼저**: CI에 테스트 러너 + 인프라가 붙지 않으면 나머지 P1/P2의 테스트 추가가 구조적으로 불가능. 즉 **테스트 인프라가 P0보다 순위는 낮지만, P2 이후 작업의 전제**. 순서 제안: P0 hotfix → P1-4/5/6 인프라 세팅 → P1-1/2/3 → P2 → P3.
3. **P2-2 (strategy 패턴) 전에 P2-8 (validator 테스트)**: 리팩토링 전 기존 거동을 pin 해두면 안전하게 god-class 분해 가능.
4. **P2-3 분해는 P1-5(Vitest) 설치 후**: 1,675 LoC 파일은 테스트 없이 쪼개면 회귀 필연.

## planner 착수 아이템 (스펙 필요)
다음 3건은 단순 코드 수정이 아닌 **정책 결정** 필요:
- HMAC 재도입 vs 제거 (P0-4) — 서명 기반이냐 세션 기반이냐 확정 필요
- OAuth 토큰 전달 방식 (P1-2) — cookie vs handoff code, 프론트 저장 정책 재설계
- Admin 등급 정책 (P1-1) — ADMIN 승급 경로, SUPER_ADMIN 개념 여부

## qa-tester 회귀 체크리스트 최초 시드
`docs/review/regression-checklist.md` 초안으로 올릴 항목 (테스트 커버리지 리포트의 shared-module 표 기반):
- `RankingService.submit` — 6게임별 정상 1건 + 범위 초과 + 세션 재사용 + 레이트리밋
- `SessionService.validateAndConsume` — ACTIVE→SUBMITTED / 만료 / 게임명 불일치 / IP 불일치
- `JwtUtil.validateToken` — 만료·변조·잘못된 서명·null
- `IpBanFilter` — XFF 스푸핑·XRIP·remoteAddr 폴백
- `rankingsApi` (프론트) — 401/403/409/422/429/5xx 응답 변환
- `AuthContext.refresh` — 만료 RT는 wipe, 네트워크 오류는 wipe 금지
- `ExcelShellContext` — 게임 간 전환 시 `registerNewGame` 덮어쓰기, `setFormula` 중복 제거
