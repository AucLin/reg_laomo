import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminPage from '../AdminPage';
import * as adminRegistrationsModule from '../../lib/adminRegistrations';
import * as registrationsModule from '../../lib/registrations';
import type { RegistrationWithSchool } from '../../lib/types';

function makeRegistration(
  overrides: Partial<RegistrationWithSchool> = {}
): RegistrationWithSchool {
  return {
    id: 'reg-1',
    parent_id: 'parent-1',
    student_name: '林小明',
    student_gender: 'male',
    student_birthday: '2016-05-20',
    school_id: 'school-1',
    school_name_raw: null,
    grade: 'E4',
    class_name: '忠班',
    parent_name: '林大明',
    relation: 'father',
    contact_phone: '0912345678',
    status: 'pending',
    admin_note: '',
    created_at: '2026-08-10T10:00:00Z',
    updated_at: '2026-08-10T10:00:00Z',
    school_name: '臺北市立中正國小',
    school_city: '臺北市',
    school_level: 'elementary',
    ...overrides,
  };
}

describe('AdminPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(adminRegistrationsModule, 'getStats').mockResolvedValue({
      thisMonth: 0,
      pending: 0,
      contacted: 0,
      enrolled: 0,
    });
  });

  // 品質審查第 1 輪修正：存檔失敗（管理員把狀態改成「已聯絡」、按下
  // 「儲存」，但資料庫更新失敗）時，明細視窗不能悄悄恢復成「儲存」
  // 按鈕就當作沒事發生 —— 要顯示錯誤訊息、視窗留著讓管理員知道要重試、
  // 列表也不該假裝資料已經更新而重新整理。
  it('儲存失敗時顯示錯誤訊息、明細視窗仍開著、列表沒被重整', async () => {
    const user = userEvent.setup();
    const listSpy = vi
      .spyOn(adminRegistrationsModule, 'listRegistrations')
      .mockResolvedValue({ rows: [makeRegistration()], total: 1 });
    vi.spyOn(registrationsModule, 'updateRegistrationStatus').mockResolvedValue({
      error: '更新失敗，請稍後再試',
    });

    render(<AdminPage />);

    const nameCells = await screen.findAllByText('林小明');
    await user.click(nameCells[0]);

    // 「內部備註」只存在明細視窗裡（篩選列的「狀態」下拉選單跟明細
    // 視窗裡的「狀態」下拉選單同名，用會撞名的標籤查詢容易誤判）
    expect(screen.getByText('報名明細')).toBeInTheDocument();
    expect(screen.getByLabelText('內部備註')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '儲存' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('更新失敗，請稍後再試');
    // 明細視窗仍開著
    expect(screen.getByText('報名明細')).toBeInTheDocument();
    expect(screen.getByLabelText('內部備註')).toBeInTheDocument();
    // 列表沒被重整：從點開明細到存檔失敗，listRegistrations 只在初次載入時呼叫過一次
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it('儲存成功時關閉明細視窗並重新整理列表', async () => {
    const user = userEvent.setup();
    const listSpy = vi
      .spyOn(adminRegistrationsModule, 'listRegistrations')
      .mockResolvedValue({ rows: [makeRegistration()], total: 1 });
    vi.spyOn(registrationsModule, 'updateRegistrationStatus').mockResolvedValue({
      error: null,
    });

    render(<AdminPage />);

    const nameCells = await screen.findAllByText('林小明');
    await user.click(nameCells[0]);
    expect(screen.getByText('報名明細')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '儲存' }));

    expect(await screen.findByText('報名管理')).toBeInTheDocument();
    expect(screen.queryByText('報名明細')).not.toBeInTheDocument();
    expect(listSpy).toHaveBeenCalledTimes(2);
  });
});
