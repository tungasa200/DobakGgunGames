# 도박군 게시판 — API 계약 초안

문서 소유자: planner
작성일: 2026-04-24
상태: Draft — developer-backend/-frontend 합의 후 확정

본 문서는 `docs/specs/board-community.md` PRD의 구현 계약 초안이다. 백엔드 구현 전 DTO/스키마는 developer-backend가 확정하며, 엔드포인트 경로와 권한은 본 문서 기준.

---

## 1. 공통 규약

- Base URL: `/api`
- 인증: JWT Bearer 토큰 (기존 `JwtAuthenticationFilter` 재사용)
- 권한 패턴:
  - FRIEND 이상 필요: SecurityConfig에 `.requestMatchers(...).hasAnyRole("FRIEND","ADMIN")` 적용
  - ADMIN 전용: 기존 `/api/admin/**` 패턴 유지
- 페이지네이션 응답: `{ content: [...], hasNext: boolean, totalCount: number }` (기존 패치노트 포맷 재사용)
- 시간 필드: ISO-8601 UTC 문자열 (`2026-04-24T10:15:30Z`)
- 에러 응답: `{ "error": "ERROR_CODE", "message": "사용자용 메시지" }`

## 2. 엔드포인트 목록 요약

| Method | Path | 권한 | 설명 |
|---|---|---|---|
| GET | `/api/board/posts` | FRIEND+ | 글 목록 (페이지네이션, 양식 필터) |
| GET | `/api/board/posts/{id}` | FRIEND+ | 글 상세 (댓글 포함) |
| POST | `/api/board/posts` | FRIEND+ | 글 작성 (3양식 통합) |
| PUT | `/api/board/posts/{id}` | 본인 only | 본인 글 수정 |
| DELETE | `/api/board/posts/{id}` | 본인 or ADMIN | 글 삭제 |
| POST | `/api/board/images` | FRIEND+ | 에디터용 이미지 업로드 |
| GET | `/api/board/posts/{id}/comments` | FRIEND+ | 댓글 추가 로드 (cursor 기반) |
| POST | `/api/board/posts/{id}/comments` | FRIEND+ | 댓글 작성 |
| DELETE | `/api/board/posts/{postId}/comments/{commentId}` | 본인 or ADMIN | 댓글 삭제 |

비고: 관리자 전용 "모든 글 강제 삭제"는 일반 DELETE 엔드포인트에서 ADMIN role 체크로 처리하므로 `/api/admin/board/**` 별도 경로는 생성하지 않는다.

## 3. 엔드포인트 상세

### 3.1 GET /api/board/posts — 글 목록

**권한**: FRIEND 이상
**쿼리 파라미터**:
- `postType` (optional): `TOURNAMENT` | `NOTICE` | `FREE` (미지정 시 전체)
- `page` (default 0), `size` (default 20, max 50)
- 정렬: 고정 — `createdAt DESC`

**응답** `200 OK`:
```json
{
  "content": [
    {
      "id": 1,
      "postType": "TOURNAMENT",
      "title": "4월 블록폴 대회",
      "author": {
        "id": 42,
        "nickname": "도박군",
        "profileImage": "https://.../profiles/42/xxx.jpg",
        "role": "FRIEND"
      },
      "commentCount": 7,
      "hasImages": true,
      "createdAt": "2026-04-20T09:00:00Z",
      "updatedAt": "2026-04-20T09:00:00Z"
    }
  ],
  "hasNext": true,
  "totalCount": 57
}
```

### 3.2 GET /api/board/posts/{id} — 글 상세

