# 도박군 게시판 (Board Community) — 테스트 플랜

작성자: qa-tester
작성일: 2026-04-24
상태: 선행 작성 (구현 완료 전) — 실제 실행은 구현 완료 후 별도 턴
참조 스펙:
- docs/specs/board-community.md
- docs/specs/board-api-contract.md

---

## 섹션 1. 권한 매트릭스

### 1.1 테스트 대상 동작 × 역할 매트릭스

| 유저 | 목록조회 GET /api/board/posts | 상세조회 GET /api/board/posts/{id} | 글작성 POST /api/board/posts | 이미지업로드 POST /api/board/images | 댓글작성 POST /posts/{id}/comments | 본인삭제 DELETE /posts/{id} | 타인삭제 DELETE /posts/{id} |
|------|---------|---------|-------|-------------|---------|---------|---------|
| 비로그인 (토큰 없음) | 401 UNAUTHORIZED | 401 UNAUTHORIZED | 401 UNAUTHORIZED | 401 UNAUTHORIZED | 401 UNAUTHORIZED | 401 UNAUTHORIZED | 401 UNAUTHORIZED |
| USER (ROLE_USER 토큰) | 403 FORBIDDEN | 403 FORBIDDEN | 403 FORBIDDEN | 403 FORBIDDEN | 403 FORBIDDEN | 403 FORBIDDEN | 403 FORBIDDEN |
| FRIEND (ROLE_FRIEND 토큰) | 200 OK | 200 OK | 201 Created | 200 OK | 201 Created | 204/200 OK | 403 FORBIDDEN |
| ADMIN (ROLE_ADMIN 토큰) | 200 OK | 200 OK | 201 Created | 200 OK | 201 Created | 204/200 OK | 204/200 OK |

비고: PRD 스펙상 DELETE 응답 코드는 api-contract 3.5에서 200 OK로 명시. 구현 후 실제 코드 기준 확인 필요.

### 1.2 curl 예시 (Authorization 헤더 포함)

**비로그인 — 목록 조회 (401 기대)**
```bash
curl -s -o /dev/null -w "%{http_code}" \
  "https://{backend-host}/api/board/posts"
```

**USER 토큰 — 목록 조회 (403 기대)**
```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer {USER_JWT}" \
  "https://{backend-host}/api/board/posts"
```

**FRIEND 토큰 — 글 목록 조회 (200 기대)**
```bash
curl -s -w "\n%{http_code}" \
  -H "Authorization: Bearer {FRIEND_JWT}" \
  "https://{backend-host}/api/board/posts"
```

**FRIEND 토큰 — 글 작성 (201 기대)**
```bash
curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer {FRIEND_JWT}" \
  -H "Content-Type: application/json" \
  -d '{"postType":"FREE","title":"테스트 글","contentHtml":"<p>본문</p>"}' \
  "https://{backend-host}/api/board/posts"
```

**FRIEND 토큰 — 타인 글 삭제 (403 기대)**
```bash
curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  -H "Authorization: Bearer {FRIEND_JWT_DIFFERENT_USER}" \
  "https://{backend-host}/api/board/posts/{타인_post_id}"
```

**ADMIN 토큰 — 타인 글 삭제 (200 기대)**
```bash
curl -s -w "\n%{http_code}" -X DELETE \
  -H "Authorization: Bearer {ADMIN_JWT}" \
  "https://{backend-host}/api/board/posts/{타인_post_id}"
```

**FRIEND 토큰 — 이미지 업로드 (200 기대)**
```bash
curl -s -w "\n%{http_code}" -X POST \
  -H "Authorization: Bearer {FRIEND_JWT}" \
  -F "file=@/tmp/test.jpg" \
  "https://{backend-host}/api/board/images"
```

**USER 토큰 — 이미지 업로드 (403 기대)**
```bash
curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Authorization: Bearer {USER_JWT}" \
  -F "file=@/tmp/test.jpg" \
  "https://{backend-host}/api/board/images"
```

**댓글 삭제 — ADMIN이 FRIEND 댓글 삭제 (200 기대)**
```bash
curl -s -w "\n%{http_code}" -X DELETE \
  -H "Authorization: Bearer {ADMIN_JWT}" \
  "https://{backend-host}/api/board/posts/{postId}/comments/{commentId}"
```

