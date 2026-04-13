# DobakGgun Games

솔로플레이 미니게임 컬렉션 — 일반 모드와 Microsoft Excel UI 모드로 플레이 가능

## 게임 목록

| 게임 | 레벨 | 랭킹 기준 |
|---|---|---|
| 💣 지뢰찾기 | 초급 / 중급 / 고급 | 시간 (빠를수록) |
| ⚾ 숫자야구 | 쉬움 / 보통 / 어려움 | 시도 횟수 (적을수록) |
| 🟦 블록폴 | 쉬움 / 보통 / 어려움 | 점수 (높을수록) |
| 🍎 사과게임 | 일반 | 점수 (높을수록) |
| 🃏 솔리테어 | 드로우1 / 드로우3 | 시간 → 이동 수 |

## 기술 스택

| 레이어 | 기술 |
|---|---|
| 프론트엔드 | React 19 + Vite + TypeScript |
| 라우팅 | React Router v6 |
| 백엔드 | Spring Boot 3.5 (Java 17) + Gradle |
| ORM / DB | Spring Data JPA + MySQL 8 |
| 배포 (프론트) | Vercel |
| 배포 (백엔드 + DB) | Railway |
| CI | GitHub Actions |

## 프로젝트 구조

```
dobakggun/
├── frontend/                        # React + Vite
│   ├── src/
│   │   ├── App.tsx                  # 라우팅
│   │   ├── api/rankings.ts          # 백엔드 API 래퍼
│   │   ├── utils/hmac.ts            # HMAC 토큰 생성
│   │   ├── styles/excel.css         # Excel UI 공통 CSS
│   │   └── pages/
│   │       ├── HomePage.tsx
│   │       ├── ExcelHomePage.tsx
│   │       └── GamePage.tsx
│   ├── .env.local.example
│   └── vite.config.ts
│
├── backend/                         # Spring Boot
│   └── src/main/java/com/dobakggun/
│       ├── controller/RankingController.java
│       ├── service/
│       │   ├── RankingService.java
│       │   └── HmacService.java
│       ├── repository/RankingRepository.java
│       ├── entity/Ranking.java
│       ├── dto/
│       │   ├── RankingRequest.java
│       │   └── RankingResponse.java
│       └── config/
│           ├── WebConfig.java        # CORS
│           └── GlobalExceptionHandler.java
│
└── .github/workflows/
    ├── frontend-ci.yml
    └── backend-ci.yml
```

## API

```
GET  /api/{game}/rankings?level={level}          주간 TOP 10
GET  /api/{game}/rankings/alltime?level={level}  역대 최고 1개
POST /api/{game}/rankings                        점수 제출
```

`{game}`: `minesweeper` | `baseball` | `blockfall` | `solitaire` | `apple`

### 점수 제출 요청 예시

```json
{
  "level": "beginner",
  "name": "홍길동",
  "time": 34.72,
  "token": "<HMAC-SHA256 토큰>",
  "timestamp": 1712620800
}
```

## 로컬 개발 환경 설정

### 사전 조건
- Node.js 22+
- Java 17+
- MySQL 8

### 백엔드

```bash
# DB 생성
mysql -u root -p -e "CREATE DATABASE dobakggun CHARACTER SET utf8mb4;"

# 환경변수 설정
cp backend/.env.example backend/.env
# backend/.env 편집

# 실행
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

### 백엔드 (`backend/.env`)

| 변수 | 설명 | 기본값 |
|---|---|---|
| `DB_HOST` | DB 호스트 | `localhost` |
| `DB_PORT` | DB 포트 | `3306` |
| `DB_NAME` | DB 이름 | `dobakggun` |
| `DB_USER` | DB 유저 | `root` |
| `DB_PASS` | DB 비밀번호 | (없음) |
| `HMAC_SECRET` | HMAC 서명 키 | `dev-secret-...` |
| `CORS_ORIGINS` | 허용 Origin | `http://localhost:5173` |

### 프론트엔드 (`frontend/.env.local`)

| 변수 | 설명 |
|---|---|
| `VITE_API_URL` | 백엔드 URL (프로덕션) |
| `VITE_HMAC_SECRET` | HMAC 서명 키 (백엔드와 동일) |

## 보안

- **HMAC 토큰**: 점수 제출 시 클라이언트가 서버와 공유하는 비밀키로 서명 → 캐주얼 부정행위 방지
- **점수 범위 검증**: 서버에서 물리적으로 불가능한 점수 거부
- **Rate Limit**: IP당 1분에 3회 제출 초과 시 429 응답
- **자격증명**: 소스코드에 DB 비밀번호 없음, 환경변수로만 관리
- **CORS**: 특정 도메인만 허용
