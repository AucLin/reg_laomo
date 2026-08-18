import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  filterUsers,
  listRegistrationsOf,
  listStudentsOf,
  listUsers,
  type AdminUserRow,
} from '../adminUsers';

const builder = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
};

const rpc = vi.fn((_name: string) => ({ data: [], error: null }) as unknown);
const from = vi.fn((_table: string) => builder);

vi.mock('../supabase', () => ({
  supabase: {
    rpc: (name: string) => rpc(name),
    from: (table: string) => from(table),
  },
}));

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
  for (const key of Object.keys(builder) as (keyof typeof builder)[]) {
    builder[key].mockClear();
    builder[key].mockReturnValue(builder);
  }
  rpc.mockClear();
  from.mockClear().mockReturnValue(builder);
});

describe('listUsers', () => {
  /*
    信箱在 auth.users，前端的 anon 金鑰查不到那張表，只能走
    list_users() 這支 SECURITY DEFINER 函式。改成直接查 profiles
    的話信箱會整欄不見，所以這條斷言盯著呼叫方式本身。
  */
  it('走 list_users() 函式，不是直接查 profiles', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    await listUsers();
    expect(rpc).toHaveBeenCalledWith('list_users');
    expect(from).not.toHaveBeenCalled();
  });

  it('查詢出錯時回空陣列，不讓整頁壞掉', async () => {
    rpc.mockResolvedValue({ data: null, error: { message: '壞了' } });
    expect(await listUsers()).toEqual([]);
  });
});

describe('listStudentsOf', () => {
  /*
    這裡跟家長端的 listMyStudents() 不同：那邊靠列級權限自動只回自己的，
    這邊管理員讀得到全部，漏掉 parent_id 條件就會把所有人的孩子都撈出來
    掛在同一個家長名下。
  */
  it('限定這個家長的孩子', async () => {
    builder.order.mockResolvedValue({ data: [], error: null });
    await listStudentsOf('parent-1');
    expect(from).toHaveBeenCalledWith('students_with_school');
    expect(builder.eq).toHaveBeenCalledWith('parent_id', 'parent-1');
  });

  it('查詢出錯時回空陣列', async () => {
    builder.order.mockResolvedValue({ data: null, error: { message: '壞了' } });
    expect(await listStudentsOf('parent-1')).toEqual([]);
  });
});

describe('listRegistrationsOf', () => {
  it('限定這個家長的報名，新的排前面', async () => {
    builder.order.mockResolvedValue({ data: [], error: null });
    await listRegistrationsOf('parent-1');
    expect(from).toHaveBeenCalledWith('registrations_with_school');
    expect(builder.eq).toHaveBeenCalledWith('parent_id', 'parent-1');
    expect(builder.order).toHaveBeenCalledWith('created_at', { ascending: false });
  });
});

describe('filterUsers', () => {
  const users = [
    makeUser({ id: 'a', full_name: '林大明', email: 'Ming@Example.com', phone: '0912345678' }),
    makeUser({ id: 'b', full_name: '陳小華', email: 'hua@example.com', phone: '0987654321' }),
  ];

  it('關鍵字留空時回全部', () => {
    expect(filterUsers(users, '')).toHaveLength(2);
    expect(filterUsers(users, '   ')).toHaveLength(2);
  });

  it('比對姓名', () => {
    expect(filterUsers(users, '大明').map((u) => u.id)).toEqual(['a']);
  });

  it('比對電話', () => {
    expect(filterUsers(users, '0987').map((u) => u.id)).toEqual(['b']);
  });

  /*
    家長報上來的信箱大小寫常常跟註冊時不一樣，行政人員照著抄就搜不到。
  */
  it('比對信箱時忽略大小寫', () => {
    expect(filterUsers(users, 'ming@example.com').map((u) => u.id)).toEqual(['a']);
    expect(filterUsers(users, 'MING').map((u) => u.id)).toEqual(['a']);
  });

  it('沒有符合的就回空陣列', () => {
    expect(filterUsers(users, '查無此人')).toEqual([]);
  });
});
