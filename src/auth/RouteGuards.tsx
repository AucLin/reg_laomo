import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth';

function Loading() {
  return (
    <div className="flex min-h-screen items-center justify-center text-slate-500">
      載入中…
    </div>
  );
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  // 登入狀態還沒確定時不能直接導走，否則重新整理頁面會把已登入的
  // 使用者踢回登入頁。
  if (loading) return <Loading />;

  if (!user) {
    // 記住原本要去的頁面，登入後送他回去
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  return <>{children}</>;
}

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading } = useAuth();

  if (loading) return <Loading />;

  // 非管理員一律導回進入頁，不顯示「權限不足」之類的訊息 ——
  // 那等於告訴對方這裡有個後台。
  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
