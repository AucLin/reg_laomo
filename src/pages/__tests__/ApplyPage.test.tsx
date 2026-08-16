import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ApplyPage from '../ApplyPage';
import * as registrationsModule from '../../lib/registrations';
import * as useAuthModule from '../../auth/useAuth';

vi.mock('../../components/SchoolSelector', () => ({
  default: ({
    onChange,
  }: {
    onChange: (next: {
      level: string;
      schoolId: string;
      schoolNameRaw: string;
    }) => void;
  }) => (
    <button
      type="button"
      onClick={() =>
        onChange({ level: 'elementary', schoolId: 'school-1', schoolNameRaw: '' })
      }
    >
      模擬選擇學校
    </button>
  ),
}));

function renderPage(path = '/apply') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <ApplyPage />
    </MemoryRouter>
  );
}

describe('ApplyPage', () => {
  beforeEach(() => {
    vi.spyOn(useAuthModule, 'useAuth').mockReturnValue({
      user: { id: 'parent-1' } as never,
      profile: {
        id: 'parent-1',
        full_name: '林大明',
        phone: '0912345678',
        role: 'parent',
        created_at: '2026-08-01',
      },
      isAdmin: false,
      loading: false,
      signOut: vi.fn(),
    });
    vi.spyOn(registrationsModule, 'createRegistration').mockResolvedValue({
      error: null,
    });
  });

  it('家長姓名與電話預先帶入註冊時填的資料', () => {
    renderPage();
    expect(screen.getByLabelText('家長姓名')).toHaveValue('林大明');
    expect(screen.getByLabelText('聯絡電話')).toHaveValue('0912345678');
  });

  it('未填必填欄位時不送出並顯示錯誤', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: '送出報名' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(registrationsModule.createRegistration).not.toHaveBeenCalled();
  });

  it('年級選項預設是國小的六個年級', () => {
    renderPage();
    const select = screen.getByLabelText('年級');
    expect(select.querySelectorAll('option[value^="E"]')).toHaveLength(6);
  });

  it('生日不合理時擋下並提示', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('學生姓名'), '林小明');
    await user.click(screen.getByLabelText('男'));
    await user.type(screen.getByLabelText('生日'), '2024-01-01');
    await user.click(screen.getByRole('button', { name: '模擬選擇學校' }));
    await user.selectOptions(screen.getByLabelText('年級'), 'E4');
    await user.selectOptions(screen.getByLabelText('與學生關係'), 'father');
    await user.click(screen.getByRole('button', { name: '送出報名' }));

    expect(
      await screen.findByText(/生日不合理，就讀學生年齡應介於 5 至 20 歲/)
    ).toBeInTheDocument();
    expect(registrationsModule.createRegistration).not.toHaveBeenCalled();
  });

  it('帶 ?edit= 時載入既有報名並改用修改，標題也跟著變', async () => {
    vi.spyOn(registrationsModule, 'getRegistration').mockResolvedValue({
      id: 'reg-1',
      parent_id: 'parent-1',
      student_name: '林小華',
      student_gender: 'female',
      student_birthday: '2015-03-10',
      school_id: 'school-9',
      school_name_raw: null,
      grade: 'E5',
      class_name: '孝班',
      parent_name: '林大明',
      relation: 'father',
      contact_phone: '0912345678',
      status: 'pending',
      admin_note: null,
      created_at: '2026-08-10T10:00:00Z',
      updated_at: '2026-08-10T10:00:00Z',
      school_name: '臺北市立中正國小',
      school_city: '臺北市',
      school_level: 'elementary',
    });
    vi.spyOn(registrationsModule, 'updateRegistration').mockResolvedValue({
      error: null,
    });

    const user = userEvent.setup();
    renderPage('/apply?edit=reg-1');

    expect(await screen.findByText('修改報名資訊')).toBeInTheDocument();
    expect(await screen.findByLabelText('學生姓名')).toHaveValue('林小華');
    expect(screen.getByLabelText('班級')).toHaveValue('孝班');

    await user.click(screen.getByRole('button', { name: '儲存修改' }));

    await waitFor(() => {
      expect(registrationsModule.updateRegistration).toHaveBeenCalledWith(
        'reg-1',
        expect.objectContaining({ student_name: '林小華', grade: 'E5' })
      );
    });
    // 修改既有報名不該再建一筆新的
    expect(registrationsModule.createRegistration).not.toHaveBeenCalled();
  });

  it('資料完整時送出報名，且送的是學校代碼', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('學生姓名'), '林小明');
    await user.click(screen.getByLabelText('男'));
    await user.type(screen.getByLabelText('生日'), '2016-05-20');
    await user.click(screen.getByRole('button', { name: '模擬選擇學校' }));
    await user.selectOptions(screen.getByLabelText('年級'), 'E4');
    await user.type(screen.getByLabelText('班級'), '忠班');
    await user.selectOptions(screen.getByLabelText('與學生關係'), 'father');
    await user.click(screen.getByRole('button', { name: '送出報名' }));

    await waitFor(() => {
      expect(registrationsModule.createRegistration).toHaveBeenCalledWith(
        expect.objectContaining({
          student_name: '林小明',
          student_gender: 'male',
          student_birthday: '2016-05-20',
          school_id: 'school-1',
          grade: 'E4',
          class_name: '忠班',
          parent_name: '林大明',
          relation: 'father',
          contact_phone: '0912345678',
        })
      );
    });
  });

  it('未選學校、班級留白時，送出的資料把空字串轉成 null', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText('學生姓名'), '林小明');
    await user.click(screen.getByLabelText('男'));
    await user.type(screen.getByLabelText('生日'), '2016-05-20');
    await user.click(screen.getByRole('button', { name: '模擬選擇學校' }));
    await user.selectOptions(screen.getByLabelText('年級'), 'E4');
    // 班級留白，不輸入
    await user.selectOptions(screen.getByLabelText('與學生關係'), 'father');
    await user.click(screen.getByRole('button', { name: '送出報名' }));

    await waitFor(() => {
      expect(registrationsModule.createRegistration).toHaveBeenCalledWith(
        expect.objectContaining({
          class_name: null,
          school_name_raw: null,
        })
      );
    });
  });

  it('用注音輸入學生姓名時，組字中不寫入半成品，選字完成後才寫入', async () => {
    renderPage();

    const nameInput = screen.getByLabelText('學生姓名') as HTMLInputElement;
    const birthdayInput = screen.getByLabelText('生日') as HTMLInputElement;

    fireEvent.compositionStart(nameInput);
    fireEvent.change(nameInput, { target: { value: 'ㄌㄧㄣˊ' } });

    // 組字中的半成品不該寫進 React 狀態：讓另一個欄位觸發重新渲染，
    // 若姓名狀態真的沒被半成品覆蓋，受控欄位會被打回原本的空值。
    fireEvent.change(birthdayInput, { target: { value: '2016-05-20' } });
    expect(nameInput.value).toBe('');

    fireEvent.compositionEnd(nameInput, { target: { value: '林小明' } });

    // 選字完成後應該已經寫進狀態：再讓別的欄位觸發一次重新渲染，
    // 姓名欄位仍要維持最終值，而不是被打回空字串。
    fireEvent.change(birthdayInput, { target: { value: '2016-05-20' } });
    expect(nameInput.value).toBe('林小明');
  });
});
