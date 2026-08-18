export interface JumpTarget {
  /** 目標區塊的 id，要跟頁面上那一段的 id 對上 */
  id: string;
  label: string;
  /** 這一區有幾筆。0 也照樣寫出來 —— 「還沒有」本身就是資訊 */
  count: number;
  /** 有事情等著家長動手，例如「2 場待挑」 */
  todo?: string;
}

/*
  頁面頂端的快速跳。

  家長這一頁三段疊起來就兩三個螢幕高，而最需要他動手的那一段（挑集訓
  時段）排在最下面 —— 沒捲到底就不知道有事要做。這一條把三段攤在眼前，
  順便把「還有幾場沒挑」講在最上面。

  沒有做成側邊欄：家長一個月才用一兩次，手機上收進漢堡選單的東西他們
  記不住裡面有什麼。攤開來反而少一層。
*/
export default function PageJumpBar({ targets }: { targets: JumpTarget[] }) {
  if (targets.length === 0) return null;

  function jump(id: string) {
    // 那一區可能整個沒渲染（例如沒排集訓），找不到就什麼都不做
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav
      aria-label="快速跳到"
      className="sticky top-0 z-20 -mx-4 border-b border-slate-200/70 bg-paper/95 px-4 py-2 backdrop-blur"
    >
      {/* 手機上放不下就橫著捲，不換行也不藏起來 */}
      <ul className="flex gap-2 overflow-x-auto">
        {targets.map((target) => (
          <li key={target.id} className="shrink-0">
            <button
              type="button"
              onClick={() => jump(target.id)}
              className="inline-flex min-h-[2.25rem] items-center gap-1.5 rounded-[1rem_0.8rem_1.05rem_0.85rem] border-2 border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:border-brand-300 hover:text-brand-700"
            >
              {target.label}
              <span className="tabular-nums text-xs text-slate-400">{target.count}</span>
              {target.todo && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
                  {target.todo}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
