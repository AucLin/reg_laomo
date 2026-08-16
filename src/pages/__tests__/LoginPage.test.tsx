import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from '../LoginPage';

const signInMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: (...args: unknown[]) => signInMock(...args),
    },
  },
}));

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

async function fillAndSubmit(email: string, password: string) {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('電子信箱'), email);
  await user.type(screen.getByLabelText('密碼'), password);
  await user.click(screen.getByRole('button', { name: '登入' }));
}

describe('LoginPage', () => {
  beforeEach(() => {
    signInMock.mockReset();
    navigateMock.mockReset();
  });

  it('登入成功時導向 /apply', async () => {
    signInMock.mockResolvedValue({ data: {}, error: null });
    renderPage();

    await fillAndSubmit('test@example.com', 'password123');

    expect(await screen.findByRole('button', { name: '登入' })).toBeInTheDocument();
    expect(navigateMock).toHaveBeenCalledWith('/apply', { replace: true });
  });

  // 密碼錯誤／帳號不存在刻意不區分，避免洩漏哪些信箱註冊過 —— 這是
  // 既有的刻意設計，不是這次要修的問題，維持原本的統一訊息。
  it('密碼錯誤（invalid_credentials）時顯示統一的信箱或密碼不正確', async () => {
    signInMock.mockResolvedValue({
      data: {},
      error: { message: 'Invalid login credentials', code: 'invalid_credentials' },
    });
    renderPage();

    await fillAndSubmit('test@example.com', 'wrongpass');

    expect(await screen.findByRole('alert')).toHaveTextContent('信箱或密碼不正確');
    expect(navigateMock).not.toHaveBeenCalled();
  });

  // 全分支審查找到的必修 bug：老莫的 Supabase 專案開啟了信箱驗證
  // （mailer_autoconfirm = false）。家長註冊後沒收信就跑來登入，
  // Supabase 回傳 email_not_confirmed，若跟其他錯誤混在一起顯示
  // 「信箱或密碼不正確」，家長會誤以為自己記錯密碼，永遠不知道
  // 該去收信。這裡必須給專屬訊息。
  it('信箱尚未驗證（email_not_confirmed）時顯示專屬訊息，不是信箱或密碼不正確', async () => {
    signInMock.mockResolvedValue({
      data: {},
      error: { message: 'Email not confirmed', code: 'email_not_confirmed' },
    });
    renderPage();

    await fillAndSubmit('test@example.com', 'password123');

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('這個信箱還沒完成驗證，請到信箱點選確認連結');
    expect(alert).not.toHaveTextContent('信箱或密碼不正確');
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