**댓글 삭제 — FRIEND가 타인 댓글 삭제 (403 기대)**
```bash
curl -s -o /dev/null -w "%{http_code}" -X DELETE \
  -H "Authorization: Bearer {FRIEND_JWT_NOT_OWNER}" \
  "https://{backend-host}/api/board/posts/{postId}/comments/{commentId}"
```

### 1.3 프론트 UI 우회 검증 원칙

프론트 라우트 가드(리다이렉트, 버튼 미노출)를 통과하더라도 **API 직접 호출로도 동일한 403/401이 반환되는지** 반드시 별도 확인.

- 프론트 가드 통과 경로: 브라우저에서 직접 URL 입력 → SecurityConfig 레벨 차단 확인
- API 직접 호출 경로: curl/Postman으로 JWT 직접 주입 → 서비스 레벨 소유권 체크 확인

총 권한 케이스 수: 32개 (4 역할 × 8 동작)

---

## 섹션 2. XSS 테스트 케이스 (서버 sanitize 검증)

### 2.1 XSS 입력 케이스 매트릭스

| # | 입력 HTML | 기대 결과 | 검증 방법 |
|---|-----------|----------|----------|
| XSS-01 | `<script>alert(1)</script>` | script 태그 완전 제거. 응답 contentHtml에 script 없음 | API 직접 POST 후 GET 응답 비교 |
| XSS-02 | `<img src=x onerror=alert(1)>` | onerror 속성 제거, img 태그는 src가 R2 prefix 아니므로 img 통째로 제거 | API 직접 POST 후 GET 응답 비교 |
| XSS-03 | `<a href="javascript:alert(1)">link</a>` | href 속성 제거 또는 a 태그 통째 제거 (javascript: 스킴 차단) | API 직접 POST 후 GET 응답 비교 |
| XSS-04 | `<a href="http://evil.com">link</a>` | href 유지 (http 스킴 허용). rel="noopener noreferrer" 강제 부여 확인 | GET 응답에서 rel 속성 확인 |
| XSS-05 | `<img src="http://evil.com/x.jpg">` | 외부 도메인 img 차단 — R2 prefix 아니므로 img 태그 통째 제거 | API 직접 POST 후 GET 응답에 img 없음 확인 |
| XSS-06 | `<iframe src="https://evil.com"></iframe>` | iframe 태그 완전 제거 | API 직접 POST 후 GET 응답 비교 |
| XSS-07 | `<style>body{display:none}</style>` | style 태그 완전 제거 | API 직접 POST 후 GET 응답 비교 |
| XSS-08 | `<svg><script>alert(1)</script></svg>` | svg 내 script 태그 완전 제거. svg 자체도 허용 태그 외이므로 제거 | API 직접 POST 후 GET 응답 비교 |

### 2.2 추가 검증 케이스

| # | 입력 HTML | 기대 결과 |
|---|-----------|----------|
| XSS-09 | `<p onmouseover="alert(1)">text</p>` | onmouseover 속성 제거, p 태그 내용은 유지 |
| XSS-10 | `<a href="data:text/html,<script>alert(1)</script>">link</a>` | data: 스킴 href 제거 |
| XSS-11 | `<img src="data:image/png;base64,iVBOR...">` | data: 이미지 src는 R2 prefix 아니므로 img 통째 제거 |
| XSS-12 | `<p class="ProseMirror-selectednode">text</p>` | class 허용 (ProseMirror-* prefix 화이트리스트) — 태그/클래스 유지 |
| XSS-13 | `<p class="evil-class">text</p>` | 허용 prefix 외 class — class 속성 제거 (p 내용은 유지) |
| XSS-14 | `<object data="..."></object>` | object 태그 완전 제거 |

### 2.3 이중 검증 원칙

- 프론트 에디터를 통한 정상 경로와 **API 직접 POST**(curl) 양쪽 모두 동일한 sanitize 결과를 반환하는지 확인
- 특히 API 직접 호출 시에도 서버 sanitize가 작동해야 함 (프론트 sanitize 우회 시나리오)

### 2.4 댓글 plain text 검증

