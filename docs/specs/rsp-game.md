# PRD — 어드민 전용 가위바위보 (RSP) 미니게임

- 작성자: planner
- 최초 작성일: 2026-04-21
- 최종 확정일: 2026-04-21
- 상태: **최종 확정 (CP2 승인됨)**
- 승인자: 프로젝트 오너 (사용자) — 2026-04-21 CP2 승인 완료
- 확정 이력:
  - 2026-04-21 CP2 승인 — OQ-3 / OQ-5 / OQ-7 잠정안 그대로 확정
- 관련 문서:
  - `docs/review/architecture.md` (재발 방지 메모 근거)
  - `docs/progress/planner-rsp-game.md` (작업 로그)

---

## 1. 배경 및 목적

### 배경
- DobakGgun Games 는 솔로플레이 미니게임 컬렉션으로 현재 6종 게임(지뢰찾기/숫자야구/블록폴/솔리테어/사과게임/스도쿠) + 블록폴 인세인 모드(어드민 전용)를 운영 중.
- 어드민 전용 경량 미니게임이 필요함. 부담 없이 즐길 수 있고, 서버/DB에 랭킹 데이터를 오염시키지 않는 **어드민 개인 플레이용** 게임.
- 기존 어드민 전용 사례(블록폴 인세인)는 랭킹 시스템에 포함되어 `blockfall-insane` 관련 누락 이슈를 만들었음. RSP는 **처음부터 랭킹 시스템과 완전히 분리**하여 이런 smell의 재발을 방지.

### 목적
- ADMIN 역할 유저만 접근 가능한 가위바위보(Rock-Scissors-Paper) 1P vs 컴퓨터 게임을 추가.
- 매 판 결과를 서버에 저장하되 **공개 랭킹/리더보드에는 노출 금지**, 어드민 본인의 누적 통계(승/패/무/승률)만 조회 가능.
- 일반 모드(`/admin/rsp`)와 Excel 모드(`/admin/rsp/excel` — OQ-5 확정) 양쪽 모두 지원.
- 세션 중 무제한 플레이 가능, 종료 시점은 어드민 의사에 맡김.

### 비목표 (Out of Scope)
- 멀티플레이, 친구 초대, PvP 매칭.
- 일반 USER / 게스트 접근 허용.
- 공개 랭킹, 홈/Excel 홈 카드 노출, 사이드바 메뉴 노출.
- `AdminGamesPage` active/inactive 토글 대상 포함.

---

## 2. 유저 스토리

- **US-1 (핵심)** — As an admin, I want to play rock-scissors-paper against the computer, so that I can quickly take a mental break without leaving the admin area.
- **US-2** — As an admin, I want to keep playing consecutive rounds without being kicked out, so that I can play as long as I like.
- **US-3** — As an admin, I want my win/loss/draw counts to persist across sessions, so that I can see my long-term record.
- **US-4** — As an admin, I want the current session streak (e.g. 연승 3판) to be visible while I play, so that I feel a sense of progress beyond a single round.
- **US-5** — As an admin, I do not want this game to appear to regular users or in the sidebar/home/excel/game management screens, so that it stays a private tool.
- **US-6** — As an admin, I want this to work in both the standard theme and the Excel UI theme, so that it is consistent with how other games render.
- **US-7** — As an admin, I want a reliable result (no client-side cheating my own stats), so that my record reflects actual play.

---

## 3. 모드 적용 범위 (**필수 필드**)

- **일반 모드: 필수 (Must)**
- **Excel 모드: 필수 (Must)**
- 사용자 지시: "일반+Excel 모드 양쪽 필수" 명시됨.
- designer는 양쪽 모드 화면 명세 작성 필수.
- developer-frontend는 양쪽 구현 필수.
- qa-tester는 양쪽 동작 검증 필수 — 한쪽만 구현된 PR은 반려.
- Excel 모드 라우트는 Excel 쉘 안에서 동작하되, 일반 유저 Excel 홈(`/excel`)의 게임 목록에는 **노출 금지**. Excel 모드 접근은 직접 URL 입력 **`/admin/rsp/excel`** (OQ-5 확정) 으로만 허용하며 AdminRoute로 감쌈.

