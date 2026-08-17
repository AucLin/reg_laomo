import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isValidTaiwanPhone } from '../lib/validation/phone';
import EmailField from '../components/EmailField';
import { useImeGuardedInput } from '../lib/hooks/useImeGuardedInput';

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
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
        <div className="w-full max-w-md rounded-2xl bg-white p-6 text-center shadow-lg sm:p-8">
          <h1 className="text-2xl font-bold text-slate-900">請到信箱收信</h1>
          <p className="mt-4 text-sm text-slate-600">
            我們已經寄出一封確認信到{' '}
            <span className="font-semibold text-slate-900">{confirmationEmail}</span>
            ，請點選信中的連結完成驗證，完成後再回來登入即可開始報名。
          </p>
          <Link
            to="/login"
            className="mt-6 inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white transition hover:bg-brand-700"
          >
            前往登入
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg sm:p-8">
        <h1 className="text-2xl font-bold text-slate-900">建立家長帳號</h1>
        <p className="mt-2 text-sm text-slate-500">
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
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
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
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brand-600 px-4 py-3 font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
          >
            {submitting ? '建立中…' : '建立帳號'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          已經有帳號了？{' '}
          <Link to="/login" className="font-semibold text-brand-600 hover:underline">
            登入
          </Link>
        </p>
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
        className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
      />
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}
