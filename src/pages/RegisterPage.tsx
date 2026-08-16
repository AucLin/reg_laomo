import { useRef, useState, type CompositionEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { isValidTaiwanPhone } from '../lib/validation/phone';

export default function RegisterPage() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // 姓名欄位用注音、倉頡等輸入法組字時，瀏覽器會在選字完成前不斷觸發
  // onChange（值是「ㄓㄨㄥ」這種半成品）。組字期間先不更新狀態，
  // 避免半成品被拿去做任何判斷；等 compositionend 才寫入最終值。
  const isComposingRef = useRef(false);

  function handleFullNameChange(value: string) {
    if (isComposingRef.current) return;
    setFullName(value);
  }

  function handleFullNameCompositionStart() {
    isComposingRef.current = true;
  }

  function handleFullNameCompositionEnd(event: CompositionEvent<HTMLInputElement>) {
    isComposingRef.current = false;
    // 部分瀏覽器的 compositionend 在 change 之後才觸發，這裡補寫一次
    // 最終值，否則組字完成的最後一個字會漏掉。
    setFullName(event.currentTarget.value);
  }

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
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim(), phone: phone.trim() },
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

    // 註冊完直接進報名表，不繞回首頁
    navigate('/apply', { replace: true });
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
              onChange={(event) => handleFullNameChange(event.target.value)}
              onCompositionStart={handleFullNameCompositionStart}
              onCompositionEnd={handleFullNameCompositionEnd}
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
          <Field
            id="email"
            label="電子信箱"
            value={email}
            onChange={setEmail}
            type="email"
            autoComplete="email"
          />
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
