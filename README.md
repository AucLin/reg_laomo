# 老莫機器人報名系統

機器人教育中心的線上報名系統。家長自己註冊、填孩子的資料、報名課程與比賽、挑集訓時段；中心這邊在後台看報名、排比賽與集訓、點名、匯出資料。

介面全繁體中文，資料放 Supabase，前端打包成靜態檔丟 Netlify，沒有自己維運的伺服器。

## 功能

**家長端**

- 註冊、登入、信箱驗證、忘記密碼
- 建立孩子資料（姓名、生日、性別、就讀學校、年級），學校從教育部全國名錄挑
- 報名課程；瀏覽公開比賽並報名（比賽頁不必登入就看得到，可以單場分享出去）
- 「我的報名」查狀態，並從比賽的集訓時間表挑孩子要上的時段

**後台**

- 報名件的篩選、統計、備註與 CSV 匯出
- 比賽場次管理，支援貼一個比賽官網的網址自動帶入資訊
- 集訓管理：月曆檢視、批次排課、報名人數分佈、當天點名
- 家長帳號名冊（含信箱是否驗證、最後登入時間）

## 技術組成

React 18 + TypeScript + Vite + Tailwind CSS，路由用 React Router，表單驗證用 Zod，測試用 Vitest + Testing Library。

後端是 Supabase（PostgreSQL + Auth），權限完全靠資料庫的列級安全性（RLS）政策把關 —— 前端拿的是公開的 anon 金鑰，能讀寫什麼由資料庫決定，不是由畫面決定。另有一支 Netlify 無伺服器函式 `/api/contest-info`，替後台代抓比賽官網的網頁（瀏覽器受同源政策擋著抓不到）。

---

## 要準備的外部資源

拿到這份程式碼之後，你需要自己開這三個帳號。全部都有夠用的免費方案：

