import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isValidTaiwanPhone } from '../lib/validation/phone';
import EmailField from '../components/EmailField';
import { useImeGuardedInput } from '../lib/hooks/useImeGuardedInput';
import {
  BlocksDoodle,
  DashedRule,
  EnvelopeDoodle,
  Spark,
  Squiggle,
} from '../components/doodles';

/*
  跟 EmailField、StudentForm 用同一套欄位樣式。手繪風做在卡片、標題與
  按鈕上，欄位維持原樣 —— 這頁的信箱欄是共用元件，單獨把姓名、手機
  加粗邊框只會讓三個欄位長得不一樣。
*/
const FIELD_CLASS =
  'mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  // Supabase 專案若開啟「Confirm email」（mailer_autoconfirm = false），
  // signUp 成功時不會回傳 session，這時不能直接導向 /apply ——
  // ProtectedRoute 看到 user 是 null 會把人踢回登入頁，全程沒有任何
  // 提示要去收信。這個狀態記著「已註冊成功、正等信箱驗證」，畫面改顯示
  // 收信說明，不再導頁。
  const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
  const [confirmationEmail, setConfirmationEmail] = useState('');

  // 姓名欄位要能用注音、倉頡輸入中文。細節（組字途中的注音也必須寫進
  // 狀態，否則重新渲染會把它清掉）統一由共用的守衛處理。
  const fullNameIme = useImeGuardedInput(setFullName);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError('');

    if (fullName.trim().length < 2) {
      setError('請填寫家長姓名');
      return;
    }
    if (!isValidTaiwanPhone(phone)) {
      setError('手機格式不正確');
      return;
    }
    if (password.length < 8) {
      setError('密碼至少 8 個字元');
      return;
    }

    setSubmitting(true);
    // 姓名與手機放進 metadata，資料庫的 handle_new_user 觸發器會據此
    // 自動建立 profiles 資料列
    const trimmedEmail = email.trim();
    const { data, error: signUpError } = await supabase.auth.signUp({
      email: trimmedEmail,
      password,
      options: {
        data: { full_name: fullName.trim(), phone: phone.trim() },
        /*
          確認信裡的連結預設會導回 Supabase 設定的 Site URL，也就是進入頁。
          家長點完驗證只會看到首頁，沒有任何「驗證成功」的訊號，看起來
          像什麼都沒發生 —— 實測就是這樣被誤判成失敗的。改成直接落在
          報名表，驗證成功與下一步要做什麼都不必解釋。
        */
        emailRedirectTo: `${window.location.origin}/apply`,
      },
    });
    setSubmitting(false);

    if (signUpError) {
      setError(
        signUpError.message.includes('already registered')
          ? '這個信箱已經註冊過了，請直接登入'
          : '註冊失敗，請稍後再試'
      );
      return;
    }

    if (data.session) {
      // 信箱驗證關閉（mailer_autoconfirm = true）：signUp 直接回傳
      // session，照舊直接進報名表，不繞回首頁
      navigate('/apply', { replace: true });
      return;
    }

    // 信箱驗證開啟：signUp 成功但沒有 session，這裡不能導向 /apply
    // （ProtectedRoute 會因為 user 是 null 把人踢回登入頁）。改顯示
    // 收信說明。
    setConfirmationEmail(trimmedEmail);
    setAwaitingConfirmation(true);
  }

  if (awaitingConfirmation) {
    return (
      <PaperShell>
        <div className="doodle-card overflow-hidden text-center">
          <div className="relative flex justify-center bg-gradient-to-b from-emerald-50 to-white px-6 pb-1 pt-7">
            <EnvelopeDoodle className="animate-doodle-float h-28 w-auto text-emerald-600" />
            <Spark className="absolute left-10 top-8 h-5 w-5 text-amber-400" />
          </div>

          <div className="px-6 pb-8 sm:px-8">
            <h1 className="text-2xl font-bold text-slate-900">請到信箱收信</h1>
            <div className="mx-auto mt-1 w-28">
              <Squiggle className="text-amber-400" />
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600">
              我們已經寄出一封確認信到{' '}
              <span className="break-all font-semibold text-slate-900">
                {confirmationEmail}
              </span>
              ，請點選信中的連結完成驗證，完成後再回來登入即可開始報名。
            </p>

            {/* 找不到信是這一步最常見的卡關，先講在前面比等家長寫信來問省事 */}
            <p className="mt-4 rounded-xl border-2 border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm leading-relaxed text-amber-900">
              沒收到信嗎？請看看垃圾郵件匣，有時候確認信會被分到那裡。
            </p>

            <Link
              to="/login"
              className="doodle-btn mt-6 inline-block px-6 py-3"
            >
              前往登入
            </Link>
          </div>
        </div>
      </PaperShell>
    );
  }

  return (
    <PaperShell>
      <div className="doodle-card overflow-hidden">
        <div className="relative flex justify-center bg-gradient-to-b from-brand-50 to-white px-6 pb-1 pt-7">
          <BlocksDoodle className="animate-doodle-float h-24 w-auto text-brand-600" />
          <Spark className="absolute right-10 top-7 h-4 w-4 text-amber-400" />
        </div>

        <div className="px-6 pb-7 sm:px-8 sm:pb-8">
          <h1 className="text-2xl font-bold text-slate-900">建立家長帳號</h1>
          <div className="mt-1 w-28">
            <Squiggle className="text-amber-400" />
          </div>
          <p className="mt-3 text-sm text-slate-600">
            註冊後即可替孩子填寫機器人課程報名資訊。
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
            <div>
              <label htmlFor="full_name" className="block text-sm font-medium text-slate-700">
                家長姓名
              </label>
              <input
                id="full_name"
                type="text"
                value={fullName}
                autoComplete="name"
                onChange={fullNameIme.onChange}
                onCompositionStart={fullNameIme.onCompositionStart}
                onCompositionEnd={fullNameIme.onCompositionEnd}
                className={FIELD_CLASS}
              />
            </div>
            <Field
              id="phone"
              label="手機號碼"
              value={phone}
              onChange={setPhone}
              type="tel"
              autoComplete="tel"
              placeholder="0912345678"
            />
            <EmailField value={email} onChange={setEmail} />
            <Field
              id="password"
              label="密碼"
              value={password}
              onChange={setPassword}
              type="password"
              autoComplete="new-password"
              hint="至少 8 個字元"
            />

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
              {submitting ? '建立中…' : '建立帳號'}
            </button>
          </form>

          <div className="mt-6 text-slate-300">
            <DashedRule />
          </div>

          <p className="mt-4 text-center text-sm text-slate-600">
            已經有帳號了？{' '}
            <Link
              to="/login"
              className="font-semibold text-brand-700 underline decoration-amber-400 decoration-2 underline-offset-4 hover:text-brand-800"
            >
              登入
            </Link>
          </p>
        </div>
      </div>
    </PaperShell>
  );
}

/** 註冊表單與「請到信箱收信」共用同一個紙感外框 */
function PaperShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-paper px-4 py-10">
      {/* 暈染色塊放在 overflow-hidden 裡，超出畫面的部分會被裁掉，不會多出橫向捲軸 */}
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
          回老莫機器人教育中心首頁
        </Link>
        {children}
      </div>
    </div>
  );
}

interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  autoComplete?: string;
  placeholder?: string;
  hint?: string;
}

function Field({
  id,
  label,
  value,
  onChange,
  type = 'text',
  autoComplete,
  placeholder,
  hint,
}: FieldProps) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        autoComplete={autoComplete}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CLASS}
      />
      {/* 原本的 slate-400 在白底上只有 2.8:1，對比度不夠，提示等於看不見 */}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
