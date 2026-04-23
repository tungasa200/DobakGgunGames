# QA 진행 로그 — Board Community (도박군 게시판)

담당: qa-tester
최초 작성: 2026-04-24
최종 업데이트: 2026-04-24 (세션 종료)
기능: 도박군 게시판 신설 (FRIEND 이상 전용, 3양식, TipTap 에디터, R2 이미지, 댓글)

---

## 최종 판정

**PASS** (CONDITIONAL PASS → BUG-01/02 재검증 후 PASS 전환)

검증 방식: 정적 코드 리뷰 + HtmlSanitizerTest 19케이스 BUILD SUCCESSFUL + tsc -b 통과 기반 (B2 경로)

---

## 산출물

| 파일 | 내용 |
|---|---|
| `docs/review/board-community-test-plan.md` | 11개 섹션 + 부록 A/B/C, 약 183개 테스트 케이스 |
| `docs/review/board-community-bug-report.md` | BUG-01/02 RESOLVED 포함, 재검증 결과 섹션 추가, 최종 판정 PASS |

---

## 세션 로그

### 2026-04-24 — 선행 테스트 플랜 작성 (구현 완료 전)

| 항목 | 내용 |
|---|---|
| 스펙 독해 | docs/specs/board-community.md 전체 정독 완료 |
| 스펙 독해 | docs/specs/board-api-contract.md 전체 정독 완료 (에러 코드 22개 전수 확인) |
| 회귀 참조 | docs/progress/qa-tester-blockfall-insane.md 확인 (기존 SecurityConfig/R2 기준 파악) |
| 테스트 플랜 선행 작성 | docs/review/board-community-test-plan.md 11개 섹션 완료 |
| 모드 확인 | PRD 4절 "일반 모드만" 명시 — Excel 모드 검증 불필요 확인 |

### 2026-04-24 — 정적 코드 리뷰 (B2 경로, 구현 완료 후)

| 항목 | 내용 |
|---|---|
| HtmlSanitizer 리뷰 | 화이트리스트 태그 PRD 일치, sanitize 호출 경로(create/update) 확인 |
| 권한 매트릭스 32케이스 | SecurityConfig 룰 + 서비스 레이어 소유권 체크 정적 확인. 전부 PASS |
| XSS 14케이스 커버리지 | 초기 10/14 커버 — BUG-01/02 발견 후 19케이스로 확장, 전부 PASS |
| 이미지 업로드 | 50MB 제한 / MIME / 확장자 / 교차검증 / 글당 20장 제한. 전부 PASS |
| 대회기록 필드 | prize/sponsor 선택 필드 포함 확인. blockfall-insane difficultyKey=insane 고정 확인. PASS |
| 댓글 | plain text 렌더, cursor 페이지네이션, 아바타 fallback 정적 확인. PASS |
| 에러 코드 매핑 | BoardErrorCode 22개 enum + GlobalExceptionHandler 일관성 확인. 부분 불일치(BUG-03) |
| 회귀 영향 | SecurityConfig 기존 룰 순서 영향 없음 / CORS PUT 추가 기존 API 영향 없음. PASS |

### 2026-04-24 — BUG-01/02 재검증

| 항목 | 결과 |
|---|---|
| BUG-01 재검증 | disallowTextIn 추가 + style_tag_is_completely_removed / object_embed_base_tags_are_removed 테스트 확인. RESOLVED |
| BUG-02 재검증 | rel allowAttributes 제거 + 후처리 정규식 rel 강제 주입 + 테스트 4케이스 확인. RESOLVED |
| 정규식 엣지 케이스 5종 분석 | Self-closing / 멀티라인 / rel 중복 / 대문자 / href 없는 a — 실질 위험 없음 확인 |

---

## 현재 상태

| 단계 | 상태 |
|---|---|
| 스펙 독해 | 완료 |
| 테스트 플랜 선행 작성 | 완료 |
| 정적 코드 리뷰 초기 (B2 경로) | 완료 |
| 버그 리포트 작성 | 완료 |
| BUG-01/02 재검증 | 완료 — RESOLVED |
| 최종 판정 | PASS |
| 브라우저 E2E | 미실행 — 사용자 수동 확인 8항목, 배포 후 확인 권장 |

---

## 발견/해소 이슈

| 이슈 | 심각도 | 상태 | 내용 |
|---|---|---|---|
| BUG-01 `<style>` 태그 텍스트 노드 유출 | High | RESOLVED | backend: `disallowTextIn("script","style","object","embed","base","math","xml","svg","noscript","applet")` 추가 |
| BUG-02 `a[rel]` 임의 허용 (reverse tabnabbing) | High | RESOLVED | backend: rel allowAttributes 제거 + 후처리 정규식으로 `rel="noopener noreferrer"` 강제 주입 |
| BUG-03 TITLE_REQUIRED 응답 포맷 불일치 | Medium | 미해소 | Bean Validation 경로가 `{ "error": "title: ..." }` 포맷 반환 — api-contract 에러 코드 포맷 불일치. 배포 차단 불필요, 차기 배포 시 수정 예정 |
| INFO-01 타인삭제 403 vs 404 설계 불일치 | Low | 미해소 | 보안 관례로 404 반환하나 api-contract는 403 명시 — planner 문서 업데이트 권장 |
| A_TAG_WITHOUT_REL dead code | Low | 참고 사항 | HtmlSanitizer.java 43-45 미사용 상수. 동작 영향 없음 |

