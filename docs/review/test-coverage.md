# Test Coverage Review — main branch

**Reviewer**: test-coverage (temp role)
**Date**: 2026-04-21
**Scope**: frontend/ + backend/ + CI

## Summary
- **The project has effectively zero automated test coverage.** Backend has a single `@SpringBootTest` `contextLoads()` smoke test (`backend/src/test/java/com/dobakggun/DobakGgunGamesApplicationTests.java`); frontend has **no** test runner configured and **no** test files anywhere under `frontend/`.
- **CI does not run any tests.** `.github/workflows/backend-ci.yml` explicitly runs `./gradlew build -x test` (comment: "skip tests — no DB in CI"). `.github/workflows/frontend-ci.yml` only runs `npm run build` (type-check + vite build). Nothing blocks merge on test failure, and CLAUDE.md's "backend는 `./gradlew test` 통과" rule is not enforceable in CI today (one test exists and would require a running DB).
- **Critical server-side business logic is 100% untested** — ranking submission, HMAC/IP-hash rate limiting, JWT issue/validate/refresh, OAuth2 callback, IP ban filter, admin role-gating, session validate-and-consume, and per-game server validators (`AppleValidationService`, `BlockfallValidationService`, `SolitaireMoveService`, `SudokuService.generateSolution/generatePuzzle`).
- **Shared cross-cutting modules that break N games at once are untested**: `SessionService.validateAndConsume`, `RankingService.validateScoreBounds`/`validateLevel`, `ExcelShellContext`, `useAuth`, and the frontend `rankingsApi` wrapper. A single regression in any of these silently breaks all 6 mini-games.
- **Client-side game logic has no unit tests** — score calculation, timer, game-over detection, board generation for all 6 games (sudoku, apple, baseball, blockfall, minesweeper, solitaire) runs only via manual QA.

## Inventory

### Frontend
- **Test runner: none configured.** `frontend/package.json` has no `test` script, no Vitest / Jest / Playwright / Cypress dependency. Only build/lint/dev/preview scripts.
- **Test files: 0.** Glob for `frontend/**/*.{test,spec}.{ts,tsx,js,jsx}` returns nothing.
- **E2E: none.** No Playwright/Cypress config, no `e2e/` directory.
- Source surface for context: 62 `.ts`/`.tsx` files across `frontend/src/` (6 game folders under `src/games/`, 12 API wrappers under `src/api/`, 10 admin pages under `src/pages/admin/`, 16 normal pages).

### Backend
- **Test framework**: Spring Boot Starter Test (JUnit 5 + Mockito + AssertJ + Spring Test) — declared in `backend/build.gradle` as `testImplementation 'org.springframework.boot:spring-boot-starter-test'`. `useJUnitPlatform()` is set.
- **No Testcontainers**, no H2/in-memory DB dependency, no `application-test.properties` — so `@SpringBootTest` requires the real MySQL + Redis at test time.
- **Test classes: 1.**
  - Controller tests: 0
  - Service tests: 0
  - Repository tests (`@DataJpaTest`): 0
  - Security/filter tests: 0
  - Integration tests: 0 (the only `@SpringBootTest` is a vacuous `contextLoads()`)
- Source surface for context: 111 `.java` files across controller/service/entity/repository/security/config/handler/util — ratio is ~1 test per 111 production classes.

### CI
- **Runs tests on PR: NO.**
  - `.github/workflows/backend-ci.yml` line 28: `./gradlew build -x test` — tests explicitly skipped.
  - `.github/workflows/frontend-ci.yml` line 30: `npm run build` only (= `tsc -b && vite build`). ESLint is not even run in CI, despite CLAUDE.md mandating `eslint .` passes pre-PR.
- **Blocks merge on failure: only type/compile errors do.** Runtime regressions, security flaws, broken HMAC/JWT, or broken ranking submission cannot be detected by CI.
- **No coverage reporting** (no JaCoCo, no coverage upload, no Codecov badge).

## Findings (gaps, ordered by risk)