---

## 4. 기능 요구사항

### 4.1 Must (MVP 필수)
| ID | 요구사항 |
|---|---|
| FR-M1 | 가위/바위/보 3개 선택 버튼 UI — 일반 모드와 Excel 모드 양쪽에서 렌더링 |
| FR-M2 | 어드민이 선택 후 컴퓨터의 선택을 **서버**에서 랜덤 생성 (클라이언트 조작 방지) |
| FR-M3 | 승/패/무 판정 규칙: 가위>보, 보>바위, 바위>가위, 동일=무승부 — **서버에서 판정** |
| FR-M4 | ADMIN 역할만 접근. AdminRoute로 프론트 보호 + SecurityConfig에서 `/api/admin/rsp/**` → `hasRole("ADMIN")` |
| FR-M5 | 한 세션에서 무제한 반복 플레이 가능 ("다시하기" 또는 즉시 재선택) |
| FR-M6 | 매 판마다 결과 서버 저장: `admin_rsp_play` 테이블에 1행 insert |
| FR-M7 | 어드민 본인 누적 통계 조회 API — totalPlays, wins, losses, draws, winRate |
| FR-M8 | 통계 페이지 또는 게임 화면 하단에 본인 누적 전적 표시 |
| FR-M9 | 이 게임은 **공개 랭킹/리더보드/홈/Excel 홈/사이드바/게임 관리 토글 어디에도 노출 금지** |
| FR-M10 | 유저 식별은 JWT 기반 (`@AuthenticationPrincipal` 또는 SecurityContext) — 클라이언트가 userId 전달 금지 |
| FR-M11 | `RankingService.VALID_GAMES` 및 기존 Ranking 시스템에 `rsp` 추가 금지 (분리 유지) |

### 4.2 Should (MVP 포함 권장)
| ID | 요구사항 |
|---|---|
| FR-S1 | 세션 내 누적 전적 프론트 상태로 표시 (승 X / 패 Y / 무 Z) |
| FR-S2 | 연승/연패 스트릭 표시 (예: "연승 3판" / "연패 2판") |
| FR-S3 | 어드민 선택 → 컴퓨터 선택 공개 시 간단한 리빌 애니메이션(흔들림/카운트다운 등) — designer가 구체 명세 |
| FR-S4 | "초기화" 버튼: 현재 세션 카운트만 리셋 (서버 통계 영향 없음) |
| FR-S5 | 서버 응답 지연 시 버튼 더블클릭 방지 (in-flight 상태 관리) |

### 4.3 Nice-to-have (후순위)
| ID | 요구사항 |
|---|---|
| FR-N1 | 컴퓨터 AI 난이도 선택 ("진짜 랜덤" / "어드민의 패턴 학습") — 데이터 충분해진 후 별도 PRD |
| FR-N2 | 일자별 전적 차트 (최근 7일 승률 라인) |
| FR-N3 | 사운드 이펙트 on/off |
| FR-N4 | "오늘의 컨디션" 등 소소한 메시지 |

### 4.4 Won't (이번 작업 범위 외 — 명시적 제외)
- 멀티플레이, PvP, 친구 초대
- 공개 랭킹/리더보드 포함
- 일반 USER / 게스트 접근
- 사이드바 메뉴 추가 / 홈·Excel 홈 카드 노출
- `AdminGamesPage` 토글 목록 포함
- 어드민 간 전적 비교(= 개인 전용 유지)

---

## 5. 게임 규칙 / 점수 정책

- **판정 테이블 (서버 SSOT)**
  | user \ computer | ROCK | SCISSORS | PAPER |
  |---|---|---|---|
  | ROCK     | DRAW | WIN  | LOSS |
  | SCISSORS | LOSS | DRAW | WIN  |
  | PAPER    | WIN  | LOSS | DRAW |
