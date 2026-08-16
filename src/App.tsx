import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './auth/AuthProvider';
import { ProtectedRoute, AdminRoute } from './auth/RouteGuards';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';

// 以下頁面會在後續任務建立，先用暫時內容佔位，讓路由結構先跑起來。
// Task 13 換成 ApplyPage、Task 14 換成 MyRegistrationsPage、
// Task 17 換成 AdminPage、Task 19 換成 LandingPage。
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
                <Placeholder title="報名表" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/my"
            element={
              <ProtectedRoute>
                <Placeholder title="我的報名" />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminRoute>
                <Placeholder title="後台管理" />
              </AdminRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
