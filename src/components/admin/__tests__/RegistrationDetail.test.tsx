import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import RegistrationDetail from '../RegistrationDetail';
import type { RegistrationWithSchool } from '../../../lib/types';

const registration: RegistrationWithSchool = {
  id: 'reg-1',
  parent_id: 'parent-1',
  student_name: '林小明',
  student_gender: 'male',
  student_birthday: '2016-05-20',
  school_id: 'school-1',
  school_name_raw: null,
  grade: 'E4',
  class_name: '忠班',
  parent_name: '林大明',
  relation: 'father',
  contact_phone: '0912345678',
  status: 'pending',
  admin_note: '',
  created_at: '2026-08-10T10:00:00Z',
  updated_at: '2026-08-10T10:00:00Z',
  school_name: '臺北市立中正國小',
  school_city: '臺北市',
  school_level: 'elementary',
};

describe('RegistrationDetail', () => {
  it('顯示家長填寫的所有欄位', () => {
    render(
      <RegistrationDetail
        registration={registration}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByText('林小明')).toBeInTheDocument();
    expect(screen.getByText('男')).toBeInTheDocument();
    expect(screen.getByText('2016-05-20')).toBeInTheDocument();
    expect(screen.getByText('臺北市立中正國小')).toBeInTheDocument();
    expect(screen.getByText('國小四年級')).toBeInTheDocument();
    expect(screen.getByText('忠班')).toBeInTheDocument();
    expect(screen.getByText('父親')).toBeInTheDocument();
    expect(screen.getByText('0912345678')).toBeInTheDocument();
  });

  it('家長填的欄位是唯讀文字，不提供輸入框', () => {
    render(
      <RegistrationDetail
        registration={registration}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    // 整個明細只有兩個可編輯控制項：狀態下拉選單與內部備註
    expect(screen.getByLabelText('狀態')).toBeInTheDocument();
    expect(screen.getByLabelText('內部備註')).toBeInTheDocument();
    expect(screen.queryByLabelText('學生姓名')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('聯絡電話')).not.toBeInTheDocument();
  });

  it('四種狀態都可以選', async () => {
    render(
      <RegistrationDetail
        registration={registration}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    const select = screen.getByLabelText('狀態');
    expect(select.querySelectorAll('option')).toHaveLength(4);
  });

  it('儲存後回報新的狀態與備註', async () => {
    const onSaved = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <RegistrationDetail
        registration={registration}
        onClose={vi.fn()}
        onSaved={onSaved}
      />
    );

    await user.selectOptions(screen.getByLabelText('狀態'), 'contacted');
    await user.type(screen.getByLabelText('內部備註'), '已致電家長');
    await user.click(screen.getByRole('button', { name: '儲存' }));

    expect(onSaved).toHaveBeenCalledWith('reg-1', 'contacted', '已致電家長');
  });

  // 以下兩條測試不在 brief 的 Step 1 範例裡，是依任務說明中「備註欄要用
  // useImeGuardedInput、要補組字測試」的要求另外補上的 —— brief 的
  // RegistrationDetail.tsx 範例程式碼本身沒有套用 IME 守衛，屬於範例程式碼
  // 漏掉這段防護，不是「應該照抄」的正確版本，比照 RegistrationTable 的
  // filter-keyword 先例（task-16 已補過同類缺口）處理。
  it('備註使用中文輸入法時，組字中不寫入半成品', () => {
    render(
      <RegistrationDetail
        registration={registration}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    const noteInput = screen.getByLabelText('內部備註') as HTMLTextAreaElement;
    const statusSelect = screen.getByLabelText('狀態') as HTMLSelectElement;

    fireEvent.compositionStart(noteInput);
    fireEvent.change(noteInput, { target: { value: 'ㄌㄧㄣˊ' } });

    // 組字中的半成品不該寫進 React 狀態：讓狀態下拉選單觸發重新渲染，
    // 若備註狀態真的沒被半成品覆蓋，受控欄位會被打回原本的空值。
    fireEvent.change(statusSelect, { target: { value: 'contacted' } });
    expect(noteInput.value).toBe('');
  });

  it('備註組字結束後補寫最終選字結果', () => {
    render(
      <RegistrationDetail
        registration={registration}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    const noteInput = screen.getByLabelText('內部備註') as HTMLTextAreaElement;
    const statusSelect = screen.getByLabelText('狀態') as HTMLSelectElement;

    fireEvent.compositionStart(noteInput);
    fireEvent.change(noteInput, { target: { value: 'ㄌㄧㄣˊ' } });
    fireEvent.compositionEnd(noteInput, { target: { value: '已致電家長' } });

    // compositionEnd 已補寫最終值，之後即使有別的欄位觸發重新渲染，
    // 備註內容也要維持最終值而不是被打回半成品或空字串。
    fireEvent.change(statusSelect, { target: { value: 'contacted' } });
    expect(noteInput.value).toBe('已致電家長');
  });

  // 品質審查第 1 輪修正：存檔失敗時要有明確提示，AdminPage 把
  // updateRegistrationStatus 回傳的錯誤文字往下傳給這個元件顯示。
  it('顯示外部傳入的錯誤訊息', () => {
    render(
      <RegistrationDetail
        registration={registration}
        onClose={vi.fn()}
        onSaved={vi.fn()}
        error="更新失敗，請稍後再試"
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('更新失敗，請稍後再試');
  });

  it('沒有錯誤時不顯示錯誤區塊', () => {
    render(
      <RegistrationDetail
        registration={registration}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // 品質審查第 1 輪修正：「家長看不到」提示要用 aria-describedby 跟備註欄
  // 綁在一起，螢幕閱讀器使用者 Tab 到備註欄時才聽得到這段提示；同時
  // label 的無障礙名稱仍要維持精確的「內部備註」，兩者不衝突。
  it('校名解析得出來時不顯示待人工確認標記', () => {
    render(
      <RegistrationDetail
        registration={registration}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    expect(screen.queryByText('學校待人工確認')).not.toBeInTheDocument();
  });

  // school_id 有值（家長確實選了名錄裡的學校），但該校後來被下架
  // （is_active = false），schools 的讀取政策擋下、左連接查無資料，
  // school_name 一樣變 null。用 school_id 判斷「是否需要人工確認」
  // 在這種情況下會誤判成不需要，改用 school_name 才對。
  it('school_id 有值但學校已被停用（school_name 為 null）時仍顯示待人工確認標記', () => {
    render(
      <RegistrationDetail
        registration={{
          ...registration,
          school_id: 'school-inactive',
          school_name_raw: null,
          school_name: null,
          school_city: null,
          school_level: null,
        }}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    expect(screen.getByText('學校待人工確認')).toBeInTheDocument();
  });

  it('內部備註欄位的無障礙描述包含「家長看不到」提示', () => {
    render(
      <RegistrationDetail
        registration={registration}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByLabelText('內部備註')).toHaveAccessibleDescription('家長看不到');
  });
});
