import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import EmailField from '../EmailField';

/** 受控元件要有人幫它記住值，測試裡用這個殼模擬呼叫端。 */
function Harness({ onSubmit }: { onSubmit?: () => void } = {}) {
  const [email, setEmail] = useState('');
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}
    >
      <EmailField value={email} onChange={setEmail} />
    </form>
  );
}

function getInput() {
  return screen.getByLabelText('電子信箱');
}

describe('EmailField', () => {
  it('還沒打字時不顯示建議清單', () => {
    render(<Harness />);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('打了帳號名稱後列出常見網域的完整信箱', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(getInput(), 'mama0912');

    expect(screen.getByRole('option', { name: 'mama0912@gmail.com' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'mama0912@yahoo.com.tw' })
    ).toBeInTheDocument();
  });

  it('點選建議會把完整信箱帶進輸入框，並收起清單', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(getInput(), 'mama0912');
    await user.click(screen.getByRole('option', { name: 'mama0912@gmail.com' }));

    expect(getInput()).toHaveValue('mama0912@gmail.com');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('可以用上下鍵移動、Enter 帶入', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(getInput(), 'mama0912');
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    // 第一次下鍵選中第一項，第二次移到第二項
    expect(getInput()).toHaveValue('mama0912@yahoo.com.tw');
  });

  it('上鍵可以從第一項繞回最後一項', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(getInput(), 'mama0912');
    await user.keyboard('{ArrowUp}{Enter}');

    expect(getInput()).toHaveValue('mama0912@msn.com');
  });

  it('Esc 收起清單但保留已輸入的文字', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(getInput(), 'mama0912');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(getInput()).toHaveValue('mama0912');
  });

  it('沒有選中任何建議時，Enter 照常送出表單', async () => {
    // 家長自己打完整信箱後直接按 Enter 送出是很自然的操作。
    // 若清單一開著就吃掉 Enter，等於把送出按鈕藏起來。
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(getInput(), 'mama0912');
    await user.keyboard('{Enter}');

    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it('有選中建議時，Enter 只帶入不送出表單', async () => {
    const onSubmit = vi.fn();
    const user = userEvent.setup();
    render(<Harness onSubmit={onSubmit} />);

    await user.type(getInput(), 'mama0912');
    await user.keyboard('{ArrowDown}{Enter}');

    expect(getInput()).toHaveValue('mama0912@gmail.com');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('網域打完整後不再顯示建議', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(getInput(), 'mama0912@gmail.com');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('輸入法組字期間不顯示建議', () => {
    // 停在注音模式打字時，輸入框會短暫出現「ㄇㄚ」這種半成品。
    // 這時跳出建議清單，選項內容是沒有意義的注音符號。
    render(<Harness />);
    const input = getInput();

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'ㄇㄚ' } });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('組字結束後用最終文字給建議', () => {
    render(<Harness />);
    const input = getInput();

    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'ㄇㄚ' } });
    fireEvent.compositionEnd(input, { target: { value: 'mama' } });

    expect(screen.getByRole('option', { name: 'mama@gmail.com' })).toBeInTheDocument();
  });

  it('輸入框帶有讀螢幕軟體需要的下拉語意', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = getInput();

    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-expanded', 'false');

    await user.type(input, 'mama0912');
    expect(input).toHaveAttribute('aria-expanded', 'true');

    // 鍵盤移動時要讓讀螢幕軟體知道目前停在哪一項
    await user.keyboard('{ArrowDown}');
    const active = input.getAttribute('aria-activedescendant');
    expect(active).toBeTruthy();
    expect(screen.getByRole('option', { name: 'mama0912@gmail.com' })).toHaveAttribute(
      'id',
      active
    );
  });
});
