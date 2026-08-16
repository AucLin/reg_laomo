import { Link, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { useAuth } from '../auth/useAuth';

/**
 * `/apply`、`/my`、`/admin` 三頁共用的頁首。
 *
 * 背景：session 存在 localStorage 會長期留著（supabase.ts 設了
 * persistSession: true）。家長在補習班櫃檯或家中共用的平板報名完就離開，
 * 下一個人開啟網站直接是他的身分，看得到孩子姓名、生日、學校、電話；
 * 若是管理員帳號，看得到全部家長的資料。這三頁原本連導覽列都沒有，
 * 全站找不到任何登出出口（AuthProvider.tsx 定義了 signOut，但只有
 * 測試的 vi.fn() 呼叫過）。
 *
 * 這裡刻意不套用到 LandingPage：LandingPage 已有自己的頁首（深色主視覺
 * 區塊的一部分）且已通過視覺驗收，套用這支共用元件會變成兩層頁首、
 * 也會在進入頁多出一顆登出按鈕改變既有樣子。LandingPage 保留原本寫法。
 */
export default function AppHeader() {
  const { user, profile, isAdmin, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  // 家長帳號顯示姓名（辨識度比信箱高）；profile 還沒載入完成或缺姓名時
  // 退回顯示信箱，總之要讓下一個使用者一眼看出「這是誰的帳號」。
  const displayName = profile?.full_name || user?.email || '';

  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-3">
        <Link to="/" className="text-base font-bold text-slate-900 sm:text-lg">
          老莫機器人教育中心
        </Link>

        <div className="flex items-center gap-2 text-xs sm:gap-4 sm:text-sm">
          {displayName && (
            <span
              className="max-w-[32vw] truncate text-slate-500 sm:max-w-xs"
              title={displayName}
            >
              目前登入：{displayName}
            </span>
          )}

          {isAdmin && (
            <Link to="/admin" className="text-slate-600 hover:text-brand-600">
              後台管理
            </Link>
          )}

          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-600 transition hover:bg-slate-50"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            登出
          </button>
        </div>
      </div>
    </header>
  );
}
