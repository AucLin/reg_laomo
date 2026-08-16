import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AppHeader from '../AppHeader';
import * as useAuthModule from '../../auth/useAuth';

const navigateMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return { ...actual, useNavigate: () => navigateMock };
});

function mockAuth(overrides: Partial<useAuthModule.AuthState> = {}) {
  const signOut = vi.fn().mockResolvedValue(undefined);
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user: { id: 'u1', email: 'parent@example.com' } as never,
    profile: {
      id: 'u1',
      full_name: '林大明',
      phone: '0912345678',
      role: 'parent',
      created_at: '2026-08-01',
    },
    isAdmin: false,
    loading: false,
    signOut,
    ...overrides,
  });
  return signOut;
}

function renderHeader() {
  return render(
    <MemoryRouter>
      <AppHeader />
    </MemoryRouter>
  );
}

describe('AppHeader', () => {
  beforeEach(() => {
    navigateMock.mockReset();
  });

  // 共用裝置的下一個人要能一眼看出「這不是我的帳號」
  it('顯示目前登入者的姓名', () => {
    mockAuth();
    renderHeader();
    expect(screen.getByText(/林大明/)).toBeInTheDocument();
  });

  it('沒有 profile 姓名時退回顯示信箱', () => {
    mockAuth({ profile: null });
    renderHeader();
    expect(screen.getByText(/parent@example.com/)).toBeInTheDocument();
  });

  it('管理員才看得到後台管理入口', () => {
    mockAuth({ isAdmin: true });
    const { unmount } = renderHeader();
    expect(screen.getByRole('link', { name: '後台管理' })).toBeInTheDocument();
    unmount();

    mockAuth({ isAdmin: false });
    renderHeader();
    expect(screen.queryByRole('link', { name: '後台管理' })).not.toBeInTheDocument();
  });

  it('點選登出按鈕會呼叫 signOut 並導回進入頁', async () => {
    const signOut = mockAuth();
    const user = userEvent.setup();
    renderHeader();

    await user.click(screen.getByRole('button', { name: '登出' }));

    expect(signOut).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith('/');
  });
});
