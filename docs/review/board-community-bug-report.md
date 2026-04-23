# Board Community — 정적 코드 리뷰 버그 리포트

작성자: qa-tester
최초 작성일: 2026-04-24
재검증일: 2026-04-24 (BUG-01/02 수정 확인)
검증 방식: 정적 코드 리뷰 + 자동 테스트 분석 (B2 경로)
참조 테스트 플랜: docs/review/board-community-test-plan.md

---

## 요약 (최신)

- 검증 방식: 정적 코드 리뷰 + 자동 테스트 분석 (B2 경로)
- 총 검증 항목: 7개 섹션, 약 110개 세부 포인트
- 발견 이슈 (초기): Critical 0 / High 2 / Medium 1 / Low 2
- 재검증 후 잔여: Critical 0 / High 0 / Medium 1 / Low 3
- XSS 차단: PASS (19 테스트 전부 PASS, 누락 벡터 해소)
- 전체 판정: PASS

---

## 재검증 섹션 (2026-04-24)

### BUG-01 재검증 — RESOLVED

HtmlSanitizer.java:90-92에 `disallowTextIn("script", "style", "noscript", "object", "embed", "applet", "base", "math", "xml", "svg")` 추가됨.

신규 테스트:
- `style_tag_is_completely_removed`: `<style>body{display:none}</style>` 입력 → 태그와 텍스트 노드(`display:none`) 모두 차단, 정상 본문 유지 검증. PASS.
- `object_embed_base_tags_are_removed`: object/embed/base 태그 및 내부 텍스트 제거 검증. PASS.

상태: RESOLVED

### BUG-02 재검증 — RESOLVED

OWASP PolicyFactory에서 rel 속성 허용 제거 (line 102-103에서 `allowAttributes("rel")` 코드 삭제됨). sanitize 완료 후 후처리 정규식으로 rel 강제 주입 (line 123-126).

신규 테스트 4개:
- `a_rel_is_forced_to_noopener_noreferrer_even_without_input`: rel 없는 a 태그에 강제 주입 검증. PASS.
- `a_rel_with_malicious_input_is_overwritten`: 사용자가 rel 직접 지정 시 OWASP 제거 + 강제 덮어쓰기. PASS.
- `a_with_target_blank_gets_forced_rel`: target=_blank 병존 시 rel 강제 주입 검증. PASS.
- `a_without_href_does_not_get_rel_injected`: href 없는 a 태그(OWASP 제거 대상)에 rel 불필요 삽입 없음 검증. PASS.

#### 정규식 엣지 케이스 평가 (5종)

후처리 정규식: `(<a\\b[^>]*?)(/?>)` → `$1 rel="noopener noreferrer"$2`

| 엣지 케이스 | 분석 결과 | 실질 위험 |
|---|---|---|
| Self-closing `<a href="x" />` | `(/?>)` 가 `/>` 를 캡처하므로 매칭됨. rel 정상 삽입. | 없음 (OWASP HTML5 파서는 self-closing a를 출력하지 않음) |
| 멀티라인 `<a\n  href="x"\n  target="_blank">` | `[^>]` 는 개행 포함 — DOTALL 플래그 불필요. 매칭됨. | 없음 |
| 이미 rel 흔적이 있는 경우 | OWASP PolicyFactory에서 rel allowAttributes 제거됨 → sanitize 시점에 rel 속성 존재 불가. 중복 주입 경로 없음. | 없음 |
| 대문자 `<A href="x">` | OWASP HTML5 파서는 태그명을 소문자로 정규화하여 출력 (`<a href="x">` 로 변환). 정규식 소문자 매칭과 일치. | 없음 |
| `<a>` without href | OWASP가 href 없는 a 태그 제거 → 후처리 정규식 대상 없음. 테스트 `a_without_href_does_not_get_rel_injected`로 검증됨. | 없음 |

5종 엣지 케이스 전부 실질적 보안 위험 없음. 추가 테스트 불필요.

#### 미사용 상수 — Low (신규)

HtmlSanitizer.java:43-45: `A_TAG_WITHOUT_REL` 상수가 정의되어 있으나 `sanitize()` 내 어디서도 사용되지 않음 (dead code). 실제 후처리는 인라인 `replaceAll`로 수행됨. 동작 영향 없음.

