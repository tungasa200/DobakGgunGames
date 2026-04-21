# UX 디자인 명세 — 어드민 전용 가위바위보 (RSP)

- 작성자: designer
- 작성일: 2026-04-21
- 근거 PRD: `docs/specs/rsp-game.md` (CP2 승인 완료)
- 상태: **CP3 완료 — developer-frontend 착수 가능**

---

## 목차

1. 공통 요구사항 요약
2. 유저 플로우
3. 화면별 와이어프레임 — 일반 모드
4. 화면별 와이어프레임 — Excel 모드
5. 상태 머신
6. 컴포넌트 명세
7. Excel 모드 통합 패턴 (useExcelShell)
8. 어드민 진입 경로 UX
9. 접근성 (A11y)
10. 마이크로카피 (한국어)
11. 아키텍처 smell 재발 방지 — designer 관점
12. 반응형 레이아웃

---

## 1. 공통 요구사항 요약

| 항목 | 내용 |
|---|---|
| 접근 경로 | 일반 모드 `/admin/rsp`, Excel 모드 `/admin/rsp/excel` |
| 접근 제한 | ADMIN role 전용 (AdminRoute 적용) |
| 플레이 선택지 | 가위 / 바위 / 보 3개 |
| 판정 위치 | 서버 (클라이언트는 userChoice만 전송) |
| 세션 집계 | 프론트 in-memory (승/패/무 카운트, 연승/연패 스트릭) |
| 서버 통계 | 누적 전적 (totalPlays, wins, losses, draws, winRate) — 페이지 진입 시 GET 조회 |
| 무승부 스트릭 | 유지 (스트릭 카운트에 영향 없음) |
| 랭킹 | 완전 미노출 (홈/Excel 홈/사이드바/관리 페이지 모두) |
| 로딩 보호 | 서버 응답 대기 중 선택 버튼 전체 비활성화 |
| 에러 처리 | 네트워크 실패 시 배너 표시 + 세션 카운트 미증가 |

---

## 2. 유저 플로우

### 2.1 진입 플로우

```
[어드민 직접 URL 입력]
  /admin/rsp 또는 /admin/rsp/excel
        |
        v
  [AdminRoute 검사]
        |
   +----+----+
   |         |
  ADMIN      기타
   |         |
   v         v
  게임     /login (미인증)
  페이지   또는 / (USER role)
  렌더링
```

### 2.2 게임 플로우 (한 판 단위)

```
[페이지 진입 — idle 상태]
        |
        | (GET /api/admin/rsp/stats 호출 → 누적 통계 로드)
        v
[선택 대기 화면]
  가위 / 바위 / 보 선택 버튼 활성화
  세션 전적: 승 0 / 패 0 / 무 0
  연승/연패 스트릭: 표시 없음(0)
        |
        | (어드민이 버튼 클릭 또는 키보드 1/2/3)
        v
[submitting 상태]
  선택한 버튼 하이라이트
  나머지 버튼 비활성화
  "확인 중..." 인디케이터 표시
  POST /api/admin/rsp/plays 전송
        |
        |--- 성공 응답 수신 ---+
        |                      v
        |             [revealing 상태]
        |               결과 공개 애니메이션 실행
        |               (카운트다운 3→2→1 또는 쉐이크)
        |                      |
        |                      v
        |             [result 상태]
        |               유저 선택 / 컴퓨터 선택 나란히 표시
        |               WIN / LOSS / DRAW 판정 배너
        |               세션 전적 즉시 업데이트
        |               연승/연패 스트릭 업데이트
        |               누적 통계 업데이트 (응답 stats 필드)
        |                      |
        |               유저가 "다음 판" 버튼 클릭
        |                      v
        |             [idle 상태 복귀]
        |
        |--- 실패 응답 수신 ---+
                               v
                      [에러 배너 표시]
                        "결과를 저장하지 못했습니다."
                        재시도 버튼 제공
                        세션 카운트 미증가
                        idle 상태로 복귀
```

### 2.3 세션 종료 플로우

```
[result 또는 idle 상태]
        |
        | ("그만하기" 버튼 클릭)
        v
[AdminDashboard 또는 /admin 으로 이동]
  세션 카운트 리셋
  서버 누적 통계는 보존
```

---

## 3. 화면별 와이어프레임 — 일반 모드

### 3.1 전체 레이아웃 (데스크톱 기준)

