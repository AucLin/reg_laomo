import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminLayout from '../AdminLayout';
import * as useAuthModule from '../../../auth/useAuth';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<p>報名管理的內容</p>} />
          <Route path="contests" element={<p>比賽管理的內容</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('AdminLayout', () => {
  const signOut = vi.fn();

  beforeEach(() => {
    vi.restoreAllMocks();
    signOut.mockReset();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com' } as never,
      profile: {
        id: 'admin-1',
        full_name: '林管理',
        phone: '0900000000',
        role: 'admin',
      } as never,
      isAdmin: true,
      loading: false,
      signOut,
    });
  });

  it('側邊欄列出後台的每一頁', () => {
    renderAt('/admin');
    expect(screen.getByRole('link', { name: '報名管理' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '比賽管理' })).toBeInTheDocument();
  });

  it('子頁面的內容渲染在外框裡', () => {
    renderAt('/admin/contests');
    expect(screen.getByText('比賽管理的內容')).toBeInTheDocument();
  });

  /*
    index 路由的連結若少了 end，/admin/contests 底下「報名管理」也會被
    算成選取中 —— 兩個項目同時亮起來，等於沒有指示目前在哪一頁。
  */
  it('只有目前這一頁的項目標示為選取中', () => {
    renderAt('/admin/contests');
    expect(screen.getByRole('link', { name: '比賽管理' })).toHaveAttribute(
      'aria-current',
      'page'
    );
    expect(screen.getByRole('link', { name: '報名管理' })).not.toHaveAttribute(
      'aria-current'
    );
  });

  it('登出後回到進入頁', async () => {
    const user = userEvent.setup();
    renderAt('/admin');
    await user.click(screen.getByRole('button', { name: '登出' }));
    expect(signOut).toHaveBeenCalled();
  });
});