- 댓글 POST body에 `<script>alert(1)</script>` 포함 시 — 저장/반환 시 HTML 렌더가 아닌 plain text 이스케이프 확인
- 댓글 content는 plain text 필드이므로 GET 응답의 content 필드에 HTML 태그가 그대로 문자열로 노출되어야 함 (렌더 안 됨)
- 프론트 UI에서 댓글 본문의 HTML 태그가 실제 요소로 렌더되지 않는지 확인

총 XSS 케이스 수: 14개

---

## 섹션 3. 대회기록 양식 필수 필드 유효성

### 3.1 필수 필드 누락 에러 코드 매트릭스

| 누락 필드 | 기대 에러 코드 | HTTP 상태 |
|----------|--------------|----------|
| title 없음 (postType: TOURNAMENT) | TITLE_REQUIRED | 400 |
| tournamentDate 없음 | TOURNAMENT_FIELD_MISSING | 400 |
| gameKey 없음 | TOURNAMENT_FIELD_MISSING | 400 |
| difficultyKey 없음 | TOURNAMENT_FIELD_MISSING | 400 |
| winner 없음 | TOURNAMENT_FIELD_MISSING | 400 |
| tournamentData 객체 자체 없음 | TOURNAMENT_FIELD_MISSING | 400 |
| title 빈 문자열 "" | TITLE_REQUIRED | 400 |
| title 101자 초과 | TITLE_REQUIRED (혹은 별도 길이 초과 코드) | 400 |
| winner 빈 문자열 "" | TOURNAMENT_FIELD_MISSING | 400 |
| winner 51자 초과 | TOURNAMENT_FIELD_MISSING (혹은 길이 초과 코드) | 400 |
| tournamentDate 포맷 불일치 (예: "2026/04/24") | TOURNAMENT_FIELD_MISSING | 400 |

비고: api-contract에서 TOURNAMENT_FIELD_MISSING과 TITLE_REQUIRED가 별도 코드로 명시됨. 실제 구현에서 필드별로 세분화되는지 확인 후 에러 코드 재검증.

### 3.2 gameKey/difficultyKey 정상 케이스 매트릭스 (각 1건씩)

| # | gameKey | difficultyKey | 기대 결과 |
|---|---------|--------------|----------|
| GK-01 | minesweeper | beginner | 201 Created |
| GK-02 | minesweeper | intermediate | 201 Created |
| GK-03 | minesweeper | expert | 201 Created |
| GK-04 | baseball | easy | 201 Created |
| GK-05 | baseball | normal | 201 Created |
| GK-06 | baseball | hard | 201 Created |
| GK-07 | blockfall | easy | 201 Created |
| GK-08 | blockfall | normal | 201 Created |
| GK-09 | blockfall | hard | 201 Created |
| GK-10 | blockfall-insane | insane | 201 Created |
| GK-11 | solitaire | draw1 | 201 Created |
| GK-12 | solitaire | draw3 | 201 Created |
| GK-13 | apple | normal | 201 Created |
| GK-14 | sudoku | easy | 201 Created |
| GK-15 | sudoku | normal | 201 Created |
| GK-16 | sudoku | hard | 201 Created |

### 3.3 비정상 gameKey/difficultyKey 케이스

| # | gameKey | difficultyKey | 기대 에러 코드 | HTTP 상태 |
|---|---------|--------------|--------------|----------|
| GK-ERR-01 | unknown_game | easy | INVALID_GAME_KEY | 400 |
| GK-ERR-02 | minesweeper | custom | INVALID_DIFFICULTY_KEY | 400 |
| GK-ERR-03 | blockfall-insane | easy | INVALID_DIFFICULTY_KEY | 400 |
| GK-ERR-04 | blockfall-insane | hard | INVALID_DIFFICULTY_KEY (blockfall-insane의 표기는 insane) | 400 |
| GK-ERR-05 | apple | hard | INVALID_DIFFICULTY_KEY | 400 |
| GK-ERR-06 | solitaire | easy | INVALID_DIFFICULTY_KEY | 400 |
| GK-ERR-07 | (빈 문자열) | easy | INVALID_GAME_KEY | 400 |
| GK-ERR-08 | minesweeper | (빈 문자열) | INVALID_DIFFICULTY_KEY | 400 |

### 3.4 선택 필드 빈 값 허용 확인