| 資源 | 用途 | 一定要嗎 |
|---|---|---|
| [Supabase](https://supabase.com) | 資料庫、帳號登入 | 必要 |
| [Netlify](https://netlify.com) | 網站託管、比賽匯入用的無伺服器函式 | 上線才需要 |
| [Resend](https://resend.com) | 寄認證信的 SMTP | 上線才需要（Supabase 內建寄信服務一小時只能寄 2 到 4 封） |

另外要裝 [Node.js 22 以上](https://nodejs.org) 與 [Supabase CLI](https://supabase.com/docs/guides/local-development/cli/getting-started)（`brew install supabase/tap/supabase`）。

---

## 從零開始建起來

### 1. 取得程式碼與相依套件

```bash
git clone <你的 repo 網址>
cd reg_laomo
npm install
```

### 2. 開一個 Supabase 專案

到 [supabase.com/dashboard](https://supabase.com/dashboard) 按 **New project**，地區選離使用者近的（台灣選新加坡或東京），資料庫密碼設好後**記下來**，等一下推送資料表結構要用。

專案建好後，到 **Project Settings** → **API** 抄三個值：

| 值 | 在哪裡 | 給誰用 |
|---|---|---|
| Project URL | API 頁最上面 | 前端 |
| `anon` `public` 金鑰 | Project API keys | 前端 |
| `service_role` 金鑰 | Project API keys（要按眼睛才看得到） | 只給本機的 `scripts/`，**絕對不可外流** |

專案代號（project ref）就是網址 `https://supabase.com/dashboard/project/<這一段>` 裡的那串字。

### 3. 填環境變數

```bash
cp .env.example .env
```

把剛才抄的三個值填進去：

```bash
VITE_SUPABASE_URL=https://你的專案代號.supabase.co
VITE_SUPABASE_ANON_KEY=你的-anon-金鑰
SUPABASE_SERVICE_ROLE_KEY=你的-service-role-金鑰
```

`VITE_` 開頭的變數會被打包進瀏覽器，任何人都看得到 —— 這是正常的，anon 金鑰本來就是公開的，安全性由資料庫的列級權限保證。**`SUPABASE_SERVICE_ROLE_KEY` 千萬不要加 `VITE_` 前綴**，那把金鑰繞過所有權限檢查。`.env` 已經被 `.gitignore` 擋著，不會進版本控制。

### 4. 建資料表

`supabase/migrations/` 底下是全部的資料表結構、檢視表、列級權限政策與觸發器，照檔名順序套用：

```bash
supabase login
supabase link --project-ref <你的專案代號>
supabase db push
```

`db push` 會問資料庫密碼，就是第 2 步設的那組。

### 5. 設定登入與認證信

```bash
cp supabase/config.example.toml supabase/config.toml
```

打開 `supabase/config.toml`，把 `project_id`、`site_url`、`additional_redirect_urls`、`admin_email` 換成自己的值。這份設定不進版本控制（各自環境的代號與網域不同）。

寄信要接 Resend 才夠用，設定步驟見 [`docs/resend-smtp-setup.md`](docs/resend-smtp-setup.md)。拿到 Resend 的 API 金鑰後：

```bash
export RESEND_SMTP_PASSWORD='re_你的金鑰'
supabase config push
```

信件範本在 `supabase/templates/`，是繁中版的確認信、重設密碼信、變更信箱信 —— 家長收到滿是英文的信會直接當詐騙信刪掉。想改店名或文案就改這三個檔，再 `config push` 一次。

只想先在本機試跑的話，這一步可以先跳過，改在 Supabase 主控台 **Authentication** → **Providers** → **Email** 關掉 **Confirm email**，註冊完就直接登入（正式上線不建議關，任何人都能拿不存在的信箱送假報名）。

### 6. 匯入全國學校名錄

孩子的就讀學校是從教育部統計處的名錄挑的，這張表要先灌資料：

```bash
npm run import:schools
```

腳本會下載教育部的國小、國中、高中職 CSV，正規化後寫進 `schools` 表（以教育部代碼為唯一鍵，重跑不會重複）。明年名錄更新時，改 `scripts/import-schools.ts` 裡的學年度數字再跑一次即可。

### 7. 跑起來

```bash
npm run dev
```

打開 http://localhost:5173，註冊一個帳號試試。

### 8. 把自己設成管理員

系統沒有「申請當管理員」這種入口 —— 註冊出來的帳號一律是家長。要開後台權限，到 Supabase 主控台的 **SQL Editor** 執行：

```sql
UPDATE profiles SET role = 'admin' WHERE id = (
  SELECT id FROM auth.users WHERE email = '你的信箱'
);
```

改完重新整理網頁，導覽列就會出現「後台」。

### 9. 確認權限真的有生效（建議）

```bash
npm run verify:rls
```

這支腳本會建兩個測試帳號，實際嘗試越權讀寫別人的資料，逐項印出通過或失敗，跑完自己清乾淨。改過任何 `supabase/migrations/` 底下的政策之後都值得再跑一次。

---

## 部署

推到 GitHub，在 Netlify 匯入這個 repo 就好，`netlify.toml` 已經寫好建置設定。要注意的只有兩件事：**環境變數只填 `VITE_` 開頭那兩個**（service_role 金鑰在 Netlify 上完全用不到），以及**拿到正式網址後要回 Supabase 補 URL 設定**，不然認證信裡的連結會指回 localhost。

完整步驟與上線後的實測清單見 [`docs/netlify-deploy.md`](docs/netlify-deploy.md)。

---

## 常用指令

| 指令 | 做什麼 |
|---|---|
| `npm run dev` | 本機開發伺服器（http://localhost:5173） |
| `npm test` | 跑全部測試 |
| `npm run test:watch` | 邊改邊跑 |
| `npm run typecheck` | 型別檢查 |
| `npm run build` | 型別檢查後打包到 `dist/` |
| `npm run preview` | 預覽打包後的結果 |
| `npm run import:schools` | 匯入／更新教育部學校名錄 |
| `npm run verify:rls` | 實測資料庫的列級權限 |

想在後台看到有人數分佈的畫面，`supabase/seeds/test-parents.sql` 會建十組測試家長與孩子（信箱是 `@example.invalid`，沒有密碼登不進去），檔頭有執行與清除的指令。

## 專案結構

```
src/
  auth/          登入狀態、路由守衛
  components/    共用元件（admin/ 底下是後台專用）
  lib/           資料存取、驗證、格式化；純函式都有對應的測試
  pages/         每個網址一支
netlify/functions/  無伺服器函式（代抓比賽官網）
scripts/            本機維護腳本（匯入學校、驗證權限）
supabase/
  migrations/    資料表結構與列級權限政策，照檔名順序套用
  templates/     繁中認證信範本
  seeds/         測試資料
docs/            部署與寄信設定的操作手冊
```

## 關於資料

這個系統存的是未成年人的姓名、生日、就讀學校與家長聯絡方式。幾件別忘記的事：

- `service_role` 金鑰能繞過全部權限檢查，只留在本機的 `.env`，不要進版本控制、不要填進 Netlify、不要貼進聊天室
- 後台匯出的 CSV 是完整個資，存到哪裡、留多久要自己有規矩
- 改動 `supabase/migrations/` 底下的權限政策之後，跑一次 `npm run verify:rls` 再上線

## 授權

尚未指定授權條款。要開放別人取用的話，記得補一份 LICENSE。
