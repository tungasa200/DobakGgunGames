# Security Review — main branch

**Reviewer**: security-concerns (temp role)
**Date**: 2026-04-21
**Scope**: frontend/ + backend/ (auth, JWT, HMAC, env vars, injection, headers)

## Summary

1. **HMAC ranking verification is entirely absent.** CLAUDE-level policy says ranking submissions use HMAC; in code, neither `RankingController` nor `RankingService` nor any service reads `app.hmac.secret`, and `RankingRequest` carries no signature/nonce field. The legacy `HMAC_SECRET` / `VITE_HMAC_SECRET` env vars are still wired into `application.properties` and `frontend-ci.yml` (and documented in `README.md` as an active protection) but are dead — scores are admitted based only on session state and coarse bounds.
2. **OAuth2 success handler leaks tokens via URL.** `OAuth2SuccessHandler.onAuthenticationSuccess` appends both `accessToken` and `refreshToken` as query-string params to a redirect, exposing them to browser history, Referer headers, reverse-proxy logs, and any third-party resources loaded by the callback page.
3. **Sudoku server returns the full solution to the client at session-start.** `SudokuSessionStartResponse.solution` is included in the `/api/sudoku/session/start` response, completely defeating server-side authority for sudoku clear-time validation.
4. **Dev-quality default secrets are baked into `application.properties`.** `JWT_SECRET`, `HMAC_SECRET`, and `IP_HASH_SALT` all have fallback defaults such as `dev-jwt-secret-min-32-chars-change-in-prod`. If the env var is ever unset on Railway, the app boots silently with a guessable HS256 key, enabling full JWT forgery (any `role=ADMIN`).
5. **Admin authorization depends only on the URL prefix `/api/admin/**`.** Any admin controller accidentally mapped under a different base (or sharing a sibling path that `permitAll`-matches) loses protection; there is no method-level `@PreAuthorize`. Combined with the catch-all `.anyRequest().permitAll()` this is fragile.

## Findings

### Critical — HMAC score verification is advertised but not implemented
- **Where**: `backend/src/main/java/com/dobakggun/service/RankingService.java:57-93`; `backend/src/main/java/com/dobakggun/controller/RankingController.java:38-44`; `backend/src/main/resources/application.properties:16`; `backend/src/main/java/com/dobakggun/dto/RankingRequest.java` (no signature field); `README.md:140-144`.
- **Issue**: `CLAUDE.md` / README promise HMAC protection on ranking submissions. The only consumer of `app.hmac.secret` in the whole backend is the properties file itself — `grep -R "hmac" backend/src` matches only the property key and the (unrelated) `Keys.hmacShaKeyFor` call inside `JwtUtil`. `RankingRequest` has no `token`/`signature`/`nonce`/`timestamp` field, so the controller cannot verify anything even if a service existed. Front-end `frontend/src/api/rankings.ts` likewise sends no signature (I inspected `frontend/src/api/rankings.ts` and there is no HMAC dependency imported).
- **Attack scenario**: An attacker POSTs a crafted body to `/api/{game}/rankings` with a legitimate `sessionId` obtained from `/api/{game}/session/start` and any desired score within `validateScoreBounds` (e.g. `apple.score=1200`, `minesweeper.time=0.4`, `blockfall.score=9_999_999`). Minesweeper / Apple / Blockfall submission never re-checks the game state (`validateAndConsume` only verifies the session is ACTIVE and not expired; game-specific `validate` exists for Apple/Solitaire/Blockfall but not Minesweeper or Sudoku). Rate limit is 3/min per IP-hash and trusts `X-Forwarded-For`, which is client-controlled for any caller that can set arbitrary headers.
- **Suggested fix**: Either (a) implement the documented HMAC: require `signature = HMAC-SHA256(secret, sessionId|score|timestamp|nonce)`, verify server-side before persist, reject replayed nonces via Redis; or (b) explicitly update docs + CLAUDE.md to say HMAC is *replaced by* server-authoritative session validation, and remove `app.hmac.secret` / `VITE_HMAC_SECRET` everywhere. Currently the code/doc mismatch is itself a risk (future contributors may assume protection exists).

