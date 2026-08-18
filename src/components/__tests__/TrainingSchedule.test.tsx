import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import TrainingSchedule from '../TrainingSchedule';
import * as trainingModule from '../../lib/training';
import * as contestsModule from '../../lib/contests';
import type {
  Contest,
  ContestEntry,
  TrainingAttendance,
  TrainingSession,
} from '../../lib/types';

const CONTEST: Contest = {
  id: 'contest-1',
  title: 'WRO 2026',
  description: null,
  event_date: '2026-10-01',
  location: '台北',
  signup_deadline: '2026-09-01',
  capacity: null,
  min_grade: 'E1',
  max_grade: 'S3',
  status: 'published',
  created_by: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

function makeEntry(overrides: Partial<ContestEntry> = {}): ContestEntry {
  return {
    id: 'entry-1',
    contest_id: 'contest-1',
    student_id: 'student-1',
    parent_id: 'parent-1',
    grade: 'E4',
    student_name: '林小明',
    status: 'enrolled',
    admin_note: null,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

/** 未來的場次，家長還改得動 */
const FUTURE_SESSION: TrainingSession = {
  id: 'session-1',
  contest_id: 'contest-1',
  session_date: '2099-09-06',
  start_time: '09:00:00',
  end_time: '11:00:00',
  location: null,
  note: null,
  created_at: '2026-08-01T00:00:00Z',
  updated_at: '2026-08-01T00:00:00Z',
};

function makeMark(
  status: TrainingAttendance['status'],
  overrides: Partial<TrainingAttendance> = {}
): TrainingAttendance {
  return {
    id: 'att-1',
    session_id: 'session-1',
    entry_id: 'entry-1',
    status,
    created_at: '2026-08-01T00:00:00Z',
    updated_at: '2026-08-01T00:00:00Z',
    ...overrides,
  };
}

function setup({
  sessions = [FUTURE_SESSION],
  entries = [makeEntry()],
  marks = [] as TrainingAttendance[],
} = {}) {
  vi.spyOn(trainingModule, 'listMySessions').mockResolvedValue(sessions);
  vi.spyOn(trainingModule, 'listMyAttendance').mockResolvedValue(marks);
  vi.spyOn(contestsModule, 'listMyEntries').mockResolvedValue(entries);
  vi.spyOn(contestsModule, 'listOpenContests').mockResolvedValue([CONTEST]);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(trainingModule, 'signupTraining').mockResolvedValue({ error: null });
  vi.spyOn(trainingModule, 'cancelTrainingSignup').mockResolvedValue({ error: null });
});

describe('TrainingSchedule', () => {
  it('列出場次與孩子', async () => {
    setup();
    render(<TrainingSchedule />);

    expect(await screen.findByText(/9\/6/)).toBeInTheDocument();
    expect(screen.getByText('林小明')).toBeInTheDocument();
  });

  it('還沒挑的時段給「這場要來」，按下去就挑起來', async () => {
    setup();
    const user = userEvent.setup();
    render(<TrainingSchedule />);

    await user.click(await screen.findByRole('button', { name: '這場要來' }));

    expect(trainingModule.signupTraining).toHaveBeenCalledWith('session-1', 'entry-1');
  });

  it('挑過的時段標「會來」，按鈕變成取消', async () => {
    setup({ marks: [makeMark('signed_up')] });
    const user = userEvent.setup();
    render(<TrainingSchedule />);

    expect(await screen.findByText('會來')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '取消' }));

    expect(trainingModule.cancelTrainingSignup).toHaveBeenCalledWith(
      'session-1',
      'entry-1'
    );
  });

  /*
    課開始後資料庫也擋著，這裡先把按鈕收起來，免得家長按了才被拒絕。
  */
  it('已經開始的場次不給改', async () => {
    setup({
      sessions: [{ ...FUTURE_SESSION, session_date: '2020-01-01' }],
    });
    render(<TrainingSchedule />);

    await screen.findByText('林小明');
    expect(screen.queryByRole('button', { name: '這場要來' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
  });

  /*
    點名結果是上課當天的事實，家長只能看。這裡連取消鈕都不該出現 ——
    出現了也按不動（資料庫擋），只會讓家長以為自己弄壞了什麼。
  */
  it('點過名的場次只顯示結果，沒有可以按的東西', async () => {
    setup({ marks: [makeMark('present')] });
    render(<TrainingSchedule />);

    expect(await screen.findByText('已到')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
  });

  /*
    集訓是錄取之後的事。還在審核的孩子挑了也會被資料庫擋，不如不要
    給按 —— 家長只會看到一句莫名其妙的錯誤訊息。
  */
  it('還沒錄取的孩子不出現在時間表上', async () => {
    setup({ entries: [makeEntry({ status: 'pending' })] });
    const { container } = render(<TrainingSchedule />);

    await waitFor(() => {
      expect(container.querySelector('section')).toBeNull();
    });
  });

  it('挑選失敗時把資料庫的說法顯示出來', async () => {
    setup();
    vi.spyOn(trainingModule, 'signupTraining').mockResolvedValue({
      error: '這個場次已經開始，請直接聯繫我們',
    });
    const user = userEvent.setup();
    render(<TrainingSchedule />);

    await user.click(await screen.findByRole('button', { name: '這場要來' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      '這個場次已經開始，請直接聯繫我們'
    );
  });

  /*
    家長最常問的是「我挑完了嗎」。這個數字就是答案，一個都沒挑時
    講得更直白，因為那通常代表他還沒動手，不是他決定都不來。
  */
  it('數出自己挑了幾個時段', async () => {
    setup({
      sessions: [FUTURE_SESSION, { ...FUTURE_SESSION, id: 'session-2' }],
      marks: [makeMark('signed_up'), makeMark('signed_up', { id: 'att-2', session_id: 'session-2' })],
    });
    render(<TrainingSchedule />);

    expect(await screen.findByText('已挑 2 個時段')).toBeInTheDocument();
  });

  it('一個都沒挑時說得直白一點', async () => {
    setup();
    render(<TrainingSchedule />);

    expect(await screen.findByText('還沒挑任何時段')).toBeInTheDocument();
  });

  /*
    點名結果不算「挑了」—— 那是上課當天的事實，不是家長還能改的選擇。
  */
  it('點過名的場次不算進已挑的時段', async () => {
    setup({ marks: [makeMark('present')] });
    render(<TrainingSchedule />);

    expect(await screen.findByText('還沒挑任何時段')).toBeInTheDocument();
  });

  it('沒排集訓時整區不顯示，不留一塊空白', async () => {
    setup({ sessions: [] });
    const { container } = render(<TrainingSchedule />);

    await waitFor(() => {
      expect(container.querySelector('section')).toBeNull();
    });
  });
});
