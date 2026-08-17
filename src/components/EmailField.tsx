import { useId, useState, type KeyboardEvent } from 'react';
import { suggestEmails } from '../lib/emailDomains';
import { useImeGuardedInput } from '../lib/hooks/useImeGuardedInput';

interface Props {
  value: string;
  onChange: (value: string) => void;
}

/**
 * 信箱輸入框，打字時列出常見網域的完整信箱供快速選取。
 *
 * 家長多半用手機填表，把 @gmail.com 一個字一個字打出來既慢又容易打錯，
 * 而信箱打錯的代價特別高 —— 確認信會寄到不存在的信箱，家長只會看到
 * 「沒收到信」，不會知道是自己少打一個字母。
 */
export default function EmailField({ value, onChange }: Props) {
  const inputId = useId();
  const listboxId = useId();
  const [open, setOpen] = useState(false);
  /** -1 代表游標還在輸入框，沒有停在任何建議上 */
  const [activeIndex, setActiveIndex] = useState(-1);

  /*
    中文輸入法組字狀態。使用者若停在注音模式打字，輸入框會短暫變成
    「ㄇㄚ」這種半成品，這時算出來的建議是一串沒有意義的注音符號。

    這裡用狀態而不是 ref：ref 改變不會觸發重新渲染，拿它決定要不要
    顯示建議，畫面會慢一拍。值本身則一律即時寫入 —— 組字途中的注音
    若沒進到狀態，重新渲染就會把它清掉，中文根本打不進去。
  */
  const [composing, setComposing] = useState(false);

  const ime = useImeGuardedInput((next, meta) => {
    onChange(next);
    setComposing(meta.composing);
    if (meta.composing) return;
    setOpen(true);
    // 清單內容一變，先前停留的位置就沒有意義了
    setActiveIndex(-1);
  });

  const suggestions = composing ? [] : suggestEmails(value);
  const visible = open && suggestions.length > 0;

  function commit(email: string) {
    onChange(email);
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (!visible) return;

    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % suggestions.length);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      // 從第一項往上會繞到最後一項，鍵盤使用者不必按到底
      setActiveIndex((current) =>
        current <= 0 ? suggestions.length - 1 : current - 1
      );
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    if (event.key === 'Enter') {
      // 只有真的停在某個建議上才攔截 Enter。家長自己打完整信箱後
      // 直接按 Enter 送出表單是很自然的操作，清單一開著就吃掉 Enter
      // 等於把送出按鈕藏起來。
      if (activeIndex < 0) return;
      event.preventDefault();
      commit(suggestions[activeIndex]);
    }
  }

  return (
    <div>
      <label htmlFor={inputId} className="block text-sm font-medium text-slate-700">
        電子信箱
      </label>
      <div className="relative">
        <input
          id={inputId}
          type="email"
          value={value}
          autoComplete="email"
          role="combobox"
          aria-expanded={visible}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={
            activeIndex >= 0 ? `${listboxId}-${activeIndex}` : undefined
          }
          onChange={ime.onChange}
          onCompositionStart={() => {
            setComposing(true);
            ime.onCompositionStart();
          }}
          onCompositionEnd={ime.onCompositionEnd}
          onKeyDown={handleKeyDown}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setActiveIndex(-1);
          }}
          className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
        />

        {visible && (
          <ul
            id={listboxId}
            role="listbox"
            aria-label="信箱建議"
            className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            {suggestions.map((email, index) => (
              <li
                key={email}
                id={`${listboxId}-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                /*
                  用 mousedown 而不是 click：輸入框的 blur 會先於 click 發生，
                  清單一被 blur 收起來，click 就永遠不會落到選項上。
                  preventDefault 擋掉 blur，讓點選真的生效。
                */
                onMouseDown={(event) => {
                  event.preventDefault();
                  commit(email);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`cursor-pointer px-3 py-2.5 text-base transition ${
                  index === activeIndex
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                {email}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
