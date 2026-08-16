import { render, screen, fireEvent } from '@testing-library/react';
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

  it('用注音輸入中文姓名時，組字中不寫入半成品，選字完成後才寫入', async () => {
    renderPage();

    const nameInput = screen.getByLabelText('家長姓名') as HTMLInputElement;
    const phoneInput = screen.getByLabelText('手機號碼') as HTMLInputElement;

    fireEvent.compositionStart(nameInput);
    fireEvent.change(nameInput, { target: { value: 'ㄨㄤˊ' } });

    // 組字中的半成品不該寫進 React 狀態：讓另一個欄位觸發重新渲染，
    // 若姓名狀態真的沒被半成品覆蓋，受控欄位會被打回原本的空值。
    fireEvent.change(phoneInput, { target: { value: '0' } });
    expect(nameInput.value).toBe('');

    fireEvent.compositionEnd(nameInput, { target: { value: '王小明' } });

    // 選字完成後應該已經寫進狀態：再讓別的欄位觸發一次重新渲染，
    // 姓名欄位仍要維持最終值，而不是被打回空字串。
    fireEvent.change(phoneInput, { target: { value: '09' } });
    expect(nameInput.value).toBe('王小明');

    await userEvent.clear(phoneInput);
    await userEvent.type(phoneInput, '0912345678');
    await userEvent.type(screen.getByLabelText('電子信箱'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('密碼'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: '建立帳號' }));

    expect(signUpMock).toHaveBeenCalledWith({
      email: 'test@example.com',
      password: 'password123',
      options: {
        data: { full_name: '王小明', phone: '0912345678' },
      },
    });
  });
});
