import { describe, it, expect } from 'vitest';
import { getGradeOptions, DEFAULT_CITIES, STATUS_LABELS } from '../types';

describe('getGradeOptions', () => {
  it('國小回傳六個年級', () => {
    const options = getGradeOptions('elementary');
    expect(options).toHaveLength(6);
    expect(options[0]).toEqual({ value: 'E1', label: '一年級' });
    expect(options[5]).toEqual({ value: 'E6', label: '六年級' });
  });

  it('國中回傳三個年級', () => {
    const options = getGradeOptions('junior');
    expect(options).toHaveLength(3);
    expect(options[0]).toEqual({ value: 'J1', label: '一年級' });
  });

  it('高中職回傳三個年級', () => {
    const options = getGradeOptions('senior');
    expect(options).toHaveLength(3);
    expect(options[2]).toEqual({ value: 'S3', label: '三年級' });
  });

  it('不同級別的年級代碼不重複，避免混淆', () => {
    const all = [
      ...getGradeOptions('elementary'),
      ...getGradeOptions('junior'),
      ...getGradeOptions('senior'),
    ].map((option) => option.value);
    expect(new Set(all).size).toBe(all.length);
  });
});

describe('DEFAULT_CITIES', () => {
  it('預設縣市為雙北，且使用正體的臺北市', () => {
    expect(DEFAULT_CITIES).toEqual(['新北市', '臺北市']);
  });
});

describe('STATUS_LABELS', () => {
  it('四種狀態都有繁體中文標籤', () => {
    expect(STATUS_LABELS.pending).toBe('待審核');
    expect(STATUS_LABELS.contacted).toBe('已聯絡');
    expect(STATUS_LABELS.enrolled).toBe('已錄取');
    expect(STATUS_LABELS.cancelled).toBe('已取消');
  });
});