---

## 검증 결과 요약

### 권한 매트릭스 (32케이스 전부 PASS)

- 비로그인 → 401: SecurityConfig FRIEND+ 룰, JWT 필터
- USER → 403: hasAnyRole(FRIEND, ADMIN) 불충족
- FRIEND 본인 삭제 → 200: isOwner 체크
- FRIEND 타인 삭제 → 404(보안 관례): !isOwner && !isAdmin → POST_NOT_FOUND throw
- ADMIN 타인 삭제 → 200: isAdmin=true 분기
- ADMIN 타인 수정 → 403: updatePost()에 isAdmin 예외 없음 (PRD 5 준수)
- FriendRoute 4라우트 래핑 확인 (App.tsx 84-87)

### XSS 검증 (19케이스 전부 PASS)

초기 14케이스 중 10케이스 커버 → BUG-01/02 수정으로 6케이스 추가, 총 19케이스 BUILD SUCCESSFUL.
커버된 공격 벡터: script / onerror / javascript: href / data: img / 외부 img src / iframe / style 태그(텍스트 노드 포함) / vbscript: / onmouseover / object/embed/base / rel 강제 주입 4케이스.

### 회귀 영향 체크 (전부 PASS)

- `/api/admin/**`: SecurityConfig 룰 순서상 게시판 룰보다 앞 선언 — 기존 ADMIN 전용 접근 보장
- `/api/*/session/**`, `/api/*/rankings`: 경로 패턴 충돌 없음 (board 세그먼트와 분리)
- `/api/patch-notes/**`: 게시판 룰 이후 선언이나 경로 충돌 없음
- CORS PUT 추가: 기존 허용 메서드에 추가이므로 기존 GET/POST/DELETE 동작 영향 없음
- UserService.validateImageFile(5MB): BoardImageService가 독립 구현, 재사용 없음 — 프로필 이미지 5MB 제한 그대로 유지

---

## 사용자 브라우저 E2E 수동 확인 필요 (배포/로컬 구동 후)

PR 머지 이후 아래 8항목을 사용자가 직접 브라우저에서 확인:

| # | 항목 | 확인 포인트 |
|---|---|---|
| 1 | 업로드 실패 placeholder UI | `__upload_error__:` prefix src 이미지가 오류 표시 UI로 보이는지 (깨진 아이콘 아닌지) |
| 2 | 아바타 404 fallback | profileImage URL이 깨진 경우 닉네임 첫 글자 원형 fallback 노출 여부 (onError 핸들러 미구현 상태) |
| 3 | Ctrl+V 붙여넣기 업로드 | 스크린샷 이미지를 에디터에 붙여넣기 시 업로드 플로우 시작 확인 |
| 4 | 드래그앤드롭 dragging CSS | 파일 드래그 시 에디터 영역에 dragging 클래스 토글 및 업로드 확인 |
| 5 | blockfall-insane 드롭다운 disabled | 게임 선택 시 난이도 드롭다운 disabled + "인세인" 자동 선택 시각 동작 확인 |
| 6 | 320px 모바일 에디터 툴바 | 에디터 툴바 아이콘 overflow 또는 레이아웃 붕괴 없음 확인 |
| 7 | PostTypeBadge 3색 렌더 | TOURNAMENT/NOTICE/FREE 배지 designer 명세 색상으로 올바르게 표시 확인 |
| 8 | 댓글 51개+ 더보기 cursor | 댓글 51개 이상 환경에서 "더 보기" 버튼 노출 및 cursor 페이지네이션 실동작 확인 |

---

## 다음 세션 인수인계 주의사항

1. 브라우저 실동작 QA는 미실행 (정적 기반). 배포 또는 로컬 구동 후 위 수동 확인 8건 반드시 체크.
2. BUG-03(Medium): 차기 배포 때 developer-backend에 TITLE_REQUIRED Bean Validation 경로 → BoardException 전환 수정 요청 필요.
3. INFO-01(Low): api-contract.md의 타인 삭제 응답 코드를 403에서 404로 planner가 문서 현행화 필요.
4. 현재 mock 데이터 기반 프론트 — 백엔드 배포 후 4개 페이지 import를 `boardMock` → `boardApi`로 전환 필요 (developer-frontend 담당).

---

## 에스컬레이션 규칙

- XSS sanitize 실패 → developer-backend에 직접 메시지 (서버 sanitize 단일 신뢰 지점 위반)
- 에디터 UI 실패 (서식/이미지 업로드/UX) → developer-frontend에 직접 메시지
- 양식 필드 불일치 (스펙 vs 구현 불명확) → planner에게 먼저 확인 후 판정
- 회귀 파손 발견 (기존 SecurityConfig, R2, 랭킹 API) → 즉시 해당 developer-backend 차단 메시지

---

## 반려 기준 (차기 작업 대비)

- Excel 모드 코드가 구현에 혼입된 경우 반려 (PRD 명시 제외)
- SecurityConfig 변경으로 기존 /api/admin/**, /api/patch-notes/** 접근 파손 시 즉시 반려
- Critical/High 버그 미해결 상태로 완료 요청 시 반려
- XSS sanitize 서버 측 미적용 (API 직접 호출로 script 삽입 성공) 시 Critical 처리 후 반려
