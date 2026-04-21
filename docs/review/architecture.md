# Architecture Review — main branch

**Reviewer**: architecture-smells (temp role)
**Date**: 2026-04-21
**Scope**: frontend/ + backend/

## Summary
- Game board React components are extremely oversized (6 of 8 exceed 700 LoC; `BlockfallInsaneBoard.tsx` is 1,675 LoC), each reimplementing the same "score-timer-modal → ranking submit → reload rankings" flow and excel-grid helpers.
- Frontend `src/api/*` is fragmented into 12 modules, 10 of which paste the same `BASE + request<T>()` helper; no shared HTTP client exists, and `user.ts`/`contact.ts`/`admin.ts` bypass it with direct `fetch` calls.
- Backend `RankingService` and `AdminRankingService` concentrate all six games' persistence, level rules, and score bounds behind giant `switch(game)` blocks while still omitting `blockfall-insane` from `VALID_GAMES` — a latent submit-rejection bug for the insane board route.
- Several backend controllers leak JPA entities (`Ranking`, `IpBan`, `GameStatus`) directly as response bodies and `ContactController` performs validation + repo access that belong in the service.
- `getClientIp()` is copy-pasted into 8 backend classes with subtly diverging behavior (filter has `X-Real-IP` fallback, services do not).

## Findings

### Critical — `blockfall-insane` not in `RankingService.VALID_GAMES` but submitted from frontend
- **Where**: `backend/src/main/java/com/dobakggun/service/RankingService.java:26` vs `frontend/src/games/blockfall/BlockfallInsaneBoard.tsx:1438`
- **Smell**: Frontend calls `rankingsApi.submit('blockfall-insane', …)` and `startSession('blockfall-insane', …)`; `SessionService.EXPIRE_SECONDS` and `RankingService.VALID_GAMES` only list `blockfall`. Session creation in `SessionService.java:27-34` will throw 404 and `validateGame()` in `RankingService.java:190-194` will also reject. The insane route therefore cannot persist scores end-to-end.
- **Impact**: Silent production bug — rankings for the insane mode simply fail; the `BlockfallInsaneBoard` UI shows an error state instead of recording a score, and the route looks wired up but isn't.
- **Suggested fix**: Add `blockfall-insane` to `EXPIRE_SECONDS`, `VALID_GAMES`, `validateLevel()`, `validateScoreBounds()`, `queryWeekly()`, `queryAlltimeBest()`, `countByIpHash()`, `saveRanking()` — or delete the submit call until the feature is ready.

### High — Massive game board components duplicate shared "boilerplate"
- **Where**: `frontend/src/games/blockfall/BlockfallInsaneBoard.tsx:1-1675`, `frontend/src/games/blockfall/BlockfallBoard.tsx:1-1388`, `frontend/src/games/solitaire/CardBoard.tsx:1-1074`, `frontend/src/games/apple/AppleCanvas.tsx:1-1025`, `frontend/src/games/minesweeper/MinesweeperBoard.tsx:1-837`, `frontend/src/games/sudoku/SudokuBoard.tsx:1-805`, `frontend/src/games/baseball/BaseballBoard.tsx:1-704`
- **Smell**: Each file owns: game engine + rendering + name-entry modal + profanity check + session start + ranking fetch + alltime/weekly list + excel grid helpers + `weekRange`/`colLabel`/`formatTime`. Six copies of `weekRange()` (apple:40, baseball:24, minesweeper:24, sudoku:40, solitaire:59, blockfall:21), seven copies of `colLabel()`, three of `formatTime()`, seven of the modal-submit-then-reload pattern (grepped in `rankingsApi.submit`).
- **Impact**: Every visual/behavioral change needs six edits. Bugs already diverge (e.g. minesweeper rounds `time` with `parseFloat(toFixed(2))`, sudoku uses `Math.round`). The files are too large to safely refactor with AI or code review.
- **Suggested fix**: Extract `useRankingSubmit(game, levelsConfig)` hook, `<NameEntryModal>` component, and `src/utils/excel.ts` (`colLabel`, `weekRange`, `formatTime`). Split Blockfall's 1,388 LoC engine into `hooks/useBlockfallEngine.ts` + presentational `BlockfallBoard.tsx`.

