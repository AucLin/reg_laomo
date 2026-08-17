import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ClipboardList, ExternalLink, LogOut, Menu, Trophy, X } from 'lucide-react';
import { useAuth } from '../../auth/useAuth';

/*
  後台的共用外框。

  原本兩頁各自帶一份頁首，彼此的入口是散在標題列的連結（報名管理那頁有
  「比賽管理」，比賽管理那頁有「回報名管理」），跟「匯出 CSV」這種動作
  按鈕混在同一排 —— 分不出哪個是換頁、哪個是對這頁做事。導覽收進側邊欄
  之後，標題列只剩下這一頁自己的動作。

  側邊欄在桌機固定在左邊；手機沒有那個寬度，收成頂部列加抽屜。
*/

const NAV = [
  { to: '/admin', label: '報名管理', icon: ClipboardList, end: true },
  { to: '/admin/contests', label: '比賽管理', icon: Trophy, end: false },
];

export default function AdminLayout() {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);

  // 換頁後把抽屜收起來，否則點完新頁面還被蓋住
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // 蓋住整個畫面的東西一定要能用 Esc 關掉，不然鍵盤操作的人會被困住
  useEffect(() => {
    if (!menuOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setMenuOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [menuOpen]);

  async function handleSignOut() {
    await signOut();
    navigate('/');
  }

  const displayName = profile?.full_name || user?.email || '';

  return (
    <div className="min-h-screen bg-slate-50 lg:flex">
      {/* 手機頂部列。桌機用不到，側邊欄本身就一直在 */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-expanded={menuOpen}
          aria-label="開啟選單"
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-600"
        >
          <Menu className="h-4 w-4" aria-hidden="true" />
          選單
        </button>
        <span className="text-sm font-semibold text-slate-900">後台管理</span>
      </div>

      {menuOpen && (
        <button
          type="button"
          aria-label="關閉選單"
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
        />
      )}

      <Sidebar
        open={menuOpen}
        displayName={displayName}
        onClose={() => setMenuOpen(false)}
        onSignOut={handleSignOut}
      />

      <main className="min-w-0 flex-1">
        <Outlet />
      </main>
    </div>
  );
}

function Sidebar({
  open,
  displayName,
  onClose,
  onSignOut,
}: {
  open: boolean;
  displayName: string;
  onClose: () => void;
  onSignOut: () => void;
}) {
  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-slate-200 bg-white transition-transform lg:static lg:translate-x-0 ${
        open ? 'translate-x-0' : '-translate-x-full'
      }`}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">
            老莫機器人教育中心
          </p>
          <p className="text-xs text-slate-500">後台管理</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="關閉選單"
          className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 lg:hidden"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition ${
                isActive
                  ? 'bg-brand-50 font-semibold text-brand-700'
                  : 'text-slate-600 hover:bg-slate-50'
              }`
            }
          >
            <item.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-3 border-t border-slate-100 p-3">
        {displayName && (
          <p className="truncate px-3 text-xs text-slate-500" title={displayName}>
            目前登入：{displayName}
          </p>
        )}

        {/* 後台看不到家長那一面。要確認發佈出去的樣子得回前台，
            這個入口省下手動改網址 */}
        <Link
          to="/"
          className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          <ExternalLink className="h-4 w-4 shrink-0" aria-hidden="true" />
          回前台
        </Link>

        <button
          type="button"
          onClick={onSignOut}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4 shrink-0" aria-hidden="true" />
          登出
        </button>
      </div>
    </aside>
  );
}
