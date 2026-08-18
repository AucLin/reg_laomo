import { useState, type FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { DashedRule, RobotDoodle, Spark, Squiggle } from '../components/doodles';

/*
  輸入框沿用 EmailField、StudentForm 裡那一套（1px 邊框、rounded-xl）。
  手繪風做在卡片、標題與按鈕上就夠了，欄位本身跨頁共用元件，
  這裡單方面加粗邊框只會讓註冊頁的信箱欄位跟旁邊兩欄長得不一樣。
*/
const FIELD_CLASS =
  'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

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
      // email_not_confirmed 是唯一需要獨立出來的錯誤：家長註冊後沒收信
      // 就跑來登入，這不是密碼錯誤，若跟其他錯誤混在一起顯示「信箱或
      // 密碼不正確」，家長永遠不會知道該去收信。
      // 其他錯誤（帳號不存在／密碼錯誤）刻意不區分，避免洩漏哪些信箱註冊過。
      setError(
        signInError.code === 'email_not_confirmed'
          ? '這個信箱還沒完成驗證，請到信箱點選確認連結'
          : '信箱或密碼不正確'
      );
      return;
    }

    navigate(from, { replace: true });
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-paper px-4 py-10">
      {/*
        兩塊暈開的色塊讓米色底不至於太平。放在 overflow-hidden 的容器裡，
        390px 的手機上超出去的部分會被裁掉，不會多出一條橫向捲軸。
      */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-brand-100/70 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-28 -right-20 h-64 w-64 rounded-full bg-amber-100/60 blur-3xl"
      />

      <div className="relative w-full max-w-md">
        <Link
          to="/"
          className="mx-auto mb-5 flex w-fit items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-brand-700"
        >
          <Spark className="h-4 w-4 shrink-0 text-amber-400" />
          回老莫機器人首頁
        </Link>

        <div className="doodle-card overflow-hidden">
          <div className="relative flex justify-center bg-gradient-to-b from-brand-50 to-white px-6 pb-1 pt-7">
            <RobotDoodle className="animate-doodle-float h-28 w-auto text-brand-600" />
            <Spark className="absolute left-9 top-8 h-5 w-5 text-amber-400" />
            <Spark className="absolute right-11 top-14 h-3.5 w-3.5 text-amber-300" />
          </div>

          <div className="px-6 pb-7 sm:px-8 sm:pb-8">
            <h1 className="text-2xl font-bold text-slate-900">家長登入</h1>
            <div className="mt-1 w-24">
              <Squiggle className="text-amber-400" />
            </div>
            <p className="mt-3 text-sm text-slate-600">
              歡迎回來，登入後就能替孩子報名課程與比賽。
            </p>

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
                  className={FIELD_CLASS}
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
                  className={FIELD_CLASS}
                />
              </div>

              {error && (
                <p
                  role="alert"
                  className="rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="doodle-btn w-full px-4 py-3 text-base"
              >
                {submitting ? '登入中…' : '登入'}
              </button>
            </form>

            <div className="mt-6 text-slate-300">
              <DashedRule />
            </div>

            <p className="mt-4 text-center text-sm text-slate-600">
              還沒有帳號？{' '}
              <Link to="/register" className="font-semibold text-brand-700 underline decoration-amber-400 decoration-2 underline-offset-4 hover:text-brand-800">
                立即註冊
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