**권한**: FRIEND 이상
**응답** `200 OK`:
```json
{
  "id": 1,
  "postType": "TOURNAMENT",
  "title": "...",
  "contentHtml": "<p>...</p>",
  "author": { "id": 42, "nickname": "...", "profileImage": "...", "role": "FRIEND" },
  "tournamentData": {
    "tournamentDate": "2026-04-19",
    "gameKey": "blockfall",
    "difficultyKey": "hard",
    "winner": "A",
    "runnerUp": "B",
    "ranking": "1위: A / 2위: B / ...",
    "participantCount": 8,
    "participants": "A, B, C, D, E, F, G, H",
    "prize": "스타벅스 기프티콘",
    "sponsor": "도박군 프로젝트"
  },
  "comments": [
    {
      "id": 100,
      "author": { "id": 5, "nickname": "...", "profileImage": "...", "role": "FRIEND" },
      "content": "좋은 대회였습니다",
      "createdAt": "2026-04-20T10:00:00Z"
    }
  ],
  "commentTotalCount": 7,
  "commentHasNext": false,
  "commentNextCursor": null,
  "createdAt": "2026-04-20T09:00:00Z",
  "updatedAt": "2026-04-20T09:00:00Z"
}
```
- `tournamentData`: `postType == TOURNAMENT`일 때만 non-null
- NOTICE/FREE는 `tournamentData: null`
- `comments`: 초기 로드 시 작성 시각 오름차순으로 **최대 50개** 포함. 총 댓글 수가 50개 이하이면 전부 반환하고 `commentHasNext=false`. 초과 시 50개 반환 후 `commentHasNext=true`, `commentNextCursor`에 이후 조회용 커서 설정.

**에러**: `404 POST_NOT_FOUND`

### 3.3 POST /api/board/posts — 글 작성

**권한**: FRIEND 이상
**요청**:
```json
{
  "postType": "TOURNAMENT | NOTICE | FREE",
  "title": "string (1-100)",
  "contentHtml": "string (sanitize 대상)",
  "tournamentData": {
    "tournamentDate": "YYYY-MM-DD",
    "gameKey": "minesweeper|baseball|blockfall|solitaire|apple|sudoku",
    "difficultyKey": "string (게임별 화이트리스트)",
    "winner": "string (1-50, required)",
    "runnerUp": "string (0-50, optional)",
    "ranking": "string (0-2000, optional)",
    "participantCount": "number (1-999, optional)",
    "participants": "string (0-1000, optional)",
    "prize": "string (0-500, optional)",
    "sponsor": "string (0-200, optional)"
  }
}
```

**검증 규칙**:
- `postType == TOURNAMENT`: `tournamentData` 필수, 필수 필드 4개(tournamentDate/gameKey/difficultyKey/winner) 검증, `contentHtml`은 선택
- `postType == NOTICE | FREE`: `tournamentData`는 무시, `contentHtml` 필수 (sanitize 후 비어있지 않아야 함)
- `gameKey`/`difficultyKey` 화이트리스트 매트릭스 (PRD 6.5 참조) 위반 시 400
- 본문 `<img>` 태그 개수 > 20 → 400 `TOO_MANY_IMAGES`
- 본문 `<img src>`가 R2 publicUrl prefix로 시작하지 않으면 서버가 sanitize 단계에서 제거

**응답** `201 Created`: 생성된 글 상세 (3.2와 동일 스키마)

**에러 코드**:
- `400 INVALID_POST_TYPE`, `400 TITLE_REQUIRED`, `400 CONTENT_EMPTY`, `400 TOURNAMENT_FIELD_MISSING`, `400 INVALID_GAME_KEY`, `400 INVALID_DIFFICULTY_KEY`, `400 TOO_MANY_IMAGES`
- `401 UNAUTHORIZED`, `403 FORBIDDEN`

### 3.4 PUT /api/board/posts/{id} — 글 수정

**권한**: 작성자 본인만 (ADMIN도 수정 불가 — PRD 5 권한 매트릭스)
**요청**: POST와 동일 스키마 (postType 변경 불가 — 변경 시 400)
**응답** `200 OK`: 수정된 글 상세
**에러**: `403 NOT_POST_OWNER`, `400 POST_TYPE_IMMUTABLE`, `404 POST_NOT_FOUND`

### 3.5 DELETE /api/board/posts/{id} — 글 삭제

**권한**: 작성자 본인 OR ADMIN
**응답** `200 OK`: `{ "message": "글이 삭제되었습니다" }`
**에러**: `403 FORBIDDEN`, `404 POST_NOT_FOUND`
**삭제 방식**: Hard delete. 하위 댓글도 cascade 삭제. R2 이미지는 이번 스코프에서 정리하지 않음 (고아 이미지는 별도 배치 이관).

### 3.6 POST /api/board/images — 에디터용 이미지 업로드