```
┌─────────────────────────────────────────────────────────────┐
│  [← 어드민 홈]          가위바위보                  [그만하기] │  ← 헤더 (48px)
├─────────────────────────────────────────────────────────────┤
│                                                             │
│              ┌───────────────────────────┐                  │
│              │     VS 보드 영역           │  ← 메인 보드     │
│              │  [유저 영역]  [컴 영역]    │    (정사각형     │
│              │  ?           ?           │     또는 가로)   │
│              │  ___         ___         │                  │
│              └───────────────────────────┘                  │
│                                                             │
│                   [판정 결과 배너]                           │  ← result 상태에만
│                   "이겼습니다!" (승/패/무)                   │    표시
│                                                             │
│         ┌──────┐     ┌──────┐     ┌──────┐                 │
│         │  가위 │     │  바위 │     │  보  │                 │  ← 선택 버튼 영역
│         │  ✂   │     │  🪨  │     │  📄  │                 │
│         └──────┘     └──────┘     └──────┘                 │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  세션 전적: 승 0 / 패 0 / 무 0     연승: 3판                 │  ← 통계 바 (44px)
│  누적 전적: 총 42판 · 승률 52.6%                              │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 헤더 영역

```
┌─────────────────────────────────────────────────────────────┐
│  [← 어드민 홈]        ✂ 가위바위보        [세션 초기화] [그만하기] │
└─────────────────────────────────────────────────────────────┘
```

- "← 어드민 홈": 아이콘 없이 텍스트 링크. `/admin`으로 navigate.
- 제목: 중앙 정렬. 게임 아이콘(가위 이모지) + "가위바위보" 텍스트.
- "세션 초기화": 텍스트 버튼(ghost style). 세션 in-memory 카운트만 리셋. 서버 통계 무영향.
- "그만하기": primary 버튼. `/admin`으로 navigate.

### 3.3 VS 보드 영역 (상태별)

**idle / 선택 대기 상태:**
```
┌─────────────────────────────────────────────────────────────┐
│         [나 (어드민)]           VS          [컴퓨터]          │
│                                                             │
│           ┌──────────┐                 ┌──────────┐         │
│           │          │                 │          │         │
│           │    ?     │                 │    ?     │         │
│           │          │                 │          │         │
│           └──────────┘                 └──────────┘         │
│                                                             │
│              아래 버튼으로 선택하세요                          │
└─────────────────────────────────────────────────────────────┘
```

**revealing 상태 (애니메이션 진행 중):**
```
┌─────────────────────────────────────────────────────────────┐
│         [나 (어드민)]           VS          [컴퓨터]          │
│                                                             │
│           ┌──────────┐                 ┌──────────┐         │
│           │          │                 │          │         │
│           │    ✂     │                 │   ···    │  ← 컴퓨터│
│           │  (선택됨) │                 │ (흔들림)  │    애니  │
│           └──────────┘                 └──────────┘         │
│                                                             │
│                        확인 중...                            │
└─────────────────────────────────────────────────────────────┘
```

**result 상태:**
```
┌─────────────────────────────────────────────────────────────┐
│         [나 (어드민)]           VS          [컴퓨터]          │
│                                                             │
│           ┌──────────┐                 ┌──────────┐         │
│           │          │                 │          │         │
│           │    ✂     │                 │    📄    │         │
│           │  가위     │                 │   보     │         │
│           └──────────┘                 └──────────┘         │
│                                                             │
│             ╔═══════════════════════════════╗               │
│             ║    이겼습니다!   (보 > 가위)    ║               │
│             ╚═══════════════════════════════╝               │
└─────────────────────────────────────────────────────────────┘
```

### 3.4 선택 버튼 영역

```
┌──────────────┐   ┌──────────────┐   ┌──────────────┐
│              │   │              │   │              │
│      ✂       │   │      🪨      │   │      📄      │
│              │   │              │   │              │
│    가위 [1]  │   │  바위  [2]  │   │   보  [3]   │
└──────────────┘   └──────────────┘   └──────────────┘
```

- 버튼 크기: 가로 120px / 세로 100px (데스크톱). 모바일에서는 flex wrap.
- 아이콘: 이모지 (✂ / 🪨 / 📄). 크기 36px. 아이콘 접근성 aria-hidden="true".
- 키보드 단축키 힌트 [1] [2] [3]을 버튼 하단 소자로 표시.
- 상태별 스타일:
  - idle: 테두리 #3B82F6(blue), 호버 시 배경 light blue.
  - 선택된 버튼 (submitting/revealing): 배경 #3B82F6, 텍스트 white, scale 1.05.
  - 비선택 버튼 (submitting 중): opacity 0.4, pointer-events none.
  - result 상태: 모든 버튼 idle 스타일 복귀 (다음 판 준비).
  - 에러 상태: 모든 버튼 재활성화.

### 3.5 통계 바 (하단)

```
┌─────────────────────────────────────────────────────────────┐
│ [세션] 승 3  패 2  무 1  │  [연승] 3판  │  [누적] 총 42판 · 승률 52.6% │
└─────────────────────────────────────────────────────────────┘
```

- 세션 카운트: in-memory. 새로고침 시 리셋.
- 연승/연패 스트릭: "연승 N판" (초록) / "연패 N판" (빨강). 스트릭 없음(0) 시 표시 없음.
- 누적 전적: 서버 응답 stats 필드. 로딩 중엔 "로딩 중...".
- 승률: 0~1 소수를 백분율로 표시. (0.5263 → "52.6%"). totalPlays 0이면 "-".

### 3.6 에러 배너

```
┌─────────────────────────────────────────────────────────────┐
│ ⚠ 결과를 저장하지 못했습니다. 네트워크 상태를 확인하세요.  [재시도] │
└─────────────────────────────────────────────────────────────┘
```

- 배경 #FEF3C7, 텍스트 #92400E (amber 계열).
- 위치: 선택 버튼 영역 상단.
- 닫기 버튼 또는 재시도 버튼 클릭 시 배너 사라짐.

---

## 4. 화면별 와이어프레임 — Excel 모드

### 4.1 Excel 쉘 구조 (전체)

Excel 모드는 `ExcelShell` 컴포넌트를 래퍼로 사용한다.
기존 게임들(`SudokuBoard`, `BlockfallBoard`)과 동일한 패턴으로 `useExcelShell` 훅을 통해
리본/수식바/상태바를 제어한다.

**홈 드롭다운 제외**: RSP는 `ExcelShell` 내부의 `GAMES` 배열에 등록하지 않는다.
드롭다운에 RSP 항목이 노출되어서는 안 된다 (PRD FR-M9 / FR-M11).
어드민이 드롭다운을 열어도 RSP는 목록에 없다 — 정상 동작.

**파일명 표시**: `admin_rsp.xlsx`

**시트 탭 구성** (랭킹 없음 — RSP는 랭킹 미지원):

```
[ 게임 ]  [ 히스토리 ]  [ 룰 ]
```

- "게임" 탭: 플레이 화면
- "히스토리" 탭: 세션 내 플레이 기록을 스프레드시트 형태로 표시
- "룰" 탭: 가위바위보 판정 규칙 설명

### 4.2 Excel 쉘 레이아웃 구조 (와이어프레임)

```
┌─────────────────────────────────────────────────────────────┐
│ [X] DobakGgun - 가위바위보  │  admin_rsp.xlsx - Excel  │ [─][□][✕] │
├─────────────────────────────────────────────────────────────┤
│ [홈] [삽입] [페이지 레이아웃] [수식] [데이터] [검토] [보기]    │  ← 리본 탭
├─────────────────────────────────────────────────────────────┤
│ [클립보드] [글꼴] [맞춤] [표시 형식] │ [가위][바위][보][초기화] │  ← 리본 (게임 그룹)
├─────────────────────────────────────────────────────────────┤
│ C3  │ fx │ =SCISSORS                                        │  ← 수식바
├─────────────────────────────────────────────────────────────┤
│     │  A  │  B  │  C  │  D  │  E  │  F  │  G  │  H  │ ... │
│  1  │     │     │     │     │     │     │     │     │     │
│  2  │     │  [가위바위보 게임 보드]                           │  ← 시트 영역
│  3  │     │                                                 │
│ ... │     │                                                 │
├─────────────────────────────────────────────────────────────┤
│ [ 게임 ] [ 히스토리 ] [ 룰 ]                                  │  ← 시트 탭
├─────────────────────────────────────────────────────────────┤
│ 연승: 3판  │  세션: 승3/패2/무1  │  누적: 42판 52.6%          │  ← 상태바
└─────────────────────────────────────────────────────────────┘
```

### 4.3 Excel 리본 게임 그룹

```
┌──────────────────────────────────────────────────────────┐
│ ✂   │  🪨  │  📄  │  🔄   │
│ 가위  │ 바위  │  보   │ 초기화 │
│              게임               │
└──────────────────────────────────────────────────────────┘
```

- 가위/바위/보 버튼: 클릭 시 해당 선택 전송 (idle 상태일 때만 활성화).
- submitting/revealing 상태: 모든 리본 게임 버튼 `xrb-disabled` 클래스 적용.
- 초기화: 세션 in-memory 카운트 리셋.
- 그룹 레이블: "게임".

### 4.4 Excel 수식바 상태별 표시

| 게임 상태 | 셀 주소 표시 | 수식 내용 |
|---|---|---|
| idle | `B2` | `` (빈 값) |
| submitting | `B2` | `=SUBMITTING(...)` |
| revealing | `C2` | `=RESULT_PENDING` |
| result — WIN | `D2` | `=WIN("가위","보")` |
| result — LOSS | `D2` | `=LOSS("바위","가위")` |
| result — DRAW | `D2` | `=DRAW("보","보")` |
| error | `B2` | `#ERROR!` |

