# 도박군 게시판 (Board Community) — PRD

문서 소유자: planner
작성일: 2026-04-24
상태: Draft (Phase 1 조사 + 사용자 답변 반영 완료, 개발 착수 대기)

---

## 1. 개요

DobakGgun Games 내부에 "도박군 등급(FRIEND)" 이상 사용자만 접근할 수 있는 커뮤니티 게시판을 신설한다. 3가지 글 양식(대회기록 / 공지 / 자유)을 지원하며, 리치 텍스트 에디터(TipTap)와 이미지 업로드(R2)를 포함한다. 댓글은 아바타 표시와 함께 제공되며, 본인 삭제 + ADMIN 전체 삭제가 가능하다.

## 2. 목표 & 성공 기준 (Acceptance Criteria)

- FRIEND 이상 사용자가 게시판에 접근하여 3가지 양식으로 글을 작성/수정/삭제할 수 있다.
- USER/비로그인 사용자는 게시판 URL 접근 시 리다이렉트 또는 403으로 차단된다.
- 대회기록 양식은 정형 필드 4개(필수) + 7개(선택)로 구성되며, 게임종류 필드는 2단계 드롭다운(게임명 + 난이도)으로 선택한다.
- 에디터에서 붙여넣기/드래그앤드롭/파일선택으로 이미지를 업로드할 수 있으며, 업로드된 이미지 URL이 본문 HTML에 즉시 삽입된다.
- 서버가 저장 전 HTML sanitize를 수행하여 `<script>`, 인라인 이벤트 핸들러, `javascript:` URL이 모두 제거된다.
- 댓글 작성은 FRIEND 이상만 가능하며, 본인 댓글은 본인이 삭제, ADMIN은 모든 댓글을 삭제할 수 있다.
- 글 목록은 페이지네이션되며 기존 `{content, hasNext, totalCount}` 포맷을 따른다.

## 3. 타겟 유저

- **1차**: FRIEND 등급을 받은 지인/단골 유저 — 대회기록 공유, 공지 전달, 자유 담소
- **2차**: ADMIN — 모든 글/댓글 모더레이션 권한
- **제외**: USER 등급, 비로그인 — 게시판 기능 완전 비노출

## 4. 모드 적용 범위

- **일반 모드만** 지원. Excel UI 모드는 이번 스코프에서 제외.
- 향후 Excel 모드 확장 요청 시 별도 PRD로 재계획.

## 5. 권한 매트릭스

| 동작 | 비로그인 | USER | FRIEND | ADMIN |
|---|---|---|---|---|
| 게시판 접근(목록 열람) | X | X | O | O |
| 글 상세 조회 | X | X | O | O |
| 자유 글 작성 | X | X | O | O |
| 공지 글 작성 | X | X | O | O |
| 대회기록 글 작성 | X | X | O | O |
| 에디터 이미지 업로드 | X | X | O | O |
| 본인 글 수정 | X | X | O | O |
| 본인 글 삭제 | X | X | O | O |
| 타인 글 수정 | X | X | X | X (수정 불가, 삭제만) |
| 타인 글 삭제 | X | X | X | O |
| 댓글 작성 | X | X | O | O |
| 본인 댓글 삭제 | X | X | O | O |
| 타인 댓글 삭제 | X | X | X | O |

비고: ADMIN은 "모든 글/댓글 삭제"만 가능하며, 타인 글 본문 수정은 불가(이력 보존 원칙).

## 6. 글 양식 3종 상세 스펙

### 6.1 공통 필드

- `id`, `postType` (TOURNAMENT/NOTICE/FREE), `title`, `authorId`, `createdAt`, `updatedAt`
- `contentHtml` (sanitize된 HTML) — TOURNAMENT는 선택, NOTICE/FREE는 필수
- 수정 시 `updatedAt` 갱신, 본문에 "수정됨" 표시 플래그 노출

### 6.2 자유 (FREE)

- 필수: `title` (1~100자), `contentHtml` (sanitize 후 비어있지 않아야 함)
- 에디터 기반 본문 작성, 이미지 삽입 허용

### 6.3 공지 (NOTICE)

