import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import AdminPageHeader from '../components/admin/AdminPageHeader';
import Spinner, { PageLoading } from '../components/Spinner';
import StatusBadge from '../components/StatusBadge';
import { useImeGuardedInput } from '../lib/hooks/useImeGuardedInput';
import {
  filterUsers,
  listRegistrationsOf,
  listStudentsOf,
  listUsers,
  type AdminUserRow,
} from '../lib/adminUsers';
import { formatGrade, type RegistrationWithSchool, type StudentWithSchool } from '../lib/types';

/*
  家長帳號名冊。

  這一頁只看不改。角色（家長／管理員）不開放在畫面上調整 —— 管理員就
  那兩三位而且是固定的，為了一年用不到一次的操作擺一顆會把人降級的
  按鈕，風險遠大於方便。真要改就下一行 SQL。

  刪帳號也不做：家長的報名紀錄掛在帳號底下，刪掉等於讓那些報名變成
  孤兒，得先想清楚報名怎麼辦才談得上刪。
*/

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('zh-TW');
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    listUsers()
      .then(setUsers)
      .finally(() => setLoading(false));
  }, []);

  /*
    搜尋框的顯示與過濾要分開：draft 跟著使用者打的字走（含還沒選字的
    注音），組字結束才拿去過濾。少了這一層，中文根本打不進去。
  */
  const [draft, setDraft] = useState('');
  const keywordIme = useImeGuardedInput((next, { composing }) => {
    setDraft(next);
    if (!composing) setKeyword(next);
  });

  const shown = useMemo(() => filterUsers(users, keyword), [users, keyword]);

  if (loading) return <PageLoading label="正在讀取帳號…" />;

  return (
    <>
      <AdminPageHeader
        title="家長帳號"
        description="誰註冊了、怎麼聯絡得上、名下有哪些孩子與報名。"
        maxWidth="max-w-5xl"
      />

      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80">
          <label htmlFor="user-search" className="block text-sm font-medium text-slate-700">
            搜尋
          </label>
          <div className="relative mt-1">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            />
            <input
              id="user-search"
              type="search"
              value={draft}
              onChange={keywordIme.onChange}
              onCompositionStart={keywordIme.onCompositionStart}
              onCompositionEnd={keywordIme.onCompositionEnd}
              placeholder="姓名、信箱、電話"
              className="w-full rounded-xl border border-slate-300 py-2.5 pl-9 pr-3 text-base outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            />
          </div>
          <p className="mt-2 text-sm text-slate-500">
            {keyword === ''
              ? `共 ${users.length} 個帳號`
              : `符合的有 ${shown.length} 個，共 ${users.length} 個帳號`}
          </p>
        </div>

        {shown.length === 0 ? (
          <p className="mt-4 rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm ring-1 ring-slate-200/80">
            沒有符合的帳號
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {shown.map((user) => (
              <li
                key={user.id}
                className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80"
              >
                <button
                  type="button"
                  onClick={() =>
                    setExpandedId((current) => (current === user.id ? null : user.id))
                  }
                  aria-expanded={expandedId === user.id}
                  className="flex w-full items-start justify-between gap-3 p-5 text-left"
                >
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-slate-900">
                        {user.full_name || '（沒有填姓名）'}
                      </span>
                      {user.role === 'admin' && (
                        <span className="rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-800">
                          管理員
                        </span>
                      )}
                      {/* 沒點驗證信的帳號登不進來。家長打電話說「登不進去」
                          時，這個標記就是答案 */}
                      {user.email_confirmed_at === null && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                          信箱未驗證
                        </span>
                      )}
                    </p>
                    <p className="mt-1 break-words text-sm text-slate-600">
                      {user.email}
                      {user.phone && <span className="text-slate-400"> · </span>}
                      <span className="tabular-nums">{user.phone}</span>
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDate(user.created_at)} 註冊 ·{' '}
                      {user.last_sign_in_at
                        ? `最後登入 ${formatDate(user.last_sign_in_at)}`
                        : '從未登入'}
                    </p>
                  </div>
                  <ChevronDown
                    aria-hidden="true"
                    className={`mt-1 h-5 w-5 shrink-0 text-slate-400 transition ${
                      expandedId === user.id ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedId === user.id && <UserDetail parentId={user.id} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

/*
  展開後才去查孩子與報名。名冊上每個帳號都先撈一次的話，四十個家長就是
  八十次查詢，而行政人員一次只會看其中一兩個。
*/
function UserDetail({ parentId }: { parentId: string }) {
  const [students, setStudents] = useState<StudentWithSchool[]>([]);
  const [registrations, setRegistrations] = useState<RegistrationWithSchool[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    Promise.all([listStudentsOf(parentId), listRegistrationsOf(parentId)]).then(
      ([foundStudents, foundRegistrations]) => {
        // 展開後馬上收起再展開別人時，慢回來的那次不能蓋掉新的結果
        if (cancelled) return;
        setStudents(foundStudents);
        setRegistrations(foundRegistrations);
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
    };
  }, [parentId]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 border-t border-slate-100 px-5 py-4 text-sm text-slate-600">
        <Spinner />
        正在讀取…
      </p>
    );
  }

  return (
    <div className="space-y-4 border-t border-slate-100 px-5 py-4">
      <section>
        <h3 className="text-sm font-semibold text-slate-700">
          孩子（{students.length}）
        </h3>
        {students.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">還沒有建立孩子的資料</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {students.map((student) => (
              <li key={student.id} className="text-sm text-slate-600">
                <span className="font-medium text-slate-800">{student.name}</span>
                {' · '}
                {formatGrade(student.grade)}
                {' · '}
                {/* 自由填寫校名的孩子在名錄裡對不到，退回家長打的字 */}
                {student.school_name ?? student.school_name_raw ?? '未填學校'}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-slate-700">
          課程報名（{registrations.length}）
        </h3>
        {registrations.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">還沒有送出過報名</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {registrations.map((registration) => (
              <li
                key={registration.id}
                className="flex flex-wrap items-center gap-2 text-sm text-slate-600"
              >
                <span className="tabular-nums text-slate-500">
                  {formatDate(registration.created_at)}
                </span>
                <span className="font-medium text-slate-800">
                  {registration.student_name}
                </span>
                <StatusBadge status={registration.status} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