| 필드 | 빈 값 전송 방식 | 기대 결과 |
|-----|---------------|----------|
| runnerUp | null 또는 생략 | 201 Created (저장 null) |
| ranking | null 또는 "" | 201 Created |
| participantCount | null 또는 생략 | 201 Created |
| participants | null 또는 "" | 201 Created |
| prize | null 또는 "" | 201 Created |
| sponsor | null 또는 "" | 201 Created |
| contentHtml | null 또는 생략 | 201 Created (TOURNAMENT에서 선택) |

총 에러 코드 매핑 케이스 수: 27개 (섹션 3.1 + 3.3 합산), 정상 케이스 16개

---

## 섹션 4. 에디터 테스트 (UI — 수동)

### 4.1 서식 7종 동작 확인

| 서식 | 입력 방법 | 기대 동작 |
|-----|----------|----------|
| 굵게 (Bold) | 툴바 버튼 또는 Ctrl+B | 선택 텍스트 `<strong>` 래핑 |
| 기울임 (Italic) | 툴바 버튼 또는 Ctrl+I | 선택 텍스트 `<em>` 래핑 |
| 밑줄 (Underline) | 툴바 버튼 또는 Ctrl+U | 선택 텍스트 `<u>` 래핑 |
| 취소선 (Strike) | 툴바 버튼 | 선택 텍스트 `<s>` 래핑 |
| 글머리 목록 (BulletList) | 툴바 버튼 | `<ul><li>` 구조 생성 |
| 번호 목록 (OrderedList) | 툴바 버튼 | `<ol><li>` 구조 생성 |
| 링크 | 툴바 버튼 → URL 입력 | `<a href="..." target="_blank" rel="noopener noreferrer">` 생성 |

### 4.2 이미지 업로드 3경로

| 경로 | 방법 | 기대 동작 |
|-----|------|----------|
| 파일선택 | 툴바 이미지 버튼 → 파일 브라우저 | 업로드 로딩 스피너 노출 → 완료 시 R2 URL로 img 삽입 |
| 드래그앤드롭 | 파일을 에디터 영역으로 드래그 | 위와 동일 |
| 클립보드 붙여넣기 | Ctrl+V (이미지 복사 후) | 위와 동일 |

### 4.3 업로드 중 UX

- 업로드 진행 중 에디터 내 로딩 스피너(또는 placeholder) 노출 확인
- 업로드 완료 시 blob URL → R2 URL 교체 확인

### 4.4 업로드 실패 UX

- 네트워크 오류 시뮬레이션 (개발자 도구 오프라인 전환) → 에디터 내 placeholder 제거 확인 + 토스트 메시지 노출
- 서버 500 응답 시 → 동일 동작

### 4.5 파일 크기 제한 (50MB)

| 케이스 | 방법 | 기대 결과 |
|-------|------|----------|
| 49.9MB 파일 | 파일선택 | 업로드 성공 |
| 50MB 초과 파일 | 파일선택 | 클라이언트 선제 차단 + 에러 메시지 |
| 50MB 초과 파일 API 직접 요청 | curl | 400 FILE_TOO_LARGE |

### 4.6 MIME 불일치 거절

| 케이스 | 설명 | 기대 결과 |
|-------|------|----------|
| .jpg 확장자, 실제 GIF 바이너리 | MIME=image/gif, ext=jpg | 400 MIME_EXTENSION_MISMATCH |
| .png 확장자, 실제 JPEG 바이너리 | MIME=image/jpeg, ext=png | 400 MIME_EXTENSION_MISMATCH |
| .webp 확장자, 실제 PNG 바이너리 | MIME=image/png, ext=webp | 400 MIME_EXTENSION_MISMATCH |

### 4.7 글당 이미지 20장 초과

| 케이스 | 방법 | 기대 결과 |
|-------|------|----------|
| 20장 포함 글 저장 | POST /api/board/posts | 201 Created |
| 21장 포함 글 저장 | POST /api/board/posts | 400 TOO_MANY_IMAGES |
| 글 수정 시 이미지 21장으로 증가 | PUT /api/board/posts/{id} | 400 TOO_MANY_IMAGES |

---

## 섹션 5. 댓글 CRUD + 아바타

### 5.1 댓글 CRUD 케이스

