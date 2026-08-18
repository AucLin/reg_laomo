import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminPage from '../AdminPage';
import * as adminRegistrationsModule from '../../lib/adminRegistrations';
import * as registrationsModule from '../../lib/registrations';
import * as csvModule from '../../lib/csv';
import * as useAuthModule from '../../auth/useAuth';
import type { AdminRegistrationRow } from '../../lib/types';

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminPage />
    </MemoryRouter>
  );
}

function makeRegistration(
  overrides: Partial<AdminRegistrationRow> = {}
): AdminRegistrationRow {
  return {
    id: 'reg-1',
    parent_id: 'parent-1',
    student_id: 'student-1',
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
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'admin-1', email: 'admin@example.com' } as never,
      profile: {
        id: 'admin-1',
        full_name: '管理員',
        phone: '0912345678',
        role: 'admin',
        created_at: '2026-08-01',
      },
      isAdmin: true,
      loading: false,
      signOut: vi.fn(),
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
      .mockResolvedValue({ rows: [makeRegistration()], total: 1, notesFailed: false });
    vi.spyOn(registrationsModule, 'updateRegistrationStatus').mockResolvedValue({
      error: '更新失敗，請稍後再試',
    });

    renderPage();

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
      .mockResolvedValue({ rows: [makeRegistration()], total: 1, notesFailed: false });
    vi.spyOn(registrationsModule, 'updateRegistrationStatus').mockResolvedValue({
      error: null,
    });

    renderPage();

    const nameCells = await screen.findAllByText('林小明');
    await user.click(nameCells[0]);
    expect(screen.getByText('報名明細')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '儲存' }));

    expect(await screen.findByText('報名管理')).toBeInTheDocument();
    expect(screen.queryByText('報名明細')).not.toBeInTheDocument();
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  // 最終修正三：listAllForExport 不分頁，資料量大時 attachNotes() 的
  // .in() 可能整批失敗，備註查詢失敗的降級處理過去只留一行
  // console.error，CSV 的備註欄會靜默全空、行政人員拿到檔案完全看不出
  // 異狀。這裡改成把失敗訊號帶回畫面，用跟撤回／存檔失敗一致的
  // role="alert" 呈現，不能只留在主控台。
  it('匯出時備註讀取失敗要在畫面顯示提示，不能只留在主控台', async () => {
    const user = userEvent.setup();
    vi.spyOn(adminRegistrationsModule, 'listRegistrations').mockResolvedValue({
      rows: [],
      total: 0,
      notesFailed: false,
    });
    vi.spyOn(adminRegistrationsModule, 'listAllForExport').mockResolvedValue({
      rows: [makeRegistration()],
      notesFailed: true,
    });
    vi.spyOn(csvModule, 'downloadCsv').mockImplementation(() => {});

    renderPage();
    await screen.findByText('報名管理');

    await user.click(screen.getByRole('button', { name: /匯出 CSV/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '本次備註讀取失敗，匯出的備註欄可能不完整'
    );
    // 主要資料還是要照樣匯出，不能因為備註失敗整份檔案都不下載
    expect(csvModule.downloadCsv).toHaveBeenCalledTimes(1);
  });

  it('匯出時備註讀取成功則不顯示任何警示', async () => {
    const user = userEvent.setup();
    vi.spyOn(adminRegistrationsModule, 'listRegistrations').mockResolvedValue({
      rows: [],
      total: 0,
      notesFailed: false,
    });
    vi.spyOn(adminRegistrationsModule, 'listAllForExport').mockResolvedValue({
      rows: [makeRegistration()],
      notesFailed: false,
    });
    vi.spyOn(csvModule, 'downloadCsv').mockImplementation(() => {});

    renderPage();
    await screen.findByText('報名管理');

    await user.click(screen.getByRole('button', { name: /匯出 CSV/ }));

    expect(csvModule.downloadCsv).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