- 점수 개념 없음 (승/패/무 카운트만).
- 타이머 없음 (본인 페이스로 플레이).
- 레벨 없음.
- 무제한 플레이 — 세션 종료는 어드민이 화면을 떠나는 순간.
- **세션 경계**
  - 서버 저장 단위: 매 판 1 row (세션 ID 컬럼 없음 — 초기 스펙 단순화).
  - 프론트 세션: 페이지 진입~이탈 동안 in-memory 카운트(연승/연패/총 Win/Loss/Draw 포함) 유지. 페이지 이탈 시 서버 누적 통계는 그대로 유지되고 세션 카운트만 리셋.
- **연승/연패 계산 (OQ-3 확정)**
  - 프론트 로컬 상태로 계산.
  - **무승부는 스트릭을 유지** — 카운트에 영향을 주지 않음 (증가/초기화 모두 없음).
    - 예: 3연승 후 무승부 → 여전히 "3연승"으로 표시.
    - 예: 2연패 후 무승부 → 여전히 "2연패"로 표시.
    - 예: 스트릭 없음(0) 상태에서 무승부 → 여전히 스트릭 없음.
  - 연승 중 패: 연승 초기화 후 연패 1로 시작.
  - 연패 중 승: 연패 초기화 후 연승 1로 시작.

---

## 6. 엣지 케이스 & 에러 시나리오

| # | 시나리오 | 처리 |
|---|---|---|
| EC-1 | 비로그인 상태로 `/admin/rsp` 진입 | AdminRoute → `/login` 리다이렉트 |
| EC-2 | USER 역할이 `/admin/rsp` 진입 | AdminRoute → `/` 리다이렉트 (기존 정책 유지) |
| EC-3 | 네트워크 에러로 결과 저장 실패 | 토스트/배너 에러 표시, 세션 카운트는 올리지 않음 (일관성 우선) |
| EC-4 | 한 판 결과 저장 응답 전에 재선택 시도 | 버튼 비활성화로 방지 (FR-S5) |
| EC-5 | userChoice 에 유효하지 않은 값 전송 | 서버 400 Bad Request |
| EC-6 | 통계 조회 시 플레이 기록 0건 | `{ totalPlays: 0, wins: 0, losses: 0, draws: 0, winRate: null }` 반환 (OQ-7 확정 포맷 준수) |
| EC-7 | JWT 만료/무효 | 401 Unauthorized → 프론트 로그아웃 플로우(기존 정책) |
| EC-8 | ADMIN이 토큰 조작해 userId 위조 시도 | 서버가 `@AuthenticationPrincipal` 로만 userId 추출하므로 무시 |
| EC-9 | DB 저장 중 예외 | 500 반환, 프론트는 "결과를 저장하지 못했습니다. 다시 시도해주세요." 메시지 |
| EC-10 | 어드민 Role이 러닝 타임에 USER로 변경됨 | 다음 요청부터 403. 프론트 가드는 AuthContext 재로드 시점에 반영 |
| EC-11 | Excel 모드 쉘 외부 렌더(컨텍스트 누락) | 기존 패턴대로 `if (!excel) return;` 가드 또는 `useExcelShell` 하드 의존 회피 |

---

## 7. API 계약 초안

> 주의: 백엔드 최종 DTO/서명은 developer-backend와 협의 후 확정. planner가 제시하는 **초안** 수준.

### 7.1 `POST /api/admin/rsp/plays`
어드민이 낸 선택만 전달. 컴퓨터 선택/결과 판정은 서버가 수행.

**Request Body**
```json
{
  "userChoice": "ROCK"   // "ROCK" | "SCISSORS" | "PAPER"
}
```

