# developer-backend — 게시판 커뮤니티 구현 로그

문서 소유자: developer-backend
작성일: 2026-04-24
상태: **완료 — 구현 완료, `./gradlew test` 19케이스 PASS, QA PASS 판정**

---

## 핵심 구현 결정 5건

### 1. JwtAuthenticationFilter ROLE_ prefix 확인
`JwtAuthenticationFilter`가 `SimpleGrantedAuthority("ROLE_" + role)` 형식으로 세팅함을 확인.
SecurityConfig 게시판 룰에 `hasAnyRole("FRIEND", "ADMIN")` 사용 확정 (`hasAnyAuthority` 아님).
프론트엔드 API 호출 시 JWT 토큰의 role 값(`FRIEND`/`ADMIN`)이 그대로 와야 하며, 백엔드가 `ROLE_` prefix를 자동 부여한다.

### 2. HtmlSanitizer 화이트리스트 + disallowTextIn 강화 (BUG-01 해소)
OWASP `HtmlPolicyBuilder`로 태그/속성 화이트리스트 구성.
미허용 태그의 텍스트 노드 유출 방지를 위해 `disallowTextIn("script", "style", "noscript", "object", "embed", "applet", "base", "math", "xml", "svg")` 추가.
`allowUrlProtocols("http", "https")` 전역 설정 필수 — 없으면 `AttributePolicy`도 차단됨 (OWASP 내부 필터).

### 3. rel="noopener noreferrer" 강제 주입 (BUG-02 해소)
PRD 9.2 "rel 강제 부여" 요건 이행.
OWASP PolicyFactory에서 `rel` 속성 허용 자체를 제거한 뒤, `sanitize()` 후처리 2단계에서 모든 `<a>` 태그에 무조건 삽입.
구현: `replaceAll("(<a\\b[^>]*?)(/?>)", "$1 rel=\"noopener noreferrer\"$2")`
`target="_blank"` 유무, 사용자 rel 입력값 유무 모두 무관하게 강제 적용.

### 4. BoardImageService.validateBoardImage (50MB, MIME-확장자 교차검증)
기존 `UserService.validateImageFile`(5MB 제한 하드코딩)은 재사용하지 않음.
`BoardImageService`에 신규 `validateBoardImage` 작성: 50MB 제한, MIME 화이트리스트(jpeg/png/gif/webp), 확장자 화이트리스트, MIME-확장자 교차검증(스푸핑 방지).
`S3Client` 빈은 `UserService`와 공유.

### 5. R2 이미지 저장 경로
`board/{userId}/{YYYY}/{MM}/{UUID}.{ext}` — 연월 파티셔닝으로 운영 편의.
예: `board/42/2026/04/e3a2b1c0-....png`
공개 URL: `r2Properties.getPublicUrl() + "/" + key`

---

## 변경 파일 총계

### 신규 생성 (25개)

| 파일 | 분류 |
|---|---|
| `entity/board/BoardPost.java` | Entity — PostType enum(TOURNAMENT/NOTICE/FREE), TOURNAMENT 필드 NULL 허용 |
| `entity/board/BoardComment.java` | Entity — post_id FK ON DELETE CASCADE |
| `repository/BoardPostRepository.java` | Repository |
| `repository/BoardCommentRepository.java` | Repository — cursor 기반 페이지네이션 메서드 포함 |
| `exception/BoardErrorCode.java` | 에러코드 enum 22개 |
| `exception/BoardException.java` | RuntimeException 확장 |
| `dto/board/BoardAuthorResponse.java` | DTO |
| `dto/board/TournamentDataRequest.java` | DTO |
| `dto/board/CreatePostRequest.java` | DTO |
| `dto/board/UpdatePostRequest.java` | DTO |
| `dto/board/CreateCommentRequest.java` | DTO |
| `dto/board/TournamentDataResponse.java` | DTO |
| `dto/board/BoardCommentResponse.java` | DTO |
| `dto/board/BoardPostSummaryResponse.java` | DTO |
| `dto/board/BoardPostDetailResponse.java` | DTO |
| `util/HtmlSanitizer.java` | Util — OWASP PolicyFactory + AttributePolicy + 후처리 2단계 |
| `service/BoardImageService.java` | Service — 50MB 제한, MIME-확장자 교차검증 |
| `service/BoardPostService.java` | Service — gameKey/difficultyKey 화이트리스트 포함 |
| `service/BoardCommentService.java` | Service — cursor 페이지네이션 |
| `controller/BoardPostController.java` | Controller |
| `controller/BoardCommentController.java` | Controller |
| `controller/BoardImageController.java` | Controller |
| `db/migration/V2__create_board_tables.sql` | Migration SQL (참조용 — 실제 적용은 JPA ddl-auto=update) |
| `test/.../util/HtmlSanitizerTest.java` | Test — 19케이스 PASS |

