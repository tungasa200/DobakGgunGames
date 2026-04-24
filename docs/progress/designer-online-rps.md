# Progress — designer : Online RPS (실시간 멀티플레이 가위바위보)

- 소유 팀원: **designer**
- 기능 키: `online-rps`
- 최종 업데이트: 2026-04-24
- 관련 문서:
  - PRD: `docs/specs/online-rps-prd.md` (CP1 승인 완료, 2026-04-24)
  - UX 명세: `docs/design/online-rps-design.md`
  - 구(舊) RSP 진행: `docs/progress/designer-rsp-game.md`

---

## 현재 상태

- **세션 완료 — 커밋 367c623 (2026-04-24)**
- `docs/design/online-rps-design.md` 신규 작성 완료 및 QA PASS 확인 (2026-04-24)
- OQ-4 (결과 화면 표시 시간 3초), OQ-8 (모바일 햅틱) 디자이너 결정 사항 확정 (PRD §16 → 명세 §8에 반영)

---

## 산출물 목록

| 파일 | 설명 | 상태 |
|---|---|---|
| `docs/design/online-rps-design.md` | UX 명세 전체 (카드 상태, 화면 레이아웃, 애니메이션, 접근성) | 완료 (QA PASS) |

---

## 작업 로그

### 2026-04-24 (초기 세션 — UX 명세 작성)

**읽은 파일**
- `docs/specs/online-rps-prd.md` — PRD 전체 검토, CP1 확정 사항 파악
- `docs/progress/designer-rsp-game.md` — 구(舊) RSP 디자인 이력 파악, 폐기 확인
- `frontend/public/games/rcp/` — rock.png, paper.png, scissors.png 에셋 확인 (Glob)
- `frontend/src/games/rsp/RspBoard.tsx` — 기존 카드 UI, 상태 머신, 키보드 단축키 패턴 참고 (삭제 예정)
- `frontend/src/styles/excel.css` — 토큰 구조 참고 (Online RPS는 Excel 모드 N/A)

**작성 완료 항목 (docs/design/online-rps-design.md)**
1. RpsCard 컴포넌트 명세 — 6가지 상태별 스타일 (idle / selected / unselected / revealed / auto / disabled)
2. 매칭 대기 화면 — 3가지 서브 상태 (혼자 대기 / 카운트다운 / 취소)
3. 게임 화면 — 타이머 바, 카드 선택 UI, 참가자 현황 표시
4. 결과 화면 — 본인 결과 배너, 참가자 카드 나열, 재도전 카운트다운
5. 연결 끊김 / 에러 상태 UI — 토스트 4종, 인라인 에러
6. 홈페이지 test lab 진입 카드 — CTA 포함
7. 컬러 / 타이포그래피 토큰 — --rps- 접두사 신규 변수 목록 포함
8. OQ-4, OQ-8 디자이너 결정 사항 답변
9. 반응형 레이아웃 (desktop 769px+ / tablet 481–768px / mobile 480px-)
10. 접근성 명세 (키보드 네비게이션, ARIA, 색상 대비)
11. keyframes 요약 부록

---

## OQ 답변 기록

| OQ ID | 질문 | 결정 내용 |
|---|---|---|
| OQ-4 | 결과 화면 표시 시간 | 최소 3초. 결과 배너 진입 후 3초간 카운트다운 숨김, 3초 후 fade-in. 서버 측 카운트다운 < 3초이면 즉시 노출하되 리스크 공유 필요. |
| OQ-8 | 모바일 터치 애니메이션 | haptic: `navigator.vibrate(60)` 조건부 호출. scale-up: rps-card-select 애니메이션 280ms. |

---

## 주요 설계 결정 사항

- **이미지 에셋 재사용**: `frontend/public/games/rcp/` 의 3개 png 파일을 그대로 사용. 별도 아이콘 추가 없음.
- **키보드 단축키 변경**: 기존 RspBoard의 1/2/3 숫자 → R/P/S 알파벳 (직관성 개선). 실제 구현 키 바인딩은 developer-frontend 결정.
- **Excel 모드 없음**: PRD §3 명시, designer는 일반 모드만 작성. excel.css 참조 불필요.
- **CSS 변수 네임스페이스**: `--rps-` 접두사로 기존 프로젝트 변수와 충돌 방지.
- **카운트다운 데이터**: 대기 화면의 `secondsRemaining`은 서버 `MATCH_COUNTDOWN` payload에서 실시간 수신. 클라이언트 독립 타이머 미사용.

---

## 다음 단계

1. **developer-frontend 착수** (CP2 완료, UX 명세 확정)
   - `docs/design/online-rps-design.md` 기반으로 구현 시작 가능
   - 신규 CSS 변수 `--rps-*` 선언 및 keyframes 구현
   - `frontend/src/games/rsp/` 구(舊) RSP 파일 제거와 병행 진행 가능 (PRD §11)
2. **developer-backend 착수** (API/WebSocket 병렬 진행)
   - PRD §7~9 기준으로 구현

---

## 블로커 / 리스크

- **기존 `--color-*` 변수 정의 파일 미확인**: `frontend/src/styles/`에 excel.css 외 별도 CSS 변수 파일이 없으면 developer-frontend가 `--rps-` 변수 선언 위치 결정 필요.
- **keyframes 구현 위치**: 모듈 CSS vs 글로벌 CSS 선택은 developer-frontend 결정.
- **재도전 카운트다운 서버 연동**: OQ-4 결정은 서버가 `ROUND_RESULT` 후 `MATCH_COUNTDOWN`을 재발송한다는 가정 기반. developer-backend 구현 시 확인 필요.

---

## 세션 종료 로그

| 세션 날짜 | 커밋 해시 | 브랜치 | 완료 내용 | 담당자 |
|---|---|---|---|---|
| 2026-04-24 | `367c623` | main | online-rps-design.md 작성, QA PASS, OQ-4/OQ-8 결정 확정 | designer |

---

## 파일 소유권 메모

- `docs/design/online-rps-design.md` — designer 소유 (UX 명세)
- `docs/progress/designer-online-rps.md` — designer 소유 (본 파일)
- `frontend/src/styles/excel.css` — 수정 금지 (Online RPS 무관)
- `frontend/` 실제 코드 — developer-frontend 소유