**Response 200**
```json
{
  "id": 123,
  "userChoice": "ROCK",
  "computerChoice": "SCISSORS",
  "result": "WIN",       // "WIN" | "LOSS" | "DRAW"
  "playedAt": "2026-04-21T12:34:56Z",
  "stats": {
    "totalPlays": 17,
    "wins": 8,
    "losses": 7,
    "draws": 2,
    "winRate": 0.4706    // 0~1 소수 4자리 (OQ-7 확정). totalPlays=0 이면 null
  }
}
```
- `stats`를 같이 돌려주면 프론트가 저장 후 별도 GET을 호출하지 않아도 되어 RTT 절약. 포함 여부는 backend 선호에 따라 조정 가능 (OQ-1).
- `winRate` 포맷(OQ-7 확정): **0~1 범위 소수, 소수점 4자리 반올림** (예: 0.6667). `totalPlays = 0`인 경우 `null`. 퍼센트 변환은 프론트 담당.

**Auth**: Bearer JWT (ADMIN 필수).
**Validation**: `userChoice` 3개 enum 외 값 → 400.
**Rate limit**: 별도 제한 없음 (무제한 플레이 정책). 단, 추후 남용 방지 필요시 `N회/분` 검토.

---

### 7.2 `GET /api/admin/rsp/stats`
어드민 본인 누적 통계 조회.

**Response 200**
```json
{
  "totalPlays": 42,
  "wins": 20,
  "losses": 18,
  "draws": 4,
  "winRate": 0.5263       // 0~1 소수 4자리 (OQ-7 확정). totalPlays=0 이면 null
}
```
- `winRate` 포맷(OQ-7 확정): **0~1 범위 소수, 소수점 4자리 반올림**. 퍼센트(% 표기)는 프론트 변환.

**Auth**: Bearer JWT (ADMIN 필수). 타 어드민 통계는 조회 불가 (본인 것만).

---

### 7.3 (선택) `DELETE /api/admin/rsp/plays`
본인 기록 전체 삭제. Should/Nice-to-have — MVP 범위 외.

---

### 7.4 세션 집계 방식
- **서버에 세션 엔드포인트 추가하지 않음** (무제한 플레이의 세션 경계가 불명확).
- 프론트 상태(`useState` / `useReducer`)로만 세션 누적 카운트와 스트릭 관리.
- 새로고침 시 세션 카운트 리셋은 허용 (서버 누적은 보존).

---

### 7.5 프론트 API 래퍼 정책 (재발 방지)
- `docs/review/architecture.md`의 High 지적사항 "10개 `request<T>` 중복" 재발 방지.
- **신규 게임이라고 별도 `api/rsp.ts` 파일에 `BASE + request<T>()` 재작성 금지.**
- 권장: `frontend/src/api/admin.ts` 에 `adminRspApi.playRound(token, userChoice)` / `adminRspApi.getStats(token)` 추가. 기존 `adminXxxApi` 패턴 재활용.
- 또는 별도 파일 생성 시에도 `request` 헬퍼는 **반드시 재활용** — 중복 작성 금지 (developer-frontend가 판단 후 선택).

---

## 8. DB 스키마 초안

### 8.1 신규 테이블: `admin_rsp_play`
```sql
CREATE TABLE admin_rsp_play (
    id              BIGINT AUTO_INCREMENT PRIMARY KEY,
    admin_user_id   BIGINT NOT NULL,
    user_choice     ENUM('ROCK','SCISSORS','PAPER') NOT NULL,
    computer_choice ENUM('ROCK','SCISSORS','PAPER') NOT NULL,
    result          ENUM('WIN','LOSS','DRAW') NOT NULL,
    played_at       DATETIME(6) NOT NULL,
    CONSTRAINT fk_admin_rsp_play_user
        FOREIGN KEY (admin_user_id) REFERENCES users(id)
        ON DELETE CASCADE,
    INDEX idx_admin_rsp_play_user_played (admin_user_id, played_at DESC)
);
```

**설계 근거**
- `result` 컬럼은 `user_choice` + `computer_choice`로 계산 가능하지만, 집계 쿼리 단순화를 위해 역정규화 저장.
- `admin_user_id` + `played_at` 복합 인덱스: 최근 플레이 조회 및 통계 집계 최적화.
- 세션 컬럼은 초기 MVP에서 제외 — 서버는 판 단위 저장만 담당.

