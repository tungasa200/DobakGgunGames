# 도박군 게시판 — UX 명세

문서 소유자: designer
작성일: 2026-04-24
상태: 작성 완료 — developer-frontend 인계 대기
모드 적용 범위: 일반 모드 전용 (Excel 모드 제외 확정)

---

## 1. 전체 IA (Information Architecture)

### 1.1 라우트 구조

```
/board                          게시글 목록 (FRIEND+만 접근)
/board/new?type=TOURNAMENT      대회기록 작성
/board/new?type=NOTICE          공지 작성
/board/new?type=FREE            자유 작성
/board/:id                      게시글 상세
/board/:id/edit                 게시글 수정 (본인 only)
```

### 1.2 각 페이지 구조 요약

| 페이지 | 헤더 영역 | 필터/컨트롤 | 메인 콘텐츠 |
|---|---|---|---|
| `/board` | NormalHeader + 페이지 제목 "도박군 게시판" | 양식 탭 필터 + 글쓰기 CTA | 게시글 카드 목록 + 페이지네이션 |
| `/board/new` | NormalHeader + 뒤로가기 | 양식 배지(읽기 전용) | 양식별 입력 필드 + 에디터 + 제출 버튼 |
| `/board/:id` | NormalHeader + 뒤로가기 | - | 정형 카드(TOURNAMENT) + HTML 본문 + 작성자/날짜 + 수정·삭제 버튼 + 댓글 영역 |
| `/board/:id/edit` | NormalHeader + 뒤로가기 | 양식 배지(읽기 전용) | 작성 페이지와 동일 레이아웃, 기존 데이터 프리필 |

---

## 2. 목록 페이지 (`/board`)

### 2.1 레이아웃

```
┌──────────────────────────────────────────────────────┐
│ NormalHeader                                         │
├──────────────────────────────────────────────────────┤
│ [페이지 타이틀: 도박군 게시판]          [글쓰기 버튼] │
│                                                      │
│ [전체] [대회기록] [공지] [자유]                      │
├──────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────────────────┐  │
│ │ [TOURNAMENT 배지]  제목 텍스트          [댓글 3] │  │
│ │ 아바타  닉네임  ·  2026-04-20                   │  │
│ └─────────────────────────────────────────────────┘  │
│ (반복)                                               │
├──────────────────────────────────────────────────────┤
│ < 이전  1  2  3 … 다음 >  (또는 totalCount 기반)    │
├──────────────────────────────────────────────────────┤
│ Footer                                               │
└──────────────────────────────────────────────────────┘
```

### 2.2 탭 필터

- 탭: **전체 / 대회기록 / 공지 / 자유** (4개)
- 선택된 탭: 하단 underline + 텍스트 color #2c3e50 (진하게)
- 비선택 탭: color #94a3b8
- 탭 전환 시 URL 쿼리 `?type=TOURNAMENT|NOTICE|FREE` 반영 (전체는 파라미터 없음)
- 탭 전환 시 목록 첫 페이지(page=0)로 초기화

### 2.3 게시글 카드

각 카드는 클릭 시 `/board/:id`로 이동.

```
┌──────────────────────────────────────────────────────────┐
│  [배지]  제목 (최대 2줄 말줄임)              [댓글 수 배지] │
│  [아바타 32px]  닉네임  ·  2026-04-20                    │
└──────────────────────────────────────────────────────────┘
```

**카드 구성 요소:**
- **양식 배지**: 좌측 상단 인라인 — TOURNAMENT/NOTICE/FREE 각 색상 구분 (섹션 8 참조)
- **제목**: font-size 15px, font-weight 600, color #0f172a, 2줄 초과 시 `…` 말줄임
- **댓글 수 배지**: 우측 상단 — 말풍선 아이콘 + 숫자, color #94a3b8, font-size 13px
- **아바타**: 32×32px 원형
  - `profileImage` 있으면 `<img>` (object-fit: cover)
  - 없으면 닉네임 첫 글자 원형 fallback (ProfilePage 패턴 동일 — background: `linear-gradient(135deg, #aa3bff, #7b2bd4)`, 흰색 텍스트)