**권한**: FRIEND 이상
**요청**: `multipart/form-data`, 필드명 `file`
**검증** (`BoardImageService.validate` 신규 메서드):
- 파일 null/empty 차단
- MIME: `image/jpeg | image/png | image/gif | image/webp` 외 거부
- 확장자 화이트리스트: `jpg, jpeg, png, gif, webp`
- 용량: 50MB 이하
- MIME과 확장자 교차 검증 (스푸핑 방지)

**R2 저장**: key = `board/{userId}/{YYYY}/{MM}/{UUID}.{ext}`, contentType은 원본 MIME 사용 (프로필처럼 JPEG 강제 변환 없음)

**응답** `200 OK`:
```json
{ "url": "https://r2-public.../board/42/2026/04/xxx.png" }
```

**에러 코드**:
- `400 FILE_EMPTY`, `400 FILE_TOO_LARGE`, `400 UNSUPPORTED_MIME`, `400 UNSUPPORTED_EXTENSION`, `400 MIME_EXTENSION_MISMATCH`
- `500 R2_UPLOAD_FAILED`

### 3.7-pre GET /api/board/posts/{id}/comments — 댓글 추가 로드 (cursor 기반)

**권한**: FRIEND 이상
**쿼리 파라미터**:
- `cursor` (optional): 직전 응답의 `commentNextCursor` 값. 미지정 시 처음부터 조회.
- `size` (default 50, max 100)

**cursor 정의**: 직전 페이지 마지막 댓글의 `id` 문자열. 서버는 `WHERE comment.id > :cursor ORDER BY id ASC LIMIT size+1` 방식으로 조회(댓글 작성 시각 오름차순 = id 오름차순 가정, 동일 post_id 내에서 안전).

**응답** `200 OK`:
```json
{
  "content": [
    {
      "id": 101,
      "author": { "id": 6, "nickname": "...", "profileImage": "...", "role": "FRIEND" },
      "content": "...",
      "createdAt": "2026-04-20T10:05:00Z"
    }
  ],
  "hasNext": true,
  "nextCursor": "150"
}
```
**에러**: `404 POST_NOT_FOUND`, `400 INVALID_CURSOR`

비고: 글 상세(`GET /api/board/posts/{id}`) 초기 응답에 이미 최대 50개 댓글이 포함되므로, 본 엔드포인트는 "더 보기" 클릭 시에만 호출된다.

### 3.7 POST /api/board/posts/{id}/comments — 댓글 작성

**권한**: FRIEND 이상
**요청**:
```json
{ "content": "string (1-1000)" }
```
**응답** `201 Created`:
```json
{
  "id": 100,
  "postId": 1,
  "author": { "id": 5, "nickname": "...", "profileImage": "...", "role": "FRIEND" },
  "content": "...",
  "createdAt": "2026-04-24T10:15:30Z"
}
```
**에러**: `400 CONTENT_EMPTY`, `400 CONTENT_TOO_LONG`, `404 POST_NOT_FOUND`

### 3.8 DELETE /api/board/posts/{postId}/comments/{commentId} — 댓글 삭제

**권한**: 댓글 작성자 본인 OR ADMIN
**응답** `200 OK`: `{ "message": "댓글이 삭제되었습니다" }`
**에러**: `403 FORBIDDEN`, `404 COMMENT_NOT_FOUND`, `400 COMMENT_POST_MISMATCH` (commentId가 해당 postId에 속하지 않을 때)

## 4. DB 스키마 초안

### 4.1 board_posts

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT | PK, AUTO_INCREMENT | |
| post_type | VARCHAR(20) | NOT NULL | `TOURNAMENT` / `NOTICE` / `FREE` |
| title | VARCHAR(100) | NOT NULL | |
| content_html | MEDIUMTEXT | NULL | sanitize된 HTML (TOURNAMENT는 nullable) |
| author_id | BIGINT | NOT NULL, FK users(id) | |
| tournament_date | DATE | NULL | TOURNAMENT일 때만 사용 |
| game_key | VARCHAR(30) | NULL | TOURNAMENT 필수 |
| difficulty_key | VARCHAR(20) | NULL | TOURNAMENT 필수 |
| winner | VARCHAR(50) | NULL | TOURNAMENT 필수 |
| runner_up | VARCHAR(50) | NULL | |
| ranking | VARCHAR(2000) | NULL | |
| participant_count | INT | NULL | |
| participants | VARCHAR(1000) | NULL | |
| prize | VARCHAR(500) | NULL | |
| sponsor | VARCHAR(200) | NULL | |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |
| updated_at | DATETIME | NOT NULL, ON UPDATE CURRENT_TIMESTAMP | |

