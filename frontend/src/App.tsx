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
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import AdminUsersPage from './pages/admin/AdminUsersPage';
import AdminContactsPage from './pages/admin/AdminContactsPage';
import AdminRankingsPage from './pages/admin/AdminRankingsPage';
import AdminLeaderboardPage from './pages/admin/AdminLeaderboardPage';
import AdminPatchNotesPage from './pages/admin/AdminPatchNotesPage';
import AdminPatchNoteFormPage from './pages/admin/AdminPatchNoteFormPage';
import AdminIpBansPage from './pages/admin/AdminIpBansPage';

export default function App() {
  return (
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
        </Route>

        {/* 게임 라우트 (가장 마지막 — 다른 경로와 충돌 방지) */}
        <Route path="/:game" element={<GamePage excel={false} />} />
        <Route path="/:game/excel" element={<GamePage excel={true} />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
