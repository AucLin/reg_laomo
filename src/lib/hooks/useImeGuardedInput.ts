import { useRef, type ChangeEvent, type CompositionEvent } from 'react';

/**
 * 中文輸入法（注音、倉頡等）組字期間，瀏覽器會不斷觸發 onChange，
 * 值是「ㄌㄧㄣˊ」這種還沒選字的半成品。組字中若照樣寫進 React 狀態，
 * 使用者打到一半的字就會被打斷。這裡用一個 ref 記錄組字狀態，
 * 組字中一律跳過 onChange；compositionend 時才補寫一次最終值 ——
 * 部分瀏覽器的 compositionend 在 change 之後才觸發，少了這行最後一個字會漏掉。
 *
 * 全站共用的中文輸入欄位守衛。原本只在 ApplyPage.tsx 裡（學生姓名、班級、
 * 家長姓名三個欄位共用），後台 RegistrationFilters.tsx 的搜尋框加入後
 * 抽成這個共用 hook，避免每個中文輸入框各自重寫一份。
 */
export function useImeGuardedInput(setValue: (value: string) => void) {
  const isComposingRef = useRef(false);

  return {
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      if (isComposingRef.current) return;
      setValue(event.target.value);
    },
    onCompositionStart: () => {
      isComposingRef.current = true;
    },
    onCompositionEnd: (event: CompositionEvent<HTMLInputElement>) => {
      isComposingRef.current = false;
      setValue(event.currentTarget.value);
    },
  };
}
