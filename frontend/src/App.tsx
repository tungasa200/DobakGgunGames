import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import AdminRoute from './components/admin/AdminRoute';
import AdminLayout from './components/admin/AdminLayout';
import FriendRoute from './components/guards/FriendRoute';
import AuthRoute from './components/AuthRoute';
import AdminClearButton from './components/admin/AdminClearButton';
import { AdminTestProvider } from './context/AdminTestContext';

// 페이지 lazy 로딩 — 방문 시점에 청크 다운로드
const HomePage = lazy(() => import('./pages/HomePage'));
const ExcelHomePage = lazy(() => import('./pages/ExcelHomePage'));
const GamePage = lazy(() => import('./pages/GamePage'));
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignupPage = lazy(() => import('./pages/SignupPage'));
const PasswordResetPage = lazy(() => import('./pages/PasswordResetPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const OAuthCallbackPage = lazy(() => import('./pages/OAuthCallbackPage'));
const EmailVerifyPage = lazy(() => import('./pages/EmailVerifyPage'));
const ContactPage = lazy(() => import('./pages/ContactPage'));
const PatchNotesPage = lazy(() => import('./pages/PatchNotesPage'));
const PatchNoteDetailPage = lazy(() => import('./pages/PatchNoteDetailPage'));
const DbgChatListPage = lazy(() => import('./pages/DbgChatListPage'));
const DbgChatRoomPage = lazy(() => import('./pages/DbgChatRoomPage'));
const BoardListPage = lazy(() => import('./pages/BoardListPage'));
const BoardDetailPage = lazy(() => import('./pages/BoardDetailPage'));
const BoardWritePage = lazy(() => import('./pages/BoardWritePage'));
const BoardEditPage = lazy(() => import('./pages/BoardEditPage'));
const OnlineRpsPage = lazy(() => import('./pages/OnlineRpsPage'));
const BlockfallBattlePage = lazy(() => import('./pages/BlockfallBattlePage'));
const MinesweeperBattleBoard = lazy(() => import('./games/minesweeper/battle/MinesweeperBattleBoard'));
const AppleBattleBoard = lazy(() => import('./games/apple/battle/AppleBattleBoard'));
const YachtPage = lazy(() => import('./games/yacht/YachtPage'));
const YachtSelectPage = lazy(() => import('./games/yacht/YachtSelectPage'));
const YachtBotPage = lazy(() => import('./games/yacht-bot/YachtBotPage'));
const BattleUITestPage = lazy(() => import('./pages/BattleUITestPage'));
const MafiaDevPage = lazy(() => import('./pages/MafiaDevPage'));
const RoulettePage = lazy(() => import('./pages/RoulettePage'));
const LadderPage = lazy(() => import('./pages/LadderPage'));
const DicePage = lazy(() => import('./pages/DicePage'));
const BrickBreakerPage = lazy(() => import('./pages/BrickBreakerPage'));
const BlockCrushPage = lazy(() => import('./pages/BlockCrushPage'));

// 어드민 페이지
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/admin/AdminUsersPage'));
const AdminContactsPage = lazy(() => import('./pages/admin/AdminContactsPage'));
const AdminRankingsPage = lazy(() => import('./pages/admin/AdminRankingsPage'));
const AdminLeaderboardPage = lazy(() => import('./pages/admin/AdminLeaderboardPage'));
const AdminPatchNotesPage = lazy(() => import('./pages/admin/AdminPatchNotesPage'));
const AdminPatchNoteFormPage = lazy(() => import('./pages/admin/AdminPatchNoteFormPage'));
const AdminIpBansPage = lazy(() => import('./pages/admin/AdminIpBansPage'));
const AdminGamesPage = lazy(() => import('./pages/admin/AdminGamesPage'));

export default function App() {
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.code !== 'Space' && e.keyCode !== 32) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'A') return;
        if (target.isContentEditable) return;
      }
      e.preventDefault();
    };
    const opts: AddEventListenerOptions = { capture: true, passive: false };
    document.addEventListener('keydown', onKeyDown, opts);
    window.addEventListener('keydown', onKeyDown, opts);
    return () => {
      document.removeEventListener('keydown', onKeyDown, opts);
      window.removeEventListener('keydown', onKeyDown, opts);
    };
  }, []);

  return (
    <AdminTestProvider>
    <BrowserRouter>
      <Suspense fallback={null}>
      <Routes>
        {/* 기존 라우트 */}
        <Route path="/" element={<HomePage />} />
        <Route path="/excel" element={<ExcelHomePage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/terms" element={<TermsOfServicePage />} />

        {/* 인증 라우트 */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/password-reset" element={<PasswordResetPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/oauth/callback" element={<OAuthCallbackPage />} />
        <Route path="/verify-email" element={<EmailVerifyPage />} />
        <Route path="/contact" element={<ContactPage />} />

        {/* 패치노트 공개 */}
        <Route path="/patch-notes" element={<PatchNotesPage />} />
        <Route path="/patch-notes/:id" element={<PatchNoteDetailPage />} />

        {/* 게시판 — FRIEND 이상 전용 (/:game 보다 먼저 선언) */}
        <Route path="/board" element={<FriendRoute><BoardListPage /></FriendRoute>} />
        <Route path="/board/new" element={<FriendRoute><BoardWritePage /></FriendRoute>} />
        <Route path="/board/:id/edit" element={<FriendRoute><BoardEditPage /></FriendRoute>} />
        <Route path="/board/:id" element={<FriendRoute><BoardDetailPage /></FriendRoute>} />

        {/* Online RPS — 로그인/게스트 모두 허용 */}
        <Route
          path="/online-rps"
          element={<OnlineRpsPage />}
        />

        {/* Yacht — 로그인 필수 */}
        <Route
          path="/yacht/select"
          element={<AuthRoute><YachtSelectPage /></AuthRoute>}
        />
        <Route
          path="/yacht"
          element={<AuthRoute><YachtPage /></AuthRoute>}
        />
        <Route
          path="/yacht-bot"
          element={<AuthRoute><YachtBotPage /></AuthRoute>}
        />

        {/* 사과게임 배틀 (로그인/게스트 모두 허용) */}
        <Route
          path="/games/apple/battle"
          element={<AppleBattleBoard />}
        />

        {/* 지뢰찾기 배틀 (로그인/게스트 모두 허용) */}
        <Route
          path="/games/minesweeper/battle"
          element={<MinesweeperBattleBoard />}
        />

        {/* 블록폴 배틀 (정식, 로그인/게스트 모두 허용) */}
        <Route
          path="/blockfall-battle"
          element={<BlockfallBattlePage />}
        />
        {/* Test Lab URL 하위 호환 유지 */}
        <Route
          path="/test-lab/blockfall-battle"
          element={<BlockfallBattlePage />}
        />

        {/* 벽돌깨기 — 로그인/게스트 모두 허용 */}
        <Route
          path="/brickbreaker"
          element={<BrickBreakerPage />}
        />

        {/* 블록 크러시 — 로그인/게스트 모두 허용 */}
        <Route
          path="/block-crush"
          element={<BlockCrushPage />}
        />

        {/* DEV — 배틀 UI 테스트 (통신 없이 로컬 확인용) */}
        <Route path="/dev/battle-ui" element={<BattleUITestPage />} />
        <Route path="/dev/mafia" element={<MafiaDevPage />} />

        {/* 어드민 */}
        <Route path="/admin" element={<AdminRoute><AdminLayout /></AdminRoute>}>
          <Route index element={<AdminDashboardPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="contacts" element={<AdminContactsPage />} />
          <Route path="rankings" element={<AdminRankingsPage />} />
          <Route path="leaderboard" element={<AdminLeaderboardPage />} />
          <Route path="patch-notes" element={<AdminPatchNotesPage />} />
          <Route path="patch-notes/new" element={<AdminPatchNoteFormPage />} />
          <Route path="patch-notes/:id/edit" element={<AdminPatchNoteFormPage />} />
          <Route path="ip-bans" element={<AdminIpBansPage />} />
          <Route path="games" element={<AdminGamesPage />} />
        </Route>

        {/* 채팅 Test Room — FRIEND 이상 전용, /:game 보다 위에 선언 */}
        <Route path="/dbgchat" element={<FriendRoute><DbgChatListPage /></FriendRoute>} />
        <Route path="/dbgchat/:roomId" element={<FriendRoute><DbgChatRoomPage /></FriendRoute>} />

        {/* 인세인 모드 — 로그인 유저 전용, /:game 보다 위에 선언 */}
        <Route
          path="/blockfall-insane"
          element={<AuthRoute><GamePage excel={false} gameKey="blockfall-insane" /></AuthRoute>}
        />
        {/* 인세인 엑셀 모드 없음 — 접근 시 인세인 일반 모드로 리다이렉트 */}
        <Route path="/blockfall-insane/excel" element={<Navigate to="/blockfall-insane" replace />} />

        {/* 미니게임 도구 — /:game 보다 먼저 선언 */}
        <Route path="/roulette" element={<RoulettePage />} />
        <Route path="/dice" element={<DicePage />} />
        <Route path="/ladder" element={<LadderPage />} />

        {/* 게임 라우트 (가장 마지막 — 다른 경로와 충돌 방지) */}
        <Route path="/:game" element={<GamePage excel={false} />} />
        <Route path="/:game/excel" element={<GamePage excel={true} />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
      <AdminClearButton />
    </BrowserRouter>
    </AdminTestProvider>
  );
}
