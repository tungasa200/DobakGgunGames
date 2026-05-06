# designer — brickbreaker 진행 로그

최종 업데이트: 2026-05-06

## 완료 항목

### docs/design/brickbreaker-ux.md
- [x] 색상 팔레트 전체 (배경/HUD/캔버스/공/패들/벽돌/아이템)
- [x] 벽돌 내구도별 색상 체계 (D1/D2/D3/ITEM) + 손상 밝기 변화 규칙
- [x] HUD 상단 바 상세 명세 (높이/폰트/색상/간격)
- [x] 활성 아이템 칩 타이머 바 + 3초 깜빡임 주기 (0.5s)
- [x] 하단 버튼 스타일 (일시정지/그만두기/도움말)
- [x] 캔버스 렌더링 상세 (공 잔상, 패들 그라디언트, 벽돌 파티클, 캡슐 낙하)
- [x] 스테이지 전환 / 클리어 / 게임오버 오버레이 UX 타임라인
- [x] 닉네임 입력 폼 UX (유효성 검사 포함)
- [x] 랭킹 표시 포맷 — `N스테이지 클리어 / N,NNN점` 형식 + 테이블 컬럼 구성
- [x] 애니메이션/이펙트 목록 전체 (구현 방법 포함)
- [x] 반응형 레이아웃 (데스크톱/태블릿/모바일)
- [x] 접근성 (키보드 내비게이션, 색상 대비, prefers-reduced-motion)

### frontend/src/games/brickbreaker/BrickBreaker.module.css
- [x] .gameWrapper — 페이지 배경 다층 그라디언트, CSS 변수 네임스페이스
- [x] .canvasWrap / .canvas — 비율 유지 반응형, 네온 펄스 애니메이션
- [x] .hudTop / .hudBottom — 상/하단 HUD 레이아웃
- [x] .stageInfo / .scoreInfo / .livesInfo — HUD 항목 스타일
- [x] .lifeHeart / .lifeHeart.lost — 생명 하트 활성/소진
- [x] .itemChips / .itemChip — 아이템 칩 배치 및 아이템별 색상
- [x] .itemChipActive / .itemChipFading — 타이머 progress bar, 깜빡임
- [x] .overlay / .overlay.exiting — 공통 오버레이 기반
- [x] .overlayTitle (.clear/.allClear/.gameOver/.paused) — 상태별 타이틀
- [x] .overlayScore / .overlayBonus / .overlayCountdown — 오버레이 정보
- [x] .overlayActions — 버튼 그룹 컨테이너
- [x] .btnPrimary / .btnSecondary / .btnGhost — 버튼 3종
- [x] .rankForm / .rankFormInput / .rankFormError — 닉네임 입력 폼
- [x] .keyHints / .keyBadge — 도움말 키 안내
- [x] .rankSection / .rankTable — 랭킹 테이블 (컬럼별, 순위색, myRow)
- [x] .allClearBadge — ALL CLEAR 특별 표기
- [x] 반응형 미디어쿼리 (759px, 480px 브레이크포인트)
- [x] prefers-reduced-motion 전체 재정의

## 모드 적용 범위
- 일반(다크 게임 테마) 단독
- Excel 모드: 미적용 (PRD에 미포함)

## 다음 담당자 인계 사항
- developer-frontend 가 BrickBreaker.module.css 를 즉시 구현에 사용 가능
- Canvas 렌더링 로직 (공 잔상 trail 배열, 벽돌 파티클, 아이템 캡슐) 상세는 brickbreaker-ux.md §3 참조
- HUD 아이템 칩 타이머 바 width는 `--timer-pct` CSS 변수로 JS에서 인라인 스타일로 업데이트
- 스테이지 전환 타임라인 상세는 brickbreaker-ux.md §4 참조