### Critical — Ranking submission flow (`RankingService.submit`)
- **Coverage today**: none. This is arguably the most security-sensitive code path in the repo.
- **Gap**: `backend/src/main/java/com/dobakggun/service/RankingService.java` has untested: rate-limit (3/min by `ipHash`), session `validateAndConsume` dispatch (normal vs baseball branch), per-game validator dispatch (solitaire/apple/blockfall), `validateScoreBounds` (e.g. minesweeper `time >= 0.4 && <= 3600`, apple `score <= 1200`), special sudoku clear-time clamp (`time >= 5 && <= sessionSeconds + 10`), and `saveRanking` switch for 6 games.
- **Risk**: A broken score bound or wrong validator dispatch silently accepts cheated scores, or rejects legitimate scores (both already happened — see recent commit `820bf30 fix: 스도쿠 클리어 시간 오차 및 랭킹 탭 불일치`). A subtle switch fall-through writes to the wrong game's ranking table.
- **Suggested minimum test**: service-level unit test per game: given a valid session + valid score, `submit` persists one row and returns `RankingResponse`; given score above bound, throws 400; given already-consumed session, throws 400; given 4th submission in 60s from same ipHash, throws 429.

### Critical — Session validate/consume (`SessionService.validateAndConsume`)
- **Coverage today**: none.
- **Gap**: State machine is untested — ACTIVE→SUBMITTED on success, EXPIRED transition when `Instant.now() > startedAt + 7200s`, game-name mismatch rejection, IP-mismatch flag (set to true without rejecting), and the "already SUBMITTED" rejection that prevents double submission.
- **Risk**: Breaking the single-consume semantic lets a user POST the same `sessionId` to multiple games, or replay the same win indefinitely. This is the primary anti-cheat boundary for 5 of 6 games.
- **Suggested minimum test**: unit test `validateAndConsume` with a mocked `GameSessionRepository`: (a) fresh session returns and flips to SUBMITTED, (b) second call throws, (c) expired session flips to EXPIRED + throws, (d) game mismatch throws.

### Critical — Auth flow (`AuthService` + `JwtUtil` + `JwtAuthenticationFilter`)
- **Coverage today**: none.
- **Gap**:
  - `JwtUtil.validateToken` — never tested against expired / tampered / wrong-signature / null tokens.
  - `AuthService.refresh` — RT rotation + "stolen RT → invalidate all sessions" logic is untested (`redisTokenService.deleteRefreshToken(userId)` on mismatch).
  - `AuthService.login` — PENDING/BANNED status rejection and timing-safe password mismatch response.
  - `AuthService.signup` — OTP expiry, OTP mismatch, reserved-word nickname (`admin/관리자/운영자`), profanity rejection.
  - `JwtAuthenticationFilter` — `ROLE_` prefix handling, missing `Authorization` header behavior.
  - `OAuth2SuccessHandler` and `CustomOAuth2UserService` — the Google OAuth callback is entirely untested.
- **Risk**: Silent regression of JWT signing (e.g. changing `Keys.hmacShaKeyFor` input) would accept forged tokens. Broken RT rotation allows replay. Broken role extraction demotes ADMIN to USER and locks out admin.
- **Suggested minimum test**: `JwtUtilTest` — generate/validate round-trip, expired token returns false, tampered signature returns false; `AuthServiceTest` — login with PENDING status throws, refresh with unknown RT calls `deleteRefreshToken` and throws.

### Critical — Admin authorization gating
- **Coverage today**: none.
- **Gap**: `SecurityConfig` line 64 (`/api/admin/**` requires `hasRole("ADMIN")`) is never tested with MockMvc. There's no test asserting that a USER-role JWT gets 403 on admin endpoints, or that an unauthenticated call gets 401. 7 admin controllers exist (`AdminUser/Contact/Game/IpBan/PatchNote/Ranking/Stats`), all unguarded by tests.
- **Risk**: A misconfigured `.requestMatchers(...)` or accidentally re-ordered filter chain opens admin endpoints to all users without anyone noticing. Given the IP-ban and user-delete endpoints, this is CVE-grade if it regresses.
- **Suggested minimum test**: `@WebMvcTest(AdminUserController.class)` with `@MockBean` for the filter chain — assert `/api/admin/users` returns 403 for USER role, 200 for ADMIN role.

