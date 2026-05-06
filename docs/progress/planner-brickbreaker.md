# Progress — planner — Brick Breaker

## 2026-05-06 (초안 작성)

### 완료
- `docs/specs/brickbreaker.md` 초안 작성 (Phase 1 — 구현 착수 가능)
- 결정 사항 반영:
  - 라우트 `/brickbreaker`, 로그인 불필요 (전체 공개)
  - 일반 모드 only, Excel 모드 N/A
  - 10스테이지 (배치/내구도/속도 모두 정의)
  - 4종 아이템: M(멀티볼), W(패들확장), P(관통볼), S(공슬로우)
  - 점수 공식 + 이론 최대 약 41,740점 (검증 상한 99,999,999 충분)
  - API 계약: `POST /api/brickbreaker/session/start`, `POST /api/brickbreaker/rankings`, `GET /api/brickbreaker/rankings(/alltime)`
  - DB 스키마: `brickbreaker_ranking` 테이블, 정렬 `gameLevel DESC, score DESC, createdAt ASC`
  - 캔버스 720×480 (sample.html 480×320의 1.5배)
  - 테스트 체크리스트 22항목
- 잠정 결정한 오픈 퀘스천 (사용자 의견 받으면 수정):
  - OQ-3: 다시하기는 새 sessionId 발급
  - OQ-4: Stage 10 후 엔딩으로 종료
  - OQ-5: 일별 랭킹 컷오프 KST 00:00

### 인계 대기
- designer: `docs/design/brickbreaker-design.md` 작성 필요
- developer-frontend: §11 파일 목록 기준 구현
- developer-backend: §9, §12 + `RankingService.VALID_GAMES`에 `"brickbreaker"` 추가
- qa-tester: §15 테스트 플랜 정리

### 사용자에게 확인 필요
- OQ-1 (BGM/SFX MVP 포함 여부) — 일단 비포함으로 진행
- OQ-2 (모바일 자이로) — 일단 비포함으로 진행
- 위 잠정 결정한 OQ-3/4/5에 이견 있는지

### 다음 세션 시 할 일
- designer/frontend/backend 작업 중 스펙 질문 받으면 빠르게 답변
- 사용자가 OQ에 대한 답변 주면 PRD 업데이트
