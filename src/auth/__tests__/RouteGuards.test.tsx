import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import { ProtectedRoute, AdminRoute } from '../RouteGuards';
import * as useAuthModule from '../useAuth';

function renderWithRoute(element: React.ReactElement, initialPath = '/protected') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/protected" element={element} />
        <Route path="/login" element={<div>登入頁</div>} />
        <Route path="/" element={<div>進入頁</div>} />
      </Routes>
    </MemoryRouter>
  );
}

const secret = <div>機密內容</div>;

describe('ProtectedRoute', () => {
  it('載入中時顯示等待畫面，不急著導走', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      isAdmin: false,
      loading: true,
      signOut: vi.fn(),
    });
    renderWithRoute(<ProtectedRoute>{secret}</ProtectedRoute>);
    expect(screen.getByText('載入中…')).toBeInTheDocument();
  });

  it('未登入時導向登入頁', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: null,
      profile: null,
      isAdmin: false,
      loading: false,
      signOut: vi.fn(),
    });
    renderWithRoute(<ProtectedRoute>{secret}</ProtectedRoute>);
    expect(screen.getByText('登入頁')).toBeInTheDocument();
    expect(screen.queryByText('機密內容')).not.toBeInTheDocument();
  });

  it('已登入時顯示內容', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'u1' } as never,
      profile: null,
      isAdmin: false,
      loading: false,
      signOut: vi.fn(),
    });
    renderWithRoute(<ProtectedRoute>{secret}</ProtectedRoute>);
    expect(screen.getByText('機密內容')).toBeInTheDocument();
  });
});

describe('AdminRoute', () => {
  it('一般家長被導回進入頁，且看不到後台內容', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'u1' } as never,
      profile: null,
      isAdmin: false,
      loading: false,
      signOut: vi.fn(),
    });
    renderWithRoute(<AdminRoute>{secret}</AdminRoute>);
    expect(screen.getByText('進入頁')).toBeInTheDocument();
    expect(screen.queryByText('機密內容')).not.toBeInTheDocument();
  });

  it('管理員可以看到後台內容', () => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'u1' } as never,
      profile: null,
      isAdmin: true,
      loading: false,
      signOut: vi.fn(),
    });
    renderWithRoute(<AdminRoute>{secret}</AdminRoute>);
    expect(screen.getByText('機密內容')).toBeInTheDocument();
  });
});
