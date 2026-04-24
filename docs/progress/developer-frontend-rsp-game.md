# Progress — developer-frontend : RSP (가위바위보) 어드민 전용 게임

- 소유 팀원: developer-frontend
- 기능 키: `rsp`
- 최종 업데이트: 2026-04-21
- 관련 문서:
  - PRD: `docs/specs/rsp-game.md`
  - UX 명세: `docs/design/rsp-game.md`
  - API 계약: `docs/specs/rsp-api-contract.md`

---

## 현재 상태

**구현 완료 — tsc/eslint 통과 대기 (빌드 명령 실행 필요)**

---

## 구현 완료 파일 목록

### 신규 생성
- `frontend/src/games/rsp/useRspGame.ts` — 게임 상태 훅 (useReducer 기반)
- `frontend/src/games/rsp/RspBoard.tsx` — 일반 모드 + Excel 모드 통합 보드 컴포넌트
- `frontend/src/games/rsp/RspBoard.module.css` — CSS 모듈 (디자인 명세 토큰 준수)
- `frontend/src/pages/admin/AdminRspPage.tsx` — `/admin/rsp` 라우트 페이지
- `frontend/src/pages/admin/AdminRspExcelPage.tsx` — `/admin/rsp/excel` 라우트 페이지

### 수정
- `frontend/src/api/admin.ts` — `adminRspApi` (playRound/getStats) 추가. 기존 `req<T>` 헬퍼 재활용
- `frontend/src/App.tsx` — `/admin/rsp`, `/admin/rsp/excel` 라우트 2개 추가. AdminLayout 중첩 라우트 위에 선언

---

## 아키텍처 smell 재발 방지 체크

- [x] `request<T>()` 신규 작성 금지 — 기존 `req<T>` 헬퍼 재활용 (`admin.ts` 내)
- [x] `GAME_LABELS`, `GameConfig`, `ExcelShell GAMES` 배열에 RSP 미등록
- [x] 랭킹 API (`api/rankings.ts`) 수정 없음
- [x] `AdminDashboardPage.tsx` RSP 링크/힌트 추가 없음 (D-2 완전 숨김 준수)
- [x] `AdminGamesPage.tsx` 토글 목록 미추가
- [x] `HomePage.tsx` / `ExcelHomePage.tsx` 게임 카드 미추가
- [x] 사이드바 컴포넌트 수정 없음
- [x] ExcelShell GAMES 배열 수정 없음 (홈 드롭다운 비노출 유지)

---

## 주요 구현 결정사항

### 1. useRspGame 아키텍처
- `useReducer` 기반으로 상태 머신 구현 (idle/submitting/revealing/result/error)
- `revealing` → `result` 전환: setTimeout 600ms (shake 300ms + fadeIn 300ms)
- 무승부 스트릭 유지: DRAW 시 streak 변경 없음 (OQ-3 확정)
- 에러 시 세션 카운트 미증가 (EC-3 준수)

### 2. ExcelShell 단독 렌더 POC
- `ExcelShell` 컴포넌트가 내부에 `ExcelShellProvider`를 포함하므로 별도 Provider 불필요
- `AdminRspExcelPage.tsx`에서 `<ExcelShell game="rsp" ...>` 직접 사용
- GAMES 배열에 미등록된 상태에서도 ExcelShell이 정상 렌더됨 (홈 드롭다운만 비노출)

### 3. Excel 모드 시트 탭
- 'ranking' SheetTab을 히스토리 탭으로 재사용 (ExcelShellContext 타입 변경 없이)
- `activeSheet === 'ranking'` 분기에서 `ExcelHistorySheet` 렌더링

### 4. 라우트 충돌 방지
- `/admin/rsp` 라우트를 `/admin` 중첩 라우트(AdminLayout) **위**에 선언
- React Router v7은 선언 순서 기반으로 매칭하므로 더 구체적인 경로가 먼저 매칭됨

### 5. 진입 경로 완전 숨김 (D-2)
- 어떤 기존 파일에도 RSP 관련 링크/힌트 추가 없음
- URL 직접 입력/북마크 전용

---

## 수동 검증 체크리스트

