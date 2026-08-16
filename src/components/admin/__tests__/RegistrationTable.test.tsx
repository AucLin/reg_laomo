import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RegistrationTable from '../RegistrationTable';
import type { AdminRegistrationRow } from '../../../lib/types';

function makeRegistration(
  overrides: Partial<AdminRegistrationRow> = {}
): AdminRegistrationRow {
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
    admin_note: null,
    created_at: '2026-08-10T10:00:00Z',
    updated_at: '2026-08-10T10:00:00Z',
    school_name: '臺北市立中正國小',
    school_city: '臺北市',
    school_level: 'elementary',
    ...overrides,
    };
}

describe('RegistrationTable', () => {
  it('沒有資料時顯示提示文字', () => {
    render(<RegistrationTable rows={[]} onSelect={vi.fn()} />);
    expect(screen.getByText('沒有符合條件的報名資料')).toBeInTheDocument();
  });

  it('校名解析得出來時不顯示待確認標記', () => {
    render(<RegistrationTable rows={[makeRegistration()]} onSelect={vi.fn()} />);
    expect(screen.queryByText('待確認')).not.toBeInTheDocument();
  });

  it('自由填寫校名（school_id 為 null）時顯示待確認標記', () => {
    render(
      <RegistrationTable
        rows={[
          makeRegistration({
            school_id: null,
            school_name_raw: '某某實驗教育機構',
            school_name: null,
            school_city: null,
            school_level: null,
          }),
        ]}
        onSelect={vi.fn()}
      />
    );
    // 手機卡片與桌機表格各渲染一份，取全部確認至少一份存在
    expect(screen.getAllByText('待確認').length).toBeGreaterThan(0);
  });

  // 核心情境：school_id 有值（家長確實選了名錄裡的學校），但該校後來被
  // 下架（is_active = false），schools 的讀取政策擋下、左連接查無資料，
  // school_name 一樣變 null。這批報名跟自由填寫校名一樣需要人工確認，
  // 不能因為 school_id 有值就被誤判成「校名已解析」而不顯示標記。
  it('school_id 有值但學校已被停用（school_name 為 null）時仍顯示待確認標記', () => {
    render(
      <RegistrationTable
        rows={[
          makeRegistration({
            school_id: 'school-inactive',
            school_name_raw: null,
            school_name: null,
            school_city: null,
            school_level: null,
          }),
        ]}
        onSelect={vi.fn()}
      />
    );
    expect(screen.getAllByText('待確認').length).toBeGreaterThan(0);
  });

  it('點選手機版卡片會呼叫 onSelect 並帶上該筆資料', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    const registration = makeRegistration();
    render(<RegistrationTable rows={[registration]} onSelect={onSelect} />);

    // 手機卡片是唯一的 <button>，桌機表格用 <tr onClick> 沒有 button 角色
    await user.click(screen.getByRole('button'));

    expect(onSelect).toHaveBeenCalledWith(registration);
  });
});
