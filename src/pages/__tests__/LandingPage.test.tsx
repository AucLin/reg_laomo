import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import LandingPage from '../LandingPage';
import * as useAuthModule from '../../auth/useAuth';

function mockAuth(loggedIn: boolean, isAdmin = false) {
  vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
    user: loggedIn ? ({ id: 'u1' } as never) : null,
    profile: null,
    isAdmin,
    loading: false,
    signOut: vi.fn(),
  });
}

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>
  );
}

describe('LandingPage', () => {
  it('顯示品牌名稱', () => {
    mockAuth(false);
    renderPage();
    expect(screen.getByText('老莫機器人')).toBeInTheDocument();
  });

  it('未登入時報名按鈕導向註冊頁', () => {
    mockAuth(false);
    renderPage();
    expect(screen.getByRole('link', { name: '立即報名' })).toHaveAttribute(
      'href',
      '/register'
    );
  });

  it('已登入時報名按鈕直接導向報名表', () => {
    mockAuth(true);
    renderPage();
    expect(screen.getByRole('link', { name: '立即報名' })).toHaveAttribute(
      'href',
      '/apply'
    );
  });

  it('管理員才看得到後台連結', () => {
    mockAuth(true, true);
    const { unmount } = renderPage();
    expect(screen.getByRole('link', { name: '後台管理' })).toBeInTheDocument();
    unmount();

    mockAuth(true, false);
    renderPage();
    expect(screen.queryByRole('link', { name: '後台管理' })).not.toBeInTheDocument();
  });

  it('主視覺圖片有替代文字', () => {
    mockAuth(false);
    renderPage();
    expect(screen.getByAltText(/機器人/)).toBeInTheDocument();
  });
});