| # | 시나리오 | 기대 결과 |
|---|---------|----------|
| CMT-01 | FRIEND 댓글 작성 (1~1000자 이내) | 201 Created, 응답에 id/author/content/createdAt 포함 |
| CMT-02 | FRIEND 댓글 조회 (글 상세) | 200 OK, comments 배열에 포함 |
| CMT-03 | FRIEND 본인 댓글 삭제 | 200 OK |
| CMT-04 | ADMIN이 FRIEND 댓글 삭제 | 200 OK |
| CMT-05 | FRIEND가 타인 댓글 삭제 시도 | 403 FORBIDDEN |
| CMT-06 | 빈 댓글 (content: "") 작성 | 400 CONTENT_EMPTY |
| CMT-07 | 1001자 댓글 작성 | 400 CONTENT_TOO_LONG |
| CMT-08 | 존재하지 않는 postId에 댓글 작성 | 404 POST_NOT_FOUND |
| CMT-09 | commentId가 해당 postId에 속하지 않는 댓글 삭제 | 400 COMMENT_POST_MISMATCH |
| CMT-10 | 비로그인 댓글 작성 | 401 UNAUTHORIZED |
| CMT-11 | USER 댓글 작성 | 403 FORBIDDEN |

### 5.2 아바타 fallback

| 케이스 | profileImage 상태 | 기대 동작 |
|-------|-----------------|----------|
| profileImage 있음 | 유효한 R2 URL | 이미지 표시 |
| profileImage null | null | 닉네임 첫 글자 원형 fallback 표시 |
| profileImage URL 깨짐 | 404 응답 URL | 닉네임 첫 글자 원형 fallback 표시 (onError 처리) |

### 5.3 댓글 cursor 페이지네이션

| 케이스 | 시나리오 | 기대 결과 |
|-------|---------|----------|
| PAG-01 | 댓글 50개 이하 글 상세 | commentHasNext=false, commentNextCursor=null, 전체 댓글 포함 |
| PAG-02 | 댓글 정확히 50개 글 상세 | commentHasNext=false |
| PAG-03 | 댓글 51개 글 상세 | commentHasNext=true, comments 50개, commentNextCursor 설정됨 |
| PAG-04 | "더 보기" 클릭 → GET /posts/{id}/comments?cursor={cursor} | 51번째 이후 댓글 반환 |
| PAG-05 | 잘못된 cursor 값 전송 | 400 INVALID_CURSOR |

### 5.4 댓글 plain text 검증

- 댓글 본문에 `<b>굵게</b>` 입력 시 GET 응답 content 필드에 문자열 `<b>굵게</b>` 그대로 저장 확인
- 프론트 UI에서 해당 댓글이 HTML 요소로 렌더되지 않고 `<b>굵게</b>` 텍스트로 노출되는지 확인

---

## 섹션 6. 이미지 업로드 API 단독 테스트

### 6.1 권한 매트릭스

| 역할 | 기대 HTTP 상태 |
|-----|--------------|
| 비로그인 | 401 |
| USER | 403 |
| FRIEND | 200 |
| ADMIN | 200 |

### 6.2 허용 확장자 5종 업로드 성공

| 파일 | MIME | 기대 결과 |
|-----|------|----------|
| test.jpg | image/jpeg | 200 OK, { "url": "https://r2-public.../..." } |
| test.jpeg | image/jpeg | 200 OK |
| test.png | image/png | 200 OK |
| test.gif | image/gif | 200 OK |
| test.webp | image/webp | 200 OK |

응답 URL 검증: R2 publicUrl prefix로 시작하는지, board/{userId}/{YYYY}/{MM}/ 경로 구조인지 확인

### 6.3 비허용 확장자 거절

| 파일 | MIME | 기대 에러 코드 |
|-----|------|--------------|
| test.pdf | application/pdf | 400 UNSUPPORTED_EXTENSION |
| test.exe | application/octet-stream | 400 UNSUPPORTED_EXTENSION |
| test.svg | image/svg+xml | 400 UNSUPPORTED_EXTENSION (SVG는 XSS 위험으로 제외) |

### 6.4 MIME-확장자 불일치 케이스

