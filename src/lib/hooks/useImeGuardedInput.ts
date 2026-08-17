import { useCallback, useRef, type ChangeEvent, type CompositionEvent } from 'react';

/**
 * 中文輸入法（注音、倉頡等）的輸入框守衛。
 *
 * 要解決的是兩個不同的問題，分開處理很重要：
 *
 * 1. **畫面要即時反映使用者打了什麼**，包含還沒選字的「ㄌㄧㄣˊ」。
 *    受控輸入框的值來自 React 狀態，組字期間若不寫進狀態，任何一次
 *    重新渲染（真實表單裡其他欄位一動就會發生）都會把輸入框的內容
 *    打回舊值 —— 使用者的體感是「打了字，畫面上什麼都沒出現」，
 *    中文完全打不進去。所以 onChange 一律寫入，不做任何攔截。
 *
 * 2. **拿這個值去做事得等選完字**。用「ㄌㄧㄣˊ」去查學校名稱查不到
 *    東西，還會讓結果清單在打字過程中亂跳。所以每次回呼都附帶
 *    composing 狀態，由呼叫端自己決定要不要等。
 *
 * 早期版本把兩件事混在一起，用「組字期間不寫入狀態」同時擋住畫面
 * 更新與後續查詢，結果是中文根本打不出來。分開之後，顯示永遠即時，
 * 該等的只有查詢。
 *
 * 泛型參數預設 HTMLInputElement；多行輸入框呼叫時指定
 * useImeGuardedInput<HTMLTextAreaElement> 即可沿用同一份邏輯。
 *
 */
export function useImeGuardedInput<
  T extends HTMLInputElement | HTMLTextAreaElement = HTMLInputElement,
>(setValue: (value: string, meta: { composing: boolean }) => void) {
  const isComposingRef = useRef(false);

  const onChange = useCallback(
    (event: ChangeEvent<T>) => {
      setValue(event.target.value, { composing: isComposingRef.current });
    },
    [setValue]
  );

  const onCompositionStart = useCallback(() => {
    isComposingRef.current = true;
  }, []);

  const onCompositionEnd = useCallback(
    (event: CompositionEvent<T>) => {
      isComposingRef.current = false;
      // 部分瀏覽器的 compositionend 在 change 之後才觸發，這裡補寫一次
      // 最終值，否則選字完成的最後一個字會漏掉。
      setValue(event.currentTarget.value, { composing: false });
    },
    [setValue]
  );

  return { onChange, onCompositionStart, onCompositionEnd };
}
