import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';
import { deleteRegistration, listMyRegistrations } from '../lib/registrations';
import { formatGrade, type RegistrationWithSchool } from '../lib/types';

const CENTER_PHONE = '02-1234-5678';

export default function MyRegistrationsPage() {
  const [registrations, setRegistrations] = useState<RegistrationWithSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  useEffect(() => {
    listMyRegistrations()
      .then(setRegistrations)
      .finally(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    const { error } = await deleteRegistration(id);
    if (!error) {
      setRegistrations((current) => current.filter((item) => item.id !== id));
    }
    setConfirmingId(null);
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">載入中…</div>;
  }

  if (registrations.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <p className="text-slate-600">您還沒有任何報名紀錄</p>
        <Link
          to="/apply"
          className="mt-4 inline-block rounded-xl bg-brand-600 px-6 py-3 font-semibold text-white transition hover:bg-brand-700"
        >
          立即報名
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">我的報名</h1>
        <Link
          to="/apply"
          className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          再報名一位孩子
        </Link>
      </div>

      <ul className="mt-6 space-y-4">
        {registrations.map((registration) => (
          <li
            key={registration.id}
            className="rounded-2xl bg-white p-5 shadow-sm sm:p-6"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {registration.student_name}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {registration.school_name ?? registration.school_name_raw}
                  {!registration.school_id && (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      學校待確認
                    </span>
                  )}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {formatGrade(registration.grade)}
                  {registration.class_name && ` · ${registration.class_name}`}
                </p>
              </div>
              <StatusBadge status={registration.status} />
            </div>

            <p className="mt-4 text-xs text-slate-400">
              送出時間：
              {new Date(registration.created_at).toLocaleString('zh-TW')}
            </p>

            {/* 待審核才給改動。這與資料庫的列級權限一致 ——
                介面不提供的操作，資料庫層也一併擋住。 */}
            {registration.status === 'pending' ? (
              <div className="mt-4 flex gap-3">
                {confirmingId === registration.id ? (
                  <>
                    <button
                      type="button"
                      onClick={() => handleDelete(registration.id)}
                      className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700"
                    >
                      確定撤回
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      取消
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to={`/apply?edit=${registration.id}`}
                      className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 transition hover:bg-brand-50"
                    >
                      修改
                    </Link>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(registration.id)}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      撤回報名
                    </button>
                  </>
                )}
              </div>
            ) : (
              <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-500">
                已進入處理流程，如需異動請聯絡中心：{CENTER_PHONE}
              </p>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