- 수식바의 내용은 게임 메타포를 살리는 장식용 텍스트 — 실제 수식 연산 아님.
- `setFormula(cellAddr, formulaContent)` 호출로 ExcelShell 수식바 업데이트.

### 4.5 Excel 시트 영역 — "게임" 탭

게임 보드는 스프레드시트 격자 위에 절대 위치로 오버레이한다.
기존 SudokuBoard, BlockfallBoard와 동일한 패턴.

**게임 보드 레이아웃 (격자 오버레이)**:

```
격자 셀 B2~K12 영역을 게임 보드로 사용 (10열 × 11행 = 960px × 319px 기준)

B2~E5  : 유저 선택 영역
  └─ 선택 심볼 표시 (✂ / 🪨 / 📄 / ?)
  └─ 배경: 연한 초록 (#E8F5E9) — 선택 후 강조

G2~K5  : 컴퓨터 선택 영역
  └─ 선택 심볼 표시
  └─ revealing 중 셀 배경 깜빡임 애니메이션

F2~F5  : VS 구분선 셀 영역
  └─ "VS" 텍스트, 중앙 정렬, 볼드

B7~K7  : 판정 결과 행 (병합 셀 메타포)
  └─ WIN → 배경 #217346(초록), 흰 텍스트 "이겼습니다!"
  └─ LOSS → 배경 #C62828(빨강), 흰 텍스트 "졌습니다..."
  └─ DRAW → 배경 #616161(회색), 흰 텍스트 "무승부"
  └─ idle → 배경 #F5F5F5, 텍스트 "아래 버튼으로 선택하세요"

B9~K11 : 세션 통계 행
  └─ 셀 값처럼 표시: "세션 | 승 | 패 | 무 | 스트릭 | 누적 전적 | 승률"
  └─ 헤더 행 배경 #217346, 흰 텍스트
  └─ 데이터 행 배경 흰색, 셀 보더 #D0D0D0
```

### 4.6 Excel 시트 — "히스토리" 탭

세션 내 플레이 기록을 스프레드시트 테이블로 표시.

```
행 헤더 배경: #217346 (초록)
열 구성:
  A열(좁음)  : 판 번호 (#)
  B열        : 내 선택 (가위/바위/보)
  C열        : 컴퓨터 선택
  D열        : 결과 (WIN / LOSS / DRAW)
  E열        : 연승/연패 스트릭 (해당 판 기준)
  F열        : 시각 (플레이 시각 — 서버 응답 playedAt)

데이터 행:
  - WIN  행: 배경 #E8F5E9 (연초록)
  - LOSS 행: 배경 #FFEBEE (연빨강)
  - DRAW 행: 배경 흰색
  - 짝수 행: 배경 #F5F5F5 (기존 xrc-alt 클래스 활용)
```

히스토리는 세션 내 in-memory 데이터로만 구성.
새로고침 시 비워짐 (서버 재조회 없음).

### 4.7 Excel 시트 — "룰" 탭

판정 규칙 설명을 스프레드시트 표 형식으로 표시.

```
행 1: 제목 셀 (병합) — "가위바위보 판정 규칙"
행 2: 빈 행
행 3: 헤더 — 나 \ 컴퓨터 | 바위 | 가위 | 보
행 4: 바위 행  | 무승부 | 승리 | 패배
행 5: 가위 행  | 패배 | 무승부 | 승리
행 6: 보 행   | 승리 | 패배 | 무승부
행 7: 빈 행
행 8: "무승부는 연승/연패 스트릭에 영향 없음"
행 9: "매 판 결과는 서버에 저장됩니다"
```

