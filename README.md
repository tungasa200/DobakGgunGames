# DobakGgun Games

솔로플레이 미니게임 컬렉션 — 일반 모드와 Microsoft Excel UI 모드로 플레이 가능

## 게임 & 도구 목록

### 미니게임 (랭킹 연동)

| 게임 | 라우트 | 난이도 | 랭킹 기준 | Excel 모드 |
|---|---|---|---|---|
| 💣 지뢰찾기 | `/minesweeper` | 초급 / 중급 / 고급 | 시간 (빠를수록) | ✗ |
| ⚾ 숫자야구 | `/baseball` | 쉬움 / 보통 / 어려움 | 시도 횟수 (적을수록) | ✗ |
| 🟦 블록폴 | `/blockfall` | 쉬움 / 보통 / 어려움 | 점수 (높을수록) | ✓ |
| 💀 블록폴 인세인 | `/blockfall-insane` | 단일 | 점수 (높을수록) | ✗ |
| 🍎 사과게임 | `/apple` | 일반 | 점수 (높을수록) | ✗ |
| 🃏 솔리테어 | `/solitaire` | 드로우1 / 드로우3 | 시간 → 이동 수 | ✗ |
| 🔢 스도쿠 | `/sudoku` | 쉬움 / 보통 / 어려움 | — | ✓ |
| 🧱 브릭브레이커 | `/brickbreaker` | — | — | ✗ |
| 🎲 야추 | `/yacht` | — | — | ✗ |

### 실시간 멀티플레이

| 게임 | 라우트 | 방식 | 접근 |
|---|---|---|---|
| ✊ 온라인 RPS | `/online-rps` | WebSocket 자동매칭 (2~4인) | 비로그인 허용 |
| 🔷 블록폴 배틀 | `/blockfall-battle` | WebSocket 방 관리 (최대 5인) | 로그인 필요 |

### 소셜 (FRIEND / ADMIN 전용)

| 기능 | 라우트 | 설명 |
|---|---|---|
| 📋 게시판 | `/board` | TipTap 에디터, R2 이미지 첨부 |
| 💬 채팅 | `/dbgchat` | 사용자 생성 채팅방 (최대 50개) |

### 클라이언트 도구 (로그인 불필요)

| 도구 | 라우트 |
|---|---|
| 🎡 룰렛 | `/roulette` |
| 🎲 주사위 | `/dice` |
| 🪜 사다리 타기 | `/ladder` |

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 프론트엔드 | React 19 + Vite + TypeScript (Vercel 배포) |
| 백엔드 | Spring Boot 3.5, Java 17, Gradle (Railway 배포) |
| 데이터베이스 | MySQL 8 + Redis (Railway) |
| 인증 | Spring Security + JWT (AT 15분 / RT 7일) + OAuth2 (Google / Kakao / Naver) |
| 스토리지 | Cloudflare R2 (AWS S3 SDK) |
| 이메일 | Resend |
| 실시간 | STOMP over SockJS — `/ws` (채팅 / RPS), `/ws-battle` (블록폴 배틀) |
| CI | GitHub Actions |

## 사용자 역할

| 역할 | 설명 |
|---|---|
| `USER` | 일반 회원 — 게임, 랭킹 |
| `FRIEND` (도박꾼) | 게시판, 채팅 접근 가능 |
| `ADMIN` | 전체 관리 — Admin Panel |

## 프로젝트 구조

