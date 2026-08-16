import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute, AdminRoute } from './auth/RouteGuards';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ApplyPage from './pages/ApplyPage';
import MyRegistrationsPage from './pages/MyRegistrationsPage';
import AdminPage from './pages/AdminPage';

// 以下頁面會在後續任務建立，先用暫時內容佔位，讓路由結構先跑起來。
// Task 19 換成 LandingPage。
function Placeholder({ title }: { title: string }) {
  return <div className="p-8">{title}</div>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Placeholder title="老莫機器人教育中心" />} />
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
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminPage />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