**인덱스**:
- `idx_board_posts_created_at` (created_at DESC) — 목록 정렬
- `idx_board_posts_type_created` (post_type, created_at DESC) — 양식 필터 목록
- `idx_board_posts_author` (author_id) — 작성자 기준 조회

**정규화 판단**: TOURNAMENT 필드를 별도 테이블(board_tournament_details)로 분리하는 대안이 있으나, PRD상 1:1 관계이고 조회 시 항상 함께 필요하므로 **단일 테이블 + NULL 허용**으로 시작. 스키마가 커지면 별도 테이블로 리팩터링.

### 4.2 board_comments

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| id | BIGINT | PK, AUTO_INCREMENT | |
| post_id | BIGINT | NOT NULL, FK board_posts(id) ON DELETE CASCADE | |
| author_id | BIGINT | NOT NULL, FK users(id) | |
| content | VARCHAR(1000) | NOT NULL | |
| created_at | DATETIME | NOT NULL, DEFAULT CURRENT_TIMESTAMP | |

**인덱스**:
- `idx_board_comments_post_created` (post_id, created_at ASC) — 상세 조회 정렬

**대댓글 미지원**: parent_comment_id 컬럼 생성하지 않음. 추후 요청 시 추가.

## 5. SecurityConfig 변경 요약

기존 SecurityConfig에 아래 라인 추가 필요 (developer-backend가 구현):

```
// 게시판 — FRIEND 이상 필요
.requestMatchers(HttpMethod.GET, "/api/board/posts", "/api/board/posts/**").hasAnyRole("FRIEND","ADMIN")
.requestMatchers(HttpMethod.POST, "/api/board/posts", "/api/board/images").hasAnyRole("FRIEND","ADMIN")
.requestMatchers(HttpMethod.POST, "/api/board/posts/*/comments").hasAnyRole("FRIEND","ADMIN")
.requestMatchers(HttpMethod.PUT, "/api/board/posts/*").hasAnyRole("FRIEND","ADMIN")
.requestMatchers(HttpMethod.DELETE, "/api/board/posts/*", "/api/board/posts/*/comments/*").hasAnyRole("FRIEND","ADMIN")
```
- 본인/ADMIN 구분(소유권 체크)은 컨트롤러/서비스 레이어에서 수행
- `hasAnyRole` 사용은 기존 패턴에 없으므로 도입 시 SecurityConfig 주석 보강 권장

## 6. 신규 의존성 (Backend)

- **HTML Sanitizer**: **OWASP Java HTML Sanitizer 확정** (`com.googlecode.owasp-java-html-sanitizer`). 정확한 GAV/버전은 developer-backend 구현 플랜에서 확정.
- 기타 신규 의존성 없음 (R2 연동·JWT·JPA 기존 재사용).

## 7. 환경변수

- 신규 환경변수 추가 없음. 기존 R2 설정 (`app.r2.endpoint`, `app.r2.bucket`, `app.r2.publicUrl` 등) 재사용.

## 8. 마이그레이션

- `backend/src/main/resources/db/migration/` (기존 마이그레이션 경로 확인 필요) — developer-backend가 `V{n}__create_board_tables.sql` 작성. 현재 Liquibase/Flyway 사용 여부는 backend 담당자가 확정.

## 9. 오픈 퀘스천 (백엔드 확정 필요)

1. 마이그레이션 도구: 기존 프로젝트에 Flyway/Liquibase가 설정되어 있는지 backend 담당자 확인 후 스타일 맞추기.
2. 글 삭제 시 첨부 이미지 R2 정리 여부: 현재 **정리 안 함** (고아 이미지). 향후 수동 정리 도구 별도 논의.