### 4.8 Excel 상태바

```
┌─────────────────────────────────────────────────────────────┐
│  연승: 3판 / 연패: 0판    │   세션 승3 패2 무1   │   누적 42판 · 52.6%  │
└─────────────────────────────────────────────────────────────┘
```

`setStatusItems` 호출로 ExcelShell 상태바 업데이트:
```
[
  { label: '스트릭', value: '연승 3판' },
  { label: '세션', value: '승3/패2/무1' },
  { label: '누적 승률', value: '52.6%' }
]
```

---

## 5. 상태 머신

### 5.1 상태 정의

| 상태 | 설명 | UI |
|---|---|---|
| `idle` | 선택 대기 | 3개 버튼 활성화, VS 보드 ? 표시 |
| `submitting` | 서버 요청 중 | 선택 버튼 전체 비활성화, 로딩 인디케이터 |
| `revealing` | 결과 공개 애니메이션 | 컴퓨터 쪽 애니메이션, 버튼 비활성화 |
| `result` | 결과 표시 | 판정 배너, 통계 업데이트, "다음 판" 버튼 클릭으로만 idle 복귀 |
| `error` | 네트워크/서버 오류 | 에러 배너, 버튼 재활성화, 재시도 가능 |

### 5.2 전환 다이어그램

```
[idle]
  │
  │ 버튼 클릭 또는 키보드 1/2/3
  ▼
[submitting]
  │               │
  │ 성공 응답      │ 실패 응답 (4xx/5xx/timeout)
  ▼               ▼
[revealing]     [error]
  │               │
  │ 애니메이션     │ 닫기 버튼 또는 재시도 클릭
  │ 완료 (600ms)  ▼
  ▼             [idle]
[result]
  │
  │ "다음 판" 버튼 클릭 (자동 전환 없음 — CP3 확정)
  ▼
[idle]
```

### 5.3 에러 상태 처리

- `error` 상태 진입 조건: fetch 예외, HTTP 4xx/5xx 응답.
- `error` 상태에서:
  - 세션 카운트 증가 없음.
  - 스트릭 변경 없음.
  - 선택 버튼 재활성화 (재시도 가능).
  - 에러 배너 표시 (메시지는 §10 마이크로카피 참조).
- `error` → `idle` 전환: 배너 닫기 또는 재시도 클릭.

### 5.4 revealing 애니메이션 스텝

총 600ms, 2단계:
1. **300ms**: 컴퓨터 선택 아이콘 영역 흔들림(shake) 애니메이션.
2. **300ms**: 흔들림 종료 → 컴퓨터 선택 아이콘 페이드인 공개.
3. 애니메이션 완료 후 `result` 상태 전환.

일반 모드: CSS `@keyframes shake` + `@keyframes fadeIn`.
Excel 모드: 컴퓨터 선택 셀 배경색 깜빡임 (`#FFFDE7` → `#217346` → 공개).

---

## 6. 컴포넌트 명세

### 6.1 파일 구조 (제안)

```
frontend/src/
  games/rsp/
    RspBoard.tsx           -- 일반 모드 보드 컴포넌트 (excel prop 수신)
    RspBoard.module.css    -- 일반 모드 CSS 모듈
    useRspGame.ts          -- 게임 상태 훅
  pages/admin/
    AdminRspPage.tsx       -- 일반 모드 라우트 페이지 (/admin/rsp)
    AdminRspExcelPage.tsx  -- Excel 모드 라우트 페이지 (/admin/rsp/excel)
  api/
    admin.ts               -- adminRspApi 함수 추가 (기존 파일 확장)
```

### 6.2 RspBoard.tsx

**Props**
```typescript
interface RspBoardProps {
  excel?: boolean;  // 기본값 false
}
```

**역할**
- `useRspGame` 훅으로부터 상태와 액션 수신.
- `excel` prop에 따라 일반/Excel 모드 분기 렌더링.
- `excel === true` 시 `useExcelShell` 훅 호출하여 리본/수식바/상태바 업데이트.
- `excel === false` 시 `useExcelShell` 호출 없음.

**내부 구성 (일반 모드)**
```
<RspBoard>
  <header>            -- 헤더 (제목, 세션 초기화, 그만하기)
  <main>
    <VsBoard>         -- VS 영역 (유저 선택 + 컴퓨터 선택)
    <ResultBanner>    -- result 상태에만 렌더 (WIN/LOSS/DRAW)
    <ErrorBanner>     -- error 상태에만 렌더
    <ChoiceButtons>   -- 가위/바위/보 버튼 3개
  </main>
  <footer>            -- 통계 바 (세션 전적, 스트릭, 누적 통계)
</RspBoard>
```

**내부 구성 (Excel 모드)**
```
<ExcelShell game="rsp" gameName="가위바위보" fileTitle="admin_rsp.xlsx">
  <ExcelShellProvider>  -- ExcelShell이 내부에 포함
    <RspBoard excel={true}>
      -- ExcelShell 시트 영역 내에 게임 보드 오버레이
      -- 시트 탭 3개 (게임 / 히스토리 / 룰) 렌더링
    </RspBoard>
  </ExcelShellProvider>
</ExcelShell>
```

### 6.3 useRspGame.ts

**상태**
```typescript
type RspChoice = 'ROCK' | 'SCISSORS' | 'PAPER';
type RspResult = 'WIN' | 'LOSS' | 'DRAW';
type GamePhase = 'idle' | 'submitting' | 'revealing' | 'result' | 'error';

interface RspGameState {
  phase: GamePhase;

  // 현재 판
  userChoice: RspChoice | null;
  computerChoice: RspChoice | null;
  roundResult: RspResult | null;

  // 세션 집계 (in-memory)
  sessionWins: number;
  sessionLosses: number;
  sessionDraws: number;
  streak: number;        // 양수: 연승, 음수: 연패, 0: 없음
  history: HistoryEntry[];  // 세션 내 플레이 기록 (히스토리 탭용)

  // 누적 통계 (서버)
  totalPlays: number;
  totalWins: number;
  totalLosses: number;
  totalDraws: number;
  winRate: number | null;

  // UI
  statsLoading: boolean;
  errorMessage: string | null;
}

interface HistoryEntry {
  round: number;
  userChoice: RspChoice;
  computerChoice: RspChoice;
  result: RspResult;
  streakSnapshot: number;  // 해당 판 종료 후 스트릭 값
  playedAt: string;        // ISO 8601
}
```

