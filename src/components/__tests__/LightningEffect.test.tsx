import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LightningEffect from '../LightningEffect';

function mockReducedMotion(prefersReduced: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches: query.includes('prefers-reduced-motion') ? prefersReduced : false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
  );
}

describe('LightningEffect', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('一般情況下輸出會動的閃電', () => {
    mockReducedMotion(false);
    render(<LightningEffect />);
    const svg = screen.getByTestId('lightning');
    expect(svg.classList.contains('animate-lightning')).toBe(true);
  });

  it('使用者開啟減少動態效果時停用動畫', () => {
    mockReducedMotion(true);
    render(<LightningEffect />);
    const svg = screen.getByTestId('lightning');
    expect(svg.classList.contains('animate-lightning')).toBe(false);
  });

  it('對輔助技術隱藏，因為它純粹是裝飾', () => {
    mockReducedMotion(false);
    render(<LightningEffect />);
    expect(screen.getByTestId('lightning')).toHaveAttribute('aria-hidden', 'true');
  });
});