### High — `BlockfallBoard` and `BlockfallInsaneBoard` share ~80% of the Tetris engine
- **Where**: `frontend/src/games/blockfall/BlockfallBoard.tsx:95-147` and `frontend/src/games/blockfall/BlockfallInsaneBoard.tsx:128-190`
- **Smell**: `createMatrix`, `rotateMatrix`, piece definitions (T/O/L/J/I/S/Z), DROP_SPEEDS tables, LINE_SCORES, TSPIN_SCORES, LOCK_DELAY/MAX_LOCK_RESETS, identical useRef list (`arena`, `player`, `nextPiece`, `holdPiece`, `holdUsed`, `scoreRef`, `gameLevelRef`, …) are duplicated verbatim. Insane mode adds extended pieces + particles + events on top but forks the file instead of extending.
- **Impact**: Any rule fix (e.g. T-spin detection, lock-delay) has to be ported manually between two 1000+ LoC files. Raises risk that QA only validates one mode.
- **Suggested fix**: Move pure engine logic into `games/blockfall/engine/` (piece.ts, collision.ts, scoring.ts); keep two thin presentation components consuming the shared engine with a `mode: 'standard' | 'insane'` knob.

### High — Frontend API layer has 10 duplicated `request<T>()` helpers
- **Where**: `frontend/src/api/apple.ts:3`, `baseball.ts:3`, `minesweeper.ts:3`, `solitaire.ts:3`, `sudoku.ts:3`, `rankings.ts:33`, `admin.ts:4`, `auth.ts:17`, `user.ts:13`, `patchnotes.ts:23`; plus `games.ts:10` and `contact.ts:36,47,56` that bypass the helper with raw `fetch`.
- **Smell**: Each file redefines `const BASE = import.meta.env.DEV ? '' : …` and `async function request<T>()`. There is no shared 401-handling, no token refresh interceptor, no timeout; each file applies auth headers slightly differently (`admin.ts` requires `token` param, `user.ts` does too, but `rankings.ts` does not — so no auth on ranking submit by design, but inconsistent if ever needed).
- **Impact**: Adding a cross-cutting concern (retry, refresh on 401, request logging, base-URL change) means editing 10 files. Bugs like forgotten `Content-Type` already happen (`rankings.ts:37-39` conditionalizes it on `isPost`; others always set it).
- **Suggested fix**: Add `src/api/client.ts` exposing a single `request(path, { method, body, auth })` and refactor each feature module to export typed wrappers using it. Drop the per-file `const BASE`.

### High — Backend `RankingService` is a god-class with switch-on-game everywhere
- **Where**: `backend/src/main/java/com/dobakggun/service/RankingService.java:29-40` (six repos injected), `:95-129` (`queryWeekly` / `queryAlltimeBest` / `countByIpHash` — three separate 6-arm switches), `:131-165` (`saveRanking` 6-arm builder switch), `:176-209` (`validateScoreBounds` + `validateLevel` 6-arm each).
- **Smell**: Adding a game requires editing six switches here plus `AdminRankingService.java:34-69, 92-127`, plus `AdminStatsService.java:101-128`. Sudoku already has an inline time-range branch with side-effectful logic at `:148-162`, inflating cyclomatic complexity inside `saveRanking`.
- **Impact**: Change fatigue + missed cases (see Critical finding above — `blockfall-insane` was missed). Makes per-game policy drift invisible.
- **Suggested fix**: Introduce a `GameRankingStrategy` SPI (`name()`, `validateLevel`, `validateScore`, `save`, `findWeekly`, …) with six `@Component` implementations keyed by game name; services become thin dispatchers `strategies.get(game).save(...)`.

### High — Controllers leak JPA entities as response bodies
- **Where**:
  - `backend/src/main/java/com/dobakggun/controller/AdminIpBanController.java:21-31` returns `ResponseEntity<List<IpBan>>` and `ResponseEntity<IpBan>`.
  - `backend/src/main/java/com/dobakggun/controller/AdminRankingController.java:33-44` returns `Page<? extends Ranking>` content without DTO mapping.
  - `backend/src/main/java/com/dobakggun/controller/GameStatusController.java:19-21` and `AdminGameController.java:20-33` return `List<GameStatus>` / `GameStatus` directly.
