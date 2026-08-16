import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { parseMoeCsv, type ParsedSchool, type SchoolLevel } from './lib/moe-csv';

dotenv.config({ path: '.env' });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('缺少環境變數：需要 VITE_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// 用 service_role 金鑰繞過列級權限寫入。schools 表沒有任何寫入政策，
// 這是唯一的維護管道。
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

interface Source {
  level: SchoolLevel;
  label: string;
  url: string;
}

// 明年教育部更新名錄時，只要改這裡的學年度數字重跑即可。
const SOURCES: Source[] = [
  {
    level: 'elementary',
    label: '國小',
    url: 'https://stats.moe.gov.tw/files/school/114/e1_new.csv',
  },
  {
    level: 'junior',
    label: '國中',
    url: 'https://stats.moe.gov.tw/files/school/113/j1_new.csv',
  },
  {
    level: 'senior',
    label: '高中職',
    url: 'https://stats.moe.gov.tw/files/school/114/high.csv',
  },
];

async function download(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`下載失敗（HTTP ${response.status}）：${url}`);
  }
  return await response.text();
}

async function upsertSchools(schools: ParsedSchool[]): Promise<number> {
  const BATCH_SIZE = 500;
  let written = 0;

  for (let i = 0; i < schools.length; i += BATCH_SIZE) {
    const batch = schools.slice(i, i + BATCH_SIZE).map((school) => ({
      ...school,
      is_active: true,
      updated_at: new Date().toISOString(),
    }));

    // 以教育部代碼為唯一鍵，存在就更新、不存在就新增，重跑不會產生重複資料
    const { error } = await supabase
      .from('schools')
      .upsert(batch, { onConflict: 'code' });

    if (error) {
      throw new Error(`寫入資料庫失敗：${error.message}`);
    }
    written += batch.length;
  }

  return written;
}

async function main() {
  console.log('開始匯入教育部全國學校名錄\n');
  let total = 0;

  for (const source of SOURCES) {
    process.stdout.write(`${source.label}：下載中… `);
    const csv = await download(source.url);

    const schools = parseMoeCsv(csv, source.level);
    process.stdout.write(`解析出 ${schools.length} 所，寫入中… `);

    const written = await upsertSchools(schools);
    console.log(`完成 ${written} 所`);
    total += written;
  }

  console.log(`\n匯入完成，共 ${total} 所學校。`);

  // 印出雙北的統計，確認老莫主要招生範圍的資料到位
  const { count } = await supabase
    .from('schools')
    .select('*', { count: 'exact', head: true })
    .in('city', ['新北市', '臺北市']);
  console.log(`其中雙北 ${count} 所。`);
}

main().catch((error) => {
  console.error('\n匯入失敗：', error.message);
  process.exit(1);
});