- [ ] `/admin/rsp` 미로그인 → `/login` 리다이렉트
- [ ] `/admin/rsp` USER role → `/` 리다이렉트
- [ ] `/admin/rsp` ADMIN role → 정상 게임 화면 렌더
- [ ] 가위/바위/보 선택 → 서버 응답 → revealing 애니메이션 → result 상태
- [ ] "다음 판" 버튼 클릭으로만 idle 복귀 (자동 전환 없음)
- [ ] 세션 카운트 (승/패/무) 정확히 누적
- [ ] 무승부 후 스트릭 유지 확인
- [ ] 연승 후 패 → 연패 1로 초기화 확인
- [ ] 네트워크 에러 시 에러 배너 표시, 세션 카운트 미증가
- [ ] 키보드 1/2/3 선택 동작
- [ ] Escape 키로 다음 판 전환 (result 상태)
- [ ] 세션 초기화 버튼 → 세션 카운트 리셋, 서버 통계 유지
- [ ] 누적 통계 (진입 시 GET /stats 호출 후 표시)
- [ ] winRate null → "-" 표시
- [ ] /admin/rsp/excel → Excel 모드 정상 렌더
- [ ] Excel 모드 리본 가위/바위/보 버튼 클릭
- [ ] Excel 모드 수식바 상태별 업데이트
- [ ] Excel 모드 상태바 통계 업데이트
- [ ] Excel 모드 히스토리 탭 (랭킹 탭 재사용) 플레이 기록 표시
- [ ] Excel 모드 룰 탭 판정 규칙 표
- [ ] 홈, Excel 홈, 사이드바, AdminDashboard, AdminGamesPage 어디에도 RSP 미노출

---

## 진행 중

없음.

---

## 블로커 / 질문

없음. 백엔드 API 확정 완료 (CP4).

---

## 다음 단계

1. `cd frontend && tsc -b && eslint .` 통과 확인 (사용자가 실행 후 결과 알림)
2. qa-tester에게 E2E 검증 요청
3. Railway/Vercel 프로덕션 배포 후 스모크 테스트

---

## 세션 종료 로그 — 2026-04-21

### 빌드/린트 결과

- `tsc -b`: 통과 (112 modules transformed)
- `vite build`: 성공 (dist 번들 생성)
- `eslint .` RSP 관련 파일 (useRspGame.ts, RspBoard.tsx, RspBoard.module.css, AdminRspPage.tsx, AdminRspExcelPage.tsx, admin.ts RSP 추가분, App.tsx 라우트 추가분): **0 errors / 0 warnings — 클린**
- `eslint .` 프로젝트 전체: 54 problems (32 errors, 22 warnings) — **모두 기존 파일** (AdminDashboardPage, AdminGamesPage, AdminIpBansPage, AdminPatchNotesPage, utils/validate.ts, 기타 기존 게임 컴포넌트). RSP 작업 범위 밖이며 별도 이슈로 분리 권장.

### 최종 수정/생성 파일 목록

**신규 생성 (5개)**
- `frontend/src/games/rsp/useRspGame.ts`
- `frontend/src/games/rsp/RspBoard.tsx`
- `frontend/src/games/rsp/RspBoard.module.css`
- `frontend/src/pages/admin/AdminRspPage.tsx`
- `frontend/src/pages/admin/AdminRspExcelPage.tsx`

**수정 (2개)**
- `frontend/src/api/admin.ts` — `adminRspApi` (playRound / getStats) 추가, 기존 `req<T>` 재활용
- `frontend/src/App.tsx` — `/admin/rsp`, `/admin/rsp/excel` 라우트 2개 추가

### 아키텍처 smell 재발 방지 최종 확인

- `request<T>()` 신규 헬퍼 없음 — 기존 `req<T>` 재활용
- `GAME_LABELS`, `GameConfig`, `ExcelShell GAMES` 배열 미수정
- `api/rankings.ts` 미수정
- `AdminDashboardPage` / `HomePage` / `ExcelHomePage` / 사이드바 어디에도 RSP 추가 없음 (D-2 완전 숨김 준수)

### UX 명세 준수 최종 확인

- D-1 "다음 판" 버튼만, 자동 전환 없음
- D-2 완전 숨김 (URL 직접 입력/북마크 전용)
- 키보드 1/2/3 선택 단축키 및 Escape 다음 판 단축키
- `aria-label` / `aria-live` / `aria-pressed` 접근성 속성 적용

### CP5 (qa-tester 검증) 생략 사실

- **사용자 결정으로 QA 단계(CP5) 건너뜀**
- qa-tester E2E 검증 미진행
- 브라우저 수동 검증(접근 제어 / USER 리다이렉트 / 게임 플레이 / Excel 모드 / 미노출 확인) 미진행

### 다음 세션 참고 — 브라우저 수동 검증 필요 체크리스트

접근 제어:
- [ ] `/admin/rsp` 미로그인 → `/login` 리다이렉트
- [ ] `/admin/rsp` USER role → `/` 리다이렉트
- [ ] `/admin/rsp` ADMIN role → 정상 게임 화면 렌더
- [ ] `/admin/rsp/excel` 동일 접근 제어 동작

게임 플레이 (일반 모드):
- [ ] 가위/바위/보 클릭 → submitting → revealing 애니메이션 → result 상태
- [ ] "다음 판" 버튼으로만 idle 복귀 (자동 전환 없음)
- [ ] 키보드 1/2/3 선택, Escape 다음 판 전환
- [ ] submitting/revealing 중 버튼 비활성화

통계:
- [ ] 세션 승/패/무 카운트 정확도
- [ ] 무승부 후 스트릭 유지
- [ ] 연승 → 패 시 연패 1 초기화
- [ ] 누적 통계 진입 시 서버에서 로드 (GET /stats)
- [ ] winRate null → "-" 표시
- [ ] 세션 초기화 버튼 → 세션 카운트만 리셋, 누적 통계 유지

