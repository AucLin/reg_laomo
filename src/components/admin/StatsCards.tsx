interface Props {
  stats: { thisMonth: number; pending: number; contacted: number; enrolled: number };
}

export default function StatsCards({ stats }: Props) {
  const cards = [
    { label: '本月報名', value: stats.thisMonth, tone: 'text-brand-600' },
    { label: '待審核', value: stats.pending, tone: 'text-amber-600' },
    { label: '已聯絡', value: stats.contacted, tone: 'text-blue-600' },
    { label: '已錄取', value: stats.enrolled, tone: 'text-emerald-600' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">{card.label}</p>
          <p className={`mt-1 text-2xl font-bold ${card.tone}`}>{card.value}</p>
        </div>
      ))}
    </div>
  );
}
