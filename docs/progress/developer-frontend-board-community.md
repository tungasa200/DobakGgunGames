# developer-frontend — 도박군 게시판 (board-community) 진행 로그

작성자: developer-frontend
최종 갱신: 2026-04-24
상태: **완료 — 구현 완료, `tsc -b` PASS, `eslint .` 신규 파일 0 에러 (기존 32건은 범위 이탈)**

---

## 변경 파일 총계

### 신규 생성 30개

| 파일 | 설명 |
|---|---|
| `frontend/src/components/FriendRoute.tsx` | FRIEND/ADMIN 권한 가드, USER 접근 시 designer 명세 차단 화면 |
| `frontend/src/api/boardApi.ts` | 백엔드 API 래퍼 9종 (fetch + Bearer, TS interface 포함) |
| `frontend/src/mocks/boardMock.ts` | in-memory 목 스토어 (boardApi 동일 인터페이스) |
| `frontend/src/hooks/useImageUpload.ts` | 이미지 업로드 공통 훅 (검증 + placeholder + URL 교체) |
| `frontend/src/hooks/useToast.ts` | 토스트 상태 관리 훅 (3초 자동 제거) |
| `frontend/src/components/board/EditorToolbar.tsx` | TipTap 툴바 15버튼 + 링크 팝오버 |
| `frontend/src/components/board/EditorToolbar.module.css` | 툴바 CSS |
| `frontend/src/components/board/EditorWrapper.tsx` | TipTap 에디터 (paste/DnD/파일선택 3경로 통합) |
| `frontend/src/components/board/EditorWrapper.module.css` | 에디터 + ProseMirror 내부 스타일 CSS |
| `frontend/src/components/board/PostTypeBadge.tsx` | 양식 배지 3색 (designer 명세 정확 반영) |
| `frontend/src/components/board/PostCard.tsx` | 목록 카드 (아바타 fallback + 댓글수 배지) |
| `frontend/src/components/board/PostCard.module.css` | 카드 CSS |
| `frontend/src/components/board/GameDifficultyPicker.tsx` | 2뎁스 드롭다운 (PRD 7종 매트릭스 전체 + 상수 export) |
| `frontend/src/components/board/GameDifficultyPicker.module.css` | 드롭다운 CSS |
| `frontend/src/components/board/TournamentFields.tsx` | 대회기록 정형 필드 폼 (필수4 + 선택7) |
| `frontend/src/components/board/TournamentFields.module.css` | 폼 CSS |
| `frontend/src/components/board/CommentItem.tsx` | 댓글 카드 (상대시간 + 절대시간 tooltip + 삭제 버튼) |
| `frontend/src/components/board/CommentItem.module.css` | 댓글 카드 CSS |
| `frontend/src/components/board/CommentForm.tsx` | 댓글 입력 폼 (1000자 카운터, 950자 경고, FRIEND+ 제한) |
| `frontend/src/components/board/CommentForm.module.css` | 댓글 폼 CSS |
| `frontend/src/components/board/CommentList.tsx` | 댓글 목록 + cursor 더보기 + 작성 폼 통합 |
| `frontend/src/components/board/CommentList.module.css` | 댓글 목록 CSS |
| `frontend/src/components/board/ToastContainer.tsx` | 우하단 토스트 렌더러 |
| `frontend/src/pages/BoardListPage.tsx` | 글 목록 (탭 필터 + 페이지네이션 압축 + 글쓰기 모달) |
| `frontend/src/pages/BoardListPage.module.css` | 목록 페이지 CSS |
| `frontend/src/pages/BoardDetailPage.tsx` | 글 상세 (TOURNAMENT 카드 + HTML 본문 + 댓글 + 권한 분기) |
| `frontend/src/pages/BoardDetailPage.module.css` | 상세 페이지 CSS |
| `frontend/src/pages/BoardWritePage.tsx` | 글 작성 (?type 쿼리 양식 분기 + 세션만료 draft 저장) |
| `frontend/src/pages/BoardWritePage.module.css` | 작성/수정 공용 CSS |
| `frontend/src/pages/BoardEditPage.tsx` | 글 수정 (기존 데이터 프리필 + postType 변경 불가 UI) |

### 기존 파일 수정 4개

| 파일 | 변경 내용 |
|---|---|
| `frontend/package.json` | TipTap 7개 패키지 `^2.11.5` 추가 |
| `frontend/package-lock.json` | npm install 결과 (67개 패키지 추가, peer deps 이슈 없음) |
| `frontend/src/App.tsx` | FriendRoute import + 4개 라우트 추가 (`/board`, `/board/new`, `/board/:id/edit`, `/board/:id`) |
| `frontend/src/components/normal/NormalHeader.tsx` | FRIEND/ADMIN 조건부 게시판 링크 추가 |
| `frontend/src/components/normal/NormalHeader.module.css` | `.boardLink` 스타일 추가 |