### 8.2 기존 migration 운영 방식 확인
- `backend/src/main/resources/application.properties`: `spring.jpa.hibernate.ddl-auto=update` 사용 중.
- 별도 Flyway/Liquibase 없음 → **JPA 엔티티 추가만으로 DDL 자동 생성** 가능.
- 다만 운영 DB 스키마 변경 투명성을 위해 `backend/src/main/resources/db/migration/` 에 `V{n}__create_admin_rsp_play.sql` 형태로 **참조 SQL 파일을 함께 커밋** 권장 (현재 해당 폴더가 존재하지 않으면 신규 생성).
- 최종 결정은 developer-backend가 판단 (OQ-2).

### 8.3 엔티티 초안
```java
@Entity
@Table(name = "admin_rsp_play")
public class AdminRspPlay {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "admin_user_id", nullable = false)
    private Long adminUserId;

    @Enumerated(EnumType.STRING)
    @Column(name = "user_choice", nullable = false, length = 10)
    private RspChoice userChoice;

    @Enumerated(EnumType.STRING)
    @Column(name = "computer_choice", nullable = false, length = 10)
    private RspChoice computerChoice;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private RspResult result;

    @CreationTimestamp
    @Column(name = "played_at", nullable = false, updatable = false)
    private LocalDateTime playedAt;
}

public enum RspChoice { ROCK, SCISSORS, PAPER }
public enum RspResult { WIN, LOSS, DRAW }
```

---

## 9. 보안 / 권한

- **SecurityConfig**: `/api/admin/**` → `hasRole("ADMIN")` 이미 매핑됨 (`SecurityConfig.java:64`). `/api/admin/rsp/**`는 자동으로 보호됨 — 별도 설정 불필요. 단, 변경 시 통합 테스트 추가 권장.
- **프론트 AdminRoute**: 기존 컴포넌트 그대로 재사용. 비로그인 → `/login`, USER → `/`.
- **판정 로직 위치**: **서버 필수**.
  - 이유 1: 어드민이라도 본인 통계를 조작하지 않도록 일관성 유지.
  - 이유 2: 클라이언트 조작 가능성을 원천 차단 (신뢰 경계는 서버).
- **userId 출처**: 반드시 `SecurityContextHolder` / `@AuthenticationPrincipal` 에서 추출. 요청 body에 userId를 받지 않음.
- **CORS**: 기존 `/api/admin/**` 정책 그대로.
- **감사 로그**: 특별 요구 없음 (어드민 본인 전용이라 민감도 낮음).

---

## 10. 아키텍처 smell 재발 방지 메모

`docs/review/architecture.md` 지적 사항 중 본 기능 구현에 직접 연관되는 항목:

