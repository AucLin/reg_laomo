import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RegisterPage from '../RegisterPage';

const signUpMock = vi.fn();
const navigateMock = vi.fn();

vi.mock('../../lib/supabase', () => ({
  supabase: {
    auth: {
      signUp: (...args: unknown[]) => signUpMock(...args),
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
      <RegisterPage />
    </MemoryRouter>
  );
}

describe('RegisterPage', () => {
  beforeEach(() => {
    signUpMock.mockReset();
    navigateMock.mockReset();
    // 預設模擬「信箱驗證關閉」：signUp 直接回傳 session，維持既有測試
    // （不特別驗證導向行為的那些）的送出流程不受影響。
    signUpMock.mockResolvedValue({
      data: { session: { access_token: 'token' }, user: {} },
      error: null,
    });
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
        // 驗證後直接落在報名表，不是丟回進入頁讓家長猜有沒有成功
        emailRedirectTo: `${window.location.origin}/apply`,
      },
    });
  });

  it('用注音輸入中文姓名時，組字途中的注音要留在畫面上', async () => {
    renderPage();

    const nameInput = screen.getByLabelText('家長姓名') as HTMLInputElement;
    const phoneInput = screen.getByLabelText('手機號碼') as HTMLInputElement;

    fireEvent.compositionStart(nameInput);
    fireEvent.change(nameInput, { target: { value: 'ㄨㄤˊ' } });

    // 讓另一個欄位觸發一次重新渲染。組字中的注音若沒進到狀態，
    // 這一刻就會被打回空字串，家長的中文姓名根本打不進去。
    fireEvent.change(phoneInput, { target: { value: '0' } });
    expect(nameInput.value).toBe('ㄨㄤˊ');

    fireEvent.compositionEnd(nameInput, { target: { value: '王小明' } });

    // 選字完成後再讓別的欄位觸發一次重新渲染，姓名要維持最終值。
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
        emailRedirectTo: `${window.location.origin}/apply`,
      },
    });
  });

  // Supabase 專案若關閉了「Confirm email」（mailer_autoconfirm = true），
  // signUp 成功時會直接回傳 session，這時應該照舊直接進報名表。
  it('註冊成功且回傳 session（信箱驗證關閉）時導向 /apply', async () => {
    signUpMock.mockResolvedValue({
      data: { session: { access_token: 'token' }, user: {} },
      error: null,
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('家長姓名'), '林大明');
    await user.type(screen.getByLabelText('手機號碼'), '0912345678');
    await user.type(screen.getByLabelText('電子信箱'), 'test@example.com');
    await user.type(screen.getByLabelText('密碼'), 'password123');
    await user.click(screen.getByRole('button', { name: '建立帳號' }));

    expect(await screen.findByText(/建立帳號/)).toBeInTheDocument();
    expect(navigateMock).toHaveBeenCalledWith('/apply', { replace: true });
  });

  // 老莫 Supabase 專案的公開設定 mailer_autoconfirm = false（信箱驗證開啟），
  // signUp 成功但不會回傳 session。此時若還是導向 /apply，ProtectedRoute
  // 會因為 user 是 null 把人踢回登入頁，家長全程看不到任何「要去收信」的提示
  // （這是全分支審查抓到的合併前必修 bug）。這裡驗證：不導向 /apply，
  // 改顯示收信說明，並把家長剛剛填的信箱顯示出來。
  it('註冊成功但 session 為 null（信箱驗證開啟）時顯示收信說明，不導向 /apply', async () => {
    signUpMock.mockResolvedValue({
      data: { session: null, user: {} },
      error: null,
    });
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('家長姓名'), '林大明');
    await user.type(screen.getByLabelText('手機號碼'), '0912345678');
    await user.type(screen.getByLabelText('電子信箱'), 'test@example.com');
    await user.type(screen.getByLabelText('密碼'), 'password123');
    await user.click(screen.getByRole('button', { name: '建立帳號' }));

    expect(await screen.findByText(/收信/)).toBeInTheDocument();
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalledWith('/apply', { replace: true });
  });
});