### High — Per-game server validators
- **Coverage today**: none.
- **Gap**:
  - `AppleValidationService.validate` — 5 distinct rules (total cells == score, timestamp 0..125000, min 2 cells per event, rapid-fire threshold 5 events under 200ms, board-sum-equals-10 when server board present). `validateWithBoard` coordinate bounds check.
  - `BlockfallValidationService.validate` — minLinesForLevel, `maxScore = lines * 800 * level * 3 + 400` bound.
  - `SolitaireMoveService.processBatch` / `validateMoves` — moves accumulator + `MOVES_TOLERANCE=30` tolerance.
  - `BaseballSessionService.validateWinAndConsume` + `generateAnswer` (digits per level, no duplicates).
  - `SudokuService.generateSolution` + `generatePuzzle` (uniqueness via `countSolutions(..., 2) == 1`) — never tested that the generator actually produces a unique-solution puzzle.
- **Risk**: Cheat detection regresses silently. A tweak to the rapid-fire threshold or score multiplier breaks legitimate users or admits cheaters. Sudoku generator could regress and hand the user a puzzle with ambiguous solutions.
- **Suggested minimum test**: per-service unit test with canned `GameSession.extra` JSON and known-good/known-bad events asserting pass/throw.

### High — Frontend game core logic (6 games × hooks)
- **Coverage today**: none. All game state lives in custom hooks/reducers:
  - `frontend/src/games/sudoku/useSudokuGame.ts` — `checkComplete` is a pure function, trivially testable.
  - `frontend/src/games/minesweeper/useMinesweeperGame.ts` — `PRESETS`, mine placement, reveal flood-fill.
  - `frontend/src/games/apple/useAppleGame.ts` — score calc, sum-to-10 check, 120s timer.
  - `frontend/src/games/baseball/useBaseballGame.ts` — strike/ball count logic.
  - `frontend/src/games/solitaire/useSolitaireGame.ts` — card move legality.
  - `frontend/src/games/blockfall/BlockfallBoard.tsx` / `BlockfallInsaneBoard.tsx` — tetromino collision, line clear, soft/hard drop scoring.
- **Gap**: zero tests. No test runner even installed.
- **Risk**: Regression in any pure reducer — e.g. off-by-one in mine count, wrong baseball strike detection — ships to prod. Recent git log shows a timer-off-by-one bug already shipped (`820bf30 fix: 스도쿠 클리어 시간 오차`). Pure functions are the cheapest to test and currently have the worst ROI.
- **Suggested minimum test**: install Vitest, add `useSudokuGame.test.ts` that drives the reducer through an INPUT sequence that completes the board and asserts `status === 'won'`.

### High — Frontend API error paths
- **Coverage today**: none.
- **Gap**: `frontend/src/api/rankings.ts:42-46` (and mirrored in `auth.ts`, `admin.ts`) throws `new Error(body.error ?? `HTTP ${res.status}`)` — there's no test for 401 refresh trigger, 403 admin lockout, 409 duplicate, 422 validation, 429 rate-limit, 5xx retry. `AuthContext.tsx:32-43` silently swallows any refresh error and wipes `localStorage`; this means a transient 500 logs users out with no test asserting "only do this on 401/invalid RT".
- **Risk**: A backend error-envelope change (renaming `error` to `message`) silently replaces all user-facing errors with generic `HTTP 400`. Users get logged out on transient backend hiccups.
- **Suggested minimum test**: mock `fetch` with 401/409/429 responses, assert the API wrapper throws with the correct message and that `AuthContext.refresh` failure only clears storage for specific error codes.

### High — IP ban filter (`IpBanFilter` + `IpBanService`)
- **Coverage today**: none.
- **Gap**: The `X-Forwarded-For` / `X-Real-IP` / `getRemoteAddr()` precedence in `IpBanFilter.getClientIp` is untested — this is the same code duplicated in `SessionService`, `RankingService`, `SudokuService` (copy-paste drift risk). `IpBanService.syncToRedis` `@PostConstruct` loads Redis from DB and is critical but untested.
- **Risk**: A proxy misconfig or header spoofing that the filter mishandles either lets banned IPs in or blocks legitimate users. Redis desync silently admits banned IPs.
- **Suggested minimum test**: MockMvc with `X-Forwarded-For: <banned-ip>` → expect 403; assert same with `X-Real-IP`; assert plain `remoteAddr` fallback.

