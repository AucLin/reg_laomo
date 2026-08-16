/*
  修正 guard_registration_fields：補上 created_at、id 的欄位保護

  原本的欄位保護清單漏了 created_at 與 id，導致管理員可以直接把
  created_at（家長送出報名的原始時間）改成任意值，觸發器不會攔、
  也不會跳錯誤 —— 與「日後對報名內容有爭議時，資料庫裡留的必須是
  家長當初送出的原文，不能被行政端事後修改」這個設計目的直接矛盾。

  status、admin_note 仍是刻意開放給管理員的欄位；updated_at 由
  touch_updated_at 觸發器自動維護，不需要在這裡另外檢查。
*/

CREATE OR REPLACE FUNCTION guard_registration_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- 家長改自己的待審核報名，放行
  IF OLD.parent_id = auth.uid() AND OLD.status = 'pending' THEN
    RETURN NEW;
  END IF;

  -- 其餘情況（即管理員修改）只准動 status 與 admin_note
  IF NEW.student_name IS DISTINCT FROM OLD.student_name
     OR NEW.student_gender IS DISTINCT FROM OLD.student_gender
     OR NEW.student_birthday IS DISTINCT FROM OLD.student_birthday
     OR NEW.school_id IS DISTINCT FROM OLD.school_id
     OR NEW.school_name_raw IS DISTINCT FROM OLD.school_name_raw
     OR NEW.grade IS DISTINCT FROM OLD.grade
     OR NEW.class_name IS DISTINCT FROM OLD.class_name
     OR NEW.parent_name IS DISTINCT FROM OLD.parent_name
     OR NEW.relation IS DISTINCT FROM OLD.relation
     OR NEW.contact_phone IS DISTINCT FROM OLD.contact_phone
     OR NEW.parent_id IS DISTINCT FROM OLD.parent_id
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.id IS DISTINCT FROM OLD.id
  THEN
    RAISE EXCEPTION '不可修改家長填寫的報名內容，僅能變更狀態與內部備註';
  END IF;

  RETURN NEW;
END;
$$;
