import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import App from '../App';

describe('App', () => {
  it('顯示教育中心名稱', () => {
    render(<App />);
    expect(screen.getByText('老莫機器人教育中心')).toBeInTheDocument();
  });
});