### Critical — Weak default fallback for `JWT_SECRET` / `HMAC_SECRET` / `IP_HASH_SALT`
- **Where**: `backend/src/main/resources/application.properties:16-17,26`
  - `app.hmac.secret=${HMAC_SECRET:dev-secret-change-in-production}`
  - `app.ip-hash.salt=${IP_HASH_SALT:dev-ip-salt-change-in-production}`
  - `app.jwt.secret=${JWT_SECRET:dev-jwt-secret-min-32-chars-change-in-prod}`
- **Issue**: If the Railway environment ever fails to inject `JWT_SECRET` (missing variable, typo, deploy before secret rotation), the app silently starts with a globally-known string as its HS256 key. `JwtUtil` does no length / entropy / "production" check. Everyone in the world has read access to this GitHub repo and therefore to this key.
- **Attack scenario**: Any attacker with access to the default key value (i.e. anyone reading the repo) can forge `accessToken` claims like `{"sub":"1","role":"ADMIN"}`, sign with the default key, and hit `/api/admin/**` endpoints. `JwtAuthenticationFilter:29-37` injects the role from the token directly into `SecurityContext` with no revocation check.
- **Suggested fix**: Fail-fast at startup if the runtime secret equals the dev default or is shorter than 32 bytes. Example: add a `@PostConstruct` assertion in `JwtUtil` — `if (secret.startsWith("dev-") || secret.length()<32) throw new IllegalStateException(...)`. Same pattern for HMAC salt and IP-hash salt.

### High — OAuth2 success handler leaks both access & refresh tokens in URL query
- **Where**: `backend/src/main/java/com/dobakggun/handler/OAuth2SuccessHandler.java:41-45`
- **Issue**: Tokens flow `?accessToken=...&refreshToken=...` through the browser's address bar. They are saved in browser history, sent as `Referer` to any third-party image/script on `OAuthCallbackPage`, and land in proxy access logs / analytics tools. Frontend `frontend/src/pages/OAuthCallbackPage.tsx:19-33` then stores the RT in `localStorage` via `setAuth`, but the damage (URL exposure) is already done.
- **Attack scenario**: Any analytics beacon or third-party resource loaded on `/oauth/callback` sees the full referrer URL → token harvest. Browser extensions with history access can read tokens. Reverse-proxy / CDN access logs archive them.
- **Suggested fix**: Return a short-lived, single-use "handoff code" in the URL and have the frontend exchange it (POST) for the token pair. Alternatively set the RT as a `HttpOnly; Secure; SameSite=Lax` cookie on the callback response and redirect with no token in the URL.

### High — Refresh token stored in `localStorage`; no access-token revocation
- **Where**: `frontend/src/context/AuthContext.tsx:19,27,34,39,47,60` (RT kept in `localStorage.dbg_rt`); `backend/src/main/java/com/dobakggun/security/JwtAuthenticationFilter.java:29`; `backend/src/main/java/com/dobakggun/service/AuthService.java:167-169` (logout only deletes RT).
- **Issue**: Any XSS anywhere on the site — including in Excel-mode boards, profanity-filter bypass, or injected third-party scripts — immediately steals the refresh token (7-day TTL). Even after the user clicks "Logout," the 15-minute access token remains fully valid until natural expiry, because `JwtAuthenticationFilter` only verifies the JWT signature + expiry with no blacklist/jti check (`grep blacklist|revok` returned no matches in backend code).
- **Attack scenario**: XSS exfiltrates RT → attacker keeps it fresh indefinitely via `/api/auth/refresh`. Stolen AT remains valid up to 15 min after victim logout.
- **Suggested fix**: Move RT to `HttpOnly; Secure; SameSite=Strict` cookie. On logout, write the current AT's `jti` (or full token hash) into Redis with TTL = remaining expiry and have `JwtAuthenticationFilter` reject hits. Add a `jti` claim to `JwtUtil.generateAccessToken`.

### High — Sudoku session response discloses full solution grid
- **Where**: `backend/src/main/java/com/dobakggun/controller/SudokuController.java:22-27` → `backend/src/main/java/com/dobakggun/service/SudokuService.java:50-66` → `backend/src/main/java/com/dobakggun/dto/SudokuSessionStartResponse.java:13`
- **Issue**: The response body contains `solution: int[][]` alongside `puzzle`. The backend stores the solution in `session.extra` (good) but then also hands it to the client. Given `RankingService.saveRanking` (case `sudoku`, lines 148-162) accepts any `clearTime >= 5 && <= sessionSeconds + 10`, a bot can: start session → immediately submit any `clearTime` ≥5 → get a top-rank time. The solution field isn't even needed for rate-limiting the cheat.
- **Attack scenario**: Botted sudoku leaderboard. Additionally, the server-shipped solution opens a trivial auto-solver for anyone who opens DevTools.
- **Suggested fix**: Remove `solution` from `SudokuSessionStartResponse`. Validate the final filled grid against the stored solution in a new endpoint `/api/sudoku/verify` and require it to be called with the final board before `POST /api/sudoku/rankings` is accepted.