- **Smell**: No DTO separation. Hibernate lazy fields, internal columns (`ipHash`, `bannedBy`, `userId`), and schema changes escape into the wire format.
- **Impact**: Any entity rename or added field leaks to clients; lazy loading serialization errors can surface at the controller layer; `AdminRanking` payload already uses untyped `[key: string]: unknown` on the frontend (`api/admin.ts:105`) because shapes are fuzzy.
- **Suggested fix**: Add `IpBanResponse`, `GameStatusResponse`, and a small `AdminRankingResponse.from(Ranking)` mapper; map in controller or service before returning.

### High — `ContactController` contains validation + repo access that belongs in service
- **Where**: `backend/src/main/java/com/dobakggun/controller/ContactController.java:30-73`
- **Smell**: Controller injects `UserRepository` directly (`:30`), parses JSON manually, performs null/blank validation (`:46-54`) and builds a JSON-encoded `fileKeys` string before handing to service. That validation is not covered by bean-validation annotations and duplicates service responsibilities.
- **Impact**: Layering violation — controller reaches past service into persistence. Validation drifts between controller and the DTO (`ContactRequest` has no `@NotBlank`). Harder to unit test.
- **Suggested fix**: Use `@Valid ContactRequest` with `@NotBlank` on fields, remove `UserRepository` from the controller, and pass `userId + MultipartFile[]` to `ContactService` which loads the user and encodes fileKeys.

### Medium — `getClientIp()` copy-pasted in 8 places with subtle divergence
- **Where**: `SessionService.java:116-122`, `RankingService.java:211-217`, `BaseballSessionService.java:211-215`, `AppleSessionService.java:102-106`, `MinesweeperSessionService.java:145-149`, `SolitaireSessionService.java:85-89`, `SudokuService.java:172-…`, plus `security/IpBanFilter.java:39-49`.
- **Smell**: All eight read `X-Forwarded-For`, but only `IpBanFilter` also honors `X-Real-IP`. So IP-ban resolution and IP-hash derivation can disagree.
- **Impact**: A user behind a proxy chain where only `X-Real-IP` is set would be banned but their ranking rows would hash a different IP (the remote addr) — inconsistent rate-limit and ban enforcement.
- **Suggested fix**: Add `util/ClientIpResolver` (or method on `IpHashUtil`); replace all eight copies.

### Medium — Two separate nickname validators with different rules
- **Where**: `backend/src/main/java/com/dobakggun/service/AuthService.java:216-227` vs `backend/src/main/java/com/dobakggun/service/UserService.java:136-142`
- **Smell**: `AuthService.validateNickname` uses reserved-word list + `ProfanityService`. `UserService.validateNickname` uses a hardcoded profanity array that bypasses `ProfanityService` entirely and is out of sync with `shared/badwords.json`.
- **Impact**: Signup profanity policy ≠ nickname-edit profanity policy. Editing the shared badwords list has no effect on profile updates.
- **Suggested fix**: Delete the UserService variant and inject `ProfanityService` instead (or promote the checker to a shared helper class).

### Medium — Home & ExcelHome duplicate game-config catalogs
- **Where**: `frontend/src/pages/HomePage.tsx:22-100` (`GAMES: GameConfig[]`) vs `frontend/src/pages/ExcelHomePage.tsx:13-63` (`GAME_LIST` + `RANK_COLS`); plus `frontend/src/components/excel/ExcelShell.tsx:7-14` (`GAMES`); plus `GamePage.tsx:17-74` (five parallel `Record<string,…>` maps for name/file/size/bg/accent).
- **Smell**: Level definitions, labels, score formatters are duplicated across four files. Adding a new difficulty or game means editing all four lists plus `api/rankings.ts`/backend.
- **Impact**: Inconsistencies (e.g., HomePage lists blockfall default level `'normal'`, ExcelHomePage uses `'easy'` — `tt: 'easy'` at `ExcelHomePage.tsx:77`). These subtle drifts are already visible.
- **Suggested fix**: Centralize `src/games/registry.ts` exporting `{ key, name, icon, levels, fmt, cellSize, bg, accent, fileTitle }[]`; both pages and `GamePage` read from it.