---

## 설치된 TipTap 실제 버전

`^2.11.5` (package.json 기재값). npm install 성공 — 67개 패키지 추가, peer deps 이슈 없음.

---

## 핵심 구현 결정 6건

1. **FriendRoute = AdminRoute 복제 + 조건만 변경**: `role === 'FRIEND' || role === 'ADMIN'`. USER 접근 시 홈 리다이렉트 대신 designer 명세 차단 화면(자물쇠 아이콘 + 홈으로/내 프로필 버튼) 렌더.
2. **axios/react-hook-form 미도입**: 기존 프로젝트의 native fetch + Bearer 헤더 수동 주입 + useState 수동 validate 패턴 그대로 준수.
3. **EditorWrapper = TipTap StarterKit + Underline + Link + Image + Placeholder**: StarterKit에 없는 Underline만 별도 추가. Link에 `target="_blank" rel="noopener noreferrer"` 자동 부여, `javascript:` 스킴 프론트 선제 차단.
4. **이미지 3경로 통합 훅 `useImageUpload`**: 파일선택/DnD/클립보드 붙여넣기 모두 `uploadImageToEditor` 단일 함수로 수렴. blob URL placeholder → 실제 URL ProseMirror transaction 교체 방식.
5. **업로드 실패 UX = 재시도 버튼 포함 placeholder 유지**: PRD 원안("placeholder 제거 + 토스트")에서 designer 개선안으로 변경 승인. placeholder 노드의 `title="__upload_error__"` 마킹으로 CSS 에러 상태 표시.
6. **GameDifficultyPicker**: `blockfall-insane` 1뎁스 독립 항목, 2뎁스 `insane` 단일값 자동선택 + disabled. `apple` `normal` 동일 처리. 상수 `GAME_DIFFICULTY_MAP`을 파일에서 export하여 BoardDetailPage에서 표시 라벨 변환에 재사용.

---

## 목 데이터 사용 현황

4개 페이지 모두 `boardMock` 사용 중. 백엔드 API 배포 후 전환 방법:

```typescript
// 현재 (모든 board 페이지 동일)
import { boardMock as api } from '../mocks/boardMock';

// 전환 시
import { boardApi as api } from '../api/boardApi';
```

변경 대상 4개:
- `src/pages/BoardListPage.tsx`
- `src/pages/BoardDetailPage.tsx`
- `src/pages/BoardWritePage.tsx`
- `src/pages/BoardEditPage.tsx`

---

## 잔여 기존 ESLint 에러 32건 (범위 이탈)

아래 파일들은 게시판 작업 이전부터 누적된 에러이며 이번 PR 범위 밖:

- `src/games/blockfall/**`, `src/games/solitaire/**`, `src/games/sudoku/**`, `src/games/minesweeper/**`
- `src/pages/LoginPage.tsx`, `src/pages/EmailVerifyPage.tsx`, `src/pages/PatchNotesPage.tsx`
- `src/pages/admin/**`
- `src/utils/validate.ts`

신규 생성된 board 관련 파일에서는 0 에러.

---

## 사용자 브라우저 수동 확인 필요 4건 (QA 선행)

| 항목 | 확인 방법 |
|---|---|
| Ctrl+V 붙여넣기 업로드 | 에디터에 이미지 클립보드 붙여넣기 → placeholder 삽입 → 업로드 완료 후 blob URL 교체 확인 |
| 드래그앤드롭 dragging CSS | 이미지 파일을 에디터 위로 드래그 → 테두리 색 변경 확인 |
| 댓글 51개+ 더보기 | boardMock에 51개 댓글 수동 추가 후 `commentHasNext=true` 상태에서 "더 보기" 버튼 동작 확인 |
| 업로드 실패 재시도 UI | 목 환경에서 uploadImage 실패 강제 시뮬레이션 후 에러 placeholder + 토스트 확인 |

---

## 다음 세션 인수인계 주의사항

- **커밋되지 않은 상태**: 모든 파일이 uncommitted. 사용자가 `git add` + `git commit` 직접 수행.
- **백엔드 배포 후 API 전환**: 위 4개 파일의 import 1줄 교체만으로 완료. boardApi.ts의 엔드포인트/타입은 board-api-contract.md와 정확히 일치.
- **TipTap 버전 주의**: 추후 업그레이드 시 7개 패키지 버전 동시 일치 필요 (`@tiptap/*` 버전 불일치 시 ProseMirror 충돌).
- **이미지 업로드 에러 UX**: 실 API 전환 후 `POST /api/board/images` 실패 케이스(네트워크 단절, 50MB 초과 서버 거부 등) 브라우저에서 직접 확인 권장.