| 파일명 | Content-Type 헤더 | 기대 에러 코드 |
|-------|-----------------|--------------|
| fake.jpg (실제 GIF 바이너리) | image/gif | 400 MIME_EXTENSION_MISMATCH |
| fake.png (실제 JPEG 바이너리) | image/jpeg | 400 MIME_EXTENSION_MISMATCH |

### 6.5 기타 케이스

| 케이스 | 기대 결과 |
|-------|----------|
| 파일 필드 없이 요청 | 400 FILE_EMPTY |
| 50MB 초과 파일 | 400 FILE_TOO_LARGE |
| R2 업로드 서버 내부 오류 (모의) | 500 R2_UPLOAD_FAILED |

---

## 섹션 7. 페이지네이션 & 필터

### 7.1 양식 탭 필터

| 탭 | 쿼리 파라미터 | 기대 결과 |
|---|-------------|----------|
| 전체 | postType 없음 | 모든 postType 글 반환 |
| 대회기록 | postType=TOURNAMENT | TOURNAMENT 글만 반환 |
| 공지 | postType=NOTICE | NOTICE 글만 반환 |
| 자유 | postType=FREE | FREE 글만 반환 |
| 잘못된 값 | postType=INVALID | 400 INVALID_POST_TYPE |

### 7.2 페이지 이동 및 응답 정확성

| 케이스 | 검증 포인트 |
|-------|-----------|
| 1페이지 (page=0, size=20) | content.length <= 20, hasNext 정확성 |
| 2페이지 (page=1, size=20) | 1페이지와 id 중복 없음 |
| 마지막 페이지 | hasNext=false |
| totalCount | 실제 DB 레코드 수와 일치 (탭 필터 적용 시에도) |
| size=50 (max) | content.length <= 50 |
| size=51 (max 초과) | 400 또는 size=50으로 클램프 (구현 확인) |

### 7.3 댓글 더보기 동작 (경계 케이스)

- 댓글 정확히 50개: "더 보기" 버튼 미노출
- 댓글 51개: "더 보기" 버튼 노출, 클릭 시 나머지 1개 반환
- 더 보기 후 hasNext=false이면 버튼 숨김

---

## 섹션 8. 반응형 (기본 — 수동)

### 8.1 브레이크포인트 레이아웃 확인

| 해상도 | 확인 항목 |
|-------|----------|
| 320px (모바일 최소) | 글 목록 카드 레이아웃 붕괴 없음, 텍스트 잘림 없음 |
| 768px (태블릿) | 사이드 여백 적절, 에디터 툴바 줄바꿈 적절 |
| 1280px (데스크톱) | 전체 레이아웃 정상 |

- 가로 스크롤 발생 여부 확인
- 에디터 툴바 아이콘 터치 타겟 44px 이상 확인 (모바일)
- 심화 최적화(성능, 터치 제스처)는 PRD 명시 제외 항목

---

## 섹션 9. 회귀 테스트 (기존 기능 영향)

### 9.1 SecurityConfig 변경 영향

SecurityConfig에 `/api/board/**` 신규 룰 추가로 기존 룰 처리 순서 변경 위험.

| 기존 엔드포인트 | 역할 | 기대 결과 | 검증 방법 |
|-------------|-----|---------|---------|
| GET /api/admin/users | USER 토큰 | 403 유지 | curl |
| GET /api/admin/users | ADMIN 토큰 | 200 유지 | curl |
| GET /api/patch-notes | 비로그인 | 200 (공개) 유지 | curl |
| GET /api/patch-notes | USER 토큰 | 200 (공개) 유지 | curl |
| POST /api/auth/login | 비로그인 | 200 유지 | curl |
| POST /api/rankings/{game} | FRIEND 토큰 | 기존 동작 유지 | curl |

### 9.2 R2 업로드 변경 영향

BoardImageService에 신규 validate 메서드 추가 시 기존 UserService.validateImageFile(5MB 제한)에 영향 없는지 확인.

| 기능 | 검증 포인트 |
|-----|-----------|
| 프로필 이미지 업로드 | PUT /api/users/profile-image — 5MB 제한 그대로 유지 |
| 프로필 이미지 업로드 | 허용 확장자/MIME 기준 변경 없음 |
| 기존 R2 저장 경로 | profiles/{userId}/... 경로 그대로 유지 (board/ 경로와 충돌 없음) |

### 9.3 기존 게임 Smoke Test

