import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import AppHeader from '../components/AppHeader';
import StatusBadge from '../components/StatusBadge';
import StudentForm, {
  EMPTY_STUDENT_FORM,
  parseStudentForm,
  studentToFormValue,
  type StudentFormValue,
} from '../components/StudentForm';
import {
  ClipboardDoodle,
  DashedRule,
  SearchingDoodle,
  Squiggle,
} from '../components/doodles';
import { deleteRegistration, listMyRegistrations } from '../lib/registrations';
import {
  createStudent,
  deleteStudent,
  listMyStudents,
  updateStudent,
} from '../lib/students';
import {
  formatGrade,
  type RegistrationWithSchool,
  type StudentWithSchool,
} from '../lib/types';

const CENTER_PHONE = '02-1234-5678';

export default function MyRegistrationsPage() {
  const { user } = useAuth();
  const [registrations, setRegistrations] = useState<RegistrationWithSchool[]>([]);
  const [students, setStudents] = useState<StudentWithSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 孩子的新增／編輯共用同一份草稿：畫面上一次只會開一個表單
  const [draft, setDraft] = useState<StudentFormValue | null>(null);
  const [editingStudentId, setEditingStudentId] = useState<string | null>(null);
  const [studentError, setStudentError] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);
  const [confirmingStudentId, setConfirmingStudentId] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listMyRegistrations(), listMyStudents()])
      .then(([nextRegistrations, nextStudents]) => {
        setRegistrations(nextRegistrations);
        setStudents(nextStudents);
      })
      .finally(() => setLoading(false));
  }, []);

  /*
    每個孩子目前有幾筆報名。資料庫的外鍵是 ON DELETE RESTRICT，有報名
    紀錄的孩子刪不掉 —— 與其讓家長按下去撞一個外鍵錯誤，不如一開始就
    不給按，並說明原因。
  */
  const registrationCount = new Map<string, number>();
  for (const item of registrations) {
    if (!item.student_id) continue;
    registrationCount.set(
      item.student_id,
      (registrationCount.get(item.student_id) ?? 0) + 1
    );
  }

  function handleStartConfirm(id: string) {
    setErrorId(null);
    setErrorMessage(null);
    setConfirmingId(id);
  }

  async function handleDelete(id: string) {
    const { error } = await deleteRegistration(id);
    if (error) {
      // deleteRegistration() 會回傳兩種語意不同的訊息：被列級權限擋下
      // （這筆報名已進入處理流程）跟真正的資料庫錯誤（撤回失敗，請稍後
      // 再試）。直接顯示 error 本身的內容，不要寫死同一句話蓋掉真正的
      // 原因，否則家長會跑去問中心「這筆到底處理到哪」。
      setErrorId(id);
      setErrorMessage(error);
      const fresh = await listMyRegistrations();
      setRegistrations(fresh);
    } else {
      setErrorId(null);
      setErrorMessage(null);
      setRegistrations((current) => current.filter((item) => item.id !== id));
    }
    setConfirmingId(null);
  }

  function startAddStudent() {
    setEditingStudentId(null);
    setDraft(EMPTY_STUDENT_FORM);
    setStudentError('');
  }

  function startEditStudent(student: StudentWithSchool) {
    setEditingStudentId(student.id);
    setDraft(studentToFormValue(student));
    setStudentError('');
  }

  function cancelDraft() {
    setDraft(null);
    setEditingStudentId(null);
    setStudentError('');
  }

  async function handleSaveStudent() {
    if (!draft) return;
    const parsed = parseStudentForm(draft);
    if (!parsed.ok) {
      setStudentError(parsed.message);
      return;
    }
    if (!user) {
      setStudentError('登入狀態已失效，請重新登入');
      return;
    }

    setSavingStudent(true);
    const { error } = editingStudentId
      ? await updateStudent(editingStudentId, parsed.data)
      : await createStudent({ ...parsed.data, parent_id: user.id });
    setSavingStudent(false);

    if (error) {
      setStudentError(error);
      return;
    }
    setStudents(await listMyStudents());
    cancelDraft();
  }

  async function handleDeleteStudent(id: string) {
    const { error } = await deleteStudent(id);
    setConfirmingStudentId(null);
    if (error) {
      setStudentError(error);
      return;
    }
    setStudents((current) => current.filter((student) => student.id !== id));
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-paper">
        <AppHeader />
        <div className="p-8 text-center text-slate-600">載入中…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader />
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        <section>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900">我的孩子</h1>
              <div className="mt-1 w-20">
                <Squiggle className="text-amber-400" />
              </div>
            </div>
            {draft === null && (
              <button
                type="button"
                onClick={startAddStudent}
                className="doodle-btn-soft px-4 py-2.5 text-sm"
              >
                新增孩子
              </button>
            )}
          </div>

          {students.length === 0 && draft === null && (
            <div className="doodle-card mt-4 flex flex-wrap items-center gap-4 px-5 py-5">
              <SearchingDoodle className="h-16 w-auto shrink-0 text-slate-400" />
              <p className="min-w-0 flex-1 text-sm leading-relaxed text-slate-600">
                建立孩子的資料後，之後報名課程或比賽就不用重打一次。
              </p>
            </div>
          )}

          {students.length > 0 && (
            <ul className="mt-4 space-y-3">
              {students.map((student, index) => {
                const count = registrationCount.get(student.id) ?? 0;
                return (
                  <li
                    key={student.id}
                    className={`${
                      index % 2 === 0 ? 'doodle-card' : 'doodle-card-alt'
                    } p-5`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h2 className="break-words font-bold text-slate-900">
                          {student.name}
                        </h2>
                        <p className="mt-1 break-words text-sm text-slate-700">
                          {student.school_name ?? student.school_name_raw}
                          {!student.school_name && (
                            <span className="ml-2 inline-block rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                              學校待確認
                            </span>
                          )}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {formatGrade(student.grade)}
                          {student.class_name && ` · ${student.class_name}`}
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => startEditStudent(student)}
                          className="doodle-btn-quiet px-4 py-2 text-sm"
                        >
                          編輯
                        </button>
                        {count === 0 &&
                          (confirmingStudentId === student.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleDeleteStudent(student.id)}
                                className="doodle-btn-danger px-4 py-2 text-sm"
                              >
                                確定刪除
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmingStudentId(null)}
                                className="doodle-btn-quiet px-4 py-2 text-sm"
                              >
                                取消
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmingStudentId(student.id)}
                              className="doodle-btn-quiet px-4 py-2 text-sm"
                            >
                              刪除
                            </button>
                          ))}
                      </div>
                    </div>

                    {count > 0 && (
                      // 原本是 slate-400，在白底上只有 2.8:1，家長不會發現這行字
                      <p className="mt-3 text-xs text-slate-600">
                        已有 {count} 筆報名紀錄，如需更正請聯繫我們
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {draft !== null && (
            <div className="doodle-card mt-4 p-5 sm:p-6">
              <h2 className="text-lg font-bold text-slate-900">
                {editingStudentId ? '編輯孩子資料' : '新增孩子'}
              </h2>
              <div className="mb-4 mt-2 text-slate-300">
                <DashedRule />
              </div>
              <StudentForm value={draft} onChange={setDraft} />

              {studentError && (
                <p
                  role="alert"
                  className="mt-4 rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
                >
                  {studentError}
                </p>
              )}

              <div className="mt-5 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={handleSaveStudent}
                  disabled={savingStudent}
                  className="doodle-btn px-6 py-2.5 text-sm"
                >
                  {savingStudent ? '儲存中…' : '儲存'}
                </button>
                <button
                  type="button"
                  onClick={cancelDraft}
                  className="doodle-btn-quiet px-4 py-2.5 text-sm"
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </section>

        {/* 孩子區的錯誤（例如刪除被外鍵擋下）在表單收起時也要看得到 */}
        {draft === null && studentError && (
          <p
            role="alert"
            className="mt-4 rounded-xl border-2 border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          >
            {studentError}
          </p>
        )}

        <section className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold text-slate-900">我的報名</h1>
              <div className="mt-1 w-20">
                <Squiggle className="text-amber-400" />
              </div>
            </div>
            {registrations.length > 0 && (
              <Link to="/apply" className="doodle-btn px-4 py-2.5 text-sm">
                再報名一位孩子
              </Link>
            )}
          </div>

          {registrations.length === 0 ? (
            <div className="doodle-card mt-6 px-6 py-10 text-center">
              <ClipboardDoodle className="mx-auto h-24 w-auto -rotate-3 text-brand-600" />
              <p className="mt-4 text-base font-semibold text-slate-700">
                您還沒有任何報名紀錄
              </p>
              <p className="mt-2 text-sm text-slate-600">
                填一次資料，之後報名課程或比賽都用得上。
              </p>
              <Link to="/apply" className="doodle-btn mt-6 inline-block px-6 py-3">
                立即報名
              </Link>
            </div>
          ) : (
            <ul className="mt-6 space-y-5">
              {registrations.map((registration, index) => (
                <li
                  key={registration.id}
                  className={`${
                    index % 2 === 0 ? 'doodle-card' : 'doodle-card-alt'
                  } p-5 sm:p-6`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="break-words text-lg font-bold text-slate-900">
                        {registration.student_name}
                      </h2>
                      <p className="mt-1 break-words text-sm text-slate-700">
                        {registration.school_name ?? registration.school_name_raw}
                        {/* 用 school_name（而非 school_id）判斷要不要顯示待確認標記：
                            school_id 有值不代表校名一定解析得出來 —— 學校名錄
                            的讀取政策限定 is_active = true，若那所學校事後被
                            停用，左連接會查無資料、school_name 一樣變 null，
                            這批報名同樣需要人工確認是哪所學校 */}
                        {!registration.school_name && (
                          <span className="ml-2 inline-block rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
                            學校待確認
                          </span>
                        )}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatGrade(registration.grade)}
                        {registration.class_name && ` · ${registration.class_name}`}
                      </p>
                    </div>
                    <StatusBadge status={registration.status} />
                  </div>

                  <div className="mt-4 text-slate-300">
                    <DashedRule />
                  </div>

                  <p className="mt-3 text-xs text-slate-600">
                    送出時間：
                    {new Date(registration.created_at).toLocaleString('zh-TW')}
                  </p>

                  {/* 撤回失敗可能是這筆報名剛好已被行政端處理過（列級權限
                      擋下），也可能是單純的資料庫錯誤 —— 兩種情況資料層回傳
                      的訊息不同，這裡直接顯示 error 本身的內容，不再寫死同
                      一句話蓋掉真正的錯誤原因。不論卡片之後顯示哪種狀態，
                      這則錯誤訊息都要露出，家長才知道剛剛按的那次撤回發生
                      了什麼事。 */}
                  {errorId === registration.id && errorMessage && (
                    <p
                      role="alert"
                      className="mt-4 rounded-xl border-2 border-red-200 bg-red-50 px-3 py-2.5 text-sm font-medium text-red-700"
                    >
                      {errorMessage}
                    </p>
                  )}

                  {/* 待審核才給改動。這與資料庫的列級權限一致 ——
                      介面不提供的操作，資料庫層也一併擋住。 */}
                  {registration.status === 'pending' ? (
                    <div className="mt-4 flex flex-wrap gap-3">
                      {confirmingId === registration.id ? (
                        <>
                          <button
                            type="button"
                            onClick={() => handleDelete(registration.id)}
                            className="doodle-btn-danger px-4 py-2 text-sm"
                          >
                            確定撤回
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmingId(null)}
                            className="doodle-btn-quiet px-4 py-2 text-sm"
                          >
                            取消
                          </button>
                        </>
                      ) : (
                        <>
                          <Link
                            to={`/apply?edit=${registration.id}`}
                            className="doodle-btn-soft px-4 py-2 text-sm"
                          >
                            修改
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleStartConfirm(registration.id)}
                            className="doodle-btn-quiet px-4 py-2 text-sm"
                          >
                            撤回報名
                          </button>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="mt-4 break-words rounded-[1rem_0.8rem_1.05rem_0.85rem] border-2 border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                      已進入處理流程，如需異動請聯絡中心：{CENTER_PHONE}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