- 필수: `title` (1~100자), `contentHtml`
- 작성자: **FRIEND 이상 누구나** (ADMIN 전용 아님 — 사용자 지시 반영)
- 목록에서 최상단 고정 여부: 이번 스코프에서는 **고정 기능 없음** (별도 요청 시 추가)

### 6.4 대회기록 (TOURNAMENT)

**필수 필드 (4개)**
- `title` — 대회 제목 (1~100자)
- `tournamentDate` — 대회 날짜 (YYYY-MM-DD)
- `gameKey` + `difficultyKey` — 게임종류 2뎁스 드롭다운 (아래 6.5 참조)
- `winner` — 우승자 (1~50자, 자유 텍스트)

**선택 필드 (7개)**
- `runnerUp` — 준우승자 (1~50자)
- `ranking` — 순위 표 (자유 텍스트 multi-line, 최대 2000자) — 예: "1위: A / 2위: B / 3위: C"
- `participantCount` — 참가인원수 (양의 정수, 1~999)
- `participants` — 참가자 명단 (자유 텍스트, 콤마 구분, 최대 1000자)
- `prize` — 상품 (자유 텍스트, 최대 500자) **[사용자 강조 필수 포함]**
- `sponsor` — 스폰서 (자유 텍스트, 최대 200자) **[사용자 강조 필수 포함]**
- `contentHtml` — 상세/후기 에디터 본문 (선택)

**제외된 필드**
- 대회장소 (오프라인/온라인 구분) — 사용자 지시로 제외

### 6.5 게임종류 드롭다운 (2뎁스)

**1뎁스: 게임 (7종)** — blockfall-insane은 로그인한 유저 누구나 접근 가능한 게임이므로 대회기록 옵션에 포함 (사용자 확정)
- `minesweeper` — 지뢰찾기
- `baseball` — 숫자야구
- `blockfall` — 블록폴
- `blockfall-insane` — 블록폴: 인세인
- `solitaire` — 솔리테어
- `apple` — 사과게임
- `sudoku` — 스도쿠

**2뎁스: 난이도** — 게임별로 다름 (프론트 실제 코드 기준)

| 게임 | 난이도 옵션 (key / 표시명) |
|---|---|
| minesweeper | `beginner` 초급 / `intermediate` 중급 / `expert` 고급 (※ custom은 제외 — 랭킹 불가와 동일 방침) |
| baseball | `easy` 쉬움(3자리) / `normal` 보통(4자리) / `hard` 어려움(5자리) |
| blockfall | `easy` 쉬움 / `normal` 보통 / `hard` 어려움 |
| blockfall-insane | `insane` 인세인 (고정) — 프론트 코드상 `hard` 고정이지만 대회기록 표기는 `insane` 단일 옵션으로 노출 |
| solitaire | `draw1` 드로우1 / `draw3` 드로우3 |
| apple | `normal` 기본 (고정) |
| sudoku | `easy` 초급 / `normal` 중급 / `hard` 고급 |

설계 원칙: 프론트는 위 매트릭스를 상수로 보유하며, 게임 선택 시 해당 게임의 난이도 옵션만 2뎁스 드롭다운에 노출. 백엔드는 `gameKey`/`difficultyKey` 문자열을 그대로 저장(검증은 화이트리스트 방식).

blockfall-insane 항목 분리 근거: 프론트 라우팅(`/blockfall-insane`)과 `GAME_NAMES` 테이블에서 이미 별도 gameKey로 등록되어 있고, 난이도 구조(단일 `hard` 고정)와 랭킹 API 분기가 기존 blockfall과 독립되어 있어 **별도 게임 항목으로 분리**하는 것이 현행 코드 구조와 일치함.

## 7. 에디터 (TipTap)

### 7.1 라이브러리 선정 확정

- **TipTap** (React 19 공식 지원, TypeScript 완벽)
- 정확한 패키지명/버전은 developer-frontend 구현 플랜 단계에서 확정. PRD는 라이브러리명만 고정.

### 7.2 필수 확장 기능

