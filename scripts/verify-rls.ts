import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const RAW_URL = process.env.VITE_SUPABASE_URL;
const RAW_ANON = process.env.VITE_SUPABASE_ANON_KEY;
const RAW_SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!RAW_URL || !RAW_ANON || !RAW_SERVICE) {
  console.error(
    '缺少環境變數：需要 VITE_SUPABASE_URL、VITE_SUPABASE_ANON_KEY、SUPABASE_SERVICE_ROLE_KEY'
  );
  process.exit(1);
}

// 上面已經檢查過三者皆非空，這裡固定成 string 型別，讓下面巢狀函式裡也能直接用，
// 不必在每個使用點各自加型別斷言。
const URL: string = RAW_URL;
const ANON: string = RAW_ANON;
const SERVICE: string = RAW_SERVICE;

const admin = createClient(URL, SERVICE, { auth: { persistSession: false } });

const results: { name: string; passed: boolean; detail: string }[] = [];

function check(name: string, passed: boolean, detail = '') {
  results.push({ name, passed, detail });
  console.log(`${passed ? '通過' : '失敗'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

/** 建立一個測試帳號並回傳以該身分登入的用戶端 */
async function createTestUser(email: string, password: string) {
  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: '測試家長', phone: '0912345678' },
  });
  if (createError) throw new Error(`建立測試帳號失敗：${createError.message}`);

  const client = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`測試帳號登入失敗：${error.message}`);
  return { client, userId: data.user!.id };
}

/** 刪除測試帳號（連動刪除其 profiles 與 registrations） */
async function cleanup(emails: string[]) {
  const { data } = await admin.auth.admin.listUsers();
  for (const user of data.users) {
    if (emails.includes(user.email ?? '')) {
      await admin.auth.admin.deleteUser(user.id);
    }
  }
}

/*
  這支腳本會對 URL 指向的資料庫做真實的寫入操作：建立／刪除 Auth 帳號、
  寫入報名、把一個帳號升成 admin。不管指到哪個環境，手滑執行都不是小事，
  所以執行前一律印出目標網址，並且要求明確帶 --yes 才會真的動手——
  沒有這個旗標就只印出將要對哪個環境做什麼，不連線、不寫入，直接結束。
  （若中途被 SIGKILL 之類訊號強制終止，main().catch() 攔不到、cleanup()
  不會執行，可能留下殘留測試帳號——這是已知限制，需要人工檢查
  auth.users 裡是否還有 rls-test-a@mailinator.com／rls-test-b@mailinator.com。）
*/
function confirmTargetOrExit() {
  console.log(`目標資料庫：${URL}`);
  if (!process.argv.includes('--yes')) {
    console.log(
      '\n未帶 --yes，不會真的執行。\n' +
        '這支腳本會對上面這個資料庫：建立兩個測試帳號（rls-test-a／rls-test-b@mailinator.com）、\n' +
        '寫入一筆測試報名、把其中一個帳號升成 admin，最後刪除這兩個測試帳號。\n' +
        '確認目標環境無誤後，重跑：npm run verify:rls -- --yes'
    );
    process.exit(0);
  }
}

async function main() {
  confirmTargetOrExit();

  // Supabase 會拒絕 example.com 網域的信箱，改用 mailinator.com
  const emailA = 'rls-test-a@mailinator.com';
  const emailB = 'rls-test-b@mailinator.com';
  await cleanup([emailA, emailB]);

  const parentA = await createTestUser(emailA, 'test-password-123');
  const parentB = await createTestUser(emailB, 'test-password-123');

  // 取一所真實學校來建立報名
  const { data: school } = await admin.from('schools').select('id').limit(1).single();
  if (!school) throw new Error('資料庫沒有學校資料，請先執行 npm run import:schools');

  const baseRegistration = {
    student_name: '測試學生',
    student_gender: 'male',
    student_birthday: '2016-05-20',
    school_id: school.id,
    grade: 'E4',
    parent_name: '測試家長',
    relation: 'father',
    contact_phone: '0912345678',
  };

  // 家長 A 送出一筆報名
  const { data: created, error: insertError } = await parentA.client
    .from('registrations')
    .insert({ ...baseRegistration, parent_id: parentA.userId })
    .select()
    .single();
  check('家長可新增自己的報名', !insertError && !!created, insertError?.message ?? '');

  // 家長 B 不該看得到家長 A 的報名
  const { data: bSees } = await parentB.client.from('registrations').select('id');
  check(
    '家長 B 看不到家長 A 的報名',
    (bSees ?? []).length === 0,
    `實際看到 ${(bSees ?? []).length} 筆`
  );

  // 家長 A 應該改得動自己待審核的報名內容。
  // 「應成功」的斷言跟「應被擋下」用同一套嚴謹度：只看 error === null 不夠——
  // 若 RLS 誤把這筆列濾掉（USING 比對到 0 筆），PostgREST 一樣回傳 error: null，
  // 會被誤判成「成功」。改用 service_role 讀回資料庫，確認欄位真的變成預期值。
  const { error: editError } = await parentA.client
    .from('registrations')
    .update({ class_name: '孝班' })
    .eq('id', created!.id);
  const { data: afterEdit } = await admin
    .from('registrations')
    .select('class_name')
    .eq('id', created!.id)
    .single();
  check(
    '家長可修改自己待審核的報名',
    editError === null && afterEdit?.class_name === '孝班',
    `錯誤：${editError?.message ?? '（無）'}／資料庫實際班級：${afterEdit?.class_name}`
  );

  // 家長 B 不該能替家長 A 建立報名
  const { error: forgeError } = await parentB.client
    .from('registrations')
    .insert({ ...baseRegistration, parent_id: parentA.userId });
  check(
    '家長不能冒用他人身分送出報名',
    forgeError !== null,
    forgeError?.message ?? '竟然新增成功了'
  );

  // 家長不該能把自己升成管理員
  const { error: escalateError } = await parentA.client
    .from('profiles')
    .update({ role: 'admin' })
    .eq('id', parentA.userId);
  const { data: afterEscalate } = await admin
    .from('profiles')
    .select('role')
    .eq('id', parentA.userId)
    .single();
  check(
    '家長不能把自己升成管理員',
    escalateError !== null || afterEscalate?.role === 'parent',
    `錯誤：${escalateError?.message ?? '（無）'}／目前角色：${afterEscalate?.role}`
  );

  // 家長不該能直接把報名改成已錄取
  const { error: statusError } = await parentA.client
    .from('registrations')
    .update({ status: 'enrolled' })
    .eq('id', created!.id);
  const { data: afterStatus } = await admin
    .from('registrations')
    .select('status')
    .eq('id', created!.id)
    .single();
  check(
    '家長不能自己把報名改成已錄取',
    statusError !== null || afterStatus?.status === 'pending',
    `錯誤：${statusError?.message ?? '（無）'}／目前狀態：${afterStatus?.status}`
  );

  // 把家長 B 升成管理員（只能用 service_role，家長自己改不動——上面已驗過），測試管理員的權限邊界
  await admin.from('profiles').update({ role: 'admin' }).eq('id', parentB.userId);

  const { data: adminSees } = await parentB.client.from('registrations').select('id');
  check(
    '管理員看得到全部報名',
    (adminSees ?? []).length >= 1,
    `實際看到 ${(adminSees ?? []).length} 筆`
  );

  // 同上：「管理員可以改狀態與內部備註」也要讀回資料庫確認，不能只看 error 是否為 null。
  const { error: noteError } = await parentB.client
    .from('registrations')
    .update({ status: 'contacted', admin_note: '已致電' })
    .eq('id', created!.id);
  const { data: afterNote } = await admin
    .from('registrations')
    .select('status, admin_note')
    .eq('id', created!.id)
    .single();
  check(
    '管理員可以改狀態與內部備註',
    noteError === null && afterNote?.status === 'contacted' && afterNote?.admin_note === '已致電',
    `錯誤：${noteError?.message ?? '（無）'}／資料庫實際狀態：${afterNote?.status}／備註：${afterNote?.admin_note}`
  );

  const { error: tamperError } = await parentB.client
    .from('registrations')
    .update({ student_name: '被竄改的名字' })
    .eq('id', created!.id);
  check(
    '管理員不能修改家長填寫的原始內容',
    tamperError !== null,
    tamperError?.message ?? '竟然改成功了'
  );

  // 特別驗 created_at：這是家長送出時間，攸關稽核，Task 6 修正檔專門補這個洞
  const { error: createdAtError } = await parentB.client
    .from('registrations')
    .update({ created_at: '2000-01-01T00:00:00Z' })
    .eq('id', created!.id);
  check(
    '管理員不能竄改報名的建立時間',
    createdAtError !== null,
    createdAtError?.message ?? '竟然改成功了'
  );

  // 狀態變成已聯絡後，家長不該還能撤回
  const { error: deleteError } = await parentA.client
    .from('registrations')
    .delete()
    .eq('id', created!.id);
  const { count: stillThere } = await admin
    .from('registrations')
    .select('id', { count: 'exact', head: true })
    .eq('id', created!.id);
  check(
    '非待審核的報名家長撤回不了',
    deleteError !== null || stillThere === 1,
    `錯誤：${deleteError?.message ?? '（無）'}／刪除後剩 ${stillThere} 筆`
  );

  // 未登入的訪客
  const anon = createClient(URL, ANON, { auth: { persistSession: false } });
  const { data: anonSchools } = await anon.from('schools').select('id').limit(1);
  check(
    '未登入訪客讀得到學校名錄',
    (anonSchools ?? []).length === 1,
    `實際看到 ${(anonSchools ?? []).length} 筆`
  );

  const { data: anonRegistrations } = await anon.from('registrations').select('id');
  check(
    '未登入訪客讀不到任何報名',
    (anonRegistrations ?? []).length === 0,
    `實際看到 ${(anonRegistrations ?? []).length} 筆`
  );

  // 學校名錄唯讀：anon key 寫不進 schools（沒有任何寫入政策）。
  // 注意：RLS 擋下沒有任何可見列的 UPDATE 時，PostgREST 不會回傳 error，
  // 只會回傳空陣列（比對到 0 筆），所以不能只看 error 是否為 null，
  // 要用 .select() 回傳的實際列數、並用 service_role 讀回資料庫真實內容來判斷。
  const { data: schoolWriteData } = await anon
    .from('schools')
    .update({ name: '被竄改的學校名' })
    .eq('id', school.id)
    .select();
  const { data: schoolAfterWrite } = await admin
    .from('schools')
    .select('name')
    .eq('id', school.id)
    .single();
  check(
    '學校名錄透過前端金鑰寫不進去',
    (schoolWriteData ?? []).length === 0 && schoolAfterWrite?.name !== '被竄改的學校名',
    `UPDATE 回傳 ${(schoolWriteData ?? []).length} 筆／資料庫實際名稱：${schoolAfterWrite?.name}`
  );

  await cleanup([emailA, emailB]);

  const failed = results.filter((item) => !item.passed);
  console.log(`\n共 ${results.length} 項，失敗 ${failed.length} 項。`);
  if (failed.length > 0) {
    console.error('權限規則有漏洞，不可上線。');
    process.exit(1);
  }
  console.log('權限規則驗證通過。');
}

main().catch(async (error) => {
  console.error('\n驗證腳本執行失敗：', error.message);
  // 即使中途失敗也要嘗試清理，避免留下測試帳號
  try {
    await cleanup(['rls-test-a@mailinator.com', 'rls-test-b@mailinator.com']);
  } catch {
    // 清理本身失敗就沒辦法了，留給人工檢查
  }
  process.exit(1);
});
