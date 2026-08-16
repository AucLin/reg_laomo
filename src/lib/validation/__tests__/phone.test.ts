import { describe, it, expect } from 'vitest';
import { isValidTaiwanPhone } from '../phone';

describe('isValidTaiwanPhone', () => {
  it('接受手機號碼', () => {
    expect(isValidTaiwanPhone('0912345678')).toBe(true);
  });

  it('接受帶連字號的手機號碼', () => {
    expect(isValidTaiwanPhone('0912-345-678')).toBe(true);
  });

  it('接受臺北市話', () => {
    expect(isValidTaiwanPhone('02-23456789')).toBe(true);
  });

  it('接受不帶連字號的市話', () => {
    expect(isValidTaiwanPhone('0223456789')).toBe(true);
  });

  it('拒絕位數不足的號碼', () => {
    expect(isValidTaiwanPhone('091234')).toBe(false);
  });

  it('拒絕不是 0 開頭的號碼', () => {
    expect(isValidTaiwanPhone('9123456789')).toBe(false);
  });

  it('拒絕含英文字母的號碼', () => {
    expect(isValidTaiwanPhone('09abcdefgh')).toBe(false);
  });

  it('拒絕空字串', () => {
    expect(isValidTaiwanPhone('')).toBe(false);
  });
});