```
DobakGgunGames/
├── frontend/                        # React + Vite
│   └── src/
│       ├── App.tsx                  # 라우팅
│       ├── api/                     # 백엔드 API 래퍼
│       ├── components/              # 공통 컴포넌트 (AuthRoute, FriendRoute 등)
│       ├── pages/                   # 라우트 페이지
│       ├── styles/
│       │   └── excel.css            # Excel UI 공통 CSS
│       └── utils/hmac.ts            # HMAC 토큰 생성
│
├── backend/                         # Spring Boot
│   └── src/main/java/com/dobakggun/
│       ├── controller/
│       ├── service/
│       ├── entity/
│       ├── dto/
│       ├── repository/
│       ├── security/                # JWT 필터, OAuth2 핸들러
│       └── config/                  # CORS, WebSocket, S3
│
├── shared/                          # 공유 리소스 (badwords.json 등)
├── docs/
│   ├── specs/                       # PRD
│   ├── design/                      # UX 명세
│   ├── progress/                    # 팀원별 진행 로그
│   └── review/                      # 테스트 플랜 / 버그 리포트
└── .github/workflows/
    ├── frontend-ci.yml
    └── backend-ci.yml
```

## API

### 랭킹

```
GET  /api/{game}/rankings?level={level}          주간 TOP 10
GET  /api/{game}/rankings/alltime?level={level}  역대 최고 1개
POST /api/{game}/rankings                        점수 제출 (HMAC 토큰 필수)
```

`{game}`: `minesweeper` | `baseball` | `blockfall` | `solitaire` | `apple`

### 인증

```
POST /api/auth/signup               회원가입
POST /api/auth/login                로그인
POST /api/auth/refresh              액세스 토큰 갱신
POST /api/auth/logout               로그아웃
GET  /api/auth/oauth2/{provider}    OAuth2 로그인 (google / kakao / naver)
```

### WebSocket

```
/ws             RPS 자동매칭 + 채팅
/ws-battle      블록폴 배틀 방 관리
```

## 로컬 개발 환경

### 사전 조건

- Node.js 22+
- Java 17+
- MySQL 8
- Redis

### 백엔드

```bash
mysql -u root -p -e "CREATE DATABASE dobakggun CHARACTER SET utf8mb4;"

cp backend/.env.example backend/.env
# backend/.env 편집

cd backend
./gradlew bootRun
```

### 프론트엔드

```bash
cd frontend
cp .env.local.example .env.local
# .env.local 편집

npm install
npm run dev
```

## 환경변수

### 백엔드 (Railway)

| 변수 | 설명 |
|---|---|
| `DB_HOST` / `DB_PORT` / `DB_NAME` / `DB_USER` / `DB_PASS` | MySQL 접속 정보 |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Redis 접속 정보 |
| `JWT_SECRET` | JWT 서명 키 |
| `HMAC_SECRET` | 랭킹 점수 제출 서명 키 |
| `CORS_ORIGINS` | 허용 Origin (프론트 URL) |
| `OAUTH_GOOGLE_*` / `OAUTH_KAKAO_*` / `OAUTH_NAVER_*` | OAuth2 클라이언트 정보 |
| `R2_ENDPOINT` / `R2_ACCESS_KEY` / `R2_SECRET_KEY` / `R2_BUCKET` | Cloudflare R2 |
| `RESEND_API_KEY` | 이메일 발송 |

### 프론트엔드 (Vercel)

| 변수 | 설명 |
|---|---|
| `VITE_API_URL` | 백엔드 REST API URL |
| `VITE_WS_URL` | WebSocket URL (`/ws`) |
| `VITE_WS_BATTLE_URL` | 배틀 WebSocket URL (`/ws-battle`) |
| `VITE_HMAC_SECRET` | HMAC 서명 키 (백엔드와 동일) |

## 보안

- **HMAC 토큰**: 랭킹 점수 제출 시 공유 비밀키로 서명 — 캐주얼 부정행위 방지
- **점수 범위 검증**: 서버에서 물리적으로 불가능한 점수 거부
- **Rate Limit**: IP당 1분에 3회 초과 시 429 응답
- **CORS**: 등록된 Origin만 허용
- **FriendRoute**: FRIEND / ADMIN 역할만 게시판 · 채팅 접근
- **환경변수**: 실제 값은 Vercel / Railway UI에만 저장, 소스코드 커밋 금지