### High — Frontend form validation (signup / login / patch notes / contact)
- **Coverage today**: `frontend/src/utils/validate.ts` (pure functions `validateEmail`, `validatePassword`, `getPasswordStrength`) — highly testable, untested. `frontend/src/utils/profanity.ts` likewise.
- **Gap**: Signup flow in `SignupPage.tsx` has a multi-step state machine (email-check → OTP send → OTP verify → nickname check → submit) with 60-second cooldown. All untested.
- **Risk**: A regex change in `PASSWORD_REGEX` either lets weak passwords through or rejects strong ones. Cooldown timer regression can spam OTP emails (Resend quota cost).
- **Suggested minimum test**: table-driven `validatePassword.test.ts` over 8 cases (empty, too short, missing letter/digit/special, valid); `containsProfanity` normalisation test.

### Medium — Patch notes (CRUD + admin-only write)
- **Coverage today**: none.
- **Gap**: `PatchNoteController` (public GET), `AdminPatchNoteController` (POST/PATCH/DELETE), `PatchNoteService` entirely untested. Form validation rules (title length, content required) are not asserted.
- **Risk**: An accidental `permitAll()` change on patch-note write lets anyone deface the release notes. Pagination/ordering regression silently breaks the `PatchNotesPage.tsx`.
- **Suggested minimum test**: `@WebMvcTest` — POST `/api/admin/patch-notes` returns 403 as USER, 200 as ADMIN.

### Medium — R2 file upload (profile image)
- **Coverage today**: none.
- **Gap**: `UserService.updateProfileImage` (around lines 60–90, referenced at `backend/src/main/java/com/dobakggun/service/UserService.java:66-82`) does 256×256 BufferedImage resize + `s3Client.putObject` + old-image delete. None of the failure paths (non-image file, ImageIO read failure, S3 IOException) are tested. `R2_PUBLIC_URL` missing throws `IllegalStateException` at runtime.
- **Risk**: A broken upload silently stores an oversized image or a corrupt byte stream and breaks profile display. MIME spoofing is not asserted against.
- **Suggested minimum test**: unit test with a mocked `S3Client` and a real 10×10 PNG bytes — assert `putObject` called once with `image/png` content-type.

### Medium — Excel-mode dual-theme switching
- **Coverage today**: none.
- **Gap**: `frontend/src/components/excel/ExcelShellContext.tsx` is the single source of truth for Excel mode — formula bar, status bar, ribbon game group, sheet tabs (`game | ranking | rules`), `registerNewGame`/`triggerNewGame` callback registry. CLAUDE.md says Excel mode is a 1st-class requirement, but nothing tests that context resets between games or that `setFormula` correctly dedupes repeated calls.
- **Risk**: A ref leak in `newGameCallbackRef` causes the previous game's "new game" handler to fire in the next game. State staleness on route transitions.
- **Suggested minimum test**: `ExcelShellContext.test.tsx` — render two consecutive games, assert `registerNewGame` overrides the previous callback and `triggerNewGame` fires the latest.

### Medium — Repository queries (weekly / alltime ranking)
- **Coverage today**: none.
- **Gap**: 6 per-game `*RankingRepository.findWeekly(level, weekStart)` + `findAlltimeBest(level)` + `countByIpHashAndCreatedAtAfter` queries are untested. `RankingService.getWeeklyRankings` computes `weekStart` with `TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY)` — DST / timezone-boundary edge cases not asserted.
- **Risk**: A custom `@Query` typo in any of the 6 repos goes undetected until prod. Week boundary off-by-one makes Monday 00:00 entries invisible.
- **Suggested minimum test**: `@DataJpaTest` with Testcontainers MySQL (or switch to H2 for repo tests) asserting `findWeekly` returns only rows with `createdAt >= weekStart`.

### Medium — Session cleanup scheduler
- **Coverage today**: none.
- **Gap**: `SessionCleanupScheduler` presumably deletes expired sessions on a cron; never tested. If it fails silently, `game_session` table grows unboundedly.
- **Risk**: DB bloat on Railway's free tier.
- **Suggested minimum test**: unit test the scheduler method directly against a mocked repo; assert it calls `deleteByStateOrExpiresAtBefore(...)`.