신규 SecurityConfig 라인이 게임 랭킹 API 접근에 영향을 주지 않는지 확인.

| 게임 | 확인 API |
|-----|---------|
| 블록폴 인세인 | GET /api/rankings/blockfall-insane?difficulty=hard |
| 블록폴 | GET /api/rankings/blockfall |
| 지뢰찾기 | GET /api/rankings/minesweeper |

---

## 섹션 10. 엣지 케이스

### 10.1 동시 수정 (Concurrency)

| 시나리오 | 기대 결과 |
|---------|----------|
| FRIEND A와 FRIEND B가 동일 글을 동시에 수정 (각자 본인 글) | N/A (PUT은 본인만 수정 가능이므로 동시 수정 대상은 본인 글만) |
| 같은 사용자가 동일 글을 두 탭에서 동시에 수정 제출 | last-write-wins 또는 낙관적 락 동작 확인. 구현 방식을 developer-backend에 확인 후 기대 결과 확정 |

### 10.2 글 삭제 시 댓글 CASCADE

| 시나리오 | 기대 결과 |
|---------|----------|
| 댓글 10개 있는 글 DELETE | 글 삭제 후 해당 글의 댓글 10개도 DB에서 모두 삭제됨 (board_comments FK ON DELETE CASCADE) |
| 삭제된 글의 postId로 댓글 조회 | 404 POST_NOT_FOUND |

### 10.3 긴 입력 처리

| 케이스 | 입력 | 기대 결과 |
|-------|------|----------|
| title 100자 | 100자 문자열 | 201 Created |
| title 101자 | 101자 문자열 | 400 TITLE_REQUIRED (또는 길이 초과 에러) |
| contentHtml 100KB HTML | 100KB HTML 문자열 | 저장 성공 (MEDIUMTEXT 16MB 제한 내) 또는 서버 payload 제한 확인 |
| ranking 2000자 | 2000자 문자열 | 201 Created |
| ranking 2001자 | 2001자 문자열 | 400 TOURNAMENT_FIELD_MISSING (또는 길이 초과 에러) |
| sponsor 200자 | 200자 문자열 | 201 Created |

### 10.4 글 수정 불변 규칙

| 시나리오 | 기대 결과 |
|---------|----------|
| PUT 요청에서 postType 변경 시도 (FREE → TOURNAMENT) | 400 POST_TYPE_IMMUTABLE |
| 삭제된 글 수정 시도 (404 상태의 id) | 404 POST_NOT_FOUND |
| ADMIN이 타인 글 PUT 시도 | 403 NOT_POST_OWNER (ADMIN도 수정 불가) |

### 10.5 세션 만료 시나리오

| 시나리오 | 기대 결과 |
|---------|----------|
| 글 작성 중 JWT 만료 후 제출 | 401 UNAUTHORIZED 반환 |
| 프론트 처리 | 401 수신 시 임시 로컬 저장 후 재로그인 유도 (PRD 12 명시) |

---

## 섹션 11. 자동화 가능 범위

### 11.1 자동화 가능 (Postman/curl 스크립트)

| 섹션 | 자동화 방법 |
|-----|-----------|
| 섹션 1 — 권한 매트릭스 32케이스 | Postman Collection: 4개 역할 × 8 엔드포인트 토큰 교체 반복 |
| 섹션 2 — XSS 14케이스 | 악성 HTML을 body로 POST 후 GET 응답 diff 확인 스크립트 |
| 섹션 3 — 에러 코드 매핑 27케이스 | 필수 필드 누락/비정상 key 조합별 요청 + 응답 코드/error 필드 검증 |
| 섹션 6 — 이미지 업로드 API | 확장자별/MIME 불일치별 curl 배치 스크립트 |
| 섹션 7 — 페이지네이션 | page/size/postType 파라미터 조합 요청 + 응답 구조 검증 |
| 섹션 9 — 회귀 기존 엔드포인트 | 기존 API curl 배치 스크립트 |

### 11.2 수동 검증 필수