에러 처리:
- [ ] 네트워크 차단 시 에러 배너 표시, 세션 카운트 미증가
- [ ] 에러 배너 닫기 후 idle 복귀

Excel 모드:
- [ ] `/admin/rsp/excel` 정상 렌더
- [ ] 리본 가위/바위/보 버튼 클릭 → 게임 동작
- [ ] 수식바 상태별 업데이트
- [ ] 상태바 스트릭/세션/누적 업데이트
- [ ] 히스토리 탭 플레이 기록, 룰 탭 판정 규칙 표

미노출 확인:
- [ ] 홈(`/`), Excel 홈(`/excel`), 어드민 사이드바, AdminDashboard(`/admin`), AdminGamesPage(`/admin/games`) 어디에도 RSP 노출 없음

### 환경변수 / 배포 추가 작업

- 환경변수 추가 없음
- Vercel 및 Railway 추가 설정 없음

---

## 2026-04-24 메모 — Online RPS 전환 완료

이 기능(admin-rsp)은 Online RPS(멀티플레이)로 전면 교체되었습니다.

### 제거된 파일
- `frontend/src/games/rsp/RspBoard.tsx` (삭제)
- `frontend/src/games/rsp/useRspGame.ts` (삭제)
- `frontend/src/games/rsp/RspBoard.module.css` (삭제)
- `frontend/src/pages/admin/AdminRspPage.tsx` (삭제)
- `frontend/src/pages/admin/AdminRspExcelPage.tsx` (삭제)
- `frontend/src/api/admin.ts` adminRspApi 섹션 제거
- `frontend/src/App.tsx` `/admin/rsp`, `/admin/rsp/excel` 라우트 제거

### 신규 기능
- `frontend/src/pages/OnlineRpsPage.tsx` (`/online-rps` 라우트)
- 상세: `docs/progress/developer-frontend-online-rps.md` 참조

---

## qa-tester에게 요청할 검증 항목

### 접근 제어
- [ ] 미로그인 → `/admin/rsp`, `/admin/rsp/excel` 진입 시 `/login` 리다이렉트
- [ ] USER role 로그인 → 동일 URL 진입 시 `/` 리다이렉트
- [ ] ADMIN role → 정상 접근

### 게임 플레이 (일반 모드)
- [ ] 가위/바위/보 각 3가지 선택 동작
- [ ] 키보드 1/2/3 단축키 선택
- [ ] submitting/revealing 중 버튼 비활성화 (더블클릭 방지)
- [ ] result 상태에서 "다음 판" 버튼으로만 idle 복귀 (자동 전환 없음)
- [ ] Escape 키 다음 판 단축키
- [ ] 판정 결과 WIN/LOSS/DRAW 올바른 배너 표시

### 통계 정확성
- [ ] 세션 승/패/무 카운트 정확도
- [ ] 무승부 후 스트릭 유지 확인
- [ ] 연승 → 패 시 연패 1 초기화
- [ ] 연패 → 승 시 연승 1 초기화
- [ ] 누적 통계 (진입 시 서버에서 로드)
- [ ] winRate = null 시 "-" 표시
- [ ] winRate = 0.4706 → "47.1%" 표시 (소수점 1자리)
- [ ] 세션 초기화 버튼 → 세션 카운트만 리셋, 누적 통계 유지

### 에러 처리
- [ ] 네트워크 차단 시 에러 배너 표시
- [ ] 에러 시 세션 카운트 미증가
- [ ] 에러 배너 닫기(다시 시도) 후 idle 복귀

### Excel 모드
- [ ] `/admin/rsp/excel` 정상 렌더 (Excel 쉘 레이아웃)
- [ ] 리본 가위/바위/보 버튼 클릭 → 게임 동작
- [ ] submitting/revealing 중 리본 버튼 비활성화
- [ ] 수식바 상태별 업데이트 (idle: 빈값, submitting: =SUBMITTING(), result: =WIN(...) 등)
- [ ] 상태바 스트릭/세션/누적 업데이트
- [ ] "게임" 탭 → 게임 보드 렌더
- [ ] "히스토리" 탭 → 세션 플레이 기록 테이블
- [ ] "룰" 탭 → 판정 규칙 표
- [ ] Excel 홈 드롭다운에 RSP 미노출

### 미노출 확인 (FR-M9)
- [ ] 홈 (`/`) 게임 카드에 RSP 없음
- [ ] Excel 홈 (`/excel`) 게임 카드/드롭다운에 RSP 없음
- [ ] 어드민 사이드바에 RSP 메뉴 없음
- [ ] AdminDashboard (`/admin`) 어디에도 RSP 링크/힌트 없음
- [ ] AdminGamesPage (`/admin/games`) 토글 목록에 RSP 없음
