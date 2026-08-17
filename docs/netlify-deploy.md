# 部署到 Netlify

這個系統是純前端（Vite 打包成靜態檔），資料都放在 Supabase，沒有自己的伺服器程式，所以放 Netlify 這種靜態網站託管服務剛剛好，免費方案就夠用。

## 專案裡已經準備好的部分

這兩個檔案不用你動，建置設定都寫好了：

**`netlify.toml`** — 告訴 Netlify 怎麼建置

```toml
[build]
  command = "npm run build"
  publish = "dist"

[build.environment]
  NODE_VERSION = "22"
```

**`public/_redirects`** — 單頁應用的轉址規則

```
/*    /index.html   200
```

這一行很關鍵。系統的網址（`/apply`、`/my`、`/admin`）都是前端自己接的，伺服器上並不存在這些資料夾。沒有這條規則的話，家長在 `/my` 按重新整理會拿到 404；有了它，任何路徑都先回傳首頁，再由前端決定要顯示哪一頁。

---

## 第一步：接上 GitHub

1. 到 https://app.netlify.com 登入（可以直接用 GitHub 帳號登入）
2. 點 **Add new site** → **Import an existing project**
3. 選 **Deploy with GitHub**，授權 Netlify 讀取你的 repo
4. 在清單裡選 **your-account/your-repo**
5. 建置設定畫面會自動讀到 `netlify.toml` 的內容，**不用改**：
   - Branch to deploy：`main`
   - Build command：`npm run build`
   - Publish directory：`dist`

**先不要按 Deploy**——下一步的環境變數要先填，不然第一次建置出來的網站連不上資料庫。

## 第二步：填環境變數

同一個畫面往下找 **Add environment variables**（或建站後到 **Site configuration** → **Environment variables**），加這兩個：

| 變數名稱 | 值 |
|---|---|
| `VITE_SUPABASE_URL` | 你 `.env` 裡的同名值 |
| `VITE_SUPABASE_ANON_KEY` | 你 `.env` 裡的同名值 |

值直接從專案根目錄的 `.env` 複製過去就好（`.env` 本身不會進 git，所以 Netlify 讀不到，一定要手動填）。

**`SUPABASE_SERVICE_ROLE_KEY` 絕對不要填上去。** 那把金鑰能繞過所有權限檢查、直接讀寫全部資料，它只給你本機 `scripts/` 底下的匯入腳本用。Netlify 上完全用不到。

填完按 **Deploy**。第一次建置大約一到兩分鐘。

## 第三步：回頭補 Supabase 的網址設定

建置完 Netlify 會給你一個網址，長得像 `https://隨機名稱.netlify.app`。想換好記一點的名字，到 **Site configuration** → **Change site name** 改（例如 `laomo-robot`，網址就變成 `https://laomo-robot.netlify.app`）。

拿到正式網址後，**一定要回 Supabase 補設定**，不然註冊確認信裡的連結會指回 `localhost`，家長點了開不起來：

進 https://supabase.com/dashboard 選專案 `your-project-ref` → **Authentication** → **URL Configuration**：

- **Site URL**：填 Netlify 給的正式網址
- **Redirect URLs**：加這兩筆
  - `https://你的正式網域/**`
  - `http://localhost:5173/**`（本機開發還會用到，留著）

改完按 Save。

---

## 上線後要實測的四件事

部署完不要只看首頁有沒有出來，這四項每一項都是實際會出問題的地方：

1. **首頁能開，圖片有載入** — 確認 `hero.webp` 沒有 404
2. **在 `/my` 或 `/admin` 按重新整理不會 404** — 這是在驗 `_redirects` 有沒有生效
3. **註冊一個測試帳號，收得到中文確認信** — 這是在驗 Resend 的 SMTP 設定（見 `docs/resend-smtp-setup.md`）
4. **登入後能查到學校、送出報名** — 這是在驗環境變數有填對，連得上資料庫

第 4 項如果失敗，多半是環境變數漏填或貼錯。打開瀏覽器的開發者工具看主控台，如果出現連線相關的錯誤，就是這個原因。

---

## 之後怎麼更新

接上 GitHub 之後就不用再手動部署了：**推送到 `main` 分支，Netlify 會自動重新建置上線**，大約兩分鐘。

在 Netlify 後台的 **Deploys** 頁面可以看每次建置的紀錄。如果建置失敗，點進去看紀錄，最常見的原因是型別檢查或測試沒過——所以推送前先在本機跑一次 `npm test` 跟 `npm run typecheck` 比較保險。

要退回上一版也在同一頁：找到之前成功的那次建置，點 **Publish deploy** 就會立刻切回去。

---

## 一份不能省的提醒

`.env` 已經被 `.gitignore` 擋掉了，不會跟著推上 GitHub。**不要為了方便部署就把它加進版本控制**——那等於把資料庫金鑰公開在網路上，任何人都能拿去讀寫你的報名資料。環境變數就是要一個一個填進 Netlify 後台，這個麻煩是必要的。