### Medium — `ContactController` & `AdminUserController` build `Map.of("content"/"hasNext"/"totalCount")` envelopes by hand
- **Where**: `AdminUserController.java:33-37`, `AdminContactController.java:38-42`, `ContactController.java:88-92`, `AdminRankingController.java:35-39`, `PatchNoteController.java:30-34`, `AdminPatchNoteController.java:32-36`
- **Smell**: Six copies of `Map.of("content", result.getContent(), "hasNext", !result.isLast(), "totalCount", result.getTotalElements())`. No shared `PageResponse<T>` record.
- **Impact**: Any change in envelope shape (cursor pagination, adding `totalPages`) is six-place edit. Frontend side also reinvents the paging shape per resource (`AdminUserPage`, `AdminContactPage`, inline `{content,hasNext,totalCount}` in `adminRankingApi.list`).
- **Suggested fix**: Introduce `dto.common.PageResponse<T>` with static `of(Page<T>)`; use it on both ends.

### Medium — Shared `Excel Shell` coupling: every board imports `useExcelShell` even for standalone grid helpers
- **Where**: `frontend/src/games/*/[Board|Canvas].tsx` all call `import { useExcelShell } from '../../components/excel/ExcelShellContext'` and reach into `setFormula`, `setStatusItems`, `setRibbonGameGroup`, `setSheetSize`, `registerNewGame`, `activeSheet` (e.g. `BlockfallBoard.tsx:224`, `CardBoard.tsx`, `SudokuBoard.tsx:6`).
- **Smell**: Game components conditionally short-circuit with `if (!excel) return;` (e.g. `BlockfallBoard.tsx:226`). The context is provided only inside `ExcelShell`; in normal mode the hook returns default no-ops, meaning the `excel?: boolean` prop and the context both signal the same thing. Two sources of truth.
- **Impact**: Easy to introduce bugs where excel-only state is mutated in normal mode (or vice versa). Makes it hard to render a board outside the shell (e.g., in Storybook) because the hook must still be mocked.
- **Suggested fix**: Either (a) gate the context hook behind `excel && <ExcelAdapter game={…} />`, or (b) remove the `excel` prop and rely on context presence alone.

### Low — `BlockfallInsaneBoard` file header documents "STEP 1…STEP 6 ✓" as source-of-truth
- **Where**: `frontend/src/games/blockfall/BlockfallInsaneBoard.tsx:1-9`
- **Smell**: Project plan checklist lives in code as a doc comment and will go stale. The actual plan already lives at `docs/블록폴 인세인모드(Insane mode) 작업계획.md`.
- **Impact**: Dead documentation noise at the top of the largest file in the repo.
- **Suggested fix**: Remove header or replace with a one-line link to the doc.

### Low — Dead/commented exports and unused imports
- **Where**:
  - `frontend/src/api/rankings.ts:15-18` — `AppleEventPayload` is exported but only re-imported inside the same module's `SubmitPayload.events`; no other file imports it (ok) yet it's part of a generic `SubmitPayload` used by all games.
  - `frontend/src/api/admin.ts:108-118` — `AdminLeaderboardEntry` is structurally identical to `AdminRanking` (:94-106) yet defined twice.
  - `frontend/src/games/baseball/BaseballBoard.tsx:12-21` — `colLabel` is defined but only `weekRange` is used in the normal path; in excel path `colLabel` is used once. Same shape is hoisted into `ExcelShell`.
- **Impact**: Low; adds maintenance noise.
- **Suggested fix**: Consolidate `AdminLeaderboardEntry` into `AdminRanking`; delete the duplicated `colLabel` copies after extracting the shared helper (see High finding #2).

## Out of scope / deferred
- Deep look at game correctness/fairness logic (solitaire move validation, apple coordinate transpose) — that's `qa-tester` territory.
- CSS module duplication and visual regressions (`designer` owns `excel.css`).
- Database schema & migration hygiene.
- Performance: `BlockfallInsaneBoard` sand-physics tick cost, Excel grid recomputation on resize.
- Security posture of the JWT/refresh flow beyond the shape review already done above.
- The GitHub Actions CI pipeline and Railway/Vercel deploy flow.