- **닉네임**: font-size 13px, color #475569
- **작성일**: font-size 13px, color #94a3b8, 형식 `YYYY-MM-DD`
- **카드 구분선**: border-bottom 1px solid #f1f5f9

**카드 호버 상태:**
- background: #f8fafc
- 전환: transition 0.15s

### 2.4 "글쓰기" CTA 버튼

- **표시 조건**: 로그인 사용자 role이 FRIEND 또는 ADMIN인 경우만 렌더링
- 위치: 페이지 제목 우측 (데스크톱), 탭 필터 하단 우측 정렬 (모바일)
- 스타일: background #2c3e50, color white, border-radius 8px, padding 8px 18px, font-size 14px
- **클릭 동작**: 양식 선택 모달 표시

### 2.5 양식 선택 모달

클릭 시 오버레이 모달 표시. 중앙 정렬.

```
┌─────────────────────────────┐
│  글 양식을 선택하세요         │
│  ─────────────────────────  │
│  [대회기록]   대회 결과 공유  │
│  [공지]       공지사항 작성   │
│  [자유]       자유롭게 이야기 │
│                   [취소]    │
└─────────────────────────────┘
```

- 각 항목 클릭 → `/board/new?type=TOURNAMENT|NOTICE|FREE` 이동
- 취소 또는 오버레이 클릭 → 모달 닫기
- 모달 배경: rgba(0,0,0,0.4) 오버레이
- 모달 카드: background white, border-radius 14px, padding 28px 32px, max-width 400px

### 2.6 페이지네이션

응답 포맷: `{ content, hasNext, totalCount }`

- `totalCount`를 size(20)로 나눠 총 페이지 수 계산
- 표시: `< 이전` / 페이지 번호 / `다음 >`
- 현재 페이지 번호: font-weight 700, color #2c3e50
- 비활성 버튼(첫 페이지 이전, 마지막 페이지 다음): opacity 0.4, pointer-events none
- 번호가 7개 초과 시: `1 … 4 5 6 … 10` 형태로 압축

### 2.7 빈 목록 상태

- 탭 필터 결과가 없을 때: "아직 게시글이 없습니다" — color #94a3b8, font-size 14px, 중앙 정렬
- 로딩 중: 카드 자리에 스켈레톤 UI (회색 placeholder 카드 3개)

---

## 3. 작성/수정 페이지 (`/board/new`, `/board/:id/edit`)

### 3.1 레이아웃

```
┌──────────────────────────────────────────────────────┐
│ NormalHeader                                         │
├──────────────────────────────────────────────────────┤
│ ← 목록으로   [TOURNAMENT 배지] (수정 시 고정)        │
│                                                      │
│ ┌─── 필드 영역 ───────────────────────────────────┐  │
│ │ 제목 *                                          │  │
│ │ [__________________________________]           │  │
│ │                                                │  │
│ │ (TOURNAMENT 전용 필드들 — 섹션 3.2)            │  │
│ │                                                │  │
│ │ (NOTICE/FREE: TipTap 에디터)                   │  │
│ └─────────────────────────────────────────────────┘  │
│                                                      │
│              [취소]   [작성 완료 / 수정 완료]        │
├──────────────────────────────────────────────────────┤
│ Footer                                               │
└──────────────────────────────────────────────────────┘
```

### 3.2 TOURNAMENT 타입 — 동적 필드 레이아웃

**필수 필드 영역 (상단, 구분선 위)**

```
제목 *
[________________________________________________]

대회 날짜 *                    게임 종류 *
[날짜 선택 — date picker]      [1뎁스 ▼]  [2뎁스 ▼]

우승자 *
[_______________]
```

**선택 필드 영역 (구분선 아래, 접기/펼치기 없이 항상 표시)**

```
준우승자
[_______________]

순위
[________________________________]
[________________________________]  (multiline textarea, max 2000자)

참가인원수            참가자 명단
[______(숫자)]        [________________________________]

상품
[________________________________________________]

스폰서
[________________________________________________]

상세 후기 (선택)
[TipTap 에디터]
```