### High — Admin authorization relies solely on URL prefix
- **Where**: `backend/src/main/java/com/dobakggun/config/SecurityConfig.java:64,82`; no `@PreAuthorize` anywhere in the codebase (Grep: `@PreAuthorize|hasRole|hasAuthority` → single match = `/api/admin/**` matcher).
- **Issue**: Method-level security (`@EnableMethodSecurity`, `@PreAuthorize`) is not enabled. Authorization is enforced exclusively by URL matching. If any future admin controller is mapped under a different prefix (e.g. someone adds a `@RequestMapping("/api/internal/foo")`), it will fall through to `.anyRequest().permitAll()` at line 82 — silent privilege bypass. The catch-all `permitAll()` means "default allow" rather than "default deny".
- **Attack scenario**: A developer adds `@RestController @RequestMapping("/api/ops/rebuild-cache")` without updating `SecurityConfig`. Normal users can now trigger it.
- **Suggested fix**: Change the fallthrough to `.anyRequest().authenticated()` (or `.denyAll()`) and explicitly enumerate public endpoints. Enable `@EnableMethodSecurity` and add `@PreAuthorize("hasRole('ADMIN')")` on every admin controller class as defense-in-depth.

### Medium — `VITE_HMAC_SECRET` shipped in browser bundle via CI
- **Where**: `frontend/.env.local.example:2`; `.github/workflows/frontend-ci.yml:33`; `README.md:138`; `docs/백엔드전환계획.md:131,174,328,852` (the migration plan acknowledges this).
- **Issue**: `VITE_*` env vars are inlined into the Vite build output, so *any* value set here lands in the public JS bundle. The GitHub Actions workflow still pipes `secrets.VITE_HMAC_SECRET` into the build, meaning whatever value Vercel has for that secret is discoverable by anyone loading the site (`view-source:` → search for the string). Even though no runtime code reads it (dead secret), it still ships if the CI secret is populated.
- **Attack scenario**: If/when someone re-enables frontend HMAC using this var (per the migration plan that hasn't been cleaned up), the secret is immediately public. The variable being "dormant" is a footgun.
- **Suggested fix**: Remove `VITE_HMAC_SECRET` from `frontend/.env.local.example`, from `frontend-ci.yml`, from `README.md`. Delete the Vercel + GitHub repository secrets for it. Finish the cleanup documented in `docs/백엔드전환계획.md:852`.

### Medium — IP-based rate limit & ban trust arbitrary `X-Forwarded-For`
- **Where**: `backend/src/main/java/com/dobakggun/service/RankingService.java:211-217`; `backend/src/main/java/com/dobakggun/service/SessionService.java:116-122`; `backend/src/main/java/com/dobakggun/service/SudokuService.java:172-176`; `backend/src/main/java/com/dobakggun/service/BaseballSessionService.java:211-215`; `backend/src/main/java/com/dobakggun/service/MinesweeperSessionService.java:145-149`; `backend/src/main/java/com/dobakggun/service/SolitaireSessionService.java:85-89`; `backend/src/main/java/com/dobakggun/security/IpBanFilter.java:39-49`.
- **Issue**: All six `getClientIp` helpers take the leftmost token of `X-Forwarded-For` unconditionally. In front of Railway this is usually fine because Railway terminates at its edge and prepends the real IP, but nothing in the code enforces a trusted-proxy list, and there is no `server.forward-headers-strategy` guard specifically for IP resolution — `IpBanFilter` is the most exposed because an attacker can set `X-Forwarded-For: <any-ip>` to bypass an IP ban (they control the header, the filter reads the first hop, no allowlist).
- **Attack scenario**: Attacker whose real IP is in `ip_ban_set` sends `X-Forwarded-For: 1.2.3.4` → filter reads `1.2.3.4` → not banned → request goes through. Same pattern circumvents the 3-req/min rate limit and defeats the IP-hash equality check in `SessionService.validateAndConsume`.
- **Suggested fix**: Use Spring's `ForwardedHeaderFilter` (or Railway's documented real-IP header, commonly `X-Envoy-External-Address`). Only trust `X-Forwarded-For` if the immediate peer is on Railway's known CIDR; otherwise fall back to `request.getRemoteAddr()`.

