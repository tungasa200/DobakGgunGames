# designer — board-community 진행 로그

## 최종 상태

완료 — UX 명세 확정, developer-frontend 구현 반영 완료

---

## 산출물

- `docs/design/board-community-ux.md` (9개 섹션 최종)
  1. 전체 IA — 4개 라우트 구조 및 헤더/필터/콘텐츠 구성
  2. 목록 페이지 — 탭 필터, 게시글 카드, 글쓰기 CTA + 양식 선택 모달, 페이지네이션
  3. 작성/수정 페이지 — TOURNAMENT 2뎁스 드롭다운 포함 동적 필드, NOTICE/FREE 레이아웃
  4. TipTap 에디터 — 툴바 명세, 이미지 3경로 UX, 업로드 중 placeholder 처리, 검증 에러 토스트
  5. 상세 페이지 — TOURNAMENT 정형 카드, HTML 본문 렌더링, 수정/삭제 버튼 권한 조건
  6. 댓글 UX — 아바타 fallback, 상대시간+툴팁, 더 보기 cursor 기반, 작성 인풋
  7. 권한 차단 화면 — 비로그인 리다이렉트, USER 차단 안내 화면, API 403 토스트, 401 세션만료
  8. 시각 명세 — 양식 배지 3색 (접근성 AA), 기존 팔레트 준수, 반응형 브레이크포인트
  9. 에지/실패 케이스 — 네트워크 끊김 재시도, Word 붙여넣기, 빈 본문 차단, 404/400 처리

---

## 핵심 디자인 결정 5건

1. 아바타 fallback = ProfilePage `avatarDefault` 패턴 재사용 (보라 그라디언트 + 첫 글자 흰 텍스트)
2. 권한 차단 = AdminRoute 확장 (USER는 차단 안내 화면 + 홈/프로필 이동 CTA, 비로그인은 /login 리다이렉트)
3. 양식 배지 3색 (TOURNAMENT #fef3c7/#92400e, NOTICE #fee2e2/#991b1b, FREE #dbeafe/#1e40af) WCAG AA 충족
4. 2뎁스 드롭다운 = 단일 난이도 시 자동선택 + disabled 처리 (blockfall-insane, apple 해당)
5. 이미지 업로드 실패 UX = 재시도 버튼 포함 placeholder 유지 (planner 승인 완료, PRD에서 개선됨)

---

## 모드 적용 범위

일반 모드 전용 — Excel 모드 없음 (사용자 명시적 제외, PRD 4항 확정)

---

## 다음 세션 인수인계 주의사항

사용자 브라우저 수동 확인 항목 중 디자인 관련 4건은 아직 브라우저 렌더 검증이 완료되지 않았다.
다음 세션(또는 qa-tester)이 확인해야 할 항목:

1. **PostTypeBadge 3색 실제 렌더** — 배지 배경/텍스트 색상 대비가 실제 브라우저에서 AA 기준 충족하는지 확인
2. **blockfall-insane 드롭다운 disabled 시각 동작** — 단일 난이도 자동선택 후 2뎁스가 disabled 상태로 올바르게 표시되는지 확인
3. **320px 모바일 에디터 툴바 overflow** — 툴바 버튼이 320px 뷰포트에서 두 줄로 래핑되는지, 잘리거나 스크롤 발생하지 않는지 확인
4. **업로드 실패 placeholder 이미지 시각** — 네트워크 실패 시 placeholder 영역과 재시도 버튼 UI가 에디터 내에서 이질감 없이 렌더되는지 확인

---

## 세션 이력

| 날짜 | 작업 내용 |
|---|---|
| 2026-04-24 | UX 명세 최초 작성 (9개 섹션) — developer-frontend 인계 |
| 2026-04-24 | 세션 종료 전 progress 최종 갱신 |
