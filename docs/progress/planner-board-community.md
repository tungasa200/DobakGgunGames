# planner — 도박군 게시판 진행 로그

## 최종 상태 (2026-04-24)

**완료 — 게시판 기능 QA PASS, 커밋 단계 진입**

## 산출물 체크리스트

- [x] `docs/specs/board-community.md` — PRD (최종)
- [x] `docs/specs/board-api-contract.md` — API 계약 (최종)

## 확정된 주요 결정 (6건)

1. **등급**: 기존 `User.Role.FRIEND` 재사용 — 신규 ENUM 추가 없음.
2. **모드**: 일반 모드 전용 (Excel UI 모드 제외).
3. **에디터**: TipTap `^2.11.5` — React 19 공식 지원, 이미지/링크/기본 서식 확장.
4. **이미지 업로드**: 파일당 50MB / 글당 20장 / 허용 확장자 5종 (jpg, jpeg, png, gif, webp).
5. **공지 권한**: FRIEND 이상 전원 작성 가능 (ADMIN 전용 아님).
6. **대회기록**: 필수 4개(제목/대회날짜/게임종류/우승자) + 선택 7개(준우승자/순위/참가인원수/참가자/상품/스폰서/에디터 본문). 게임종류는 2뎁스 드롭다운(1뎁스 게임 7종 + 2뎁스 난이도, blockfall-insane은 `insane` 단일 고정).

## Sanitizer

- **OWASP Java HTML Sanitizer `20240325.1`** 확정 (GAV: `com.googlecode.owasp-java-html-sanitizer:owasp-java-html-sanitizer:20240325.1`).

## 잔여 오픈 퀘스천 (차기 논의)

1. 마이그레이션 도구 방식 — Flyway/Liquibase 도입 여부 (현재 수동 SQL 적용).
2. R2 이미지 정리 — 고아 이미지 수동 정리 도구(운영자 CLI/스크립트) 설계 및 타이밍.

## 히스토리

- 2026-04-24 Phase 1: 기존 코드베이스 조사 + 사용자 확인 질문 6건 송부.
- 2026-04-24 Phase 1 답변 반영: FRIEND 재사용 / 일반 모드만 / TipTap / 50MB·20장 / 공지 FRIEND+ / 대회기록 4필수 + 7선택. PRD·API 계약 초안 작성.
- 2026-04-24 2차 답변 반영: blockfall-insane을 별도 게임 항목으로 대회기록 포함, 댓글 페이지네이션(초기 50 + cursor "더 보기"), 고아 이미지 자동 정리 제외 확정, Sanitizer OWASP 확정.
- 2026-04-24 Phase 2 진입: designer / developer-frontend / developer-backend / qa-tester 병렬 작업.
- 2026-04-24 QA PASS → 커밋 단계 진입 (최종 상태).

## 다음 세션 인수인계 주의사항

1. **브라우저 수동 확인 8건 필요** — 자세한 항목은 `docs/review/` 하위 QA 리포트 참조.
2. **BUG-03 (Medium, `TITLE_REQUIRED` 에러 응답 포맷 일관성)** — 차기 배포분에 수정 예정. 현재 릴리스 블로커 아님.
3. **프론트 API 전환 마무리 작업**: `boardMock` → `boardApi` import 한 줄 교체만 남음 (컴포넌트 사용처는 동일 시그니처).
4. 미해결 오픈 퀘스천 2건(마이그레이션 도구 방식, R2 고아 이미지 정리)은 다음 스프린트 계획 단계에서 재논의.
