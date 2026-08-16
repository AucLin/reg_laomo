import { useCallback, useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import RegistrationFilters from '../components/admin/RegistrationFilters';
import RegistrationTable from '../components/admin/RegistrationTable';
import RegistrationDetail from '../components/admin/RegistrationDetail';
import StatsCards from '../components/admin/StatsCards';
import {
  EMPTY_FILTERS,
  PAGE_SIZE,
  getStats,
  listAllForExport,
  listRegistrations,
  type AdminFilters,
} from '../lib/adminRegistrations';
import { updateRegistrationStatus } from '../lib/registrations';
import { downloadCsv, toCsv } from '../lib/csv';
import type { RegistrationStatus, RegistrationWithSchool } from '../lib/types';

export default function AdminPage() {
  const [filters, setFilters] = useState<AdminFilters>(EMPTY_FILTERS);
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState<RegistrationWithSchool[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState({
    thisMonth: 0,
    pending: 0,
    contacted: 0,
    enrolled: 0,
  });
  const [selected, setSelected] = useState<RegistrationWithSchool | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [list, nextStats] = await Promise.all([
      listRegistrations(filters, page),
      getStats(),
    ]);
    setRows(list.rows);
    setTotal(list.total);
    setStats(nextStats);
    setLoading(false);
  }, [filters, page]);

  useEffect(() => {
    load();
  }, [load]);

  function handleFiltersChange(next: AdminFilters) {
    // 換條件後留在第 3 頁會看到空白，一律回第一頁
    setPage(0);
    setFilters(next);
  }

  async function handleSaved(
    id: string,
    status: RegistrationStatus,
    adminNote: string
  ) {
    const { error } = await updateRegistrationStatus(id, status, adminNote);
    if (!error) {
      setSelected(null);
      await load();
    }
  }

  async function handleExport() {
    // 匯出的是目前篩選條件下的全部資料，不是當頁的 25 筆
    const all = await listAllForExport(filters);
    const stamp = new Date().toISOString().slice(0, 10);
    downloadCsv(toCsv(all), `老莫報名資料_${stamp}.csv`);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-900">報名管理</h1>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <Download className="h-4 w-4" />
          匯出 CSV
        </button>
      </div>

      <div className="mt-6">
        <StatsCards stats={stats} />
      </div>

      <div className="mt-4">
        <RegistrationFilters value={filters} onChange={handleFiltersChange} />
      </div>

      <div className="mt-4">
        {loading ? (
          <p className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
            載入中…
          </p>
        ) : (
          <RegistrationTable rows={rows} onSelect={setSelected} />
        )}
      </div>

      {total > PAGE_SIZE && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage((current) => current - 1)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-40"
          >
            上一頁
          </button>
          <span className="text-sm text-slate-500">
            第 {page + 1} / {totalPages} 頁，共 {total} 筆
          </span>
          <button
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:opacity-40"
          >
            下一頁
          </button>
        </div>
      )}

      {selected && (
        <RegistrationDetail
          registration={selected}
          onClose={() => setSelected(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
