import type { ReactNode } from 'react';

/*
  後台每一頁的標題列。

  原本標題直接浮在灰底上，跟底下的統計卡片、篩選、表格擠在同一片背景裡，
  沒有東西告訴眼睛「上面是這一頁的身分與動作，下面才是資料」。抽成白色
  的一條，深色側邊欄、白色標題列、灰底資料區三層就分得開了。

  三頁共用同一個元件，順便讓標題的字級與按鈕位置不會各寫各的。
*/
interface Props {
  title: string;
  /** 這一頁在做什麼。只有需要解釋的頁面才給，例如集訓管理 */
  description?: string;
  /** 對「這一頁」做的事，例如匯出 CSV、新增比賽。換頁的入口一律在側邊欄 */
  action?: ReactNode;
  /**
   * 內容容器的寬度，要跟頁面本體用同一個值，標題才會跟底下的卡片對齊。
   * 報名管理的表格欄位多用 max-w-7xl，比賽與集訓是卡片流用 max-w-5xl。
   */
  maxWidth?: string;
}

export default function AdminPageHeader({
  title,
  description,
  action,
  maxWidth = 'max-w-7xl',
}: Props) {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div
        className={`mx-auto flex ${maxWidth} flex-wrap items-center justify-between gap-4 px-4 py-5`}
      >
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          )}
        </div>
        {action}
      </div>
    </header>
  );
}
