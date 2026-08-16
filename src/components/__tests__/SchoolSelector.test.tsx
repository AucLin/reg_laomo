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

    expect(onChange).toHaveBeenLastCalledWith({
      level: 'elementary',
      schoolId: '',
      schoolNameRaw: '某某實驗教育機構',
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
});
