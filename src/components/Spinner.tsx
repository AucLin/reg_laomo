/**
 * 轉圈圈。所有等待網路回應的地方都用同一個，家長與行政人員才不會
 * 在不同頁面看到不同的等待樣式。
 *
 * 用 border-current 取色：放在什麼顏色的按鈕上就跟著變色，不必逐處指定。
 */
export default function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="處理中"
      className={`inline-block shrink-0 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`}
    />
  );
}

/** 整頁等待。文字要說明在等什麼，只放一個轉圈圈會讓人不知道卡在哪 */
export function PageLoading({ label = '載入中…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 p-12 text-slate-500">
      <Spinner className="h-5 w-5" />
      <span>{label}</span>
    </div>
  );
}
