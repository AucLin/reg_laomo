import { CalendarPlus, CheckCircle2, Clock, PhoneCall } from 'lucide-react';

interface Props {
  stats: { thisMonth: number; pending: number; contacted: number; enrolled: number };
}

/*
  四張卡片原本只有數字顏色不同，標題又都是同一種灰，掃過去像同一個東西
  重複四次。給每張一個圖示與對應色系的圓底，顏色就有了圖形去掛，不必
  讀完文字才知道自己在看哪一格。

  色系跟狀態徽章（StatusBadge）用同一套：待審核琥珀、已聯絡藍、已錄取
  綠。管理員在同一頁上看到的同一個狀態，兩處顏色要對得起來。
*/
const CARDS = [
  { key: 'thisMonth', label: '本月報名', icon: CalendarPlus, value: 'text-brand-600', chip: 'bg-brand-50 text-brand-600' },
  { key: 'pending', label: '待審核', icon: Clock, value: 'text-amber-600', chip: 'bg-amber-50 text-amber-600' },
  { key: 'contacted', label: '已聯絡', icon: PhoneCall, value: 'text-blue-600', chip: 'bg-blue-50 text-blue-600' },
  { key: 'enrolled', label: '已錄取', icon: CheckCircle2, value: 'text-emerald-600', chip: 'bg-emerald-50 text-emerald-600' },
] as const;

export default function StatsCards({ stats }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/80"
        >
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${card.chip}`}
          >
            <card.icon className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm text-slate-500">{card.label}</p>
            <p className={`text-2xl font-bold ${card.value}`}>{stats[card.key]}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
