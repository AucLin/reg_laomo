import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute, AdminRoute } from './auth/RouteGuards';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ApplyPage from './pages/ApplyPage';
import MyRegistrationsPage from './pages/MyRegistrationsPage';
import AdminPage from './pages/AdminPage';
import ContestsPage from './pages/ContestsPage';
import AdminContestsPage from './pages/AdminContestsPage';
import AdminLayout from './components/admin/AdminLayout';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route
            path="/apply"
            element={
              <ProtectedRoute>
                <ApplyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my"
            element={
              <ProtectedRoute>
                <MyRegistrationsPage />
              </ProtectedRoute>
            }
          />
          {/* 比賽清單不設路由守衛：未登入的訪客也要看得到，這是招生素材 */}
          <Route path="/contests" element={<ContestsPage />} />
          {/* 分享出去的單場比賽連結 */}
          <Route path="/contests/:contestId" element={<ContestsPage />} />
          {/* 後台的頁面共用一個外框（側邊欄），守衛只掛在外層一次 */}
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminLayout />
              </AdminRoute>
            }
          >
            <Route index element={<AdminPage />} />
            <Route path="contests" element={<AdminContestsPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
