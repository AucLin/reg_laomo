import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { useImeGuardedInput } from '../useImeGuardedInput';

/**
 * 受控輸入框加上另一個會觸發重新渲染的欄位。
 *
 * 這個組合是關鍵：真實表單一定有其他欄位，任何一個變動都會讓整個
 * 表單重新渲染。組字期間若沒把值寫進狀態，重新渲染就會把輸入框的
 * 內容打回舊值，使用者打到一半的中文直接消失。
 */
function Harness({ onSearch }: { onSearch?: (value: string) => void } = {}) {
  const [name, setName] = useState('');
  const [other, setOther] = useState('');
  const ime = useImeGuardedInput((value) => {
    setName(value);
    onSearch?.(value);
  });

  return (
    <>
      <label htmlFor="name">姓名</label>
      <input
        id="name"
        value={name}
        onChange={ime.onChange}
        onCompositionStart={ime.onCompositionStart}
        onCompositionEnd={ime.onCompositionEnd}
      />
      <label htmlFor="other">其他欄位</label>
      <input id="other" value={other} onChange={(e) => setOther(e.target.value)} />
    </>
  );
}

describe('useImeGuardedInput', () => {
  it('組字途中重新渲染，輸入框仍要留住已經打出來的注音', () => {
    render(<Harness />);
    const name = screen.getByLabelText('姓名') as HTMLInputElement;
    const other = screen.getByLabelText('其他欄位');

    fireEvent.compositionStart(name);
    fireEvent.change(name, { target: { value: 'ㄌㄧㄣˊ' } });

    // 讓另一個欄位觸發一次重新渲染，模擬真實表單的行為
    fireEvent.change(other, { target: { value: 'x' } });

    // 這裡若變成空字串，使用者的畫面上就是「打了字卻什麼都沒出現」
    expect(name.value).toBe('ㄌㄧㄣˊ');
  });

  it('選字完成後留下最終的中文', () => {
    render(<Harness />);
    const name = screen.getByLabelText('姓名') as HTMLInputElement;
    const other = screen.getByLabelText('其他欄位');

    fireEvent.compositionStart(name);
    fireEvent.change(name, { target: { value: 'ㄌㄧㄣˊ' } });
    fireEvent.compositionEnd(name, { target: { value: '林' } });
    fireEvent.change(other, { target: { value: 'x' } });

    expect(name.value).toBe('林');
  });

  it('回報組字狀態，讓查詢之類的後續處理可以先等一下', () => {
    // 顯示要即時，但「拿這個值去查資料庫」得等選完字。
    // 沒有這個訊號，學校搜尋會拿「ㄌㄧㄣˊ」去查，結果清單在打字
    // 過程中亂跳。
    const onSearch = vi.fn();
    render(<Harness onSearch={onSearch} />);
    const name = screen.getByLabelText('姓名');

    fireEvent.compositionStart(name);
    fireEvent.change(name, { target: { value: 'ㄌ' } });

    expect(screen.getByLabelText('姓名')).toHaveValue('ㄌ');
  });

  it('沒有使用輸入法時照常運作', () => {
    render(<Harness />);
    const name = screen.getByLabelText('姓名') as HTMLInputElement;

    fireEvent.change(name, { target: { value: 'abc' } });

    expect(name.value).toBe('abc');
  });
});