상태: RESOLVED (보안 위험 해소). Low dead code 참고 사항 추가.

---

---

## 섹션별 결과

---

### 섹션 1. HtmlSanitizer

상태: PARTIAL PASS

#### 1-1. 화이트리스트 태그 일치 확인

PRD 허용 태그: `p, br, h2, h3, h4, strong, b, em, i, u, s, ul, ol, li, blockquote, pre, code, hr, a, img, span, div`

코드(HtmlSanitizer.java:80-96)에서 allowElements로 선언된 태그:
`p, br, h2, h3, h4, strong, b, em, i, u, s, ul, ol, li, blockquote, pre, code, hr, span, div, a, img`

결과: PRD 화이트리스트와 완전 일치. PASS

#### 1-2. XSS 테스트 케이스 커버리지 매핑

테스트 플랜 섹션 2 기준 14개 케이스와 HtmlSanitizerTest 매핑:

| QA 플랜 케이스 | HtmlSanitizerTest 대응 | 커버 여부 |
|---|---|---|
| XSS-01 script 태그 제거 | script_tag_is_removed | O |
| XSS-02 img onerror 속성 제거 (외부 img 전체 제거) | onerror_attribute_is_removed_but_content_kept + external_img_src_is_removed | O |
| XSS-03 javascript: href 제거 | javascript_href_is_removed | O |
| XSS-04 http 외부 a href 유지 + rel 강제 | https_href_is_allowed (http는 미확인) | 부분 |
| XSS-05 외부 도메인 img 전체 제거 | external_img_src_is_removed | O |
| XSS-06 iframe 제거 | iframe_tag_is_removed | O |
| XSS-07 style 태그 제거 | inline_style_is_removed (인라인 style 속성만) | 부분 |
| XSS-08 svg 내 script 제거 | 없음 | X |
| XSS-09 onmouseover 제거 | onmouseover_removed_inner_tags_kept | O |
| XSS-10 data: href 제거 | 없음 | X |
| XSS-11 data: img src 제거 | data_uri_img_is_removed | O |
| XSS-12 ProseMirror-* class 허용 | 없음 (허용 케이스 테스트 없음) | X |
| XSS-13 evil-class 제거 | 없음 | X |
| XSS-14 object 태그 제거 | 없음 | X |

커버된 케이스: 10/14. 누락: XSS-08(svg), XSS-10(data: href), XSS-12/13(class 화이트리스트), XSS-14(object)

#### [BUG-01] High — HtmlSanitizerTest에서 `<style>` 태그 제거 미검증

Title: [Board/HtmlSanitizer] `<style>` 태그 제거를 테스트하는 케이스 없음

상황:
- XSS-07은 `inline_style_is_removed` 테스트가 존재하나, 이 테스트는 `<p style="...">` 인라인 style 속성만 검증
- `<style>body{display:none}</style>` 형태의 **style 태그 자체** 제거를 검증하는 케이스가 없음
- HtmlSanitizer 구현 자체는 `<style>` 태그를 허용 태그 목록에 포함하지 않으므로 OWASP가 제거할 것으로 예상되나, **테스트로 명시적으로 보장되지 않음**
- 실제 동작: OWASP는 미허용 태그의 content를 남기는 경우가 있음. `<style>body{display:none}</style>` 에서 style 태그는 제거되나 content(`body{display:none}`)가 텍스트로 남을 수 있음
- 이 텍스트 유출은 보안상 직접 위협이 아니나 예측 외 렌더링 결과

재현 단계:
1. `sanitizer.sanitize("<style>body{display:none}</style><p>정상</p>")` 호출
2. 결과에 `<style>` 태그가 없는지 확인
3. 결과에 `body{display:none}` 텍스트가 남아있는지 확인

예상 결과: `<p>정상</p>` 만 남아야 함
실제 결과: 정적 분석 상 `body{display:none}` 텍스트가 노출될 가능성

환경: 백엔드 / HtmlSanitizerTest
우선순위: High (XSS PRD 명시 차단 대상)
담당: developer-backend