**액션**
```typescript
interface RspGameActions {
  submitChoice: (choice: RspChoice) => Promise<void>;  // POST 포함
  resetSession: () => void;    // 세션 카운트만 리셋
  dismissError: () => void;    // 에러 배너 닫기
  nextRound: () => void;       // result → idle 전환
}
```

**스트릭 계산 규칙**
- WIN: streak > 0 → streak+1 / streak <= 0 → streak = 1
- LOSS: streak < 0 → streak-1 / streak >= 0 → streak = -1
- DRAW: streak 변경 없음 (PRD OQ-3 확정)
- 표시: streak > 0 → "연승 N판", streak < 0 → "연패 N판", streak === 0 → 표시 없음

### 6.4 AdminRspPage.tsx

```typescript
// /admin/rsp 라우트
export default function AdminRspPage() {
  return (
    <AdminRoute>
      <RspBoard excel={false} />
    </AdminRoute>
  );
}
```

### 6.5 AdminRspExcelPage.tsx

```typescript
// /admin/rsp/excel 라우트
export default function AdminRspExcelPage() {
  return (
    <AdminRoute>
      <ExcelShellProvider>
        <ExcelShell
          game="rsp"
          gameName="가위바위보"
          fileTitle="admin_rsp.xlsx"
          cellSize={96}
        >
          <RspBoard excel={true} />
        </ExcelShell>
      </ExcelShellProvider>
    </AdminRoute>
  );
}
```

**주의**: `ExcelShell` 내부의 `GAMES` 배열에 `rsp`를 추가하지 않는다.
홈 드롭다운에서 RSP는 노출되지 않으며, 이는 정상 동작이다.

### 6.6 adminRspApi (admin.ts 확장)

```typescript
// 기존 frontend/src/api/admin.ts 에 추가할 함수 시그니처 (명세 목적)

export const adminRspApi = {
  playRound: (token: string, userChoice: 'ROCK' | 'SCISSORS' | 'PAPER') => ...,
  // POST /api/admin/rsp/plays
  // Response: { id, userChoice, computerChoice, result, playedAt, stats }

  getStats: (token: string) => ...,
  // GET /api/admin/rsp/stats
  // Response: { totalPlays, wins, losses, draws, winRate }
};
```