**게임 종류 2뎁스 드롭다운 동작:**

| 1뎁스 선택값 | 1뎁스 표시명 | 2뎁스 옵션 |
|---|---|---|
| minesweeper | 지뢰찾기 | 초급 / 중급 / 고급 |
| baseball | 숫자야구 | 쉬움(3자리) / 보통(4자리) / 어려움(5자리) |
| blockfall | 블록폴 | 쉬움 / 보통 / 어려움 |
| blockfall-insane | 블록폴: 인세인 | 인세인 (단일 고정) |
| solitaire | 솔리테어 | 드로우1 / 드로우3 |
| apple | 사과게임 | 기본 (단일 고정) |
| sudoku | 스도쿠 | 초급 / 중급 / 고급 |

- 1뎁스 미선택 시 2뎁스 드롭다운 disabled 상태
- 1뎁스 변경 시 2뎁스 선택값 초기화
- blockfall-insane, apple 처럼 단일 옵션인 경우 2뎁스 자동 선택 후 disabled 처리 (사용자 혼란 방지)

### 3.3 NOTICE / FREE 타입 — 필드 레이아웃

```
제목 *
[________________________________________________]

본문 *
[TipTap 에디터 — 최소 높이 300px]
```

### 3.4 공통 필드 명세

**제목 인풋:**
- 타입: `text`
- maxLength: 100자
- 우측 하단: `0/100` 글자 수 카운터 (font-size 12px, color #94a3b8)
- 빈 값 제출 시도: 인풋 border-color #ef4444, 아래 에러 메시지 "제목을 입력해 주세요"

**날짜 picker (TOURNAMENT):**
- `input[type=date]` 기반
- placeholder: YYYY-MM-DD
- 미래 날짜도 허용 (예정 대회 기록 가능성)
- 빈 값 제출 시도: border-color #ef4444, 에러 메시지 "대회 날짜를 선택해 주세요"

**드롭다운 공통:**
- border: 1px solid #e2e8f0, border-radius 8px, padding 8px 12px
- 포커스: border-color #2c3e50, outline none, box-shadow 0 0 0 2px rgba(44,62,80,0.15)
- 미선택: color #94a3b8 (placeholder 색)

**텍스트 인풋/textarea 공통:**
- border: 1px solid #e2e8f0, border-radius 8px, padding 10px 14px, font-size 14px
- 포커스: border-color #2c3e50, box-shadow 0 0 0 2px rgba(44,62,80,0.15)
- 에러 상태: border-color #ef4444

**양식 배지 (수정 페이지):**
- post_type 변경 불가이므로 배지만 읽기 전용으로 표시 — `POST_TYPE_IMMUTABLE`
- 배지 외형은 목록/상세와 동일, 클릭 불가 (pointer-events none)

**제출 버튼:**
- 기본: background #2c3e50, color white, border-radius 8px, padding 10px 28px, font-size 15px
- 비활성(필수 필드 누락 또는 에디터 빈 본문): opacity 0.5, cursor not-allowed
- 로딩 중: 버튼 내 스피너 + 텍스트 "저장 중…"

**취소 버튼:**
- background transparent, border 1px solid #e2e8f0, color #475569
- 클릭 시 브라우저 뒤로가기 (또는 `/board`)

---

## 4. TipTap 에디터 명세

### 4.1 툴바 구성

툴바는 에디터 상단 고정. 좌→우 순서:

```
[B] [I] [U] [S]  |  [H2] [H3]  |  [• 목록] [1. 목록]  |  [인용] [코드]  |  [링크] [링크해제]  |  [이미지]  |  [실행취소] [재실행]
```

- `|`: 그룹 구분선 (1px solid #e2e8f0)
- 버튼 크기: 32×32px, border-radius 4px
- 호버: background #f1f5f9
- 활성(해당 노드 내 커서 위치): background #e2e8f0, color #2c3e50
- 비활성(실행취소 히스토리 없음 등): opacity 0.4, cursor not-allowed

**버튼 매핑:**

| 아이콘 라벨 | 기능 | TipTap 액션 |
|---|---|---|
| B | 굵게 | Bold |
| I | 기울임 | Italic |
| U | 밑줄 | Underline |
| S | 취소선 | Strike |
| H2 | 제목2 | Heading level 2 |
| H3 | 제목3 | Heading level 3 |
| • 목록 | 순서없는목록 | BulletList |
| 1. 목록 | 순서있는목록 | OrderedList |
| 인용 | 인용구 | Blockquote |
| 코드 | 코드 | Code (인라인) |
| 링크 | 링크 삽입 | Link — URL 입력 팝오버 |
| 링크해제 | 링크 제거 | unsetLink |
| 이미지 | 파일 선택 | file input trigger |
| 실행취소 | Undo | undo |
| 재실행 | Redo | redo |

**링크 삽입 팝오버:**
- 링크 버튼 클릭 → 에디터 툴바 아래 인라인 팝오버
- URL 입력 필드 + "삽입" 버튼 + "취소" 버튼
- `http://` 또는 `https://`로 시작하지 않으면 에러: "http:// 또는 https://로 시작하는 URL을 입력해 주세요"
- `javascript:` 스킴 차단 (프론트 선제 차단 + 서버 sanitize 이중 방어)
- target="_blank", rel="noopener noreferrer" 자동 부여

### 4.2 이미지 삽입 3경로 UX

**경로 1: 파일 선택 버튼**
- 툴바 이미지 버튼 클릭 → 숨겨진 `<input type="file" accept="image/*">` trigger
- multi-select 금지 (`multiple` 속성 없음) — 1장씩만
- 파일 선택 즉시 업로드 시작

**경로 2: 드래그앤드롭**
- 에디터 전체 영역이 드롭 존
- 드래그 오버 시: 에디터 테두리 border-color #2c3e50 (2px), background rgba(44,62,80,0.04)로 전환
- 드롭 시 파일 업로드 시작

**경로 3: 클립보드 붙여넣기**
- Ctrl+V (macOS: Cmd+V) 이벤트에서 `clipboardData.items` 중 `image/*` 감지
- 감지 즉시 업로드 시작

### 4.3 업로드 중 UX (3경로 공통)

1. 사용자 액션 감지 즉시 → 에디터 커서 위치에 placeholder 삽입
   - placeholder: 회색 배경 직사각형 (min-height 80px) + 중앙 로딩 스피너 (CSS animation)
2. `POST /api/board/images` 멀티파트 요청 병렬 전송
3. **성공 시**: 응답 URL로 placeholder `<img>` src 교체 → 실제 이미지 렌더
4. **실패 시**: placeholder 노드 제거 + 하단 토스트 에러 표시

### 4.4 검증 에러 UI (업로드 전 선제 차단)

프론트에서 파일 선택/드롭/붙여넣기 직후 즉시 검증:

| 조건 | 토스트 메시지 |
|---|---|
| 파일 크기 > 50MB | "이미지는 50MB 이하만 업로드 가능합니다" |
| MIME/확장자 불일치 또는 허용 외 형식 | "지원 형식: jpg, jpeg, png, gif, webp" |
| 현재 삽입된 이미지 수 ≥ 20장 | "한 글에 이미지는 최대 20장까지" |

- 토스트: 화면 우하단 고정, 3초 후 자동 제거, background #ef4444(에러)/white, 텍스트 white(에러)
- 검증 실패 시 업로드 요청 전송하지 않음

### 4.5 에디터 컨테이너 명세

- 최소 높이: 300px (NOTICE/FREE), 200px (TOURNAMENT 상세후기)
- 최대 높이: 제한 없음 (스크롤 대신 에디터 자체 확장)
- border: 1px solid #e2e8f0, border-radius 8px (툴바 상단 포함)
- 포커스 시: border-color #2c3e50
- 에디터 본문 내 padding: 16px
- 빈 본문 placeholder 텍스트: "내용을 입력하세요…" (color #94a3b8)

### 4.6 에디터 렌더링 스타일 (작성 중 미리보기)

에디터 내부에서 표시되는 요소의 최소 스타일:

- `h2`: font-size 1.4em, font-weight 700, margin 12px 0 6px
- `h3`: font-size 1.2em, font-weight 600, margin 10px 0 4px
- `blockquote`: border-left 3px solid #e2e8f0, padding-left 12px, color #64748b
- `code` (인라인): background #f1f5f9, border-radius 3px, padding 1px 4px, font-family monospace
- `img`: max-width 100%, height auto, display block, margin 8px 0

---

## 5. 상세 페이지 (`/board/:id`)

### 5.1 레이아웃

```
┌──────────────────────────────────────────────────────┐
│ NormalHeader                                         │
├──────────────────────────────────────────────────────┤
│ ← 게시판 목록                                        │
│                                                      │
│ [TOURNAMENT 배지]   제목 텍스트                      │
│ 아바타 32px  닉네임  ·  2026-04-20  (수정됨)         │
│                          [수정] [삭제]  (권한 있을 때) │
│ ─────────────────────────────────────────────────── │
│                                                      │
│ (TOURNAMENT: 정형 필드 카드)                         │
│                                                      │
│ (HTML 본문 — sanitize된 렌더링)                      │
│                                                      │
│ ─────────────────────────────────────────────────── │
│ [댓글 영역]                                          │
├──────────────────────────────────────────────────────┤
│ Footer                                               │
└──────────────────────────────────────────────────────┘
```

### 5.2 TOURNAMENT 정형 필드 카드

HTML 본문 위에 카드 형태로 표시.

```
┌─────────────────────────────────────────────────────┐
│  대회 정보                                          │
│  ─────────────────────────────────────────────────  │
│  대회 날짜    2026-04-19                           │
│  게임         블록폴  /  보통                       │
│  우승자       A                                    │
│  준우승자     B            (값 있을 때만 행 표시)  │
│  순위         1위: A / 2위: B / …                  │
│  참가인원     8명                                  │
│  참가자       A, B, C, D, E, F, G, H               │
│  상품         스타벅스 기프티콘                    │
│  스폰서       도박군 프로젝트                      │
└─────────────────────────────────────────────────────┘
```

- 카드: background #f8fafc, border 1px solid #e2e8f0, border-radius 12px, padding 20px 24px
- 행 레이아웃: 라벨(font-weight 600, color #475569, min-width 80px) + 값(color #0f172a)
- 값이 null/빈 문자열인 선택 필드 행: 렌더링 생략
- 순위 필드: `white-space: pre-wrap` 적용 (줄바꿈 보존)
- 카드 아래에 상세 후기 HTML 본문 렌더 (contentHtml이 있을 때만)

### 5.3 작성자 정보 영역

- 아바타 32×32px (ProfilePage 패턴 동일 — img 또는 첫 글자 fallback)
- 닉네임 font-size 14px, color #475569
- 작성일 font-size 13px, color #94a3b8 (형식: `YYYY-MM-DD`)
- updatedAt != createdAt 이면 `(수정됨)` 텍스트 추가 (color #94a3b8, font-size 12px)

### 5.4 수정/삭제 버튼 표시 조건

| 조건 | 수정 버튼 | 삭제 버튼 |
|---|---|---|
| 로그인 사용자 = 작성자 | 표시 | 표시 |
| 로그인 사용자 = ADMIN (타인 글) | 숨김 | 표시 |
| 그 외 | 숨김 | 숨김 |

- 수정 버튼: background white, border 1px solid #e2e8f0, color #475569, border-radius 6px, padding 6px 14px, font-size 13px
- 삭제 버튼: background white, border 1px solid #fca5a5, color #ef4444, border-radius 6px, padding 6px 14px, font-size 13px
- 삭제 클릭 → confirm 다이얼로그 "게시글을 삭제하시겠습니까? 복구할 수 없습니다." → 확인 시 DELETE 요청
- 성공 시 `/board`로 이동

### 5.5 HTML 본문 렌더링

- `dangerouslySetInnerHTML` 또는 동등 수단으로 서버 sanitize된 HTML 렌더
- 렌더링 컨테이너에 `board-content` 클래스 적용
- `board-content` 스타일 명세 (CSS 작성은 developer-frontend):
  - `img`: max-width 100%, height auto, display block, margin 8px 0, border-radius 4px
  - `a`: color #2c3e50, text-decoration underline
  - `blockquote`: border-left 3px solid #e2e8f0, padding-left 12px, color #64748b, margin 8px 0
  - `pre`, `code`: background #f1f5f9, border-radius 4px, padding 2px 6px, font-family monospace, font-size 13px
  - `ul`, `ol`: padding-left 24px, line-height 1.8
  - `h2`: font-size 1.3em, font-weight 700, margin 16px 0 8px
  - `h3`: font-size 1.15em, font-weight 600, margin 12px 0 6px

---

## 6. 댓글 UX

### 6.1 댓글 영역 레이아웃

```
─── 댓글 7개 ────────────────────────────────────────

[아바타]  닉네임  ·  2026-04-20                [삭제]
          본문 텍스트 (최대 1000자)

[아바타]  닉네임  ·  2026-04-20                [삭제]
          본문 텍스트

(50개 초과 시)
               [더 보기]

────────────────────────────────────────────────────
[아바타]  [댓글을 입력하세요…                 ] [등록]
                                           0/1000자
```

### 6.2 댓글 카드 명세

- 전체 컨테이너: border-top 1px solid #f1f5f9 (첫 번째 댓글만 없음)
- 아바타: 36×36px 원형
  - `profileImage` 있으면 `<img>` (object-fit: cover)
  - 없으면 닉네임 첫 글자 fallback (ProfilePage 패턴 동일)
- 닉네임: font-size 14px, font-weight 600, color #0f172a
- 작성일: font-size 12px, color #94a3b8
  - 상대 시간 표시 (예: "방금 전", "3시간 전", "2일 전")
  - 절대 시간은 hover/focus tooltip으로 표시 (YYYY-MM-DD HH:mm:ss UTC)
- 본문: font-size 14px, color #334155, line-height 1.6, white-space: pre-wrap
- 삭제 버튼:
  - 표시 조건: 댓글 작성자 본인 OR ADMIN
  - 스타일: 텍스트 버튼, color #94a3b8, font-size 12px, hover시 color #ef4444
  - 클릭 → confirm 없이 즉시 삭제 (hard delete, PRD 10)

### 6.3 댓글 작성 인풋

- **표시 조건**: 로그인 + FRIEND 또는 ADMIN
- 비로그인/USER: 댓글 입력 폼 숨김, "댓글 작성은 도박군(FRIEND) 등급 이상만 가능합니다" 안내 텍스트 표시 (color #94a3b8, font-size 13px)
- 아바타: 현재 로그인 사용자 아바타 (36×36px)
- textarea: placeholder "댓글을 입력하세요…", resize none, min-height 60px, border 1px solid #e2e8f0, border-radius 8px, padding 10px 12px
- 글자 수 카운터: textarea 우측 하단 `0/1000` (font-size 12px, color #94a3b8, 950자 초과 시 color #f59e0b, 1000자 달성 시 color #ef4444)
- 등록 버튼: background #2c3e50, color white, border-radius 6px, padding 8px 16px, font-size 13px
- 비활성 조건: 빈 문자열 또는 1000자 초과 — opacity 0.5, pointer-events none
- 등록 성공 시: textarea 초기화, 새 댓글을 목록 하단에 즉시 추가 (낙관적 업데이트)

### 6.4 "더 보기" 버튼

- 표시 조건: `commentHasNext == true`
- 위치: 댓글 목록 하단 중앙
- 스타일: background white, border 1px solid #e2e8f0, color #475569, border-radius 8px, padding 8px 24px, font-size 14px
- 로딩 중: 버튼 텍스트 "불러오는 중…" + 비활성
- cursor 기반 API (`GET /api/board/posts/{id}/comments?cursor=...`) 호출
- 응답 댓글을 기존 목록 하단에 append

---

## 7. 권한 차단 화면

### 7.1 비로그인 사용자

- `/board/**` 접근 시 `/login`으로 즉시 리다이렉트
- AdminRoute 패턴 재사용:
  ```
  if (!user) → <Navigate to="/login" replace />
  if (user.role === 'USER') → 권한 부족 화면 (아래 7.2)
  ```

### 7.2 USER 등급 사용자 (로그인됨, 권한 부족)

```
┌────────────────────────────────────────┐
│  NormalHeader                          │
│                                        │
│  [자물쇠 아이콘]                        │
│  이 게시판은 도박군(FRIEND) 이상만      │
│  이용할 수 있습니다.                    │
│                                        │
│  [홈으로]    [내 프로필]               │
│                                        │
│  Footer                                │
└────────────────────────────────────────┘
```

- 자물쇠 아이콘: font-size 48px 또는 SVG, color #94a3b8
- 안내 텍스트: font-size 16px, color #475569, text-align center
- [홈으로] 버튼: background #2c3e50, color white
- [내 프로필] 버튼: background white, border 1px solid #e2e8f0, color #475569
- 두 버튼 모두 border-radius 8px, padding 10px 24px

### 7.3 API 403 응답 처리

- 어느 페이지에서든 API 호출이 403 반환 시 → 토스트: "권한이 없습니다" (color white, background #ef4444, 3초)
- 이후 추가 동작 없음 (자동 리다이렉트 하지 않음)

### 7.4 세션 만료 (401)

- 글 작성/수정 페이지에서 저장 요청 중 401 수신 시:
  - 에디터 내용 localStorage에 임시 저장 (key: `board_draft_{type}`)
  - 토스트: "세션이 만료되었습니다. 로그인 후 다시 시도해 주세요."
  - `/login`으로 리다이렉트

---

## 8. 시각 명세

### 8.1 양식 배지 컬러

접근성 기준: WCAG AA (최소 대비 4.5:1 for normal text)

| 양식 | 배지 배경 | 배지 텍스트 | 표시 텍스트 | 대비 비율 |
|---|---|---|---|---|
| TOURNAMENT | #fef3c7 (노랑) | #92400e (갈색) | 대회기록 | ≥ 5.0:1 |
| NOTICE | #fee2e2 (빨강 연) | #991b1b (빨강 진) | 공지 | ≥ 5.2:1 |
| FREE | #dbeafe (파랑 연) | #1e40af (파랑 진) | 자유 | ≥ 5.5:1 |

- 배지 공통 스타일: border-radius 4px, padding 2px 8px, font-size 12px, font-weight 600, display inline-block
- 목록 카드에서는 제목 앞에 인라인 배치
- 상세/작성 페이지에서는 제목 위 별도 줄

### 8.2 프로젝트 일반 모드 컬러 팔레트 준수

기존 코드에서 확인된 팔레트 (신규 컬러 무단 도입 금지):

| 용도 | 색상값 | 기존 사용처 |
|---|---|---|
| Primary (헤더/강조) | #2c3e50 | NormalHeader accentColor, 제목, 버튼 |
| Surface | white | 카드 background |
| Surface alt | #f8fafc | 페이지 background, 호버 |
| Border | #e2e8f0 | 카드 border, 인풋 border |
| Border light | #f1f5f9 | 구분선 |
| Text primary | #0f172a | 본문 제목 |
| Text secondary | #475569 | 닉네임, 버튼 텍스트 |
| Text muted | #94a3b8 | 날짜, placeholder |
| Text hint | #64748b | 보조 설명 |
| Success | #10b981 | 상태 배지 |
| Warning | #f59e0b | 글자 수 경고 |
| Error | #ef4444 | 에러, 삭제 버튼 |
| Avatar gradient | linear-gradient(135deg, #aa3bff, #7b2bd4) | ProfilePage avatarDefault |

### 8.3 반응형 레이아웃

**브레이크포인트:**
- 모바일: 320px ~ 767px
- 태블릿: 768px ~ 1023px
- 데스크톱: 1024px+

**목록 페이지 (`/board`):**
- 데스크톱: max-width 860px, margin auto, 단일 컬럼
- 태블릿: 동일 (padding 0 24px)
- 모바일: padding 0 16px, 카드 내 요소 폰트 소폭 축소 (font-size -1px)
- "글쓰기" 버튼: 데스크톱 제목 우측 / 모바일 탭 아래 우측 정렬

**작성/상세 페이지:**
- 데스크톱: max-width 800px, margin auto
- 모바일: padding 0 16px
- TOURNAMENT 정형 카드 — 데스크톱: 2컬럼 그리드(대회날짜+게임종류) / 모바일: 단일 컬럼 스택
- TipTap 툴바 — 모바일: 버튼 크기 28×28px, 일부 보조 버튼(H2, H3, 인용, 코드) 두 번째 줄로 래핑

**댓글 영역:**
- 모바일: 댓글 카드 아바타 32px로 축소, padding 12px 0

---

## 9. 에지/실패 케이스

### 9.1 이미지 업로드 중 네트워크 끊김

- placeholder 이미지 노드는 에디터 내에 유지
- placeholder 위에 "업로드 실패 — 재시도" 인라인 UI 표시:
  ```
  [회색 배경]  업로드 실패  [재시도 버튼]
  ```
- 재시도 버튼 클릭 → 동일 파일 재업로드 시도
- 재시도 포기 시(취소 버튼) → placeholder 노드 제거

### 9.2 Word/외부 HTML 붙여넣기

- TipTap의 `transformPastedHTML` 훅으로 클라이언트 측 1차 정리 (서식 단순화)
- 서버 sanitize가 단일 신뢰 지점 (PRD 9.4)
- 프론트 렌더 예상 결과: 허용 태그(p, strong, em 등)는 유지, `<table>`, `<style>`, `class` 어트리뷰트 등 비허용 요소는 제거됨
- 사용자에게 별도 안내 UI 없음 (서버 응답 기준으로 최종 렌더)

### 9.3 빈 본문 제출 시도 차단

- NOTICE/FREE: contentHtml이 빈 문자열(`<p></p>`, `""`)인 경우 제출 버튼 비활성
- TipTap `editor.isEmpty` 프로퍼티 활용 권장 (구현은 developer-frontend 판단)
- 버튼 비활성 상태에서 클릭 이벤트 자체 차단

### 9.4 삭제 후 수정 시도 (404)

- API 404 응답 시 토스트 "게시글이 존재하지 않습니다" + `/board`로 리다이렉트

### 9.5 게임종류/난이도 화이트리스트 위반 (400)

- 드롭다운 UI 자체가 화이트리스트 외 값을 선택 불가하게 구성 → 정상 사용 시 발생하지 않음
- API 400 `INVALID_GAME_KEY` / `INVALID_DIFFICULTY_KEY` 수신 시 토스트 에러 표시

### 9.6 sanitize로 본문이 완전히 비어지는 경우

- API 400 `CONTENT_EMPTY` 수신 시 토스트 "본문 내용이 비어있습니다. 허용되지 않는 형식이 제거되었을 수 있습니다."

### 9.7 글 목록 로딩 실패

- API 에러 시 목록 자리에 에러 메시지 "게시글을 불러오는 데 실패했습니다. [다시 시도]" 버튼 표시

---

## 참조

- PRD: `docs/specs/board-community.md`
- API 계약: `docs/specs/board-api-contract.md`
- 아바타 fallback 패턴: `frontend/src/pages/ProfilePage.tsx` + `ProfilePage.module.css`
- 권한 차단 패턴: `frontend/src/components/admin/AdminRoute.tsx`
- 프로젝트 컬러 팔레트 출처: `frontend/src/pages/ProfilePage.module.css`, `frontend/src/pages/HomePage.module.css`
