# Progress — planner : RSP (가위바위보) 어드민 전용 게임

- 소유 팀원: **planner**
- 기능 키: `rsp`
- 최종 업데이트: 2026-04-21
- 관련 문서:
  - PRD: `docs/specs/rsp-game.md`
  - 아키텍처 재발 방지 근거: `docs/review/architecture.md`

---

## 현재 상태

- **체크포인트 2 승인 완료 (2026-04-21)** — PRD 최종 확정.
- OQ-3 / OQ-5 / OQ-7 잠정안 그대로 확정.
- 다음: designer(CP3) / developer-backend(CP4) 병렬 착수 예정.

---

## 작업 로그

### 2026-04-21 (초기 세션 — PRD 작성)
- 프로젝트 오너로부터 4대 결정사항 수신:
  1. 결과 기록 범위: **C** — 서버 저장하되 랭킹 시스템 분리, 어드민 개인 통계만
  2. 한 세션 플레이 범위: **A** — 무제한, 세션은 프론트 상태로
  3. 어드민 진입 경로: **B** — `/admin/rsp` 직접 URL (사이드바 메뉴 미추가)
  4. 어드민 게임 관리 토글: **B** — `AdminGamesPage` 토글 목록에 미포함
- 기존 리포지토리 조사 완료:
  - `SecurityConfig.java:64` — `/api/admin/**` 이미 ADMIN role 보호
  - `RankingService.java:26` — `VALID_GAMES` 에 `rsp` 추가하지 않기로 결정(정책 재확인)
  - `AdminRoute.tsx` — 기존 보호 컴포넌트 재사용
  - `application.properties` — JPA `ddl-auto=update` 사용 중
  - `docs/review/architecture.md` — smell 재발 방지 항목 반영
- PRD `docs/specs/rsp-game.md` 초안 작성 완료 (15개 섹션).
- PRD 핵심 결정:
  - 판정 로직은 **서버에서 수행** (`ThreadLocalRandom` 기반 computerChoice 생성 + 승/패/무 판정)
  - 신규 테이블 `admin_rsp_play` 설계 (id, admin_user_id FK, user_choice, computer_choice, result, played_at)
  - 엔드포인트 초안: `POST /api/admin/rsp/plays`, `GET /api/admin/rsp/stats`
  - 모드 적용 범위: **일반 + Excel 모드 양쪽 필수** 명시
  - `RankingService` / `AdminRankingService` / `AdminStatsService` **수정 금지** 원칙 명시
  - 홈/Excel 홈/사이드바/AdminGamesPage 카탈로그 **미노출** 원칙 명시
  - 오픈 퀘스천 8건 (OQ-1 ~ OQ-8)

### 2026-04-21 (후속 세션 — CP2 승인 & PRD 최종화)
- 프로젝트 오너로부터 **CP2 승인** 수신 (2026-04-21).
- OQ-3 / OQ-5 / OQ-7 잠정안 그대로 **확정** 지시 수신:
  - **OQ-3 확정**: 연승/연패 스트릭에서 **무승부는 스트릭 유지** (카운트에 영향 없음).
    - 예: 3연승 후 무승부 → 여전히 3연승 표시 / 2연패 후 무승부 → 여전히 2연패 표시 / 스트릭 0에서 무승부 → 여전히 0.
    - 스트릭 초기화/증가는 WIN 또는 LOSS 시에만 발생.
  - **OQ-5 확정**: Excel 모드 URL은 `/admin/rsp/excel`. `?excel=1` 쿼리파라미터 방식 폐기.
  - **OQ-7 확정**: `winRate` 응답 포맷은 **0~1 범위 소수, 소수점 4자리 반올림** (예: 0.6667). `totalPlays = 0`이면 `null`. 퍼센트 변환은 프론트 책임.
- PRD 업데이트 섹션:
  - 상단 메타: 상태 → "최종 확정 (CP2 승인됨)", 최종 확정일/승인자/확정 이력 추가
  - §1 배경: Excel URL 표기 `/admin/rsp/excel` 확정 반영
  - §3 모드 적용 범위: Excel 라우트 확정 문구 반영
  - §5 게임 규칙 — 연승/연패 계산: OQ-3 확정 사례 3건(연승+무/연패+무/스트릭0+무) 명시, "오픈 질문" 하위 문단 제거
  - §7.1 POST 응답 JSON: `winRate` 예시를 0.4706으로 교정 + 포맷/null 정책 문단 추가
  - §7.2 GET 응답 JSON: `winRate` 포맷/null 정책 문단 추가
  - §6 EC-6: OQ-7 확정 포맷 준수 주석 추가
  - §12 체크포인트: CP2 완료 표기, CP3/CP4 착수 대기로 갱신
  - §14 오픈 퀘스천 테이블: OQ-3/5/7 "확정 (CP2, 2026-04-21)" 표기, 잠정/확정 상태 컬럼 분리
- 남은 오픈 퀘스천: OQ-1 / OQ-2 / OQ-4 / OQ-6 / OQ-8 — 이번 턴 변경 없음.
  - CP3에서 designer가 결정: OQ-8 (연승/연패 표시 문구/아이콘)
  - CP4에서 developer-backend + planner가 확정: OQ-1, OQ-2, OQ-6
  - 후속 검토: OQ-4 (Reset API, MVP 외)

---

## 다음 단계 (순서)

