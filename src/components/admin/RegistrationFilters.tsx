import { Search, X } from 'lucide-react';
import {
  SCHOOL_LEVEL_LABELS,
  STATUS_LABELS,
  getGradeOptions,
  type RegistrationStatus,
  type SchoolLevel,
} from '../../lib/types';
import type { AdminFilters } from '../../lib/adminRegistrations';

interface Props {
  value: AdminFilters;
  onChange: (next: AdminFilters) => void;
}

export default function RegistrationFilters({ value, onChange }: Props) {
  function update(patch: Partial<AdminFilters>) {
    onChange({ ...value, ...patch });
  }

  const gradeOptions =
    value.level === '' ? [] : getGradeOptions(value.level as SchoolLevel);

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm sm:p-5">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="filter-level" className="block text-sm font-medium text-slate-700">
            學校級別
          </label>
          <select
            id="filter-level"
            value={value.level}
            onChange={(event) =>
              // 換級別時年級一定要清掉，否則會留下「國小 + J1」這種查不到東西的組合
              update({ level: event.target.value as SchoolLevel | '', grade: '' })
            }
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">全部</option>
            {(Object.keys(SCHOOL_LEVEL_LABELS) as SchoolLevel[]).map((level) => (
              <option key={level} value={level}>
                {SCHOOL_LEVEL_LABELS[level]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-grade" className="block text-sm font-medium text-slate-700">
            年級
          </label>
          <select
            id="filter-grade"
            value={value.grade}
            disabled={value.level === ''}
            onChange={(event) => update({ grade: event.target.value })}
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-100"
          >
            <option value="">全部</option>
            {gradeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-status" className="block text-sm font-medium text-slate-700">
            狀態
          </label>
          <select
            id="filter-status"
            value={value.status}
            onChange={(event) =>
              update({ status: event.target.value as RegistrationStatus | '' })
            }
            className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">全部</option>
            {(Object.keys(STATUS_LABELS) as RegistrationStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-keyword" className="block text-sm font-medium text-slate-700">
            搜尋
          </label>
          <div className="relative mt-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              id="filter-keyword"
              type="text"
              value={value.keyword}
              onChange={(event) => update({ keyword: event.target.value })}
              placeholder="學生／家長姓名、電話"
              className="w-full rounded-xl border border-slate-300 py-2 pl-9 pr-3 text-sm"
            />
          </div>
        </div>
      </div>

      {/* 預設篩在雙北，必須明講，否則行政人員會以為系統裡只有這些報名 */}
      {value.cities.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2">
          <span className="text-sm text-amber-800">
            目前依縣市篩選：{value.cities.join('、')}
          </span>
          <button
            type="button"
            onClick={() => update({ cities: [] })}
            className="inline-flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-medium text-amber-800 transition hover:bg-amber-100"
          >
            <X className="h-3 w-3" />
            顯示全部縣市
          </button>
        </div>
      )}
    </div>
  );
}