### 수정 (3개)

| 파일 | 변경 내용 |
|---|---|
| `build.gradle` | OWASP `com.googlecode.owasp-java-html-sanitizer:20240325.1` 의존성 추가 |
| `config/SecurityConfig.java` | 게시판 FRIEND+ 룰 5줄 추가 + CORS `allowedMethods`에 `PUT` 추가 (기존 누락 버그 함께 수정) |
| `config/GlobalExceptionHandler.java` | `BoardException` 핸들러 추가 (`error` + `message` 필드 반환) |

---

## 의존성 추가

```
implementation 'com.googlecode.owasp-java-html-sanitizer:owasp-java-html-sanitizer:20240325.1'
```

---

## DB 스키마 관리

JPA `ddl-auto=update` 방식으로 애플리케이션 기동 시 자동 처리.
`V2__create_board_tables.sql`은 투명성 확보용 참조 문서 (Railway 프로덕션에 직접 실행 금지).

---

## 테스트: HtmlSanitizerTest 19케이스 PASS

**원 13케이스**
- `script_tag_is_removed`
- `external_img_src_is_removed`
- `javascript_href_is_removed`
- `data_uri_img_is_removed`
- `onerror_attribute_is_removed_but_content_kept`
- `onmouseover_removed_inner_tags_kept`
- `vbscript_url_is_removed`
- `inline_style_is_removed`
- `iframe_tag_is_removed`
- `r2_img_src_is_allowed`
- `https_href_is_allowed`
- `allowed_tags_are_preserved`
- `tags_only_html_is_effectively_empty`
- `html_with_text_is_not_effectively_empty`

**QA 보강 6케이스 (BUG-01/02)**
- `style_tag_is_completely_removed` — style 태그 + 내부 텍스트 완전 제거
- `object_embed_base_tags_are_removed` — object/embed/base 태그 및 내부 텍스트 제거
- `a_rel_is_forced_to_noopener_noreferrer_even_without_input` — rel 없는 a 태그에 강제 주입
- `a_rel_with_malicious_input_is_overwritten` — 사용자 rel 입력값 덮어쓰기
- `a_with_target_blank_gets_forced_rel` — target=_blank와 함께 rel 강제 주입
- `a_without_href_does_not_get_rel_injected` — javascript: href 제거 확인

```
./gradlew test → BUILD SUCCESSFUL (19케이스 전부 PASSED)
```

---

## gameKey/difficultyKey 화이트리스트 (BoardPostService 상수)

```
minesweeper      → beginner, intermediate, expert
baseball         → easy, normal, hard
blockfall        → easy, normal, hard
blockfall-insane → insane  (PRD 6.5 확정, 프론트 랭킹 hard와 무관)
solitaire        → draw1, draw3
apple            → normal
sudoku           → easy, normal, hard
```

---

## CORS PUT 누락 수정 (기존 버그)

기존 `SecurityConfig.corsConfigurationSource()`의 `allowedMethods`에 `PUT`이 없었음.
게시판 `PUT /api/board/posts/{id}` 엔드포인트 추가로 인해 함께 수정.
`List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS")`로 변경.

---

## 잔여 이슈

| 우선순위 | 내용 |
|---|---|
| Medium (BUG-03) | `TITLE_REQUIRED` 등 Bean Validation 실패 시 에러가 `MethodArgumentNotValidException` 포맷으로 반환됨. API 계약 `{ "error": "ERROR_CODE", "message": "..." }` 포맷과 다소 불일치. 차기 배포에서 `GlobalExceptionHandler`의 `handleValidation` 응답 포맷 통일 예정. |
| Low | `HtmlSanitizer.java`의 `A_TAG_WITHOUT_REL` Pattern 상수가 현재 사용되지 않는 dead code. 다음 세션 초반에 제거. |

---

## 진행 중

없음

## 블로커 / 질문

없음

## API 계약 변경사항

없음 — `docs/specs/board-api-contract.md` 기준 그대로 준수

---

## 다음 세션 인수인계 주의사항

1. **미커밋 상태**: 모든 변경이 로컬에만 있음. 사용자 승인 후 커밋 및 push 필요.
2. **JwtAuthenticationFilter prefix**: `ROLE_FRIEND` / `ROLE_ADMIN` 형식 확인 완료. 프론트엔드가 JWT 토큰 role 필드에 `FRIEND`/`ADMIN`을 넣으면 백엔드 `hasAnyRole` 매칭 정상 동작.
3. **완료 후 전달 필요**: developer-frontend에 API 사용 가이드, qa-tester에 재검증 요청.
4. **dead code 제거**: `HtmlSanitizer.java`의 `A_TAG_WITHOUT_REL` 상수 삭제.
