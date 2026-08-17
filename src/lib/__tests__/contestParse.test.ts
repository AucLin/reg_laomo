import { describe, it, expect } from 'vitest';
import { describeParsed, parseContestText } from '../contestParse';

describe('parseContestText（貼上文字）', () => {
  const 公告 = [
    'WRO 2026 全國賽',
    '比賽日期：115年8月20日',
    '報名截止：115年7月31日',
    '比賽地點：臺中市第二運動場',
  ].join('\n');

  it('民國年換算成西元', () => {
    // 不換算就會存成西元 115 年
    const parsed = parseContestText(公告);
    expect(parsed.event_date).toBe('2026-08-20');
    expect(parsed.signup_deadline).toBe('2026-07-31');
  });

  it('第一行當比賽名稱', () => {
    expect(parseContestText(公告).title).toBe('WRO 2026 全國賽');
  });

  it('抓得到地點', () => {
    expect(parseContestText(公告).location).toBe('臺中市第二運動場');
  });

  it('西元的各種寫法都吃', () => {
    expect(
      parseContestText('比賽日期：2026-08-20').event_date
    ).toBe('2026-08-20');
    expect(parseContestText('比賽日期 2026/8/5').event_date).toBe('2026-08-05');
    expect(
      parseContestText('活動日期：2026年12月1日').event_date
    ).toBe('2026-12-01');
  });

  /*
    只看關鍵字後面 60 個字。離得遠的日期多半屬於別的欄位，
    抓過來會把「報名截止」填成頒獎典禮的日期。
  */
  it('離關鍵字太遠的日期不抓', () => {
    // 填充用實體文字：連續空白會在攤平時被收成一個，距離就不算數了
    const text = `報名截止：另行公告${'其他說明文字'.repeat(15)}頒獎典禮 2026-08-20`;
    expect(parseContestText(text).signup_deadline).toBeNull();
  });

  it('抓不到的欄位一律回 null，不亂填', () => {
    const parsed = parseContestText('這段公告什麼都沒寫');
    expect(parsed.event_date).toBeNull();
    expect(parsed.signup_deadline).toBeNull();
    expect(parsed.location).toBeNull();
  });

  it('不合理的日期不採用', () => {
    // 13 月不存在
    expect(parseContestText('比賽日期：2026-13-01').event_date).toBeNull();
  });
});

describe('parseContestText（HTML）', () => {
  const html = `
    <html><head>
      <title>WRO 2026 全國賽 | 主辦單位</title>
      <meta name="description" content="全國最大機器人賽事" />
    </head><body>
      <p>比賽日期：2026/8/20</p>
      <p>報名截止：2026/7/31</p>
      <p>比賽地點：臺中市第二運動場</p>
      <script>var x = '報名截止：2099/1/1';</script>
    </body></html>
  `;

  it('標題取自網頁標題', () => {
    expect(parseContestText(html).title).toBe('WRO 2026 全國賽 | 主辦單位');
  });

  it('說明取自網頁的描述標籤', () => {
    expect(parseContestText(html).description).toBe('全國最大機器人賽事');
  });

  it('程式碼區塊裡的日期不會被誤抓', () => {
    // script 內容先被剝掉，否則會抓到 2099 那個假日期
    expect(parseContestText(html).signup_deadline).toBe('2026-07-31');
  });
});

/*
  取自 WRO 官網真實的區賽公告。台灣的比賽公告大量使用「7/22」這種
  不寫年份的日期，不支援等於大部分公告都抓不到日期。
*/
describe('parseContestText（WRO 北區區賽的真實公告）', () => {
  const 今天 = new Date(2026, 7, 17);
  const 北區 = [
    '● 北區 ',
    ' → 比賽日期：7/22、7/23、7/24 ',
    ' → 比賽地點：新北市亞東科技大學 淡水校區 (新北市淡水區濱海路三段25號)',
    ' 3. 報名 & 資料繳交時間： 5/25 (一) 起 至 6/18 (四) 23:59 截止 ',
  ].join('\n');

  it('只寫月日的比賽日期抓得到，取第一個', () => {
    expect(parseContestText(北區, 今天).event_date).toBe('2026-07-22');
  });

  it('「…至 6/18 截止」這種日期寫在關鍵字前面的也抓得到', () => {
    expect(parseContestText(北區, 今天).signup_deadline).toBe('2026-06-18');
  });

  it('截止日的年份跟著比賽日期走，不會跑到比賽之後', () => {
    /*
      各自推年份的話，6/18 距今超過一個月會被推成明年，截止日就跑到
      比賽日期之後 —— 存檔時還會被資料庫的檢查限制式擋下。
    */
    const parsed = parseContestText(北區, 今天);
    expect(parsed.signup_deadline! <= parsed.event_date!).toBe(true);
  });

  it('推過年份要標記出來，提示才會叫人特別檢查', () => {
    expect(parseContestText(北區, 今天).year_guessed).toBe(true);
    expect(describeParsed(parseContestText(北區, 今天))).toContain('沒寫年份');
  });

  it('抓得到北區的地點', () => {
    expect(parseContestText(北區, 今天).location).toBe(
      '新北市亞東科技大學 淡水校區 (新北市淡水區濱海路三段25號)'
    );
  });

  it('整段只有欄位沒有名稱時，名稱寧可留空也不要把欄位當名稱', () => {
    // 「比賽日期：7/22…」被當成名稱帶進去，等於要多刪一次
    expect(parseContestText(北區, 今天).title).toBeNull();
  });

  it('有標題行時取標題，開頭的年份要留著', () => {
    const 全段 = `2026 WRO 國際奧林匹亞智能機器人聯盟賽 區賽\n${北區}`;
    expect(parseContestText(全段, 今天).title).toBe(
      '2026 WRO 國際奧林匹亞智能機器人聯盟賽 區賽'
    );
  });
});

describe('describeParsed', () => {
  const 空的 = {
    title: null,
    description: null,
    event_date: null,
    signup_deadline: null,
    location: null,
    year_guessed: false,
  };

  it('沒抓到任何欄位時直接說要手填', () => {
    expect(describeParsed(空的)).toBe('抓不到可用的欄位，請手動填寫。');
  });

  it('列出帶入了哪些欄位，並提醒要確認', () => {
    const note = describeParsed({
      ...空的,
      title: 'A',
      event_date: '2026-08-20',
      location: '臺中',
    });
    expect(note).toContain('名稱');
    expect(note).toContain('比賽日期');
    expect(note).toContain('地點');
    expect(note).toContain('請逐項確認');
  });
});
