import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RegistrationFilters from '../RegistrationFilters';
import { EMPTY_FILTERS } from '../../../lib/adminRegistrations';

describe('RegistrationFilters', () => {
  it('縣市預設篩在北部時明確告知使用者', () => {
    render(<RegistrationFilters value={EMPTY_FILTERS} onChange={vi.fn()} />);
    expect(
      screen.getByText('目前依縣市篩選：臺北市、新北市、基隆市、桃園市')
    ).toBeInTheDocument();
  });

  it('提供一鍵清除縣市篩選', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<RegistrationFilters value={EMPTY_FILTERS} onChange={onChange} />);

    await user.click(screen.getByRole('button', { name: '顯示全部縣市' }));

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ cities: [] })
    );
  });

  it('縣市清空後不再顯示篩選提示', () => {
    render(
      <RegistrationFilters
        value={{ ...EMPTY_FILTERS, cities: [] }}
        onChange={vi.fn()}
      />
    );
    expect(screen.queryByText(/目前依縣市篩選/)).not.toBeInTheDocument();
  });

  it('切換狀態時回報新的篩選條件', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<RegistrationFilters value={EMPTY_FILTERS} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText('狀態'), 'enrolled');

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'enrolled' })
    );
  });

  it('用注音搜尋時，組字中不送出半成品', async () => {
    const onChange = vi.fn();
    render(<RegistrationFilters value={EMPTY_FILTERS} onChange={onChange} />);

    const keywordInput = screen.getByLabelText('搜尋');

    fireEvent.compositionStart(keywordInput);
    fireEvent.change(keywordInput, { target: { value: 'ㄌㄧㄣˊ' } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('組字結束後以最終選字結果回報篩選條件', async () => {
    const onChange = vi.fn();
    render(<RegistrationFilters value={EMPTY_FILTERS} onChange={onChange} />);

    const keywordInput = screen.getByLabelText('搜尋');

    fireEvent.compositionStart(keywordInput);
    fireEvent.change(keywordInput, { target: { value: 'ㄌㄧㄣˊ' } });
    fireEvent.compositionEnd(keywordInput, { target: { value: '林' } });

    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: '林' })
    );
  });
});
