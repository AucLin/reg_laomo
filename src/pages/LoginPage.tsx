import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ProtectedRoute 會把原本要去的頁面存在 state.from，登入後送他回去
  const from = (location.state as { from?: string } | null)?.from ?? '/apply';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');
    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);

    if (signInError) {
      // 不區分「帳號不存在」與「密碼錯誤」，避免洩漏哪些信箱註冊過
      setError('信箱或密碼不正確');
      return;
    }

    navigate(from, { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">家長登入</h1>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              電子信箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              密碼
            </label>
            <input
              id="password"
              type="password"
              value={password}
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>

          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? '登入中…' : '登入'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          還沒有帳號？{' '}
          <Link to="/register" className="font-semibold text-brand-600 hover:underline">
            立即註冊
          </Link>
        </p>
      </div>
    </div>
  );
}