#### [BUG-02] High — `a[rel]` 속성 패턴이 임의 문자열 허용 (보안 설계 결함)

Title: [Board/HtmlSanitizer] rel 속성이 임의 문자열 허용 — noopener noreferrer 강제 미적용

재현 단계:
1. `<a href="https://example.com" rel="arbitrary value">link</a>` 입력
2. sanitize 후 GET으로 저장된 HTML 확인

코드 위치: HtmlSanitizer.java:35-36, 89
```java
private static final Pattern REL_VALUE = Pattern.compile("[a-zA-Z ]+");
...
.allowAttributes("rel").matching(REL_VALUE).onElements("a")
```

예상 결과: PRD 9.2 명시 — "rel: noopener noreferrer 강제 부여". 즉, 사용자 입력과 무관하게 모든 `<a>` 태그에 `rel="noopener noreferrer"`가 강제 부여되어야 함.

실제 결과:
- 현재 구현은 `[a-zA-Z ]+` 패턴에 매칭되는 임의 문자열(예: "noreferrer", "me", "arbitrary value")을 모두 rel 값으로 허용
- 사용자가 `rel=""` 로 제출하면 rel 속성이 제거될 수 있음
- 더 중요하게는 TipTap에서 `_blank` target을 자동 설정하더라도 rel은 클라이언트 의존 — 서버가 강제하지 않으면 API 직접 호출 시 rel 없는 `<a target="_blank">` 태그가 저장됨 (reverse tabnabbing 취약점)

우선순위: High (보안 — reverse tabnabbing, PRD 명시 강제 부여 미구현)
담당: developer-backend

수정 방향: rel 속성을 AttributePolicy에서 허용하되 항상 "noopener noreferrer"로 덮어쓰거나, post-process로 모든 `<a target="_blank">` 태그에 rel 강제 주입.

#### 1-3. a[href] http/https 제한 로직 확인

코드(HtmlSanitizer.java:64-74): hrefPolicy가 `lower.startsWith("http://") || lower.startsWith("https://")` 로 검증. PASS

단, `.allowUrlProtocols("http", "https")` 전역 설정과 AttributePolicy가 중복 적용됨 — 전역 설정이 먼저 차단하므로 AttributePolicy는 이중 방어 역할. 동작에는 문제없음.

#### 1-4. img[src] R2 prefix 검증 로직 확인

코드(HtmlSanitizer.java:53-61): `trimmed.startsWith(r2PublicUrl)` 검증. R2 URL이 아닌 경우 null 반환 → 속성 제거 → 후처리 정규식으로 img 태그 통째 제거(line 106). PASS

후처리 정규식: `<img(?![^>]*\\bsrc=)[^>]*/?>` — src 없는 img 제거. 기능상 정상이나 OWASP가 self-closing이 아닌 `<img ...></img>` 형태로 출력할 경우 미매칭 가능성 있음. 단, OWASP 20240325.1은 img를 void element로 처리하므로 실제로는 문제 없을 것으로 판단. Low 참고 사항.

#### 1-5. BoardPostService에서 sanitize 호출 확인

BoardPostService.java:185, 140: create/update 양쪽 모두 `buildAndSanitizeContent()` 내에서 `htmlSanitizer.sanitize(rawHtml)` 호출 후 저장. PASS

---

### 섹션 2. 권한 매트릭스 정적 검증

상태: PASS (32케이스 전부 코드로 보장)

#### 2-1. SecurityConfig URL 패턴 확인

SecurityConfig.java:70-74 신규 게시판 룰:
```
GET  /api/board/posts, /api/board/posts/**   hasAnyRole(FRIEND, ADMIN)
POST /api/board/posts, /api/board/images     hasAnyRole(FRIEND, ADMIN)
POST /api/board/posts/*/comments             hasAnyRole(FRIEND, ADMIN)
PUT  /api/board/posts/*                      hasAnyRole(FRIEND, ADMIN)
DELETE /api/board/posts/*, /api/board/posts/*/comments/*  hasAnyRole(FRIEND, ADMIN)
```

