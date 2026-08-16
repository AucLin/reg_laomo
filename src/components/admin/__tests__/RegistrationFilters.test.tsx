import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RegistrationFilters from '../RegistrationFilters';
import { EMPTY_FILTERS } from '../../../lib/adminRegistrations';

describe('RegistrationFilters', () => {
  it('縣市預設篩在雙北時明確告知使用者', () => {
    render(<RegistrationFilters value={EMPTY_FILTERS} onChange={vi.fn()} />);
    expect(
      screen.getByText('目前依縣市篩選：新北市、臺北市')
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
});
