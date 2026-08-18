import { describe, it, expect } from 'vitest';
import { gradeRank, getGradeOptions, DEFAULT_CITIES, STATUS_LABELS } from '../types';

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
  it('預設縣市涵蓋北部，且使用正體的臺北市', () => {
    expect(DEFAULT_CITIES).toEqual(['臺北市', '新北市', '基隆市', '桃園市']);
  });

  /*
    這個常數是拿去跟資料庫的 city 欄位比對的，名錄一律寫「臺」。
    寫成「台北市」會篩出零筆，而且是靜悄悄的零筆。
  */
  it('不可寫成台北市，否則篩不到任何學校', () => {
    expect(DEFAULT_CITIES.every((city) => !city.includes('台'))).toBe(true);
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

/*
  比賽的參賽年級是一個區間（例如「國小四年級到六年級」），但 E/J/S 的
  年級代碼本身沒有順序。直接比字串會得出 'E4' < 'J1' 這種碰巧正確的
  假象，換個字首就崩了，所以要有明確的排序值。
*/
describe('gradeRank', () => {
  it('國小一到六年級對應 1 到 6', () => {
    expect(gradeRank('E1')).toBe(1);
    expect(gradeRank('E6')).toBe(6);
  });

  it('國中一到三年級接在國小後面，對應 7 到 9', () => {
    expect(gradeRank('J1')).toBe(7);
    expect(gradeRank('J3')).toBe(9);
  });

  it('高中職一到三年級對應 10 到 12', () => {
    expect(gradeRank('S1')).toBe(10);
    expect(gradeRank('S3')).toBe(12);
  });

  it('跨級別的大小關係正確', () => {
    // 這正是字串比對做不到的事
    expect(gradeRank('E6')!).toBeLessThan(gradeRank('J1')!);
    expect(gradeRank('J3')!).toBeLessThan(gradeRank('S1')!);
  });

  it.each([
    ['', '空字串'],
    ['E0', '國小沒有零年級'],
    ['E7', '國小只到六年級'],
    ['J4', '國中只到三年級'],
    ['S4', '高中職只到三年級'],
    ['X1', '沒有這個級別'],
    ['e1', '小寫不接受'],
    ['E 1', '中間有空白'],
    ['E10', '兩位數'],
    ['1', '只有數字'],
  ])('無法識別的代碼 %s（%s）回傳 null', (input) => {
    expect(gradeRank(input)).toBeNull();
  });
});