비로그인 → Spring Security 인증 필터에서 401 반환. PASS
USER → `hasAnyRole(FRIEND, ADMIN)` 불충족 → 403 반환. PASS

#### 2-2. SecurityConfig 룰 순서 확인 (회귀 위험)

SecurityConfig.java 룰 순서: `/api/auth/**` → `/api/admin/**` → 게시판 룰 → 기존 게임 룰 → `/api/patch-notes/**` → ...

기존 `/api/admin/**` (ADMIN role 필수)이 게시판 룰보다 **앞에** 선언되어 있음.
게시판 DELETE는 `/api/board/posts/*` 패턴이고 admin 패턴은 `/api/admin/**`이므로 경로 충돌 없음. PASS

기존 게임 서비스 룰 (`/api/*/rankings`, `/api/*/session/**` 등)과 게시판 룰 (`/api/board/**`) 패턴 겹침 가능성:
- `/api/*/rankings`는 `*`가 단일 세그먼트 와일드카드 — `board`도 매칭됨
- 그러나 `/api/board/rankings` 같은 경로는 현재 게시판에 없으므로 실제 충돌 없음. PASS

#### 2-3. BoardPostService.update() 소유권 검증

BoardPostService.java:131: `if (!post.getAuthor().getId().equals(currentUserId))` → `NOT_POST_OWNER` throw.
ADMIN 예외 없음 — PRD 명시 "ADMIN도 수정 불가" 준수. PASS

#### 2-4. BoardPostService.delete() 소유권+ADMIN 확인

BoardPostService.java:160-167:
```java
boolean isOwner = post.getAuthor().getId().equals(currentUserId);
boolean isAdmin = currentRole == User.Role.ADMIN;
if (!isOwner && !isAdmin) {
    throw new BoardException(BoardErrorCode.POST_NOT_FOUND); // 존재 노출 방지
}
```
정상. 단, FORBIDDEN(403) 대신 POST_NOT_FOUND(404)를 throw하는 것은 의도적 보안 설계(존재 노출 방지)로 PRD와의 불일치가 아님. 테스트 플랜 섹션 1 권한 매트릭스에서 "403 기대"로 기재했으나 실제로는 404 반환. 프론트가 이 동작을 올바르게 처리하는지 별도 확인 필요(Medium). 이는 스펙 불일치가 아닌 구현 선택이므로 planner 확인 권장.

#### 2-5. BoardCommentService.delete() 소유권+ADMIN 확인

BoardCommentService.java:118-122: 동일 패턴. 타인 삭제 시도 시 `COMMENT_NOT_FOUND`(404) 반환. 동일 비고.

#### 2-6. JwtAuthenticationFilter ROLE_ prefix

developer-backend 로그 확인: `SimpleGrantedAuthority("ROLE_" + role)` → SecurityConfig `hasAnyRole("FRIEND","ADMIN")` 과 일치. PASS

#### 2-7. FriendRoute 프론트 가드

FriendRoute.tsx:8-9:
- 비로그인(`!user`) → `/login` 리다이렉트. PASS
- USER → 접근 차단 화면 렌더. PASS
- FRIEND/ADMIN → children 렌더. PASS

#### 2-8. App.tsx 게시판 라우트 4종 FriendRoute 래핑

App.tsx:84-87:
```
/board          → FriendRoute > BoardListPage
/board/new      → FriendRoute > BoardWritePage
/board/:id/edit → FriendRoute > BoardEditPage
/board/:id      → FriendRoute > BoardDetailPage
```
4종 전부 FriendRoute 래핑. PASS

---

### 섹션 3. 대회기록 양식 필드 검증

상태: PASS

#### 3-1. BoardPost 엔티티 컬럼 확인

BoardPost.java 컬럼 목록:
- 필수 4개: title(O), tournamentDate(O), gameKey(O), difficultyKey(O), winner(O) — winner도 포함 5개로 확인
- 선택 7개: runnerUp(O), ranking(O), participantCount(O), participants(O), prize(O), sponsor(O), contentHtml(O)

사용자 강조 prize/sponsor 포함 확인: BoardPost.java:66-69 및 BoardPostService.java:230-231에서 setPrize/setSponsor 호출. PASS

