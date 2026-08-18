import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import App from '../App';

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({
        data: { subscription: { unsubscribe: () => {} } },
      }),
    },
  },
}));

// 進入頁掛載時會讀比賽清單，上面的 supabase 假物件只有 auth，
// 沒有 from()，不擋下來會在測試結束後才丟出未處理的錯誤
vi.mock('../lib/contests', () => ({
  listOpenContests: () => Promise.resolve([]),
}));

describe('App', () => {
  it('進入頁顯示品牌名稱', async () => {
    render(<App />);
    expect(await screen.findByText('老莫機器人')).toBeInTheDocument();
  });
});