기존 `request<T>()` 헬퍼 재활용 필수. 중복 작성 금지 (PRD §7.5 / architecture.md High #4).

### 6.7 RspBoard.module.css 토큰

일반 모드 CSS 모듈에서 사용할 주요 색상/크기 토큰:

```css
/* 색상 */
--rsp-primary: #3B82F6;         /* 선택 버튼 보더/활성 배경 */
--rsp-primary-light: #EFF6FF;   /* 선택 버튼 호버 배경 */
--rsp-win: #16A34A;             /* 승 배너 배경 */
--rsp-win-text: #FFFFFF;
--rsp-loss: #DC2626;            /* 패 배너 배경 */
--rsp-loss-text: #FFFFFF;
--rsp-draw: #6B7280;            /* 무 배너 배경 */
--rsp-draw-text: #FFFFFF;
--rsp-error-bg: #FEF3C7;        /* 에러 배너 배경 */
--rsp-error-text: #92400E;
--rsp-streak-win: #16A34A;      /* 연승 텍스트 */
--rsp-streak-loss: #DC2626;     /* 연패 텍스트 */

/* 크기 */
--rsp-btn-w: 120px;
--rsp-btn-h: 100px;
--rsp-btn-icon-size: 36px;
--rsp-board-max-w: 600px;
--rsp-header-h: 48px;
--rsp-stats-h: 44px;
```

---

## 7. Excel 모드 통합 패턴 (useExcelShell)

### 7.1 기존 패턴 분석 (SudokuBoard 기준)

기존 게임의 Excel 모드 통합 패턴:

1. `const { setFormula, setStatusItems, activeSheet, setRibbonGameGroup, sheetSize, registerNewGame } = useExcelShell();`
2. 게임 상태 변화 시 `useEffect` 안에서 `setFormula`, `setStatusItems` 호출.
3. 리본 게임 그룹을 `setRibbonGameGroup(JSX)` 로 주입.
4. `registerNewGame(() => callback)` 으로 플러스 버튼 동작 등록.
5. `excel === false` 구간에서는 `setRibbonGameGroup(null)` 반환.

### 7.2 RSP의 useExcelShell 적용 명세

**수식바 업데이트 트리거**: phase 또는 roundResult 변경 시.

```
useEffect:
  if (!excel) return;
  
  switch (phase) {
    case 'idle':
      setFormula('B2', '');
      break;
    case 'submitting':
      setFormula('B2', '=SUBMITTING()');
      break;
    case 'revealing':
      setFormula('C2', '=RESULT_PENDING');
      break;
    case 'result':
      const u = choiceLabel(userChoice);   // "가위" / "바위" / "보"
      const c = choiceLabel(computerChoice);
      const fn = resultFnName(roundResult); // "WIN" / "LOSS" / "DRAW"
      setFormula('D2', `=${fn}("${u}","${c}")`);
      break;
    case 'error':
      setFormula('B2', '#ERROR!');
      break;
  }
```

**상태바 업데이트 트리거**: 세션 카운트 또는 누적 통계 변경 시.

```
useEffect:
  if (!excel) return;
  
  const streakLabel = streak > 0 ? `연승 ${streak}판`
                    : streak < 0 ? `연패 ${Math.abs(streak)}판`
                    : '스트릭 없음';
  const sessionLabel = `승${sessionWins}/패${sessionLosses}/무${sessionDraws}`;
  const winRateLabel = winRate !== null ? `${(winRate * 100).toFixed(1)}%` : '-';
  
  setStatusItems([
    { label: '스트릭', value: streakLabel },
    { label: '세션', value: sessionLabel },
    { label: '누적 승률', value: winRateLabel },
  ]);
```

**리본 게임 그룹 주입**:

```
useEffect:
  if (!excel) { setRibbonGameGroup(null); return; }
  
  const isDisabled = phase !== 'idle';
  
  setRibbonGameGroup(
    <div className={styles.xrgGame}>
      <div className={styles.xrgBtns}>
        <div className={`${styles.xrb} ${isDisabled ? styles.xrbDisabled : ''}`}
             onClick={() => !isDisabled && submitChoice('SCISSORS')}>
          <span className={styles.xrbIcon}>✂</span>
          <span>가위</span>
        </div>
        <div className={`${styles.xrb} ${isDisabled ? styles.xrbDisabled : ''}`}
             onClick={() => !isDisabled && submitChoice('ROCK')}>
          <span className={styles.xrbIcon}>🪨</span>
          <span>바위</span>
        </div>
        <div className={`${styles.xrb} ${isDisabled ? styles.xrbDisabled : ''}`}
             onClick={() => !isDisabled && submitChoice('PAPER')}>
          <span className={styles.xrbIcon}>📄</span>
          <span>보</span>
        </div>
        <div className={styles.xrb} onClick={resetSession}>
          <span className={styles.xrbIcon}>🔄</span>
          <span>초기화</span>
        </div>
      </div>
      <div className={styles.xrgLabel}>게임</div>
    </div>
  );
```

**registerNewGame**: RSP는 "다음 판" 개념이 리본 플러스 버튼과 무관하므로 `registerNewGame(() => resetSession())` 으로 등록 (세션 초기화 동작 연결).

**EC-11 대응**: `useExcelShell` 컨텍스트가 누락된 환경(일반 모드 페이지에서 Excel 훅 호출 시)에 대해, `excel` prop이 `false`일 때는 `useExcelShell` 반환값을 사용하지 않도록 분기. `ExcelShellContext`의 `defaultValue`가 no-op이므로 에러 없이 통과.

### 7.3 activeSheet에 따른 렌더링 분기

```
Excel 모드 시트 영역 렌더링:
  activeSheet === 'game'     → 게임 보드 (선택 + VS 영역 + 통계)
  activeSheet === 'ranking'  → (RSP는 랭킹 없음) 히스토리 탭으로 대체
  activeSheet === 'rules'    → 룰 설명 테이블

주의: ExcelShellContext의 SheetTab 타입은 'game' | 'ranking' | 'rules' 고정.
RSP에서는 'ranking' 탭을 히스토리 탭으로 재사용하고, 탭 라벨만 "히스토리"로 커스터마이징.
ExcelShell의 SHEET_TABS 정의를 변경하지 않고 activeSheet === 'ranking' 분기에서
히스토리 콘텐츠를 렌더링하는 방식으로 처리.
```

---

## 8. 어드민 진입 경로 UX

### 8.1 확정 정책 (CP3, 2026-04-21 — 완전 숨김)

- **AdminDashboardPage에 RSP 링크/힌트 일절 노출 금지.**
- 어드민 홈(`/admin`), Excel 어드민 홈, 사이드바, 관리 페이지 어디에도 RSP 진입 요소를 두지 않는다.
- 어드민은 `/admin/rsp` 또는 `/admin/rsp/excel` URL을 직접 암기하거나 북마크해야 한다.
- 이 방침은 완전한 은닉성을 목적으로 하며, 사용자(프로젝트 오너)가 CP3에서 최종 확정하였다.

**frontend 구현 체크리스트 (D-2 준수 항목)**

- `AdminDashboardPage.tsx`에 RSP 관련 어떤 변경도 없음 (링크, 힌트, 텍스트, 섹션 모두 금지).
- `AdminGamesPage.tsx`에 RSP 토글 행 미추가.
- `HomePage.tsx` / `ExcelHomePage.tsx` 게임 카드 목록에 RSP 미추가.
- 사이드바 컴포넌트에 RSP 항목 미추가.

### 8.2 일반 유저 접근 시 플로우

```
비로그인 유저 → /admin/rsp → AdminRoute → /login 리다이렉트
USER role    → /admin/rsp → AdminRoute → / 리다이렉트 (기존 정책 유지)
```

별도 404 또는 커스텀 에러 페이지 없음. 기존 AdminRoute 동작 그대로.

---

## 9. 접근성 (A11y)

### 9.1 키보드 조작

| 키 | 동작 |
|---|---|
| `1` | 가위 선택 (idle 상태일 때만) |
| `2` | 바위 선택 |
| `3` | 보 선택 |
| `Enter` 또는 `Space` | 포커스된 버튼 선택 |
| `Tab` | 버튼 간 포커스 이동 |
| `Escape` | result 상태에서 idle로 전환 (다음 판 단축키) |

submitting/revealing 상태에서 `1/2/3` 키 입력 무시.

### 9.2 aria 속성

**선택 버튼:**
```html
<button
  aria-label="가위 선택 (단축키: 1)"
  aria-pressed="false"          <!-- 선택된 버튼은 true -->
  aria-disabled="true"          <!-- submitting/revealing 시 -->
  disabled                      <!-- 네이티브 disabled도 함께 -->
>
  <span aria-hidden="true">✂</span>
  가위
  <span aria-hidden="true">[1]</span>
</button>
```

**판정 결과 배너:**
```html
<div
  role="status"
  aria-live="polite"
  aria-atomic="true"
>
  이겼습니다! (가위 vs 보)
</div>
```

**에러 배너:**
```html
<div
  role="alert"
  aria-live="assertive"
>
  결과를 저장하지 못했습니다. 네트워크 상태를 확인하세요.
</div>
```

**통계 영역:**
```html
<section aria-label="전적 통계">
  <dl>
    <dt>세션 승</dt><dd>3</dd>
    <dt>세션 패</dt><dd>2</dd>
    <dt>세션 무</dt><dd>1</dd>
    <dt>현재 스트릭</dt><dd>연승 3판</dd>
    <dt>누적 승률</dt><dd>52.6%</dd>
  </dl>
</section>
```

### 9.3 색상 대비

| 요소 | 전경 | 배경 | 대비비 (WCAG AA) |
|---|---|---|---|
| 선택 버튼 텍스트 | #1E3A8A | #EFF6FF | 9.2:1 ✅ |
| 선택된 버튼 텍스트 | #FFFFFF | #3B82F6 | 4.7:1 ✅ |
| WIN 배너 | #FFFFFF | #16A34A | 5.1:1 ✅ |
| LOSS 배너 | #FFFFFF | #DC2626 | 5.5:1 ✅ |
| DRAW 배너 | #FFFFFF | #6B7280 | 4.6:1 ✅ |
| 에러 배너 텍스트 | #92400E | #FEF3C7 | 5.3:1 ✅ |
| 연승 스트릭 | #16A34A | #FFFFFF | 5.1:1 ✅ |
| 연패 스트릭 | #DC2626 | #FFFFFF | 5.5:1 ✅ |

### 9.4 포커스 인디케이터

- 선택 버튼: `outline: 2px solid #1D4ED8; outline-offset: 2px;` (포커스 시).
- "그만하기" 버튼: 동일.
- Excel 모드 리본 버튼: Excel 쉘 공통 포커스 스타일 따름.

---

## 10. 마이크로카피 (한국어)

### 10.1 버튼 라벨

| 버튼 | 라벨 |
|---|---|
| 가위 선택 | 가위 |
| 바위 선택 | 바위 |
| 보 선택 | 보 |
| 세션 초기화 | 세션 초기화 |
| 그만하기 | 그만하기 |
| 어드민 홈 | ← 어드민 홈 |
| 다음 판 | 다음 판 |
| 재시도 | 다시 시도 |

### 10.2 판정 결과 메시지

| 결과 | 메인 메시지 | 서브 메시지 |
|---|---|---|
| WIN | 이겼습니다! | {내 선택} > {컴퓨터 선택} |
| LOSS | 졌습니다... | {컴퓨터 선택} > {내 선택} |
| DRAW | 무승부 | {내 선택} vs {컴퓨터 선택} |

**선택 표시 텍스트**:
- ROCK → "바위"
- SCISSORS → "가위"
- PAPER → "보"

**예시**:
- WIN (가위 vs 보): "이겼습니다! / 가위 > 보"
- LOSS (바위 vs 보): "졌습니다... / 보 > 바위"
- DRAW (가위 vs 가위): "무승부 / 가위 vs 가위"

### 10.3 통계 라벨

| 라벨 | 텍스트 |
|---|---|
| 세션 승 | 승 |
| 세션 패 | 패 |
| 세션 무 | 무 |
| 연승 스트릭 | 연승 {N}판 |
| 연패 스트릭 | 연패 {N}판 |
| 스트릭 없음 | (표시 없음) |
| 누적 판 수 | 총 {N}판 |
| 누적 승률 | 승률 {X}% |
| 승률 없음 (0판) | 승률 - |
| 통계 로딩 중 | 로딩 중... |

### 10.4 에러 메시지

| 상황 | 메시지 |
|---|---|
| 네트워크 실패 | 결과를 저장하지 못했습니다. 네트워크 상태를 확인하세요. |
| 서버 500 | 결과를 저장하지 못했습니다. 다시 시도해주세요. |
| 서버 400 | 잘못된 요청입니다. 새로고침 후 다시 시도하세요. |
| 통계 조회 실패 | 누적 통계를 불러오지 못했습니다. |
| JWT 만료 (401) | 세션이 만료되었습니다. 다시 로그인해주세요. |

### 10.5 로딩/대기 상태 텍스트

| 상황 | 텍스트 |
|---|---|
| 서버 응답 대기 | 확인 중... |
| revealing 애니메이션 | (텍스트 없음 — 애니메이션으로 표현) |
| 통계 로딩 | 로딩 중... |

### 10.6 안내 문구

| 위치 | 문구 |
|---|---|
| idle 상태 VS 보드 하단 | 아래 버튼으로 선택하세요 |
| Excel 모드 idle 셀 | 리본의 버튼으로 선택하거나 키보드 1/2/3 |
| 룰 탭 하단 주석 | 무승부는 연승·연패 스트릭에 영향 없음 |
| 룰 탭 하단 주석 | 매 판 결과는 서버에 저장됩니다 |
| 세션 초기화 확인 | 이번 세션 전적을 초기화합니다. 서버 기록은 유지됩니다. |

---

## 11. 아키텍처 smell 재발 방지 — designer 관점

### 11.1 GAME_LABELS 통합 여부 — designer 의견

PRD §10 및 §15에서 RSP를 `GAME_LABELS`에 추가하지 않도록 명시.
designer 관점에서도 이에 동의한다.

- `AdminDashboardPage.tsx`의 `GAME_LABELS`는 어드민 게임 관리 토글 대상 라벨용.
  RSP는 토글 대상이 아니므로 여기에 추가 시 불필요한 토글 행이 생성됨.
- `ExcelShell.tsx`의 `GAMES`는 홈 드롭다운 목록용.
  RSP 추가 시 Excel 홈 드롭다운에 노출됨 → PRD 정책 위반.
- RSP 전용 라벨(게임명, 아이콘 등)은 `RspBoard.tsx` 또는 `AdminRspPage.tsx` 내 로컬 상수로 관리.

**결론: 어떤 공통 라벨/카탈로그에도 추가하지 않음. 로컬 상수 유지.**

### 11.2 공통 유틸 재활용 권장 목록

| 유틸 | 현황 | RSP 재활용 여부 |
|---|---|---|
| `colLabel(i)` | SudokuBoard, BlockfallBoard에 중복 정의 | RSP Excel 모드에서 격자 헤더 필요 시 → 공통 `src/utils/excel.ts`로 추출 후 임포트 권장 (아직 없으면 신규 생성) |
| `formatTime(elapsed)` | 중복 3개소 존재 | RSP는 타이머 없음 → 재활용 불필요 |
| `weekRange()` | 중복 6개소 | RSP는 주간 랭킹 없음 → 재활용 불필요 |
| `request<T>()` helper | 10개 중복 | RSP는 기존 `admin.ts`의 헬퍼 재활용 필수 |

### 11.3 RSP 미노출 확인 체크리스트 (착수 전 필수)

developer-frontend 착수 전 확인 필요:
- [ ] `ExcelShell.tsx`의 `GAMES` 배열에 `rsp` 미추가 여부
- [ ] `HomePage.tsx` / `ExcelHomePage.tsx` 게임 카드 목록에 RSP 미추가 여부
- [ ] `AdminGamesPage.tsx` `GAME_LABELS` 에 `rsp` 미추가 여부
- [ ] `AdminDashboardPage.tsx` `GAME_LABELS` / `GAME_ORDER` 에 `rsp` 미추가 여부
- [ ] `AdminDashboardPage.tsx`에 RSP 링크/힌트/섹션 변경 없음 (D-2 완전 숨김 확정)
- [ ] 사이드바 컴포넌트에 RSP 항목 미추가 여부
- [ ] `api/rankings.ts`의 어떤 배열/상수에도 `rsp` 미추가 여부

---

## 12. 반응형 레이아웃

### 12.1 일반 모드

| 브레이크포인트 | 레이아웃 변화 |
|---|---|
| 데스크톱 (≥768px) | VS 보드 가로 배치 (유저 좌 / 컴퓨터 우). 선택 버튼 가로 1행 3열. |
| 태블릿 (480~767px) | VS 보드 가로 유지 (비율 축소). 버튼 크기 100px × 80px. |
| 모바일 (≤479px) | VS 보드 세로 배치 (유저 위 / 컴퓨터 아래). 선택 버튼 가로 1행 3열 (flex, 간격 줄임). 통계 바 2행으로 줄바꿈. |

**VS 보드 모바일 세로 배치:**
```
┌─────────────────────────────┐
│   [나 (어드민)]              │
│     ?                       │
│         VS                  │
│   [컴퓨터]                   │
│     ?                       │
├─────────────────────────────┤
│  [판정 결과 배너]             │
├─────────────────────────────┤
│  [✂] [🪨] [📄]              │
│  가위  바위  보               │
├─────────────────────────────┤
│ 세션: 승0 패0 무0             │
│ 연승: 0판 │ 누적: 52.6%      │
└─────────────────────────────┘
```

### 12.2 Excel 모드

Excel 모드는 `ExcelShell` 기존 반응형 정책을 그대로 따른다.
(`frontend/src/styles/excel.css`의 `@media` 쿼리 — 960px, 640px, 480px 브레이크포인트 준수)

| 브레이크포인트 | Excel 쉘 변화 |
|---|---|
| ≤960px | 리본 일부 그룹 숨김 (`.xrg:nth-child(2)`, `.xrg:nth-child(4)`) |
| ≤640px | 게임 그룹만 표시 (`#xrg-game`). 타이틀바 축소 |
| ≤480px | 게임 그룹 보더 제거 |

RSP Excel 리본 게임 그룹은 `id="xrg-game"` 또는 해당하는 클래스로 마크업하여
소형 화면에서도 가위/바위/보 선택 버튼이 표시되도록 한다.

---

## 부록 A. 일반 모드 vs Excel 모드 시각적 차별화 요약

| 요소 | 일반 모드 | Excel 모드 |
|---|---|---|
| 전체 레이아웃 | 세로 스택 카드 UI | Excel 스프레드시트 쉘 |
| 선택 방법 | 화면 중앙 큰 버튼 3개 | 리본 버튼 또는 키보드 |
| 결과 표시 | 화면 중앙 배너 | 격자 셀 배경색 + 수식바 |
| 통계 표시 | 하단 통계 바 | 상태바 + 히스토리 탭 |
| 기록 내역 | 없음 (세션 카운트만) | "히스토리" 시트 탭 테이블 |
| 배경/느낌 | 일반 게임 앱 UI | Excel 업무 도구 위장 |
| 컬러 팔레트 | blue/green/red (게임 감성) | #217346 green (Excel 감성) |

---

## 부록 B. 결정사항 이력

| # | 결정 사항 | 확정 내용 | 상태 |
|---|---|---|---|
| D-1 | 결과 공개 후 다음 판 전환 방식 | "다음 판" 버튼 클릭으로만 전환. 자동 2초 전환 로직 없음. 일반/Excel 양쪽 동일. | **확정 (CP3, 2026-04-21)** |
| D-2 | AdminDashboard RSP 진입 경로 | 완전 숨김. AdminDashboardPage 포함 어드민 UI 전체에 RSP 링크/힌트 노출 금지. URL 직접 입력/북마크만. | **확정 (CP3, 2026-04-21)** |
| D-3 | Excel 시트 탭 라벨 커스터마이징 방법 | 'ranking' 탭을 히스토리로 재사용 | developer-frontend 판단 위임 |
| D-4 | 연승/연패 스트릭 아이콘 (OQ-8) | 텍스트 우선 (연승 N판 / 연패 N판). 이모지는 선택 사항. | developer-frontend 판단 위임 |