- 서식: Bold, Italic, Underline, Strike, Heading (H2/H3), BulletList, OrderedList, Blockquote, CodeBlock(인라인), HorizontalRule
- 링크: URL 삽입 (새 창 열기 속성 포함) — `javascript:` 스킴은 프론트·백엔드 양쪽에서 차단
- 이미지: Image 확장 — 붙여넣기/드래그앤드롭/파일선택 3경로 모두 지원
- 실행취소/재실행

### 7.3 제외 기능

- 표(Table), 수식, 임베드(YouTube/Twitter 등), 대댓글, 좋아요 — 이번 스코프 제외

### 7.4 이미지 업로드 플로우

1. 사용자 액션(paste / DnD / 파일선택) → 프론트에서 즉시 임시 blob URL로 미리보기
2. 병렬로 `POST /api/board/images` 멀티파트 업로드 요청
3. 업로드 성공 시 응답 URL을 에디터 본문 이미지 src로 교체
4. 업로드 실패 시 에디터에서 해당 이미지 제거 + 사용자 토스트

## 8. 이미지 업로드 정책

- **파일당 최대**: 50MB
- **글당 최대 이미지 개수**: 20장 (게시글 저장 시 본문 내 `<img>` 태그 count로 검증)
- **허용 확장자**: jpg, jpeg, png, gif, webp (확장자 + MIME 이중 검증)
- **허용 MIME**: `image/jpeg`, `image/png`, `image/gif`, `image/webp`
- **검증 로직**: `BoardImageService`에 **신규 validate 메서드** 작성. 기존 `UserService.validateImageFile` (5MB 제한)은 **재사용하지 않음**.
- **R2 저장 경로**: `board/{userId}/{YYYY}/{MM}/{UUID}.{ext}` — 연월 파티셔닝으로 운영 편의
- **공개 URL**: `R2 publicUrl + "/" + key` (프로필 이미지와 동일 규칙)
- **고아 이미지 정리**: 이번 스코프 **제외** (자동 정리 미지원). 향후 **수동 정리 도구(운영자용 CLI/스크립트)** 필요 시 별도 논의.
- **리사이즈**: 이번 스코프에서는 **원본 그대로 저장** (50MB 상한 내). 향후 요청 시 리사이즈 파이프라인 추가.

## 9. HTML Sanitize 정책 (서버 사이드 필수)

### 9.1 허용 태그 화이트리스트

`p, br, h2, h3, h4, strong, b, em, i, u, s, ul, ol, li, blockquote, pre, code, hr, a, img, span, div`

### 9.2 허용 속성

- 공통: `class` (TipTap 생성 클래스 한정 — 화이트리스트 prefix 예: `ProseMirror-*`, `tiptap-*`)
- `a`: `href` (http/https만), `target` (`_blank` 한정), `rel` (`noopener noreferrer` 강제 부여)
- `img`: `src` (우리 R2 publicUrl로 시작하는 URL만 허용), `alt`, `width`, `height`
- 나머지 태그: 속성 없음 (인라인 style 전면 제거)

### 9.3 차단 대상 (명시)