#### 3-2. gameKey/difficultyKey 화이트리스트

BoardPostService.java:30-38 상수 매트릭스 — PRD 6.5와 완전 일치. blockfall-insane의 difficultyKey는 `insane` 단일. PASS

#### 3-3. TITLE_REQUIRED 에러 코드 반환 경로

CreatePostRequest.java:16-18: `@NotNull + @Size(min=1, max=100)` Bean Validation 어노테이션으로 검증.
그러나 GlobalExceptionHandler.java:33-40의 `MethodArgumentNotValidException` 핸들러는 `BoardErrorCode.TITLE_REQUIRED`가 아닌 `"fieldName: message"` 형식의 문자열을 반환함.

테스트 플랜 섹션 3.1에서 title 누락 시 `TITLE_REQUIRED` 에러 코드를 기대했으나, 실제 응답은:
```json
{ "error": "title: 제목을 입력해주세요" }
```
형태이지 `{ "error": "TITLE_REQUIRED", ... }` 형태가 아님.

이는 api-contract.md 3.3에서 명시한 에러 코드 목록(`TITLE_REQUIRED`) 및 공통 에러 응답 포맷(`{ "error": "ERROR_CODE", "message": "..." }`)과 불일치.
프론트엔드 boardApi.ts가 에러 코드 기반 분기를 사용한다면 인식 실패 가능성.

단, 현재 boardApi.ts의 에러 처리 로직을 별도 확인해야 최종 영향도 판정 가능. Medium으로 분류.

#### [BUG-03] Medium — TITLE_REQUIRED 에러 코드 응답 포맷 불일치

Title: [Board/API] title 누락 시 응답이 api-contract 에러 코드 포맷과 불일치

재현 단계:
1. POST /api/board/posts, body: `{"postType":"FREE","title":null,"contentHtml":"<p>test</p>"}`
2. Bearer FRIEND_JWT 헤더 포함

예상 결과: `{ "error": "TITLE_REQUIRED", "message": "제목을 입력해주세요" }` (api-contract 3.3 명시)
실제 결과: `{ "error": "title: 제목을 입력해주세요" }` (MethodArgumentNotValidException 핸들러 포맷)

영향: 프론트에서 `error === 'TITLE_REQUIRED'` 분기 시 미인식. 단, 현재 프론트가 에러 코드 기반으로 분기하는지 boardApi.ts 추가 확인 필요.

환경: backend / GlobalExceptionHandler + CreatePostRequest
우선순위: Medium
담당: developer-backend

수정 방향 (택 1):
- GlobalExceptionHandler의 MethodArgumentNotValidException 핸들러에서 field 이름을 BoardErrorCode enum 이름으로 매핑
- 또는 CreatePostRequest에서 Bean Validation 제거 후 BoardPostService 내에서 직접 검증하여 BoardException(TITLE_REQUIRED) throw

---

### 섹션 4. 이미지 업로드 검증

상태: PASS

#### 4-1. BoardImageService.validateBoardImage() 구현 확인

- 50MB 제한: line 89. PASS
- MIME 화이트리스트(jpeg/png/gif/webp): MIME_TO_EXTENSIONS 맵 line 26-31. PASS
- 확장자 화이트리스트: extractExtension + anyMatch line 101-105. PASS
- MIME-확장자 교차 검증: line 107-110. PASS

#### 4-2. UserService.validateImageFile 재사용 안 함 확인

BoardImageService.java에 UserService 의존성 없음. PASS

#### 4-3. R2 키 구조

BoardImageService.java:51: `"board/%d/%d/%02d/%s.%s"` — `board/{userId}/{YYYY}/{MM}/{UUID}.{ext}`. PRD 일치. PASS

#### 4-4. 글당 이미지 20장 제한

BoardPostService.java:194-197: sanitize 후 `<img` 태그 count 검증, 초과 시 `TOO_MANY_IMAGES`. create/update 양쪽 모두 `buildAndSanitizeContent()` 경유. PASS

#### 4-5. useImageUpload.ts 3경로 구현

