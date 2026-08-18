import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AdminUsersPage from '../AdminUsersPage';
import * as adminUsersModule from '../../lib/adminUsers';
import type { AdminUserRow } from '../../lib/adminUsers';
import type { RegistrationWithSchool, StudentWithSchool } from '../../lib/types';

function renderPage() {
  return render(
    <MemoryRouter>
      <AdminUsersPage />
    </MemoryRouter>
  );
}

function makeUser(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    id: 'user-1',
    full_name: '林大明',
    phone: '0912345678',
    role: 'parent',
    created_at: '2026-08-01T00:00:00Z',
    email: 'ming@example.com',
    email_confirmed_at: '2026-08-01T00:05:00Z',
    last_sign_in_at: '2026-08-10T00:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(adminUsersModule, 'listStudentsOf').mockResolvedValue([]);
  vi.spyOn(adminUsersModule, 'listRegistrationsOf').mockResolvedValue([]);
});

describe('AdminUsersPage', () => {
  it('列出帳號的姓名、信箱與電話', async () => {
    vi.spyOn(adminUsersModule, 'listUsers').mockResolvedValue([makeUser()]);
    renderPage();

    expect(await screen.findByText('林大明')).toBeInTheDocument();
    expect(screen.getByText(/ming@example\.com/)).toBeInTheDocument();
    expect(screen.getByText(/0912345678/)).toBeInTheDocument();
  });

  it('管理員的帳號標出來', async () => {
    vi.spyOn(adminUsersModule, 'listUsers').mockResolvedValue([
      makeUser({ role: 'admin' }),
    ]);
    renderPage();

    expect(await screen.findByText('管理員')).toBeInTheDocument();
  });

  /*
    沒點驗證信的帳號登不進來。家長打電話說「登不進去」時，這個標記
    就是答案，少了它行政人員只能瞎猜。
  */
  it('信箱還沒驗證的帳號標出來', async () => {
    vi.spyOn(adminUsersModule, 'listUsers').mockResolvedValue([
      makeUser({ email_confirmed_at: null }),
    ]);
    renderPage();

    expect(await screen.findByText('信箱未驗證')).toBeInTheDocument();
  });

  it('從來沒登入過的帳號說「從未登入」，不是顯示一個假日期', async () => {
    vi.spyOn(adminUsersModule, 'listUsers').mockResolvedValue([
      makeUser({ last_sign_in_at: null }),
    ]);
    renderPage();

    expect(await screen.findByText(/從未登入/)).toBeInTheDocument();
  });

  it('搜尋會篩掉不符合的帳號', async () => {
    vi.spyOn(adminUsersModule, 'listUsers').mockResolvedValue([
      makeUser({ id: 'a', full_name: '林大明' }),
      makeUser({ id: 'b', full_name: '陳小華', email: 'hua@example.com' }),
    ]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('林大明');
    await user.type(screen.getByLabelText('搜尋'), '小華');

    await waitFor(() => {
      expect(screen.queryByText('林大明')).not.toBeInTheDocument();
    });
    expect(screen.getByText('陳小華')).toBeInTheDocument();
  });

  /*
    名冊上每個帳號都先撈一次孩子與報名的話，四十個家長就是八十次查詢，
    而行政人員一次只會看其中一兩個。
  */
  it('沒展開就不去查孩子與報名', async () => {
    vi.spyOn(adminUsersModule, 'listUsers').mockResolvedValue([makeUser()]);
    renderPage();

    await screen.findByText('林大明');
    expect(adminUsersModule.listStudentsOf).not.toHaveBeenCalled();
    expect(adminUsersModule.listRegistrationsOf).not.toHaveBeenCalled();
  });

  it('展開後顯示這個家長的孩子與報名', async () => {
    vi.spyOn(adminUsersModule, 'listUsers').mockResolvedValue([makeUser()]);
    vi.spyOn(adminUsersModule, 'listStudentsOf').mockResolvedValue([
      {
        id: 'student-1',
        parent_id: 'user-1',
        name: '林小明',
        gender: 'male',
        birthday: '2016-05-20',
        school_id: 'school-1',
        school_name_raw: null,
        grade: 'E4',
        class_name: '忠班',
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
        school_name: '市立光復國小',
        school_city: '臺北市',
        school_level: 'elementary',
      } satisfies StudentWithSchool,
    ]);
    vi.spyOn(adminUsersModule, 'listRegistrationsOf').mockResolvedValue([
      {
        id: 'reg-1',
        parent_id: 'user-1',
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
        created_at: '2026-08-10T10:00:00Z',
        updated_at: '2026-08-10T10:00:00Z',
        school_name: '市立光復國小',
        school_city: '臺北市',
        school_level: 'elementary',
      } satisfies RegistrationWithSchool,
    ]);

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText('林大明'));

    expect(await screen.findByText('孩子（1）')).toBeInTheDocument();
    expect(screen.getByText(/市立光復國小/)).toBeInTheDocument();
    expect(screen.getByText('課程報名（1）')).toBeInTheDocument();
    expect(screen.getByText('待審核')).toBeInTheDocument();
  });

  /*
    自由填寫校名的孩子在名錄裡對不到，school_name 是 null。
    退回家長打的字，不能顯示空白。
  */
  it('自由填寫校名的孩子顯示家長打的校名', async () => {
    vi.spyOn(adminUsersModule, 'listUsers').mockResolvedValue([makeUser()]);
    vi.spyOn(adminUsersModule, 'listStudentsOf').mockResolvedValue([
      {
        id: 'student-2',
        parent_id: 'user-1',
        name: '林小華',
        gender: 'female',
        birthday: '2016-05-20',
        school_id: null,
        school_name_raw: '某某實驗小學',
        grade: 'E4',
        class_name: null,
        created_at: '2026-08-01T00:00:00Z',
        updated_at: '2026-08-01T00:00:00Z',
        school_name: null,
        school_city: null,
        school_level: null,
      } satisfies StudentWithSchool,
    ]);

    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByText('林大明'));
    expect(await screen.findByText(/某某實驗小學/)).toBeInTheDocument();
  });

  it('沒有任何帳號符合搜尋時說清楚，不是留一片空白', async () => {
    vi.spyOn(adminUsersModule, 'listUsers').mockResolvedValue([makeUser()]);
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('林大明');
    await user.type(screen.getByLabelText('搜尋'), '查無此人');

    expect(await screen.findByText('沒有符合的帳號')).toBeInTheDocument();
  });
});