- `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, `<form>`, `<input>`, `<link>`, `<meta>`
- 인라인 이벤트 핸들러: `onerror`, `onload`, `onclick`, `onmouseover` 등 모든 `on*` 속성
- `javascript:`, `data:` (이미지 제외), `vbscript:` 스킴 URL
- 외부 도메인 이미지 `src` (R2 publicUrl 외부는 서버가 저장 시 `<img>` 통째로 제거)

### 9.4 검증 시점

- 글 작성/수정 API 저장 직전에 서버에서 sanitize 수행 → sanitize된 결과를 DB에 저장
- 클라이언트 sanitize는 보조 수단일 뿐, **서버 sanitize가 단일 신뢰 지점 (single source of truth)**

## 10. 댓글 정책

- 작성 권한: FRIEND 이상
- 최대 길이: 1000자 (plain text, 리치 텍스트 아님)
- 표시 요소: 작성자 아바타(User.profileImage, 없으면 기본 이미지), 닉네임, 본문, 작성시각(상대시간 + 툴팁 절대시각)
- 정렬: 작성 시각 오름차순 (오래된 것부터)
- 페이지네이션:
  - 글 상세 초기 로드 시 댓글 **최대 50개까지 한 번에 반환** (50개 이하면 전체 로드)
  - 댓글이 50개를 초과할 경우 "더 보기" 버튼 노출 → `GET /api/board/posts/{id}/comments?cursor=...` 로 추가 로드
  - 정렬 기준은 작성 시각 오름차순 유지 (cursor는 댓글 id 또는 createdAt 기반, API 계약에서 확정)
- 삭제: 본인 삭제 O, ADMIN 전체 삭제 O, 그 외 전부 X
- 삭제 방식: **Hard delete** (이번 스코프). 복구 기능 없음.
- 대댓글: 제외
- 좋아요: 제외

## 11. UX 플로우 (개괄)

1. 헤더 네비에 "도박군 게시판" 메뉴 추가 — FRIEND 이상에게만 표시
2. `/board` 접근 → 글 목록 (최신순 페이지네이션) + 양식별 필터 탭 (전체 / 대회기록 / 공지 / 자유)
3. "글쓰기" 버튼 → 양식 선택 모달 → 3종 양식 페이지 이동
4. 글 상세 `/board/{postId}` → 본문 + 댓글 리스트 + 댓글 입력 (FRIEND 이상만 입력 폼 노출)
5. 본인 글은 상세 페이지에서 "수정 / 삭제" 버튼 노출, ADMIN은 모든 글에 "삭제" 버튼 노출

※ 세부 컴포넌트/스타일 명세는 designer가 `docs/design/board-community.md`에 작성.

## 12. 엣지 케이스 & 에러 시나리오

- USER/비로그인 `/board` 접근 → 로그인 페이지 리다이렉트 (이미 로그인된 USER는 홈으로)
- 글 작성 중 세션 만료 → 저장 시 401 → 프론트에서 임시 로컬 저장 후 재로그인 유도
- 이미지 업로드 중 네트워크 실패 → 에디터 내 해당 이미지 플레이스홀더 제거 + 토스트
- 용량 초과 이미지 업로드 시도 → 프론트 선제 차단 + 백엔드 400 이중 방어
- 글당 이미지 21장 시도 → 저장 시 400 "이미지는 최대 20장까지 삽입 가능"
- 허용 외 확장자 업로드 시도 → 400 "지원하지 않는 이미지 형식"
- 본인이 작성한 글을 ADMIN이 먼저 삭제한 후 본인이 수정 시도 → 404 "글이 존재하지 않습니다"
- Sanitize로 본문이 완전히 제거되어 빈 HTML이 된 경우 → 400 "본문 내용이 비어있습니다"
- 대회기록 작성 시 필수 4개 필드 중 하나라도 누락 → 400 필드별 에러 메시지
- 게임종류/난이도 값이 화이트리스트에 없음 → 400 "유효하지 않은 게임/난이도"

## 13. 제외 항목 (Out of Scope)

- 대댓글, 좋아요/반응, 글 고정(공지 상단 고정), 검색, 해시태그
- 고아 이미지 정리 배치
- 모바일 심화 최적화 (기본 반응형만)
- Excel UI 모드 대응
- 알림 (새 댓글/멘션 등)

## 14. 성공 지표 (릴리스 후 관측 항목)

- 게시판 월간 활성 FRIEND 사용자 수
- 글 작성 건수 (양식별 분포)
- 댓글 작성 건수
- 이미지 업로드 실패율 (5% 미만 유지 목표)
- Sanitize 차단 이벤트 로그 수 (운영 모니터링 지표)

## 15. 오픈 퀘스천

1. 글 작성자가 USER로 등급이 강등된 경우 기존 글의 표시 정책 — 현재 기본안은 "글은 유지, 작성자 표시는 닉네임만". 추후 요청 시 정책 확정.
2. 공지 글에 "고정" 기능 추가 여부 — 현재 스코프 제외.

## 16. 참조 문서

- API 계약 초안: `docs/specs/board-api-contract.md`
- 진행 로그: `docs/progress/planner-board-community.md`
- 디자인 명세: `docs/design/board-community.md` (designer 작성 예정)