### Low — Database schema / migration consistency
- **Coverage today**: none. There is **no migration tool** (no Flyway, no Liquibase) — `spring.jpa.hibernate.ddl-auto=update` in `application.properties` line 10 is the only schema manager.
- **Gap**: Schema drift between dev and prod is only caught at boot time. No `CREATE TABLE` scripts checked in. CLAUDE.md rule "DB 스키마 변경: migration 파일(SQL) 또는 Liquibase 변경분으로만" is not actually followed by the codebase.
- **Risk**: Low-latency deploy with an incompatible entity change (e.g. dropped column) risks data loss on `ddl-auto=update`.
- **Suggested minimum test**: N/A via unit test; flag to planner/backend-dev that migration tooling should be introduced before any schema change on a populated table.

## Regression-prone shared modules

The CLAUDE.md policy explicitly calls out shared modules as the biggest regression risk for this mini-game collection. Current test status:

| Module | Location | Affects N games | Tested? |
|---|---|---|---|
| `RankingService.submit` + `validateScoreBounds` | `backend/src/main/java/com/dobakggun/service/RankingService.java` | All 6 games | No |
| `SessionService.validateAndConsume` | `backend/src/main/java/com/dobakggun/service/SessionService.java` | 5 games (baseball uses its own) | No |
| `JwtUtil` + `JwtAuthenticationFilter` | `backend/src/main/java/com/dobakggun/util/JwtUtil.java`, `security/JwtAuthenticationFilter.java` | All authenticated endpoints site-wide | No |
| `IpBanFilter` + `IpBanService` | `backend/src/main/java/com/dobakggun/security/IpBanFilter.java`, `service/IpBanService.java` | Every request | No |
| `SecurityConfig` filter chain | `backend/src/main/java/com/dobakggun/config/SecurityConfig.java` | Every request | No |
| `rankingsApi` + `startSession` | `frontend/src/api/rankings.ts` | All 6 games submit rankings through this | No |
| `AuthContext` (RT rotation, storage) | `frontend/src/context/AuthContext.tsx` | Whole frontend auth state | No |
| `ExcelShellContext` | `frontend/src/components/excel/ExcelShellContext.tsx` | All 6 games in Excel mode | No |
| `useAdminTest` | `frontend/src/context/AdminTestContext.tsx` | All game flows (bypass logic) | No |
| `validateEmail` / `validatePassword` / `containsProfanity` | `frontend/src/utils/validate.ts`, `frontend/src/utils/profanity.ts` | Signup, nickname, contact, patch-note | No |
| `IpHashUtil` | `backend/src/main/java/com/dobakggun/util/IpHashUtil.java` | All ranking + session writes | No |
| `ProfanityService` (backend) | `backend/src/main/java/com/dobakggun/service/ProfanityService.java` | Signup nickname + contact | No |

Every shared module in the table is a single-point-of-failure for multiple games or the whole app, and none of them has a single automated test.

## Out of scope / deferred
- Performance / load testing (no k6, no Gatling).
- Accessibility tests (no axe / pa11y).
- Visual regression (no Chromatic / Percy) — given the dual-theme Excel mode, this is a plausible future addition.
- Mutation testing / fuzz testing.
- Contract tests between frontend and backend (OpenAPI / Pact) — no OpenAPI spec generated.
- Email delivery integration (Resend) end-to-end verification.
- OAuth2 Google callback integration (requires live credentials).
- Cloudflare R2 upload integration (requires live credentials).

## Top 3 recommended first moves (outside this reviewer's remit, for planner)
1. **Enable the existing backend test in CI** by either (a) adding an `application-test.properties` with H2 + embedded Redis, or (b) introducing Testcontainers so `./gradlew test` passes without a dev DB. Then remove `-x test` from `backend-ci.yml`.
2. **Install Vitest in frontend** (`vitest`, `@testing-library/react`, `jsdom`) and add an `npm test` step to `frontend-ci.yml`. Also add the missing `npm run lint` step — CLAUDE.md mandates it but CI never runs it.
3. **Target the 3 Critical findings first** (ranking submit, session consume, auth flow) — these are the actual moneyline regressions that break player data integrity and account security.
