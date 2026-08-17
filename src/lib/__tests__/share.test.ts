import { describe, it, expect } from 'vitest';
import { buildShareText, contestUrl, lineShareUrl } from '../share';
import type { Contest } from '../types';

function makeContest(overrides: Partial<Contest> = {}): Contest {
  return {
    id: 'contest-1',
    title: 'WRO 2026 全國賽',
    description: null,
    event_date: '2026-08-20',
    location: '臺中市第二運動場',
    signup_deadline: '2026-07-31',
    capacity: 20,
    min_grade: 'E4',
    max_grade: 'J3',
    status: 'published',
    created_by: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

describe('contestUrl', () => {
  it('指向單場比賽的公開頁', () => {
    expect(contestUrl('contest-1', 'https://your-site.netlify.app')).toBe(
      'https://your-site.netlify.app/contests/contest-1'
    );
  });
});

describe('buildShareText', () => {
  const url = 'https://your-site.netlify.app/contests/contest-1';

  it('把日期、地點、年級與連結寫成一段可直接貼的文案', () => {
    const text = buildShareText(makeContest(), url);

    expect(text).toContain('【WRO 2026 全國賽】');
    expect(text).toContain('比賽日期：2026-08-20');
    expect(text).toContain('地點：臺中市第二運動場');
    expect(text).toContain('報名截止：2026-07-31');
    expect(text).toContain('參賽年級：國小四年級至國中三年級');
    expect(text).toContain(`線上報名：${url}`);
  });

  it('有名額上限才寫名額', () => {
    expect(buildShareText(makeContest(), url)).toContain('名額：20 位');
    // 「不限名額」寫進招生文案沒有意義，只會佔掉手機上一行
    expect(
      buildShareText(makeContest({ capacity: null }), url)
    ).not.toContain('名額');
  });

  it('有說明就一併帶上', () => {
    const text = buildShareText(
      makeContest({ description: '分為初階與進階兩組' }),
      url
    );
    expect(text).toContain('分為初階與進階兩組');
  });
});

describe('lineShareUrl', () => {
  it('網址與文案都要編碼，否則帶有中文與符號的文案會被截斷', () => {
    const shared = lineShareUrl('https://example.test/a?b=1', '文案 & 內容');
    expect(shared).toContain(encodeURIComponent('https://example.test/a?b=1'));
    expect(shared).toContain(encodeURIComponent('文案 & 內容'));
  });
});