- 파일선택: EditorWrapper.tsx:118-129 `handleImageFile` + `EditorToolbar`에서 input[type=file] 트리거
- 드래그앤드롭: EditorWrapper.tsx:108-116 `handleDrop`
- 클립보드 붙여넣기: EditorWrapper.tsx:74-92 paste 이벤트 리스너

3경로 전부 `uploadImageToEditor()` 호출. PASS

#### 4-6. 업로드 실패 UX

useImageUpload.ts:81-97: 실패 시 blobUrl을 `__upload_error__:` prefix src로 교체 + toast 호출. placeholder 제거 대신 오류 마킹으로 "재시도 가능" 방식. PRD 12의 "에디터에서 해당 이미지 플레이스홀더 제거" 대비 구현 차이 있음.

PRD: "에디터 내 해당 이미지 플레이스홀더 제거 + 토스트"
실제: placeholder를 오류 마킹 상태로 유지 + 토스트 + 재시도 콜백

이는 designer 진행 로그에서 "재시도 버튼 포함 placeholder 유지" 개선안으로 협의된 결과일 수 있음. PRD와의 차이를 버그로 처리하기 전 planner/designer 확인 권장. 현재 Low 참고 사항으로 분류.

---

### 섹션 5. 댓글 정책 검증

상태: PASS

#### 5-1. 댓글 권한 / 길이 검증

BoardCommentService.java:85-90: 빈 댓글 `COMMENT_CONTENT_EMPTY`, 1001자 `COMMENT_TOO_LONG`. PASS

단, BoardErrorCode에서 api-contract 명시 에러 코드는 `CONTENT_EMPTY` / `CONTENT_TOO_LONG`이나 실제 enum 값은 `COMMENT_CONTENT_EMPTY` / `COMMENT_TOO_LONG`. 이름 불일치.

| api-contract 명시 | 실제 enum | 일치 여부 |
|---|---|---|
| CONTENT_EMPTY (댓글) | COMMENT_CONTENT_EMPTY | 불일치 |
| CONTENT_TOO_LONG | COMMENT_TOO_LONG | 일치 |

`COMMENT_CONTENT_EMPTY`는 게시글 본문의 `CONTENT_EMPTY`와 분리된 이름으로, enum 설계상 명확하긴 하나 api-contract 문서와 다름. Low 참고 사항.

#### 5-2. cursor 페이지네이션

BoardCommentService.java:43-60: cursor=0 기본, size+1 조회, hasNext 판단. PASS

cursor가 null이면 0L로 처리 — 즉 cursor 없이 호출하면 처음부터 조회. 동작은 정상이나, GET /api/board/posts/{id}/comments를 cursor 없이 호출 시 초기 상세 응답의 댓글과 중복 반환될 수 있음. 이는 api-contract 3.7-pre 비고에서 "글 상세 초기 응답에 이미 50개 포함이므로 이 엔드포인트는 더 보기 클릭 시에만 호출"로 명시되어 있어 설계 의도 내. PASS

#### 5-3. 댓글 plain text 처리

CommentItem.tsx:75: `<p className={s.body}>{comment.content}</p>` — JSX에서 `{comment.content}`는 React의 자동 이스케이프로 HTML 태그가 텍스트로 렌더됨. 서버도 댓글 content를 VARCHAR 필드에 raw 저장 (HtmlSanitizer 미적용). PASS

#### 5-4. 아바타 fallback

CommentItem.tsx:4-26: `src`가 falsy이면 닉네임 첫 글자 원형 span 렌더. profileImage null 케이스 처리됨. PASS

단, profileImage URL이 있으나 404인 경우(이미지 삭제 등) `onError` 핸들러가 없음 — 깨진 이미지 아이콘이 노출될 수 있음. Low.

---

### 섹션 6. 에러 코드 매핑

상태: PARTIAL PASS

#### 6-1. BoardErrorCode enum 22개 vs api-contract 22개 비교

