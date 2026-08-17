import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import MyRegistrationsPage from '../MyRegistrationsPage';
import * as registrationsModule from '../../lib/registrations';
import * as studentsModule from '../../lib/students';
import * as useAuthModule from '../../auth/useAuth';
import type { RegistrationWithSchool, StudentWithSchool } from '../../lib/types';

function makeRegistration(
  overrides: Partial<RegistrationWithSchool> = {}
): RegistrationWithSchool {
  return {
    id: 'reg-1',
    parent_id: 'parent-1',
    student_id: null,
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
    school_name: '臺北市立中正國小',
    school_city: '臺北市',
    school_level: 'elementary',
    ...overrides,
  };
}

function makeStudent(
  overrides: Partial<StudentWithSchool> = {}
): StudentWithSchool {
  return {
    id: 'student-1',
    parent_id: 'parent-1',
    name: '林小明',
    gender: 'male',
    birthday: '2016-05-20',
    school_id: 'school-1',
    school_name_raw: null,
    grade: 'E4',
    class_name: '忠班',
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    school_name: '臺北市立中正國小',
    school_city: '臺北市',
    school_level: 'elementary',
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <MyRegistrationsPage />
    </MemoryRouter>
  );
}

describe('MyRegistrationsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // 這一頁掛載時同時讀報名與孩子，孩子沒 mock 的話會打到真的 Supabase
    vi.spyOn(studentsModule, 'listMyStudents').mockResolvedValue([]);
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'parent-1', email: 'parent@example.com' } as never,
      profile: {
        id: 'parent-1',
        full_name: '林大明',
        phone: '0912345678',
        role: 'parent',
        created_at: '2026-08-01',
      },
      isAdmin: false,
      loading: false,
      signOut: vi.fn(),
    });
  });

  it('顯示學生姓名、學校與狀態', async () => {
    vi.spyOn(registrationsModule, 'listMyRegistrations').mockResolvedValue([
      makeRegistration(),
    ]);
    renderPage();

    expect(await screen.findByText('林小明')).toBeInTheDocument();
    expect(screen.getByText('臺北市立中正國小')).toBeInTheDocument();
    expect(screen.getByText('待審核')).toBeInTheDocument();
  });

  it('絕不顯示內部備註', async () => {
    vi.spyOn(registrationsModule, 'listMyRegistrations').mockResolvedValue([
      makeRegistration(),
    ]);
    renderPage();

    await screen.findByText('林小明');
    expect(screen.queryByText(/這是內部備註/)).not.toBeInTheDocument();
  });

  it('待審核的報名顯示修改與撤回兩個操作', async () => {
    vi.spyOn(registrationsModule, 'listMyRegistrations').mockResolvedValue([
      makeRegistration({ status: 'pending' }),
    ]);
    renderPage();

    expect(await screen.findByRole('link', { name: '修改' })).toHaveAttribute(
      'href',
      '/apply?edit=reg-1'
    );
    expect(screen.getByRole('button', { name: '撤回報名' })).toBeInTheDocument();
  });

  it('已聯絡的報名不給改也不給撤回，改顯示聯絡提示', async () => {
    vi.spyOn(registrationsModule, 'listMyRegistrations').mockResolvedValue([
      makeRegistration({ status: 'contacted' }),
    ]);
    renderPage();

    await screen.findByText('林小明');
    expect(screen.queryByRole('button', { name: '撤回報名' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '修改' })).not.toBeInTheDocument();
    expect(
      screen.getByText(/已進入處理流程，如需異動請聯絡中心/)
    ).toBeInTheDocument();
  });

  it('沒有任何報名時顯示引導文字與報名連結', async () => {
    vi.spyOn(registrationsModule, 'listMyRegistrations').mockResolvedValue([]);
    renderPage();

    expect(await screen.findByText('您還沒有任何報名紀錄')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '立即報名' })).toBeInTheDocument();
  });

  it('學校選自名錄時顯示正規化校名，自由填寫時顯示待確認標記', async () => {
    vi.spyOn(registrationsModule, 'listMyRegistrations').mockResolvedValue([
      makeRegistration({
        id: 'reg-2',
        school_id: null,
        school_name_raw: '某某實驗教育機構',
        school_name: null,
        school_city: null,
        school_level: null,
      }),
    ]);
    renderPage();

    expect(await screen.findByText('某某實驗教育機構')).toBeInTheDocument();
    expect(screen.getByText('學校待確認')).toBeInTheDocument();
  });

  // school_id 有值（家長確實選了名錄裡的學校），但該校後來被下架
  // （is_active = false），schools 的讀取政策擋下、左連接查無資料，
  // school_name 一樣變 null。這批報名跟自由填寫校名一樣需要人工確認，
  // 不能因為 school_id 有值就不顯示待確認標記。
  it('school_id 有值但學校已被停用（school_name 為 null）時仍顯示待確認標記', async () => {
    vi.spyOn(registrationsModule, 'listMyRegistrations').mockResolvedValue([
      makeRegistration({
        school_id: 'school-inactive',
        school_name_raw: null,
        school_name: null,
        school_city: null,
        school_level: null,
      }),
    ]);
    renderPage();

    await screen.findByText('林小明');
    expect(screen.getByText('學校待確認')).toBeInTheDocument();
  });

  it('多筆待審核報名的撤回確認各自獨立，點一筆不影響另一筆', async () => {
    const user = userEvent.setup();
    vi.spyOn(registrationsModule, 'listMyRegistrations').mockResolvedValue([
      makeRegistration({ id: 'reg-1', student_name: '林小明' }),
      makeRegistration({ id: 'reg-2', student_name: '陳小華' }),
    ]);
    renderPage();

    await screen.findByText('林小明');
    const items = screen.getAllByRole('listitem');
    expect(items).toHaveLength(2);

    await user.click(within(items[0]).getByRole('button', { name: '撤回報名' }));

    expect(
      within(items[0]).getByRole('button', { name: '確定撤回' })
    ).toBeInTheDocument();
    expect(
      within(items[0]).getByRole('button', { name: '取消' })
    ).toBeInTheDocument();

    expect(
      within(items[1]).getByRole('link', { name: '修改' })
    ).toBeInTheDocument();
    expect(
      within(items[1]).getByRole('button', { name: '撤回報名' })
    ).toBeInTheDocument();
    expect(
      within(items[1]).queryByRole('button', { name: '確定撤回' })
    ).not.toBeInTheDocument();
  });

  // 最終修正四：deleteRegistration() 會回傳兩種語意不同的錯誤 ——
  // 被列級權限擋下（這筆報名已進入處理流程）跟真正的資料庫錯誤
  // （撤回失敗，請稍後再試）。過去這裡不管收到哪一種都寫死同一句
  // 「已進入處理流程」，資料庫錯誤那種情況會誤導家長去問中心「這筆
  // 到底處理到哪」。改成直接顯示 error 本身的內容，兩種情況各自
  // 驗證一次。
  it('撤回被列級權限擋下時顯示對應錯誤訊息、卡片仍在清單裡、並重新整理清單', async () => {
    const user = userEvent.setup();
    const listSpy = vi
      .spyOn(registrationsModule, 'listMyRegistrations')
      .mockResolvedValueOnce([makeRegistration()])
      .mockResolvedValueOnce([makeRegistration({ status: 'contacted' })]);
    vi.spyOn(registrationsModule, 'deleteRegistration').mockResolvedValue({
      error: '這筆報名已進入處理流程，無法撤回',
    });
    renderPage();

    await screen.findByText('林小明');
    await user.click(screen.getByRole('button', { name: '撤回報名' }));
    await user.click(screen.getByRole('button', { name: '確定撤回' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '這筆報名已進入處理流程，無法撤回'
    );
    expect(screen.getByText('林小明')).toBeInTheDocument();
    expect(listSpy).toHaveBeenCalledTimes(2);
  });

  it('撤回遇到真正的資料庫錯誤時顯示資料層回傳的錯誤訊息，不是寫死的處理流程文字', async () => {
    const user = userEvent.setup();
    vi.spyOn(registrationsModule, 'listMyRegistrations')
      .mockResolvedValueOnce([makeRegistration()])
      .mockResolvedValueOnce([makeRegistration()]);
    vi.spyOn(registrationsModule, 'deleteRegistration').mockResolvedValue({
      error: '撤回失敗，請稍後再試',
    });
    renderPage();

    await screen.findByText('林小明');
    await user.click(screen.getByRole('button', { name: '撤回報名' }));
    await user.click(screen.getByRole('button', { name: '確定撤回' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('撤回失敗，請稍後再試');
    expect(alert).not.toHaveTextContent('已進入處理流程');
  });

  it('撤回成功時卡片從清單消失', async () => {
    const user = userEvent.setup();
    vi.spyOn(registrationsModule, 'listMyRegistrations').mockResolvedValue([
      makeRegistration(),
    ]);
    vi.spyOn(registrationsModule, 'deleteRegistration').mockResolvedValue({
      error: null,
    });
    renderPage();

    await screen.findByText('林小明');
    await user.click(screen.getByRole('button', { name: '撤回報名' }));
    await user.click(screen.getByRole('button', { name: '確定撤回' }));

    expect(await screen.findByText('您還沒有任何報名紀錄')).toBeInTheDocument();
    expect(screen.queryByText('林小明')).not.toBeInTheDocument();
  });

  describe('我的孩子', () => {
    it('列出孩子的姓名、年級與學校', async () => {
      vi.spyOn(registrationsModule, 'listMyRegistrations').mockResolvedValue([]);
      vi.mocked(studentsModule.listMyStudents).mockResolvedValue([makeStudent()]);
      renderPage();

      expect(await screen.findByText('林小明')).toBeInTheDocument();
      expect(screen.getByText(/國小四年級/)).toBeInTheDocument();
      expect(screen.getByText('臺北市立中正國小')).toBeInTheDocument();
    });

    /*
      資料庫的外鍵是 ON DELETE RESTRICT，有報名紀錄的孩子按下刪除只會
      拿到外鍵錯誤。與其讓家長撞牆，不如一開始就不給按。
    */
    it('孩子有報名紀錄時不給刪除，改顯示報名筆數', async () => {
      vi.spyOn(registrationsModule, 'listMyRegistrations').mockResolvedValue([
        makeRegistration({ student_id: 'student-1' }),
      ]);
      vi.mocked(studentsModule.listMyStudents).mockResolvedValue([makeStudent()]);
      renderPage();

      await screen.findByText('已有 1 筆報名紀錄，如需更正請聯繫我們');
      expect(screen.queryByRole('button', { name: '刪除' })).not.toBeInTheDocument();
    });

    it('沒有報名紀錄的孩子才給刪除，而且要二次確認', async () => {
      const user = userEvent.setup();
      vi.spyOn(registrationsModule, 'listMyRegistrations').mockResolvedValue([]);
      vi.mocked(studentsModule.listMyStudents).mockResolvedValue([makeStudent()]);
      const deleteSpy = vi
        .spyOn(studentsModule, 'deleteStudent')
        .mockResolvedValue({ error: null });
      renderPage();

      await user.click(await screen.findByRole('button', { name: '刪除' }));
      // 第一下只是展開確認，不能真的刪 —— 與「撤回報名」是同一套互動
      expect(deleteSpy).not.toHaveBeenCalled();

      await user.click(screen.getByRole('button', { name: '確定刪除' }));
      expect(deleteSpy).toHaveBeenCalledWith('student-1');
    });
  });
});