### Medium — `ContactController` persists attacker-controlled filenames as JSON in DB
- **Where**: `backend/src/main/java/com/dobakggun/controller/ContactController.java:62-71`; `backend/src/main/java/com/dobakggun/service/EmailService.java:99-110` (`file.getOriginalFilename()` goes straight to Resend attachment).
- **Issue**: `file.getOriginalFilename()` is client-supplied; no sanitization/length cap. It is JSON-encoded then stored in the DB (`fileKeys`) and forwarded as an email attachment filename. Path-traversal (`../../etc/passwd`) and control characters may survive downstream. The same endpoint also uploads files only in-memory to the mail service — there is *no* virus scan or MIME validation (only the profile-image endpoint validates content-type).
- **Attack scenario**: Weaponized attachment filename crashes a downstream email client or breaks DB indexing. `.html`/`.svg` attachments can contain JS that admins opening the forwarded email may execute.
- **Suggested fix**: Validate filename (`[^A-Za-z0-9._-]` → `_`, length ≤ 100), reject executable extensions, scan content-type server-side, enforce per-file and total-upload size caps (currently unlimited — `MultipartFile` accepts whatever Spring's default allows).

### Medium — Minesweeper session ships full mine map to the client
- **Where**: `backend/src/main/java/com/dobakggun/service/MinesweeperSessionService.java:57-59,89-96`; DTO `MinesweeperSessionStartResponse`.
- **Issue**: `adjMines` is returned with `-1` for every mine cell. Together with the complete absence of server-side clear verification on minesweeper ranking submission (`RankingService.saveRanking` case `minesweeper` takes `time` from client only; no move-log check), a cheater just reads `adjMines`, flags only the safe cells, and submits any `time >= 0.4`.
- **Attack scenario**: Full minesweeper leaderboard takeover without ever needing to play.
- **Suggested fix**: Only return per-cell `adjMines` values lazily via a `/api/minesweeper/reveal` endpoint that validates the requested cell isn't a mine (server keeps the map). Validate final board on submit.

### Medium — Personal contact email hardcoded in source
- **Where**: `backend/src/main/java/com/dobakggun/service/EmailService.java:116` (`.to(List.of("ksoung140w@gmail.com"))`); also user-visible in `frontend/src/pages/PrivacyPolicyPage.tsx:46` and `frontend/src/pages/TermsOfServicePage.tsx:65`; and in `docs/어드민페이지_제작계획.md:242`.
- **Issue**: The operator's personal Gmail is baked into production code. Aside from the privacy concern, it means contact-form routing cannot be changed without a redeploy, and any fork/leak of the repo reveals it.
- **Attack scenario**: Target the admin's personal email with phishing now that the address is guaranteed to be a real account behind this service. The admin email is also used as the sole `ADMIN` role seeding path (`UPDATE users SET role='ADMIN' WHERE email='ksoung140w@gmail.com'`), so compromising this specific Gmail is a direct route to full admin.
- **Suggested fix**: Read from a new env var like `ADMIN_CONTACT_EMAIL` (Railway). For legal pages, consider an alias like `support@dobakggun.kr` that forwards.

### Medium — CORS allows credentials with pattern-matched origins
- **Where**: `backend/src/main/java/com/dobakggun/config/SecurityConfig.java:101-112`; driven by env `CORS_ORIGINS` (`app.cors.allowed-origins`).
- **Issue**: `setAllowedOriginPatterns(Arrays.asList(allowedOrigins.split(",")))` combined with `setAllowCredentials(true)` is risky if the env var contains `*` or a broad wildcard (`https://*.vercel.app` for preview deployments is a typical pattern). Any one of those preview URLs XSSed → CSRF-as-CORS attack with cookies/Authorization. The value is read from env at runtime, so the *code* is safe, but the default in `application.properties:18` is only `http://localhost:5173` — if an operator adds a wildcard in Railway for convenience, the security property silently degrades.
- **Attack scenario**: Vercel preview deployments of unrelated branches (or PR previews from forks) inherit the same domain pattern, land in the allowlist, and can make credentialed cross-site requests.
- **Suggested fix**: Validate at startup that `CORS_ORIGINS` contains no `*`. Use exact strings (not patterns) unless explicitly needed. Document the policy in `CLAUDE.md`.

### Low — `GlobalExceptionHandler` maps generic `IllegalStateException` to 403 with the message
- **Where**: `backend/src/main/java/com/dobakggun/config/GlobalExceptionHandler.java:39-42`.
- **Issue**: Returning 403 with the raw exception `getMessage()` can leak internal details (e.g. `R2_PUBLIC_URL 환경변수가 설정되지 않았습니다` surfaces config state to callers; `UserService:82`). Similarly line 46-54 returns raw `msg` checking prefix — OK but fragile.
- **Suggested fix**: Return a generic message for 500-class errors; log the detail server-side only. Reserve `IllegalStateException` for user-actionable situations, or add a new `ConfigurationMissingException` → 500 generic.

### Low — Path variable `{game}` is not strictly whitelisted at the Security layer
- **Where**: `backend/src/main/java/com/dobakggun/config/SecurityConfig.java:66-71` uses `"/api/*/session/**"` etc. and the `RankingService.VALID_GAMES` check is only at service layer.
- **Issue**: Calls like `/api/foo/rankings` pass the CORS+security chain and are handled by `RankingController` which delegates to the service, which throws 404. Fine today but makes it easy to miss coverage of new paths.
- **Suggested fix**: Use `"/api/{game:minesweeper|baseball|blockfall|solitaire|apple|sudoku}/**"` regex matchers.

### Low — `spring.jpa.hibernate.ddl-auto=update` in production
- **Where**: `backend/src/main/resources/application.properties:10`.
- **Issue**: `ddl-auto=update` on a production MySQL is risky: on entity rename/drop, existing columns are silently left, and in rare cases Hibernate issues schema changes under load. CLAUDE.md explicitly says "Railway 프로덕션 DB에 직접 쓰기 쿼리 금지 (읽기 전용 접근만)" — but Spring itself is allowed to mutate schema.
- **Suggested fix**: Switch to `validate` for prod, manage schema via migration files (CLAUDE.md already requires this for manual changes).

## Positive observations

- Passwords are BCrypt-hashed (`PasswordEncoderConfig:13`), with a strong `@Pattern` enforcement at the DTO layer (`SignupRequest:22-28`).
- JPQL used throughout repositories — no string-concatenated SQL (Grep `nativeQuery|@Query.*\\+` → none found).
- Refresh-token rotation implemented correctly: old RT deleted before new one issued, reused RT triggers full session wipe (`AuthService:152-163`).
- Password reset tokens are UUIDs stored in Redis with 30-min TTL, and reset invalidates all refresh tokens (`AuthService:183-196`).
- Email enumeration mitigated on `requestPasswordReset` (always returns same success response — `AuthService:173-180`).
- HTML email templates correctly `escapeHtml` user-supplied subject/body (`EmailService:67-95,131-137`).
- Admin user/status changes refuse self-modification (`AdminUserService:28-29,38-39,48-49`).
- Baseball ranking submission *does* require server-observed `won==true` (`BaseballSessionService.validateWinAndConsume:178-180`).
- Frontend never calls `dangerouslySetInnerHTML` (Grep returned no matches); React auto-escapes content bindings.
- Ranking-side game & level whitelisting using `Set.of(...)` before repository access (`RankingService:190-209`).

## Out of scope / deferred

- Dependency vulnerability audit (no `npm audit` / `gradle dependencyCheckAnalyze` run; recommend adding OWASP dep-check to CI).
- Load-test / DoS on ranking submission (session-id is UUID, so guessing is hard, but no absolute cap per user).
- Review of Cloudflare R2 bucket policy (access-key/secret-key usage in `R2Config:16-22` looks correct — secrets are env-sourced — but bucket CORS/public-read policy is configured in Cloudflare UI, not in this repo).
- OAuth2 state/nonce handling (relies on Spring Security defaults; not explicitly audited).
- Content Security Policy / HSTS / X-Frame-Options headers are **not** set anywhere (no `HeadersConfigurer` call in `SecurityConfig.filterChain`); considered a defense-in-depth gap but deferred as a separate hardening pass.
