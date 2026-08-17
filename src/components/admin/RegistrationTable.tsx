import { ChevronRight } from 'lucide-react';
import StatusBadge from '../StatusBadge';
import { formatGrade, type AdminRegistrationRow } from '../../lib/types';

interface Props {
  rows: AdminRegistrationRow[];
  onSelect: (registration: AdminRegistrationRow) => void;
}

export default function RegistrationTable({ rows, onSelect }: Props) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
        沒有符合條件的報名資料
      </p>
    );
  }

  return (
    <>
      {/* 手機：卡片 */}
      <ul className="space-y-3 lg:hidden">
        {rows.map((row) => (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onSelect(row)}
              className="w-full rounded-2xl bg-white p-4 text-left shadow-sm ring-1 ring-slate-200/80 transition hover:shadow"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-900">{row.student_name}</p>
                  <p className="mt-1 text-sm text-slate-600">
                    {row.school_name ?? row.school_name_raw}
                    {/* 用 school_name 判斷，不是 school_id：school_id 有值
                        不代表校名解析得出來，該校若被停用一樣需要人工確認 */}
                    {!row.school_name && (
                      <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                        待確認
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatGrade(row.grade)} · {row.parent_name} · {row.contact_phone}
                  </p>
                </div>
                <StatusBadge status={row.status} />
              </div>
            </button>
          </li>
        ))}
      </ul>

      {/* 桌機：表格 */}
      <div className="hidden overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/80 lg:block">
        <table className="w-full text-sm">
          {/*
            表頭給底色，不然它跟資料列一樣是白底、只差文字顏色，
            掃視時看不出哪一行是欄位名稱。
          */}
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-xs tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">送出時間</th>
              <th className="px-4 py-3 font-semibold">學生姓名</th>
              <th className="px-4 py-3 font-semibold">就讀學校</th>
              <th className="px-4 py-3 font-semibold">年級</th>
              <th className="px-4 py-3 font-semibold">家長</th>
              <th className="px-4 py-3 font-semibold">聯絡電話</th>
              <th className="px-4 py-3 text-right font-semibold">狀態</th>
              {/* 只是給「這一列可以點」的視覺暗示，沒有內容要念 */}
              <th className="w-10" aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              /*
                斑馬紋而不是分隔線：欄位有七個，眼睛從最左的姓名滑到最右的
                狀態很容易串到隔壁列，整列底色是唯一能把一列綁在一起的線索。
                hover 用品牌色才不會跟偶數列的灰底混在一起。
              */
              <tr
                key={row.id}
                onClick={() => onSelect(row)}
                className="group cursor-pointer transition even:bg-slate-50/70 hover:bg-brand-50"
              >
                <td className="whitespace-nowrap px-4 py-3 text-slate-500">
                  {new Date(row.created_at).toLocaleDateString('zh-TW')}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {row.student_name}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {row.school_name ?? row.school_name_raw}
                  {!row.school_name && (
                    <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800">
                      待確認
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {formatGrade(row.grade)}
                </td>
                <td className="px-4 py-3 text-slate-600">{row.parent_name}</td>
                <td className="whitespace-nowrap px-4 py-3 tabular-nums text-slate-600">
                  {row.contact_phone}
                </td>
                <td className="px-4 py-3 text-right">
                  <StatusBadge status={row.status} />
                </td>
                <td className="pr-4 text-right">
                  <ChevronRight
                    aria-hidden="true"
                    className="inline h-4 w-4 text-slate-300 transition group-hover:text-brand-500"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
