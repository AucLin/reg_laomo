import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ContestsPage from '../ContestsPage';
import * as contestsModule from '../../lib/contests';
import * as studentsModule from '../../lib/students';
import * as useAuthModule from '../../auth/useAuth';
import type { Contest, StudentWithSchool } from '../../lib/types';

function makeContest(overrides: Partial<Contest> = {}): Contest {
  return {
    id: 'contest-1',
    title: '全國機器人大賽',
    description: null,
    event_date: '2026-10-01',
    location: '臺北市政府',
    signup_deadline: '2026-09-01',
    capacity: 20,
    min_grade: 'E4',
    max_grade: 'E6',
    status: 'published',
    created_by: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function makeStudent(overrides: Partial<StudentWithSchool> = {}): StudentWithSchool {
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
      <ContestsPage />
    </MemoryRouter>
  );
}

/** 分享連結與預覽走的是帶代碼的路由 */
function renderSingle(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/contests/${id}`]}>
      <Routes>
        <Route path="/contests/:contestId" element={<ContestsPage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ContestsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'parent-1', email: 'parent@example.com' } as never,
      profile: null,
      isAdmin: false,
      loading: false,
      signOut: vi.fn(),
    });
    vi.spyOn(contestsModule, 'listMyEntries').mockResolvedValue([]);
    vi.spyOn(studentsModule, 'listMyStudents').mockResolvedValue([]);
  });

  it('顯示已報名人數與名額上限', async () => {
    vi.spyOn(contestsModule, 'listOpenContests').mockResolvedValue([makeContest()]);
    vi.spyOn(contestsModule, 'getTakenCounts').mockResolvedValue(
      new Map([['contest-1', 12]])
    );
    renderPage();

    expect(await screen.findByText('全國機器人大賽')).toBeInTheDocument();
    expect(screen.getByText('已報名 12 / 20 人')).toBeInTheDocument();
  });

  /*
    真正的把關在資料庫的 enter_contest()，前端這一層只是讓家長不必送出
    才知道。兩邊的年級判斷必須得出同樣的結論。
  */
  it('年級不符的孩子不給報名按鈕', async () => {
    const user = userEvent.setup();
    vi.spyOn(contestsModule, 'listOpenContests').mockResolvedValue([makeContest()]);
    vi.spyOn(contestsModule, 'getTakenCounts').mockResolvedValue(new Map());
    vi.mocked(studentsModule.listMyStudents).mockResolvedValue([
      makeStudent({ id: 'student-1', name: '林小明', grade: 'E4' }),
      makeStudent({ id: 'student-2', name: '林小華', grade: 'E2' }),
    ]);
    renderPage();

    await user.click(await screen.findByRole('button', { name: '我要報名' }));

    // 國小四年級在 E4–E6 之內
    expect(await screen.findByRole('button', { name: '報名' })).toBeInTheDocument();
    // 國小二年級不在範圍內
    expect(screen.getByText('年級不符')).toBeInTheDocument();
  });

  /*
    預覽草稿走的是家長看到的同一頁：管理員讀得到草稿（列級權限給的），
    家長讀不到會拿到 null。所以帶代碼的路由不能篩狀態，要直接讀那一場。
  */
  it('帶代碼進來時直接讀那一場，草稿也讀得到（管理員預覽）', async () => {
    vi.spyOn(contestsModule, 'getContest').mockResolvedValue(
      makeContest({ status: 'draft' })
    );
    vi.spyOn(contestsModule, 'getTakenCounts').mockResolvedValue(new Map());
    const listSpy = vi.spyOn(contestsModule, 'listOpenContests');

    renderSingle('contest-1');

    expect(await screen.findByText('全國機器人大賽')).toBeInTheDocument();
    expect(screen.getByText('草稿')).toBeInTheDocument();
    expect(screen.getByText(/家長打開這個連結會看到/)).toBeInTheDocument();
    // 篩狀態的那條路會把草稿濾掉，預覽就看不到了
    expect(listSpy).not.toHaveBeenCalled();
  });

  it('連結指到讀不到的比賽時說找不到，不是顯示空白', async () => {
    vi.spyOn(contestsModule, 'getContest').mockResolvedValue(null);
    vi.spyOn(contestsModule, 'getTakenCounts').mockResolvedValue(new Map());

    renderSingle('contest-missing');

    expect(
      await screen.findByText('找不到這場比賽，可能尚未開放或已經結束')
    ).toBeInTheDocument();
  });

  it('額滿的比賽不給報名', async () => {
    vi.spyOn(contestsModule, 'listOpenContests').mockResolvedValue([
      makeContest({ capacity: 20 }),
    ]);
    vi.spyOn(contestsModule, 'getTakenCounts').mockResolvedValue(
      new Map([['contest-1', 20]])
    );
    renderPage();

    expect(await screen.findByText('已額滿')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '我要報名' })).not.toBeInTheDocument();
  });
});