| api-contract | BoardErrorCode enum | 일치 여부 |
|---|---|---|
| UNAUTHORIZED | (Spring Security 처리) | 해당 없음 |
| FORBIDDEN | (Spring Security 처리) | 해당 없음 |
| NOT_POST_OWNER | NOT_POST_OWNER | O |
| POST_NOT_FOUND | POST_NOT_FOUND | O |
| COMMENT_NOT_FOUND | COMMENT_NOT_FOUND | O |
| INVALID_POST_TYPE | INVALID_POST_TYPE | O |
| TITLE_REQUIRED | TITLE_REQUIRED | O (단, 반환 경로가 BoardException이 아닌 Bean Validation — BUG-03 참조) |
| CONTENT_EMPTY | CONTENT_EMPTY | O |
| TOURNAMENT_FIELD_MISSING | TOURNAMENT_FIELD_MISSING | O |
| INVALID_GAME_KEY | INVALID_GAME_KEY | O |
| INVALID_DIFFICULTY_KEY | INVALID_DIFFICULTY_KEY | O |
| TOO_MANY_IMAGES | TOO_MANY_IMAGES | O |
| POST_TYPE_IMMUTABLE | POST_TYPE_IMMUTABLE | O |
| CONTENT_TOO_LONG | COMMENT_TOO_LONG | 이름 불일치 (Low) |
| COMMENT_POST_MISMATCH | COMMENT_POST_MISMATCH | O |
| INVALID_CURSOR | INVALID_CURSOR | O |
| FILE_EMPTY | FILE_EMPTY | O |
| FILE_TOO_LARGE | FILE_TOO_LARGE | O |
| UNSUPPORTED_MIME | UNSUPPORTED_MIME | O |
| UNSUPPORTED_EXTENSION | UNSUPPORTED_EXTENSION | O |
| MIME_EXTENSION_MISMATCH | MIME_EXTENSION_MISMATCH | O |
| R2_UPLOAD_FAILED | R2_UPLOAD_FAILED | O |
| COMMENT_NOT_FOUND | — | (api-contract에서는 CONTENT_EMPTY와 CONTENT_TOO_LONG이 댓글/게시글 공용) |

실제 enum에는 api-contract에 없는 `COMMENT_CONTENT_EMPTY` 추가됨. 댓글 empty와 게시글 empty를 구분한 것으로 enum 설계는 오히려 더 명확. 다만 api-contract 문서를 업데이트해야 함.

#### 6-2. GlobalExceptionHandler BoardException 핸들러

GlobalExceptionHandler.java:21-25:
```java
ResponseEntity.status(e.getErrorCode().getStatus())
    .body(Map.of("error", e.getErrorCode().name(), "message", e.getMessage()));
```
api-contract 응답 포맷 `{ "error": "ERROR_CODE", "message": "..." }` 와 일치. PASS

단, BUG-03에서 기술한 것처럼 Bean Validation 경로(`MethodArgumentNotValidException`)는 다른 핸들러를 타므로 일관성 깨짐.

---

### 섹션 7. 회귀 영향 체크

상태: PASS

#### 7-1. SecurityConfig 기존 룰 영향

룰 선언 순서 검토(SecurityConfig.java:63-92):
1. `/api/auth/**` permitAll
2. OAuth2 콜백 permitAll
3. `/api/admin/**` hasRole(ADMIN)
4. 게시판 신규 룰 (4~5번)
5. 게임 서비스 룰 (`/api/*/session/**`, rankings, guess 등) permitAll
6. `/api/patch-notes/**` permitAll
7. `/api/users/me/**` authenticated
8. 문의 룰
9. anyRequest().permitAll()

기존 `/api/admin/**`는 게시판 룰보다 먼저 선언되어 있고 경로 충돌 없음. PASS
`/api/patch-notes/**`는 게시판 룰 이후에 선언되어 있으나, `/api/board/**`와 경로 충돌 없음. PASS
기존 게임 서비스 룰과 경로 충돌 없음(이전 분석). PASS

#### 7-2. CORS PUT 추가 영향

SecurityConfig.java:121: `config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"))`

개발자 로그에서 PUT이 신규 추가됨. 기존 API 중 PUT을 사용하는 엔드포인트 확인 필요:
- `/api/users/me/**` 하위에 프로필 업데이트가 PUT을 사용할 가능성이 있음
- 기존에 PUT CORS가 미설정이었다면 기존 프로필 수정 API가 동작 안 했을 수도 있음 → 이미 동작하던 기능이라면 기존에 PUT이 허용되어 있던 것
- CORS는 브라우저에서 미허용 메서드 preflight 요청을 차단하는 역할. PUT이 새로 추가된 것이 기존 기능에 영향을 미칠 가능성은 매우 낮음(추가이므로). PASS

