import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import SchoolSelector, { type SchoolSelection } from '../SchoolSelector';
import * as schoolsModule from '../../lib/schools';

const emptySelection: SchoolSelection = {
  level: 'elementary',
  schoolId: '',
  schoolNameRaw: '',
};

const sampleSchools = [
  {
    id: 'school-1',
    code: '014601',
    name: '臺北市立中正國中',
    level: 'junior' as const,
    city: '臺北市',
    address: null,
    phone: null,
  },
  {
    id: 'school-2',
    code: '014602',
    name: '新北市立中正國中',
    level: 'junior' as const,
    city: '新北市',
    address: null,
    phone: null,
  },
];

describe('SchoolSelector', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.spyOn(schoolsModule, 'searchSchools').mockResolvedValue(sampleSchools);
    vi.spyOn(schoolsModule, 'searchOtherLevels').mockResolvedValue([]);
    vi.spyOn(schoolsModule, 'getSchoolById').mockResolvedValue(sampleSchools[0]);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('縣市預設勾選雙北', () => {
    render(<SchoolSelector value={emptySelection} onChange={vi.fn()} />);
    expect(screen.getByLabelText('新北市')).toBeChecked();
    expect(screen.getByLabelText('臺北市')).toBeChecked();
    expect(screen.getByLabelText('桃園市')).not.toBeChecked();
  });

  it('三種學校級別都可選', () => {
    render(<SchoolSelector value={emptySelection} onChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: '國小' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '國中' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '高中職' })).toBeInTheDocument();
  });

  it('打字後在防抖動時間內只送出一次查詢', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SchoolSelector value={emptySelection} onChange={vi.fn()} />);

    await user.type(screen.getByLabelText('搜尋學校名稱'), '中正');
    // 打了兩個字，若沒有防抖動會送出兩次
    expect(schoolsModule.searchSchools).not.toHaveBeenCalled();

    vi.advanceTimersByTime(250);
    await waitFor(() => {
      expect(schoolsModule.searchSchools).toHaveBeenCalledTimes(1);
    });
  });

  it('搜尋結果顯示校名與縣市', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SchoolSelector value={emptySelection} onChange={vi.fn()} />);

    await user.type(screen.getByLabelText('搜尋學校名稱'), '中正');
    vi.advanceTimersByTime(250);

    expect(await screen.findByText('臺北市立中正國中')).toBeInTheDocument();
    expect(await screen.findByText('新北市立中正國中')).toBeInTheDocument();
  });

  it('選定學校後回傳的是學校代碼而非文字', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SchoolSelector value={emptySelection} onChange={onChange} />);

    await user.type(screen.getByLabelText('搜尋學校名稱'), '中正');
    vi.advanceTimersByTime(250);

    const option = await screen.findByText('臺北市立中正國中');
    await user.click(option);

    expect(onChange).toHaveBeenCalledWith({
      level: 'elementary',
      schoolId: 'school-1',
      schoolNameRaw: '',
    });
  });

  it('切換級別時清空已選的學校，避免留下不相符的組合', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(
      <SchoolSelector
        value={{ level: 'elementary', schoolId: 'school-1', schoolNameRaw: '' }}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('button', { name: '國中' }));

    expect(onChange).toHaveBeenCalledWith({
      level: 'junior',
      schoolId: '',
      schoolNameRaw: '',
    });
  });

  it('選擇「找不到我的學校」後改填自由文字', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SchoolSelector value={emptySelection} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '找不到我的學校' }));

    const input = await screen.findByLabelText('請填寫學校全名');
    await user.type(input, '某某實驗教育機構');

    // 呼叫端的 onChange 是 vi.fn()，不會把值同步寫回 value prop，
    // 這裡要確認即使外部沒有同步回寫，連續打字也不會被吃掉只剩最後一個字
    expect(input).toHaveValue('某某實驗教育機構');
    expect(onChange).toHaveBeenLastCalledWith({
      level: 'elementary',
      schoolId: '',
      schoolNameRaw: '某某實驗教育機構',
    });
  });

  it('先掛載空白表單，等非同步取回的自由文字校名餵進來後仍要補回顯示（編輯報名的非同步情境）', async () => {
    // 對應報名表頁面編輯既有報名時的真實流程：getRegistration(editId) 是
    // 非同步請求，resolve 前元件早已掛載完畢，只有掛載當下的初始值判斷
    // 顧不到這種「事後才餵值」的情況
    const { rerender } = render(
      <SchoolSelector value={emptySelection} onChange={vi.fn()} />
    );

    expect(screen.queryByLabelText('請填寫學校全名')).not.toBeInTheDocument();

    rerender(
      <SchoolSelector
        value={{
          level: 'elementary',
          schoolId: '',
          schoolNameRaw: '某某實驗教育機構',
        }}
        onChange={vi.fn()}
      />
    );

    expect(await screen.findByLabelText('請填寫學校全名')).toHaveValue(
      '某某實驗教育機構'
    );
  });

  it('已在手動輸入模式下，外部之後才把校名值更新，輸入框要同步顯示新值', async () => {
    // 這條刻意讓元件從掛載到 rerender 全程都停在手動輸入模式（schoolNameRaw
    // 兩次都非空），ManualInput 不會被重新掛載，才能單獨驗證「本地狀態要
    // 跟著外部 value 的後續變化同步」這件事，跟「切到手動輸入模式」的判斷
    // 互不干擾
    const { rerender } = render(
      <SchoolSelector
        value={{ level: 'elementary', schoolId: '', schoolNameRaw: '舊某某機構' }}
        onChange={vi.fn()}
      />
    );

    expect(await screen.findByLabelText('請填寫學校全名')).toHaveValue(
      '舊某某機構'
    );

    rerender(
      <SchoolSelector
        value={{ level: 'elementary', schoolId: '', schoolNameRaw: '新某某機構' }}
        onChange={vi.fn()}
      />
    );

    expect(await screen.findByLabelText('請填寫學校全名')).toHaveValue(
      '新某某機構'
    );
  });

  it('手動輸入模式下切換級別，畫面要回到搜尋模式，不留著已被清空的舊校名', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SchoolSelector value={emptySelection} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '找不到我的學校' }));
    const input = await screen.findByLabelText('請填寫學校全名');
    await user.type(input, '某某實驗教育機構');

    await user.click(screen.getByRole('button', { name: '國中' }));

    // 父層資料已經被清空，畫面不能繼續停在手動輸入模式顯示舊校名，
    // 否則家長會以為自己填的校名還在，實際上送出的會是空字串
    expect(screen.queryByLabelText('請填寫學校全名')).not.toBeInTheDocument();
    expect(screen.getByLabelText('搜尋學校名稱')).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith({
      level: 'junior',
      schoolId: '',
      schoolNameRaw: '',
    });
  });

  it('中文輸入法組字期間不送查詢，選完字才查', async () => {
    render(<SchoolSelector value={emptySelection} onChange={vi.fn()} />);
    const input = screen.getByLabelText('搜尋學校名稱');

    // 注音組字中：使用者還在打「ㄓㄨㄥ」，這時查資料庫查不到任何東西
    fireEvent.compositionStart(input);
    fireEvent.change(input, { target: { value: 'ㄓㄨㄥ' } });
    vi.advanceTimersByTime(400);
    expect(schoolsModule.searchSchools).not.toHaveBeenCalled();

    // 選好字了才查
    fireEvent.compositionEnd(input, { target: { value: '中正' } });
    vi.advanceTimersByTime(250);

    await waitFor(() => {
      expect(schoolsModule.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: '中正' })
      );
    });
  });

  it('傳入既有的學校代碼時把校名補查回來顯示（編輯報名用）', async () => {
    render(
      <SchoolSelector
        value={{ level: 'junior', schoolId: 'school-1', schoolNameRaw: '' }}
        onChange={vi.fn()}
      />
    );

    expect(await screen.findByText('臺北市立中正國中')).toBeInTheDocument();
    expect(schoolsModule.getSchoolById).toHaveBeenCalledWith('school-1');
  });

  it('傳入自由文字校名時直接進入自由輸入模式（編輯報名用）', async () => {
    render(
      <SchoolSelector
        value={{
          level: 'elementary',
          schoolId: '',
          schoolNameRaw: '某某實驗教育機構',
        }}
        onChange={vi.fn()}
      />
    );

    expect(await screen.findByLabelText('請填寫學校全名')).toHaveValue(
      '某某實驗教育機構'
    );
  });

  it('清空縣市勾選後查詢不帶縣市條件，等於搜尋全國', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<SchoolSelector value={emptySelection} onChange={vi.fn()} />);

    await user.click(screen.getByLabelText('新北市'));
    await user.click(screen.getByLabelText('臺北市'));
    await user.type(screen.getByLabelText('搜尋學校名稱'), '中正');
    vi.advanceTimersByTime(250);

    await waitFor(() => {
      expect(schoolsModule.searchSchools).toHaveBeenCalledWith(
        expect.objectContaining({ cities: [] })
      );
    });
  });

  /*
    教育部名錄只收獨立立案的學校，一貫制私校的國小部多半只以高中身分
    登錄一筆。家長在國小級別搜「康橋」什麼都沒有，第一反應是系統壞了。
  */
  describe('同名學校掛在其他級別時的提示', () => {
    const kangchiaoSenior = {
      id: 'school-9',
      code: '11302',
      name: '私立康橋高中',
      level: 'senior' as const,
      city: '新北市',
      address: null,
      phone: null,
    };

    it('這個級別查無結果時，告知同名學校登錄在哪個級別', async () => {
      vi.spyOn(schoolsModule, 'searchSchools').mockResolvedValue([]);
      vi.spyOn(schoolsModule, 'searchOtherLevels').mockResolvedValue([
        kangchiaoSenior,
      ]);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SchoolSelector value={emptySelection} onChange={vi.fn()} />);

      await user.type(screen.getByLabelText('搜尋學校名稱'), '康橋');
      vi.advanceTimersByTime(250);

      await waitFor(() => {
        expect(screen.getByText(/登錄在其他級別/)).toBeInTheDocument();
      });
      expect(screen.getByText(/私立康橋高中/)).toBeInTheDocument();
      // 「高中職」也是級別按鈕的文字，這裡要比對括號版本才不會抓錯元素
      expect(screen.getByText('（高中職）')).toBeInTheDocument();
      // 光說「有這所學校」不夠，要直接指路到自由填寫的出口
      expect(
        screen.getByRole('button', { name: '找不到我的學校' })
      ).toBeInTheDocument();
    });

    it('這個級別找得到學校時不去問其他級別，省一次查詢', async () => {
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SchoolSelector value={emptySelection} onChange={vi.fn()} />);

      await user.type(screen.getByLabelText('搜尋學校名稱'), '中正');
      vi.advanceTimersByTime(250);

      await waitFor(() => {
        expect(schoolsModule.searchSchools).toHaveBeenCalled();
      });
      expect(schoolsModule.searchOtherLevels).not.toHaveBeenCalled();
    });

    it('其他級別也沒有同名學校時，不顯示多餘的提示', async () => {
      vi.spyOn(schoolsModule, 'searchSchools').mockResolvedValue([]);
      vi.spyOn(schoolsModule, 'searchOtherLevels').mockResolvedValue([]);
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
      render(<SchoolSelector value={emptySelection} onChange={vi.fn()} />);

      await user.type(screen.getByLabelText('搜尋學校名稱'), '不存在的學校');
      vi.advanceTimersByTime(250);

      await waitFor(() => {
        expect(
          screen.getByText('找不到符合的學校，試試放寬縣市範圍')
        ).toBeInTheDocument();
      });
      expect(screen.queryByText(/登錄在其他級別/)).not.toBeInTheDocument();
    });
  });
});
