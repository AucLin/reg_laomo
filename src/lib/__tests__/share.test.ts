import { describe, it, expect } from 'vitest';
import {
  buildShareText,
  buildTrainingNoticeText,
  contestUrl,
  lineShareUrl,
  myRegistrationsUrl,
} from '../share';
import type { Contest, TrainingSession } from '../types';

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
    expect(contestUrl('contest-1', 'https://example.com')).toBe(
      'https://example.com/contests/contest-1'
    );
  });
});

describe('buildShareText', () => {
  const url = 'https://example.com/contests/contest-1';

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

function makeSession(overrides: Partial<TrainingSession> = {}): TrainingSession {
  return {
    id: 'session-1',
    contest_id: 'contest-1',
    session_date: '2026-09-06',
    start_time: '14:00:00',
    end_time: '17:00:00',
    location: null,
    note: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

describe('myRegistrationsUrl', () => {
  it('指向家長自己的報名頁', () => {
    expect(myRegistrationsUrl('https://example.com')).toBe(
      'https://example.com/my'
    );
  });
});

describe('buildTrainingNoticeText', () => {
  const url = 'https://example.com/my';

  it('一場一行，寫出日期、星期與起訖時間', () => {
    const text = buildTrainingNoticeText(
      makeContest(),
      [makeSession(), makeSession({ id: 'session-2', session_date: '2026-09-13' })],
      url
    );

    expect(text).toContain('【WRO 2026 全國賽 集訓時間】');
    expect(text).toContain('9/6（日）14:00-17:00');
    expect(text).toContain('9/13（日）14:00-17:00');
  });

  /*
    備註寫的是「帶水壺」「這次在二館」這種家長當天要知道的事。
    通知裡漏掉它，家長就得再登入一次才看得到。
  */
  it('備註接在時間後面', () => {
    const text = buildTrainingNoticeText(
      makeContest(),
      [makeSession({ note: '帶水壺' })],
      url
    );

    expect(text).toContain('9/6（日）14:00-17:00 帶水壺');
  });

  /*
    LINE 的訊息沒有縮排，備註裡的換行會讓後面幾行看起來像獨立的場次。
  */
  it('備註有換行時壓成一行', () => {
    const text = buildTrainingNoticeText(
      makeContest(),
      [makeSession({ note: '帶水壺\n穿運動鞋' })],
      url
    );

    expect(text).toContain('9/6（日）14:00-17:00 帶水壺 穿運動鞋');
  });

  it('末尾帶家長要點進去的連結', () => {
    const text = buildTrainingNoticeText(makeContest(), [makeSession()], url);

    expect(text.trimEnd().endsWith(url)).toBe(true);
  });

  /*
    沒有場次就沒有東西可通知。回空字串讓呼叫端可以據此把按鈕收起來，
    而不是產生一段只有標題和連結、家長點進去什麼都沒有的文案。
  */
  it('沒有場次時回空字串', () => {
    expect(buildTrainingNoticeText(makeContest(), [], url)).toBe('');
  });
});