| 근거 finding | 적용 지침 |
|---|---|
| **High — Frontend `request<T>()` 10개 중복** (§3 High #4) | 신규 `api/rsp.ts` 작성 시 기존 `admin.ts` 스타일 또는 공통 helper로 통합 시도. 중복 붙여넣기 **금지**. |
| **High — `RankingService` god-class switch-on-game** (§3 High #5) | `admin_rsp_play`는 `RankingService`/`AdminRankingService`/`AdminStatsService`에 **추가하지 않음**. 별도 `AdminRspService`로 분리. |
| **Critical — `blockfall-insane` VALID_GAMES 누락** (§3 Critical) | 동일 유형 버그 재발 방지 차원에서 RSP는 **처음부터 랭킹 시스템과 완전 분리**. `VALID_GAMES`에 `rsp` 절대 추가 금지. |
| **High — 컨트롤러가 JPA 엔티티 직접 반환** (§3 High #6) | `AdminRspController`는 `AdminRspPlay` 엔티티를 반환하지 말고, `RspPlayResponse`/`RspStatsResponse` DTO로 맵핑. |
| **Medium — Home/ExcelHome 게임 카탈로그 중복** (§3 Medium) | RSP는 `GAMES`/`GAME_LIST`/`GAME_LABELS` 카탈로그에 **추가하지 않음** (홈/Excel 홈 노출 금지 요구사항과 일치). |
| **Medium — Excel Shell 결합도** (§3 Medium) | RSP는 Excel 모드를 지원하지만, 홈 카탈로그 비노출로 인해 `ExcelShell`의 `GAMES` 등록은 건너뜀. 단독 Excel 쉘 재사용 가능한지 designer/frontend가 판단. |

### GAME_LABELS/GameConfig 통합 여부
- 제안: **통합하지 않음**. 일반 유저에게 노출되지 않으므로 홈 카드 / Excel 카드 / 랭킹 게임 목록에 포함하면 안 됨.
- `AdminGamesPage`의 `GAME_LABELS`(어드민 내부용 라벨 맵)에도 등록 **하지 않음** — 게임 관리 토글 대상이 아니기 때문.
- 페이지 내부에서 필요한 라벨/아이콘은 해당 게임 페이지 컴포넌트 로컬 상수로 유지.

---

## 11. 영향 범위

### Frontend
- 신규 파일(예상):
  - `frontend/src/pages/admin/AdminRspPage.tsx`
  - `frontend/src/pages/admin/AdminRspExcelPage.tsx` (혹은 Excel 모드 분기 로직)
  - `frontend/src/games/rsp/RspBoard.tsx` 또는 단일 페이지 내 로컬 컴포넌트
  - `frontend/src/api/` 쪽 RSP 래퍼 (가능하면 `admin.ts` 에 함수 추가)
- 수정 파일:
  - `frontend/src/App.tsx` — 라우트 2개 추가 (`/admin/rsp`, `/admin/rsp/excel` 제안)
- **수정 금지** 파일:
  - `HomePage.tsx`, `ExcelHomePage.tsx`, `AdminSidebar.tsx`, `AdminGamesPage.tsx` 의 카탈로그 목록
  - `api/rankings.ts`

### Backend
- 신규 파일:
  - `entity/AdminRspPlay.java`, `entity/RspChoice.java` (enum), `entity/RspResult.java` (enum)
  - `repository/AdminRspPlayRepository.java`
  - `service/AdminRspService.java`
  - `controller/AdminRspController.java`
  - `dto/AdminRspPlayRequest.java`, `dto/AdminRspPlayResponse.java`, `dto/AdminRspStatsResponse.java`
- 수정 파일:
  - (원칙) `SecurityConfig.java`는 이미 `/api/admin/**` 보호 중 → 수정 불요
  - `RankingService.java` / `AdminRankingService.java` / `AdminStatsService.java` — **수정 금지**

### DB
- 신규 테이블 1개: `admin_rsp_play`
- 기존 테이블 스키마 변경 없음

### shared/
- 변경 없음 (`badwords.json` 등 무관)

### 환경변수
- **신규 환경변수 없음** (프론트 `VITE_*`, 백엔드 Railway 모두 추가 불요)
- 만약 후속 변경으로 RSP 관련 환경변수 (예: 난이도 모드 플래그)가 필요해지면 아래 포맷으로 PRD 보강:
  - 변수명
  - 저장 위치 (Vercel / Railway)
  - 값 형식 예시
  - 추가 이유

---

## 12. 체크포인트 및 승인자

| 체크포인트 | 책임자 | 설명 | 상태 |
|---|---|---|---|
| **CP1 — 사용자 4대 결정사항 확정** | 프로젝트 오너 | 결과 저장 C / 무제한 A / 접근 경로 B / 게임 관리 토글 B | ✅ 완료 |
| **CP2 — PRD 초안 승인** | 프로젝트 오너 | 본 문서 검토 후 승인/코멘트. OQ-3 / OQ-5 / OQ-7 확정 포함 | ✅ 완료 (2026-04-21) |
| CP3 — UX/디자인 명세 완료 | designer | `docs/design/rsp-game.md` — 일반 모드 + Excel 모드 양쪽 | ⏳ **착수 대기** |
| CP4 — API 최종 확정 | developer-backend + planner | §7 초안 → 최종 DTO/경로 동결 (OQ-1 / OQ-2 / OQ-6 남음) | ⏳ **착수 대기** |
| CP5 — 구현 완료 (FE + BE) | developer-frontend, developer-backend | 양쪽 모드 + API + DB migration | 대기 |
| CP6 — QA 검증 | qa-tester | `docs/review/rsp-game-test-plan.md` 기반 양쪽 모드 검증 | 대기 |
| CP7 — 배포 | 프로젝트 오너 | Vercel/Railway 배포 후 smoke test | 대기 |

---

## 13. 성공 지표

- 기능 정상 동작: 어드민이 `/admin/rsp` 진입 → 3선택 → 결과 확인 → 재플레이를 오류 없이 반복.
- ADMIN 외 유저가 `/admin/rsp` 접근 시 100% 리다이렉트.
- 매 판 `admin_rsp_play` row 1건 insert 성공률 ≥ 99% (네트워크 이슈 제외).
- 공개 랭킹/리더보드/홈/Excel 홈/사이드바/게임 관리 토글 어디에도 RSP 비노출 — QA 확인.
- Excel 모드와 일반 모드 동작 동등 — UI 테마만 차이.
- 아키텍처 smell 재발 없음: `RankingService.VALID_GAMES` 에 rsp 추가 금지, `request<T>()` 중복 작성 없음 — 코드리뷰 확인.

---

## 14. 오픈 퀘스천 (답변 필요)

| # | 질문 | 잠정안 / 확정안 | 상태 | 답변 필요 시점 |
|---|---|---|---|---|
| OQ-1 | `POST /api/admin/rsp/plays` 응답에 `stats`를 포함할 것인지? | 포함 (RTT 절약) | 잠정 | CP4 전 |
| OQ-2 | migration 파일을 별도 SQL로 남길 것인지 JPA DDL auto 만으로 갈 것인지? | 별도 SQL 파일 권장 | 잠정 | CP4 전 |
| OQ-3 | 연승/연패 스트릭 계산 시 무승부는 스트릭을 유지시킬 것인지 끊을 것인지? | **유지 (무는 중립, 카운트 영향 없음)** | **✅ 확정 (CP2, 2026-04-21)** | — |
| OQ-4 | 어드민이 본인 기록 전체 삭제(Reset) API 필요한가? (MVP 외) | MVP 제외, 향후 고려 | 잠정 | 후속 |
| OQ-5 | Excel 모드 접근 URL은 `/admin/rsp/excel` vs `/admin/rsp?excel=1` 중 어느 쪽? | **`/admin/rsp/excel`** | **✅ 확정 (CP2, 2026-04-21)** | — |
| OQ-6 | 컴퓨터 선택에 `SecureRandom` vs `ThreadLocalRandom` 중? | `ThreadLocalRandom` 충분 (보안 요구 낮음) | 잠정 | CP4 전 |
| OQ-7 | 통계 응답 `winRate`의 포맷 (0~1 소수 vs 0~100 정수 vs 문자열)? | **0~1 소수, 소수점 4자리 반올림 (`totalPlays=0`이면 null)** | **✅ 확정 (CP2, 2026-04-21)** | — |
| OQ-8 | 연승/연패 표시 문구/아이콘 — designer가 결정. | - | 잠정 | CP3 |

---

## 15. 참고 — 기존 유사 구현

- 블록폴 인세인 모드 (어드민 전용 루트 선례): `frontend/src/App.tsx:68-72` + `GamePage.tsx:76`
- AdminRoute 패턴: `frontend/src/components/admin/AdminRoute.tsx`
- 어드민 API 구조: `frontend/src/api/admin.ts` (래퍼 패턴 재사용 권장)
- SecurityConfig 어드민 매핑: `backend/src/main/java/com/dobakggun/config/SecurityConfig.java:64`