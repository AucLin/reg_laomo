import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import PageJumpBar from '../PageJumpBar';

const scrollIntoView = vi.fn();

beforeEach(() => {
  scrollIntoView.mockClear();
  // jsdom 沒有實作捲動
  Element.prototype.scrollIntoView = scrollIntoView;
});

describe('PageJumpBar', () => {
  it('列出每一區與筆數', () => {
    render(
      <PageJumpBar
        targets={[
          { id: 'kids', label: '我的孩子', count: 1 },
          { id: 'signups', label: '我的報名', count: 0 },
        ]}
      />
    );

    expect(screen.getByRole('button', { name: /我的孩子/ })).toHaveTextContent('1');
    expect(screen.getByRole('button', { name: /我的報名/ })).toHaveTextContent('0');
  });

  it('點了跳到那一區', async () => {
    document.body.innerHTML = '<div id="signups"></div>';
    const user = userEvent.setup();
    render(<PageJumpBar targets={[{ id: 'signups', label: '我的報名', count: 2 }]} />);

    await user.click(screen.getByRole('button', { name: /我的報名/ }));

    expect(scrollIntoView).toHaveBeenCalled();
  });

  /*
    「還有 2 場沒挑」這種話要講在最上面。家長最常漏掉的就是排在頁面
    底下、又真的需要他動手的那一件事。
  */
  it('有事情等家長做時說出來', () => {
    render(
      <PageJumpBar
        targets={[{ id: 'training', label: '集訓時間', count: 5, todo: '2 場待挑' }]}
      />
    );

    expect(screen.getByText('2 場待挑')).toBeInTheDocument();
  });

  /*
    集訓那一區在沒排課時整個不渲染，這時按鈕點下去找不到目標 ——
    不能讓家長按到一個會讓畫面爆掉的東西。
  */
  it('目標不在畫面上時不會爆掉', async () => {
    document.body.innerHTML = '';
    const user = userEvent.setup();
    render(<PageJumpBar targets={[{ id: 'nope', label: '不存在', count: 0 }]} />);

    await user.click(screen.getByRole('button', { name: /不存在/ }));

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('沒有任何一區時整條不顯示', () => {
    const { container } = render(<PageJumpBar targets={[]} />);
    expect(container.querySelector('nav')).toBeNull();
  });
});
