# developer-frontend — mafia-demo 진행 로그

- 최초 작성일: 2026-04-27
- 최종 업데이트: 2026-04-27
- 상태: 프론트엔드 전용 데모 완료 (백엔드 연결 없음), tsc PASS

---

## 개요

백엔드 통신 없이 **모던 스릴러 테마 마피아 게임** 디자인·인터랙션 퀄리티 검증용 데모 페이지.  
React Three Fiber(3D 씬) + GSAP(애니메이션)을 메인 기술로 사용.  
접근 경로: `/dev/mafia` (인증 불필요)

---

## 신규 설치 패키지

| 패키지 | 버전 | 용도 |
|--------|------|------|
| `three` | latest | WebGL 렌더링 엔진 |
| `@react-three/fiber` | latest | React + Three.js 바인딩 |
| `@react-three/drei` | latest | R3F 헬퍼 컴포넌트 |
| `@react-three/postprocessing` | latest | 후처리 이펙트 (Bloom, Vignette) |
| `gsap` | latest | 고성능 애니메이션 |
| `@types/three` | latest | Three.js 타입 정의 |

---

## 구현 파일 목록

| 파일 | 설명 |
|------|------|
| `frontend/src/games/mafia/types.ts` | Role, Phase, Player, GameState, ChatMessage 타입 전체 정의 |
| `frontend/src/games/mafia/mockData.ts` | 8인 한국 이름 모의 플레이어 (마피아2·경찰·의사·시민4), 모의 채팅 메시지 풀 |
| `frontend/src/games/mafia/useMafiaGame.ts` | 게임 상태 머신 훅 (lobby→roleReveal→day→vote→voteResult→night→result 전 흐름) |
| `frontend/src/games/mafia/MafiaGame.tsx` | 최상위 게임 컴포넌트, HUD (원형 SVG 타이머, 플레이어 상태 목록, 채팅 토글) |
| `frontend/src/games/mafia/MafiaScene.tsx` | R3F 3D 씬 — 원형 테이블, 8인 좌석 배치, Bloom+Vignette, 낮/밤 조명 GSAP 트윈, 카메라 패닝 |
| `frontend/src/games/mafia/components/PlayerSeat.tsx` | R3F 캡슐 아바타 — isMe 골드 glow, 투표 타겟 레드 링, 사망 X 표시, useFrame 부유 애니메이션 |
| `frontend/src/games/mafia/components/RoleCard.tsx` | GSAP rotateY 3D 카드 플립 (물음표 → 역할 공개), 역할별 색상/아이콘 |
| `frontend/src/games/mafia/components/PhaseOverlay.tsx` | 낮/밤 전환 텍스트 — GSAP scale up + fade out 오버레이 |
| `frontend/src/games/mafia/components/VotePanel.tsx` | 투표 선택 UI + voteResult phase 득표 바 GSAP width tween |
| `frontend/src/games/mafia/components/NightPanel.tsx` | 역할별 야간 행동 패널 (마피아 처치 선택 / 경찰 조사 / 의사 보호 / 시민 대기) |
| `frontend/src/games/mafia/components/ChatPanel.tsx` | GSAP x 슬라이드인 패널, 자동 모의 메시지, 야간 마피아 전용 채팅 분리 |
| `frontend/src/games/mafia/components/GameResult.tsx` | 승패 파티클 폭발 + GSAP 인트로 텍스트 + 전원 역할 공개 + 다시하기 버튼 |
| `frontend/src/games/mafia/mafia.css` | CSS 변수 기반 스릴러 테마, Glassmorphism 패널, 원형 SVG 타이머 스타일, Bebas Neue + Rajdhani 폰트 |
| `frontend/src/pages/MafiaDevPage.tsx` | `/dev/mafia` 라우트 페이지 |
| `frontend/src/App.tsx` | `/dev/mafia` 라우트 추가 |

---

## 게임 흐름

```
로비(게임 시작 버튼)
  → roleReveal (카드 플립 3초 → 자동)
  → day (토론 30초 타이머 → 자동)
  → vote (플레이어 클릭 → 투표 완료 버튼)
  → voteResult (득표 바 애니 → 최다득표자 탈락 → 2초 자동)
  → 탈락 판정:
      마피아 전멸 → result(citizen WIN)
      마피아 ≥ 생존 시민 → result(mafia WIN)
      그 외 → night (30초 → 의사 50% 확률 탈락 취소 → day 반복)
  → result (승패 화면 → 다시하기)
```

---

## 디자인 컨셉

- **팔레트**: 배경 `#050508`, 메인 `#1a1a2e` / `#16213e` / `#0f3460`, 포인트 레드 `#e94560`
- **폰트**: Bebas Neue(타이틀) + Rajdhani(UI 텍스트) — Google Fonts
- **3D**: 발광 테두리 원형 테이블, 8인 캡슐 아바타, Bloom+Vignette 후처리, 낮(amber)/밤(blue) 조명 전환
- **패널**: Glassmorphism (`backdrop-filter: blur(12px)`, `rgba(255,255,255,0.05)` 배경)

---

## 현재 제약 / 다음 단계

| 항목 | 상태 |
|------|------|
| 백엔드 연결 | 없음 (모의 데이터) |
| 실시간 멀티플레이 | 미구현 |
| 모바일 폴백 | 미구현 |
| 사운드 | 미구현 |
| 레퍼런스 이미지 기반 씬 개선 | 사용자 이미지 제공 후 진행 예정 |

---

## 관련 문서

- 작업 계획: 대화 내 러프 플랜 (2026-04-27)
- 다음 작업 시 이 파일 먼저 확인 후 레퍼런스 이미지 기반 디자인 이터레이션 진행
