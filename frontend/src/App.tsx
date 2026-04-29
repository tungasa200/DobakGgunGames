import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ExcelHomePage from './pages/ExcelHomePage';
import GamePage from './pages/GamePage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import PasswordResetPage from './pages/PasswordResetPage';
import ProfilePage from './pages/ProfilePage';
import OAuthCallbackPage from './pages/OAuthCallbackPage';
import EmailVerifyPage from './pages/EmailVerifyPage';
import ContactPage from './pages/ContactPage';
import PatchNotesPage from './pages/PatchNotesPage';
import PatchNoteDetailPage from './pages/PatchNoteDetailPage';
import AdminRoute from './components/admin/AdminRoute';
import AdminLayout from './components/admin/AdminLayout';
import FriendRoute from './components/guards/FriendRoute';
import DbgChatListPage from './pages/DbgChatListPage';
import DbgChatRoomPage from './pages/DbgChatRoomPage';
import BoardListPage from './pages/BoardListPage';
import BoardDetailPage from './pages/BoardDetailPage';
import BoardWritePage from './pages/BoardWritePage';
import BoardEditPage from './pages/BoardEditPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminContactsPage from './pages/admin/AdminContactsPage';
import AdminRankingsPage from './pages/admin/AdminRankingsPage';
import AdminLeaderboardPage from './pages/admin/AdminLeaderboardPage';
import AdminPatchNotesPage from './pages/admin/AdminPatchNotesPage';
import AdminPatchNoteFormPage from './pages/admin/AdminPatchNoteFormPage';
import AdminIpBansPage from './pages/admin/AdminIpBansPage';
import AdminGamesPage from './pages/admin/AdminGamesPage';
import AdminClearButton from './components/admin/AdminClearButton';
import AuthRoute from './components/AuthRoute';
import { AdminTestProvider } from './context/AdminTestContext';
import OnlineRpsPage from './pages/OnlineRpsPage';
import BlockfallBattlePage from './pages/BlockfallBattlePage';
import YachtPage from './games/yacht/YachtPage';
import BattleUITestPage from './pages/BattleUITestPage';
import MafiaDevPage from './pages/MafiaDevPage';
import RoulettePage from './pages/RoulettePage';
import LadderPage from './pages/LadderPage';
import DicePage from './pages/DicePage';

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
          path="/yacht"
          element={<AuthRoute><YachtPage /></AuthRoute>}
        />

        {/* Test Lab — 블록폴 배틀 (로그인/게스트 모두 허용, /:game 보다 위에 선언) */}
        <Route
          path="/test-lab/blockfall-battle"
          element={<BlockfallBattlePage />}
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
      <AdminClearButton />
    </BrowserRouter>
    </AdminTestProvider>
  );
}