| 섹션 | 이유 |
|-----|-----|
| 섹션 4 — 에디터 UI | TipTap 렌더링, DnD, 클립보드 붙여넣기는 브라우저 E2E 필요 |
| 섹션 4.3/4.4 — 업로드 UX 스피너/토스트 | 시각적 확인 필요 |
| 섹션 5.2 — 아바타 fallback 렌더 | 브라우저 렌더링 확인 |
| 섹션 5.4 — 댓글 plain text 렌더 | 브라우저 렌더링 확인 |
| 섹션 8 — 반응형 레이아웃 | 브라우저 dev tools 필요 |

---

## 부록 A. 에러 코드 전체 매핑

api-contract에서 정의된 에러 코드 전체 목록:

| 에러 코드 | HTTP | 발생 위치 |
|----------|------|---------|
| UNAUTHORIZED | 401 | 인증 토큰 없음/만료 |
| FORBIDDEN | 403 | 권한 부족 |
| NOT_POST_OWNER | 403 | 타인 글 수정/삭제 시도 (FRIEND) |
| POST_NOT_FOUND | 404 | 존재하지 않는 글 ID |
| COMMENT_NOT_FOUND | 404 | 존재하지 않는 댓글 ID |
| INVALID_POST_TYPE | 400 | postType 화이트리스트 외 값 |
| TITLE_REQUIRED | 400 | title 필드 누락/빈 값 |
| CONTENT_EMPTY | 400 | contentHtml/comment content 비어있음 |
| TOURNAMENT_FIELD_MISSING | 400 | TOURNAMENT 필수 필드 누락 |
| INVALID_GAME_KEY | 400 | gameKey 화이트리스트 외 값 |
| INVALID_DIFFICULTY_KEY | 400 | difficultyKey 화이트리스트 외 값 |
| TOO_MANY_IMAGES | 400 | 글 내 이미지 20장 초과 |
| POST_TYPE_IMMUTABLE | 400 | 수정 시 postType 변경 시도 |
| CONTENT_TOO_LONG | 400 | 댓글 1000자 초과 |
| COMMENT_POST_MISMATCH | 400 | commentId가 postId에 속하지 않음 |
| INVALID_CURSOR | 400 | cursor 파라미터 형식 오류 |
| FILE_EMPTY | 400 | 파일 필드 없음 |
| FILE_TOO_LARGE | 400 | 50MB 초과 |
| UNSUPPORTED_MIME | 400 | 허용 MIME 외 |
| UNSUPPORTED_EXTENSION | 400 | 허용 확장자 외 |
| MIME_EXTENSION_MISMATCH | 400 | MIME과 확장자 불일치 |
| R2_UPLOAD_FAILED | 500 | R2 업로드 내부 오류 |

총 에러 코드: 22개

---

## 부록 B. 모드 검증 체크

PRD 4절 "모드 적용 범위" 명시: **일반 모드만 지원, Excel 모드 제외**.
Excel 모드 검증은 이번 스코프에서 불필요. 구현 중 Excel 모드 코드가 혼입된 경우 즉시 반려.

---

## 부록 C. 테스트 실행 전제 조건

실제 테스트 실행 시 필요한 사전 준비:
1. 테스트용 FRIEND 계정 2개 (소유권 검증용) + USER 계정 1개 + ADMIN 계정 1개 확보
2. 각 계정의 JWT 발급 방법 확인 (로그인 API POST /api/auth/login)
3. 테스트 환경 R2 publicUrl prefix 값 확인 (XSS-05 이미지 src 검증에 사용)
4. backend 로컬 실행 또는 스테이징 환경 URL 확보
5. 50MB 초과 테스트 파일 준비

---

## 테스트 케이스 수량 요약

| 섹션 | 케이스 수 |
|-----|---------|
| 섹션 1 — 권한 매트릭스 | 32개 |
| 섹션 2 — XSS | 14개 |
| 섹션 3 — 필수 필드 유효성 (에러 코드 매핑) | 27개 (에러) + 16개 (정상) = 43개 |
| 섹션 4 — 에디터 UI | ~20개 |
| 섹션 5 — 댓글 CRUD + 아바타 | 19개 |
| 섹션 6 — 이미지 업로드 API | 16개 |
| 섹션 7 — 페이지네이션 & 필터 | 13개 |
| 섹션 8 — 반응형 | 3개 |
| 섹션 9 — 회귀 | 9개 |
| 섹션 10 — 엣지 케이스 | 14개 |
| 합계 | 약 183개 |
