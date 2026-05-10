# Progress — planner : Yacht D8 모드 (정팔면체 병행 운영)

- 소유 팀원: **planner**
- 기능 키: `yacht-d8`
- 최초 작성: 2026-05-10
- 최종 업데이트: 2026-05-10
- 관련 문서:
  - 본 PRD: `docs/specs/yacht-d8-mode-prd.md` (신규)
  - 본체 야추 PRD: `docs/specs/yacht-prd.md` (v1.0, 2026-04-29 CP1 승인 완료)
  - API 계약: `docs/specs/yacht-api-contract.md` (d8 분기 섹션 추가됨)
  - 야추 본체 progress: `docs/progress/planner-yacht.md`

---

## 현재 상태

- **PRD 작성 완료** (사용자 정책 결정 8건 그대로 반영).
- **API 계약 문서 d8 분기 섹션 추가 완료** — 별도 파일 생성 없이 `yacht-api-contract.md` 끝에 `## d8 모드 분기` 추가.
- 사용자가 결정한 모든 정책 사항을 PRD에 명시. 코드 수정은 하지 않음 (사용자 지시 — 명세 문서만).

---

## 사용자 확정 결정사항 (PRD 반영 매핑)

| # | 결정사항 | PRD 반영 위치 |
|---|---|---|
| 1 | 상단 족보 ONES~EIGHTS 8개 (d6는 6개 그대로) | §3 모드 정의 표, §5.1 |
| 2 | 상단 보너스 임계 D8=84점, 보너스 점수 D6와 동일 35점 (잠정) | §5.2, §13 OQ-1 (의문점에 명시) |
| 3 | 하단 족보 d6와 동일 룰 (face 1~8) | §5.3 |
| 3a | LITTLE_STRAIGHT 셋: {1,2,3,4} {2,3,4,5} {3,4,5,6} {4,5,6,7} {5,6,7,8} | §5.4 |
| 3b | BIG_STRAIGHT 셋: {1,2,3,4,5} {2,3,4,5,6} {3,4,5,6,7} {4,5,6,7,8} | §5.5 |
| 3c | YACHT=50, FULL_HOUSE/FOUR_OF_A_KIND 룰 동일 | §5.3 |
| 4 | 주사위 5개·3회 굴림 그대로 | §3 표, §5.7 |
| 5 | 랭킹 분리 — yacht_record.dice_type, /api/yacht/rankings 모드별 분리 응답 | §7, §9.3, API §d8.4 |
| 6 | 매칭 분리 — POST /api/yacht/match 바디 diceType 추가, 같은 모드끼리만 | §6, §9.1, API §d8.2 |
| 7 | 모드 선택 UI — 홈 → 야추 진입 → 모드 선택(D6/D8) → 매칭 | §11.1, §11.2 |
| 8 | yacht_room.dice_type 적용 완료, yacht_record는 마이그레이션 SQL 필요 | §8.1 (적용 완료 표기), §8.2 (마이그레이션 SQL 본문) |

---

## PRD 핵심 요약 (designer / developer 인계용)

### designer가 봐야 할 섹션
- §11 UI 흐름 (모드 선택 화면, 게임 화면 모드 배지)
- §12 14행 점수판 레이아웃 (모바일 스크롤/sticky, 카테고리명 축약)
- D8 주사위 시각 (정팔면체) — 본 PRD에서는 지침만, 정확한 명세는 designer가 `docs/design/yacht-d8-design.md`에 작성

### developer-backend가 봐야 할 섹션
- §5 점수 룰 상세 + §5.6 의사 코드 (D8 분기)
- §6 매칭 정책 (모드별 분리)
- §7 랭킹 정책
- §8 DB 마이그레이션 SQL (`yacht_record.dice_type`)
- §9 API 변경 (`POST /match` 요청 바디, `GET /room/{id}` 응답, `/rankings` 응답)
- §10 WebSocket 페이로드 (`diceType` 추가)
- API 계약 §d8.* 전체

### developer-frontend가 봐야 할 섹션
- §3 모드 정의 표 (D6 vs D8)
- §11 UI 흐름
- §12 14행 점수판 (모바일 스크롤/sticky)
- API 계약 §d8.2~d8.7 (요청 바디, 응답, STOMP 페이로드, DTO)

### qa-tester가 봐야 할 섹션
- §15 성공 지표 체크리스트
- §13 의문점 (출시 후 모니터링 항목)
- 회귀 — 기존 D6 게임 정상 동작 (점수 계산, 매칭, 랭킹)

---

## 인계 메시지 (다른 팀원에게)

- **designer**: `docs/specs/yacht-d8-mode-prd.md` 확인 후 `docs/design/yacht-d8-design.md` 작성 부탁. 핵심: 모드 선택 화면 + 14행 점수판(모바일 sticky 정책) + d8 주사위 시각(정팔면체 모델).
- **developer-backend**: `docs/specs/yacht-d8-mode-prd.md` + `docs/specs/yacht-api-contract.md` §d8 섹션 확인. 우선순위:
  1. `yacht_record.dice_type` 마이그레이션 SQL 준비 (Railway는 사용자가 수동 실행)
  2. 점수 계산기 D8 분기
  3. 매칭/랭킹 모드별 분리
  4. WebSocket 페이로드 `diceType` 추가
- **developer-frontend**: PRD §11/§12 + API 계약 §d8 확인. 우선순위:
  1. 모드 선택 화면 신규
  2. `POST /api/yacht/match` 호출 시 `diceType` 전달
  3. 점수판 14행 렌더 (모드 분기)
  4. d8 3D 주사위 모델 (designer 명세 대기)
- **qa-tester**: PRD §15 + §13 기반으로 테스트 시나리오 작성 (모드 분리 매칭, 14행 점수, 보너스 임계 84, 백필 검증).

---

## 의문점 / 후속 결정 필요

| ID | 질문 | 담당 | 시점 |
|---|---|---|---|
| OQ-1 | D8 보너스 점수 35로 충분한가? (50으로 상향 검토) | planner | 출시 후 도달률 모니터링 후 |
| OQ-2 | 14행 점수판 모바일 sticky 적용 여부 | designer | 디자인 명세 작성 시 |
| OQ-3 | `yacht_score`/`yacht_win` 비정규화 추가 여부 | developer-backend | 구현 시 JOIN 비용 평가 |

---

## 다음 액션

- [x] PRD 작성 — `docs/specs/yacht-d8-mode-prd.md`
- [x] API 계약에 d8 분기 섹션 추가 — `docs/specs/yacht-api-contract.md` 끝부분
- [x] 진행 로그 — 본 파일
- [ ] designer에게 디자인 명세 작성 요청 (사용자가 호출)
- [ ] developer-backend / developer-frontend에게 구현 시작 요청 (사용자가 호출)
- [ ] 출시 후 OQ-1 (보너스 점수) 도달률 모니터링 및 재조정 검토

---

## 변경 이력

| 날짜 | 변경 내용 |
|---|---|
| 2026-05-10 | 최초 작성. PRD 확정 + API 계약 d8 분기 섹션 추가. |
