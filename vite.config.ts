// 從 vitest/config 匯入而非 vite —— Vitest 4 的 test 欄位型別定義在這裡，
// 用 vite 的 defineConfig 加三斜線指令在 Vitest 4 會型別不符。
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  },
});
