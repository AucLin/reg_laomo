import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RegisterPage from '../RegisterPage';

const signUpMock = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => signUpMock(...args),
    },
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <RegisterPage />
    </MemoryRouter>
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    signUpMock.mockReset();
    signUpMock.mockResolvedValue({ data: {}, error: null });
  });

  it('顯示四個必填欄位', () => {
    renderPage();
    expect(screen.getByLabelText('家長姓名')).toBeInTheDocument();
    expect(screen.getByLabelText('手機號碼')).toBeInTheDocument();
    expect(screen.getByLabelText('電子信箱')).toBeInTheDocument();
    expect(screen.getByLabelText('密碼')).toBeInTheDocument();
  });

  it('手機格式錯誤時顯示錯誤訊息且不送出', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('家長姓名'), '林大明');
    await user.type(screen.getByLabelText('手機號碼'), '123');
    await user.type(screen.getByLabelText('電子信箱'), 'test@example.com');
    await user.type(screen.getByLabelText('密碼'), 'password123');
    await user.click(screen.getByRole('button', { name: '建立帳號' }));

    expect(await screen.findByText('手機格式不正確')).toBeInTheDocument();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('密碼少於 8 碼時顯示錯誤訊息且不送出', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('家長姓名'), '林大明');
    await user.type(screen.getByLabelText('手機號碼'), '0912345678');
    await user.type(screen.getByLabelText('電子信箱'), 'test@example.com');
    await user.type(screen.getByLabelText('密碼'), 'abc');
    await user.click(screen.getByRole('button', { name: '建立帳號' }));

    expect(await screen.findByText('密碼至少 8 個字元')).toBeInTheDocument();
    expect(signUpMock).not.toHaveBeenCalled();
  });

  it('資料正確時把姓名與手機一起送進註冊資料', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('家長姓名'), '林大明');
    await user.type(screen.getByLabelText('手機號碼'), '0912345678');
    await user.type(screen.getByLabelText('電子信箱'), 'test@example.com');
    await user.type(screen.getByLabelText('密碼'), 'password123');
    await user.click(screen.getByRole('button', { name: '建立帳號' }));

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      options: {
        data: { full_name: '林大明', phone: '0912345678' },
      },
    });
  });
});