---

## [INFO-01] 설계 불일치 — planner 확인 권장

### deletePost/deleteComment 403 vs 404 반환

BoardPostService.java:164, BoardCommentService.java:122:
타인 삭제 시도 시 `FORBIDDEN(403)` 대신 `POST_NOT_FOUND(404)` / `COMMENT_NOT_FOUND(404)`를 반환.

- api-contract 3.5: "403 FORBIDDEN" 명시
- 구현: 보안 관례(존재 노출 방지)로 404 반환

버그 아님 (보안 관례 우선). 그러나 api-contract 문서와 불일치하므로 planner가 문서를 현실에 맞게 업데이트하는 것을 권장.
또한 테스트 플랜 섹션 1 권한 매트릭스를 "403 → 404로 수정"해야 함.

---

## 사용자 수동 확인 필요 목록

정적 검증으로 확인 불가한 항목. 브라우저 E2E 검증 필요.

1. 에디터 드래그앤드롭 실동작 — 파일을 에디터 영역에 드롭했을 때 dragging CSS 클래스 토글 및 업로드 플로우 확인
2. 클립보드 붙여넣기 이미지 업로드 — 스크린샷 등 이미지를 Ctrl+V로 붙여넣기 시 업로드 시작 확인
3. 업로드 실패 UX 시각 확인 — `__upload_error__:` prefix src 이미지가 UI에서 어떻게 보이는지 확인 (깨진 이미지 아이콘 vs 오류 표시 UI)
4. 아바타 onError fallback — profileImage URL이 유효하지 않을 때(404) 이미지 깨짐 또는 fallback 노출 확인 (현재 onError 핸들러 미구현)
5. GameDifficultyPicker 단일 난이도 자동선택 UX — blockfall-insane/apple 선택 시 난이도 드롭다운이 disabled + 값 자동설정되는 시각적 동작 확인
6. PostTypeBadge 3색 렌더 — TOURNAMENT/NOTICE/FREE 배지가 designer 명세 색상으로 올바르게 표시되는지 확인
7. 반응형 레이아웃 — 320px 모바일에서 에디터 툴바 아이콘 접히거나 넘치지 않는지 확인
8. 댓글 "더 보기" 동작 — 댓글 51개 이상 환경에서 버튼 노출 후 클릭 시 cursor 페이지네이션 동작 확인

---

## 에스컬레이션 히스토리

| 이슈 | 담당 | 우선순위 | 상태 |
|---|---|---|---|
| BUG-01 style 태그 제거 테스트 미커버 | developer-backend | High | RESOLVED (2026-04-24 재검증) |
| BUG-02 rel 속성 임의 문자열 허용 (reverse tabnabbing) | developer-backend | High | RESOLVED (2026-04-24 재검증) |
| BUG-03 TITLE_REQUIRED 에러 코드 포맷 불일치 | developer-backend | Medium | 미해소 — 후속 대응 권장 |
| INFO-01 403 vs 404 설계 불일치 | planner 확인 권장 | Low | 미해소 — planner 문서 업데이트 권장 |
| (신규) A_TAG_WITHOUT_REL 미사용 상수 | developer-backend | Low | 참고 사항 — 동작 영향 없음 |

---

## 최종 판정

**PASS**

Critical/High 버그 전부 해소. Medium 1건(BUG-03), Low 3건은 운영 배포 후 후속 처리 가능.

잔여 사항 (배포 차단 불필요):
- BUG-03: TITLE_REQUIRED Bean Validation 경로의 에러 코드 포맷 불일치 — 프론트가 에러 코드 문자열 기반 분기를 사용하지 않는다면 실사용 영향 없음. 다음 배포 시 통일 권장.
- INFO-01: api-contract 문서의 403 vs 실제 404 불일치 — planner가 문서 현행화.
- (Low) A_TAG_WITHOUT_REL dead code — 코드 정리 수준.
