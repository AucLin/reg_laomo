import { useState } from 'react';
import { X } from 'lucide-react';
import {
  GENDER_LABELS,
  RELATION_LABELS,
  STATUS_LABELS,
  formatGrade,
  type RegistrationStatus,
  type RegistrationWithSchool,
} from '../../lib/types';
import { useImeGuardedInput } from '../../lib/hooks/useImeGuardedInput';

interface Props {
  registration: RegistrationWithSchool;
  onClose: () => void;
  onSaved: (
    id: string,
    status: RegistrationStatus,
    adminNote: string
  ) => Promise<void>;
  /** 儲存失敗時由 AdminPage 傳入的錯誤訊息，undefined／null 代表沒有錯誤 */
  error?: string | null;
}

export default function RegistrationDetail({
  registration,
  onClose,
  onSaved,
  error,
}: Props) {
  const [status, setStatus] = useState<RegistrationStatus>(registration.status);
  const [note, setNote] = useState(registration.admin_note ?? '');
  const [saving, setSaving] = useState(false);

  // 內部備註是中文輸入框，比照 RegistrationFilters.tsx 的搜尋框，
  // 用共用的 useImeGuardedInput 擋掉注音／倉頡組字期間的半成品。
  const noteIme = useImeGuardedInput<HTMLTextAreaElement>(setNote);

  async function handleSave() {
    setSaving(true);
    await onSaved(registration.id, status, note);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl sm:p-6">
        <div className="flex items-start justify-between">
          <h2 className="text-xl font-bold text-slate-900">報名明細</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="關閉"
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* 家長填寫的內容一律唯讀顯示。這不是偷懶 —— 資料庫的
            guard_registration_fields 觸發器也會擋下管理員的修改，
            前後端一致，日後有爭議才說得清楚。 */}
        <dl className="mt-5 grid gap-x-6 gap-y-4 sm:grid-cols-2">
          <Item label="學生姓名" value={registration.student_name} />
          <Item label="性別" value={GENDER_LABELS[registration.student_gender]} />
          <Item label="生日" value={registration.student_birthday} />
          <Item
            label="就讀學校"
            value={registration.school_name ?? registration.school_name_raw ?? ''}
            // 用 school_name 而非 school_id 判斷：school_id 有值不代表校名
            // 解析得出來 —— 該校若被下架（is_active = false），左連接會
            // 查無資料、school_name 一樣變 null，這批報名同樣需要人工確認
            badge={!registration.school_name ? '學校待人工確認' : undefined}
          />
          <Item label="年級" value={formatGrade(registration.grade)} />
          <Item label="班級" value={registration.class_name ?? '未填'} />
          <Item label="家長姓名" value={registration.parent_name} />
          <Item label="與學生關係" value={RELATION_LABELS[registration.relation]} />
          <Item label="聯絡電話" value={registration.contact_phone} />
          <Item
            label="送出時間"
            value={new Date(registration.created_at).toLocaleString('zh-TW')}
          />
        </dl>

        <div className="mt-6 space-y-4 border-t border-slate-200 pt-5">
          <div className="sm:max-w-xs">
            <label
              htmlFor="detail-status"
              className="block text-sm font-medium text-slate-700"
            >
              狀態
            </label>
            <select
              id="detail-status"
              value={status}
              onChange={(event) => setStatus(event.target.value as RegistrationStatus)}
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            >
              {(Object.keys(STATUS_LABELS) as RegistrationStatus[]).map((key) => (
                <option key={key} value={key}>
                  {STATUS_LABELS[key]}
                </option>
              ))}
            </select>
          </div>

          <div>
            {/* 「家長看不到」提示文字放在 <label> 外面而非包在裡面 ——
                包在 label 裡會讓這個欄位的無障礙名稱（accessible name）
                變成「內部備註家長看不到」，跟畫面上單獨顯示的「內部備註」
                對不上，screen.getByLabelText('內部備註') 這種精確比對
                會找不到元素。但只拆開還不夠：拆開後提示文字跟輸入框
                之間沒有任何語意連結，螢幕閱讀器使用者 Tab 到備註欄時
                只會聽到「內部備註」，聽不到「家長看不到」——而這正是
                管理員動筆前必須知道的事（決定能不能寫敏感內容）。
                比照 ApplyPage.tsx 班級欄位「（選填）」的先例，用
                aria-describedby 把提示文字跟輸入框重新連結起來：
                無障礙名稱維持精確的「內部備註」，無障礙描述補上
                「家長看不到」。 */}
            <div className="flex items-center gap-2">
              <label
                htmlFor="detail-note"
                className="text-sm font-medium text-slate-700"
              >
                內部備註
              </label>
              <span id="detail-note-hint" className="text-sm font-normal text-slate-400">
                家長看不到
              </span>
            </div>
            <textarea
              id="detail-note"
              value={note}
              rows={3}
              onChange={noteIme.onChange}
              onCompositionStart={noteIme.onCompositionStart}
              onCompositionEnd={noteIme.onCompositionEnd}
              aria-describedby="detail-note-hint"
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>

          {/* 存檔失敗時要讓管理員清楚看到，不能靜靜恢復成「儲存」按鈕
              就當作沒事發生 —— 比照 MyRegistrationsPage.tsx 撤回失敗的
              做法，用 role="alert" 讓錯誤訊息在螢幕閱讀器上也主動播報。 */}
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? '儲存中…' : '儲存'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-6 py-2.5 text-sm text-slate-600 transition hover:bg-slate-50"
            >
              取消
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Item({
  label,
  value,
  badge,
}: {
  label: string;
  value: string;
  badge?: string;
}) {
  return (
    <div>
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-0.5 font-medium text-slate-900">
        {value}
        {badge && (
          <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-normal text-amber-800">
            {badge}
          </span>
        )}
      </dd>
    </div>
  );
}