1. ~~**프로젝트 오너 CP2 승인**~~ ✅ **완료 (2026-04-21)**
2. designer 작업 착수 — **현재 단계**
   - `docs/design/rsp-game.md` — 일반 모드 + Excel 모드 양쪽 명세
   - OQ-3(확정: 무승부 스트릭 유지), OQ-5(확정: `/admin/rsp/excel`) 반영
   - OQ-8 (연승/연패 표시 문구/아이콘) designer가 결정
3. developer-backend 작업 착수 (병렬) — **현재 단계**
   - API 최종 확정 (CP4): OQ-1, OQ-2, OQ-6 답변 확정 필요
   - OQ-7(확정: 0~1 소수 4자리) 포맷 DTO에 반영
4. developer-frontend 작업 착수 (API 확정 후)
   - `App.tsx` 라우트 2개 추가 (`/admin/rsp`, `/admin/rsp/excel`) / `AdminRoute` 감싸기 / Excel 모드 페이지 분기
   - 무승부 스트릭 유지 로직 프론트 상태 구현 (OQ-3 확정)
   - `winRate` 퍼센트 변환은 프론트 담당 (OQ-7 확정)
5. qa-tester 검증 플랜 수립
   - `docs/review/rsp-game-test-plan.md`
   - 일반 + Excel 양쪽 동작, ADMIN 외 접근 차단, 랭킹 미노출, 토글 미포함 전수 확인
   - 무승부 스트릭 유지 케이스(연승+무/연패+무/스트릭0+무) 테스트 케이스화 필수

---

## 대기 중 질문 (프로젝트 오너 답변 필요)

- 없음 — CP2 승인 턴에 OQ-3 / OQ-5 / OQ-7 모두 확정됨.
- 남은 OQ-1 / OQ-2 / OQ-4 / OQ-6 / OQ-8 은 해당 체크포인트(CP3/CP4)에서 담당 팀원이 결정 후 planner 경유로 PRD 반영.

---

## 블로커 / 리스크

- 블로커 없음.
- 리스크:
  - Excel 모드 단독 렌더(홈 카탈로그 미등록) 시 `ExcelShell`이 정상 동작하는지 developer-frontend 착수 시점에 빠른 POC 필요 — 기존 블록폴 인세인이 Excel 미지원이라 선례 없음.
  - `RankingService.VALID_GAMES` 와 분리 원칙이 추후 통계/리더보드 확장 요구로 깨질 수 있음 → PRD §10 재발 방지 메모로 명시해두었으나 팀 내 재확인 필요.

---

## 파일 소유권 메모

- `docs/specs/rsp-game.md` — planner 소유 (본인)
- `docs/progress/planner-rsp-game.md` — planner 소유 (본 파일)
- 다른 팀원은 스펙 변경 필요 시 반드시 planner 경유

---

## 세션 종료 로그 (2026-04-21)

### 체크포인트별 최종 상태
- **CP1 완료**: 프로젝트 오너로부터 4가지 확인 질문 답변 수신 — 결과 기록 1-C / 플레이 범위 2-A / 진입 경로 3-B / 게임관리 토글 4-B.
- **CP2 완료**: PRD 최종 확정 (`docs/specs/rsp-game.md`). OQ-3 / OQ-5 / OQ-7 확정 (CP2, 2026-04-21):
  - OQ-3: 무승부 시 스트릭 유지 (카운트 영향 없음)
  - OQ-5: Excel URL `/admin/rsp/excel` 확정 (쿼리파라미터 방식 폐기)
  - OQ-7: `winRate` 0~1 범위 소수, 소수점 4자리 반올림 / `totalPlays = 0` 이면 `null`
- **CP3 완료**: designer UX 명세 최종 확정. D-1 B ("다음 판" 버튼만) / D-2 B (완전 숨김).
- **CP4 완료**: developer-backend API 계약 + 구현 + 테스트 25/25 통과.
- **프론트엔드 구현 완료**: `tsc` / `vite build` 통과, RSP 관련 파일 ESLint 클린.
- **CP5 생략**: 프로젝트 오너 결정으로 qa-tester 단계 건너뜀. QA 검증 없이 세션 종료.

### 남은 OQ 상태
- OQ-3 / OQ-5 / OQ-7: **확정 (CP2)**.
- OQ-1 / OQ-2 / OQ-6: CP4 단계에서 developer-backend가 결정 후 반영 (세부 기록은 developer-backend progress 참조).
- OQ-8: CP3 단계에서 designer가 결정 후 반영 (세부 기록은 designer progress 참조).
- OQ-4: MVP 외 후속 검토 항목 — 변경 없음.

### 다음 세션 인계 사항
- **커밋/푸시 여부는 프로젝트 오너 결정 대기** — 본 세션에서 git 작업 수행하지 않음.
- **ESLint 기존 에러 54건**은 RSP 무관 기존 파일에서 발생 — 별도 이슈로 분리 권장.
- **환경변수 추가 없음** — Vercel / Railway 반영 작업 불필요.
- QA 미수행 상태이므로 후속 세션에서 qa-tester 재착수 시 `docs/review/rsp-game-test-plan.md` 부재 상태부터 시작해야 함.

---

## 후속 액션 (online-rps로 교체됨)

- 2026-04-24: online-rps 프로젝트로 전면 교체됨. `docs/specs/online-rps-prd.md` 참조.
