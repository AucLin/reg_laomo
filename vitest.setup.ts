import '@testing-library/jest-dom/vitest';

// jsdom 沒有內建 matchMedia，任何元件（例如 LightningEffect）只要在測試中
// 呼叫 window.matchMedia 就會噴 TypeError。這裡補上預設實作（回傳「未開啟
// 減少動態效果」），個別測試仍可用 vi.stubGlobal('matchMedia', ...) 覆寫。
if (typeof window !== 'undefined' && !window.matchMedia) {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
