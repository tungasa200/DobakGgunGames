# Project: DobakGgun Games

## 한 줄 소개
솔로플레이 미니게임 컬렉션 — 일반 모드 + Excel UI 모드

## Stack
- Frontend: React 19 + Vite + TypeScript (Vercel 배포)
- Backend: Spring Boot 3.5, Java 17, Gradle (Railway 배포)
- Database: MySQL 8 + Redis (Railway)
- Auth: Spring Security + JWT + OAuth2
- Storage: Cloudflare R2 (AWS S3 SDK)
- Email: Resend
- CI: GitHub Actions

## 디렉토리 규칙
- frontend/src/games/         : 게임별 React 컴포넌트
- frontend/src/pages/         : 라우트 페이지 (HomePage, GamePage 등)
- frontend/src/api/           : 백엔드 API 래퍼
- frontend/src/components/    : 공통 컴포넌트
- frontend/src/styles/        : 공통 CSS (excel.css 등)
- backend/src/main/java/com/dobakggun/controller/ : REST 컨트롤러
- backend/src/main/java/com/dobakggun/service/    : 비즈니스 로직
- backend/src/main/java/com/dobakggun/entity/     : JPA 엔티티
- backend/src/main/java/com/dobakggun/dto/        : 요청/응답 DTO
- backend/src/main/java/com/dobakggun/repository/ : Spring Data JPA
- backend/src/main/java/com/dobakggun/security/   : 보안 설정
- backend/src/main/java/com/dobakggun/config/     : Spring 설정
- shared/                     : 프론트엔드 + 백엔드 공유 리소스 (badwords.json 등)
- docs/specs/                 : PRD, 유저 스토리 (planner 소유)
- docs/design/                : UX 플로우, 컴포넌트 명세 (designer 소유)
- docs/progress/              : 팀원별 진행 로그 (PC 간 인수인계 핵심)
- docs/review/                : 테스트 플랜, 버그 리포트 (qa-tester 소유)

## 코딩 규칙
- 커밋 컨벤션: Conventional Commits (feat/fix/docs/refactor/test/chore, 한국어 본문 허용)
- 브랜치 전략: WIP 브랜치에서 작업 → main 머지로 운영 반영
- PR 전 필수: frontend는 `tsc -b && eslint .` 통과, backend는 `./gradlew test` 통과
- 코드 스타일: ESLint + TypeScript strict (frontend), Lombok + Java 17 (backend)
- DB 스키마 변경: migration 파일(SQL) 또는 Liquibase 변경분으로만

## 환경변수 정책 (중요)
- **로컬 `.env` 파일은 템플릿/참조용이며 실제 사용되지 않음**
- **실제 환경변수는 Vercel (프론트) / Railway (백엔드) UI에만 저장됨**
- 코드에서 새 환경변수를 참조하게 되면, 팀원은 반드시 사용자에게 다음을 알림:
  - 추가해야 할 변수명
  - Vercel 또는 Railway 중 어디에 넣어야 하는지
  - 값의 형식/예시 (실제 값은 사용자가 직접 입력)
- `.env.example` 파일이 있는 경우에만 변수명 반영 (값은 절대 넣지 않음)
- `.env`, `.env.local`, `.env.production` 등 실제 값이 든 파일은 커밋 금지

## 금기
- shared/badwords.json 무단 수정 금지 — 변경 시 planner 승인 필요
- Railway 프로덕션 DB에 직접 쓰기 쿼리 금지 (읽기 전용 접근만)
- Vercel 환경변수 UI 수정은 Claude가 직접 못 함 — 사용자에게 지시사항 전달
- 기존 게임 로직 변경 시 반드시 qa-tester 검증 거치기

## Excel 모드 정책
- 이 프로젝트는 **일반 모드**와 **Excel UI 모드** 두 가지 테마를 가짐
- **Excel 모드 적용 여부는 사용자가 기능 요청 시점에 명시**
- 사용자가 "Excel 모드도 필요"라고 지시한 경우:
  - planner는 PRD "모드 적용 범위" 필드에 명시
  - designer는 양쪽 모드 명세 작성 필수
  - developer-frontend는 양쪽 구현 필수
  - qa-tester는 양쪽 동작 검증 필수 — 한쪽만 구현된 PR은 반려
- 사용자 지시가 없으면 일반 모드만 (나중에 추가 요청으로 Excel 모드 확장 가능)

## CI/CD 정책
- 팀원은 CI 실패 로그를 직접 모니터링하지 않음
- 빌드/배포 실패 시 **사용자가 로그를 긁어서 제공**
- 제공받은 로그를 기반으로 originator 팀원(developer-frontend 또는 -backend)이 진단 및 수정
- 수정 후 다시 push → 사용자가 성공/실패 결과 알림

## AI 팀 운영 규칙
- 모든 팀원은 작업 시작 시 docs/progress/{role}-{feature}.md 확인
- 세션 종료 전 반드시 docs/progress/ 업데이트 (PC 간 인계 핵심)
- 파일 소유권:
  - planner            → docs/specs/
  - designer           → docs/design/, frontend/src/styles/
  - developer-frontend → frontend/
  - developer-backend  → backend/
  - qa-tester          → docs/review/
  - shared/ 수정은 반드시 planner 승인 후 담당 developer가 수행
- 같은 파일을 두 팀원이 동시에 편집하지 않음
- 스펙 변경은 반드시 planner를 거침
- 프론트/백 양쪽이 필요한 기능은 API 계약(DTO, 엔드포인트)을 **먼저 확정** 후 병렬 작업

## 세션 종료 체크리스트
1. 모든 팀원 idle 확인
2. 각 팀원 docs/progress/ 업데이트 완료 확인
3. `Clean up the team` 호출
4. git add → commit → push (WIP 브랜치 또는 main)
