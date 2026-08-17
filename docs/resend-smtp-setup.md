# 用 Resend 寄 Supabase 認證信

## 為什麼要做這件事

Supabase 內建的寄信服務**一小時只能寄 2 到 4 封**，而且明文寫著只供開發測試用。上線後只要幾個家長同時註冊，後面的人就收不到確認信，畫面上還看不出任何異常——他們只會以為系統壞了。

接上 Resend 之後，寄信改走你自己的網域，額度是免費方案每天 3000 封（每月 100 封以內不限網域），也能在 Resend 後台看到每封信的送達狀況。

**目前的狀態**（2026-08-17 查證）：`mailer_autoconfirm = false`，也就是信箱驗證開著，家長註冊後必須收信點連結才能登入。系統的程式碼兩種設定都支援，但只要維持驗證開著，這份設定就是上線前必做。

---

## 第一步：Resend 這邊

### 1. 建立帳號與驗證寄件網域

到 https://resend.com 註冊，進入 **Domains** → **Add Domain**，填入你要用來寄信的網域（例如 `example.org`，或用子網域 `mail.example.org` 把行銷信與系統信分開）。

Resend 會給你幾筆 DNS 記錄，到網域註冊商的 DNS 設定頁面加進去：

| 類型 | 用途 | 一定要加嗎 |
|---|---|---|
| MX | 接收退信通知 | 是 |
| TXT（SPF） | 宣告 Resend 有權代你寄信 | 是 |
| TXT（DKIM） | 信件簽章，沒有的話會被判垃圾信 | 是 |
| TXT（DMARC） | 收件方的處理政策 | 建議加 |

DNS 生效通常幾分鐘到幾小時。Resend 的 Domains 頁面狀態變成 **Verified** 才算完成。

> **注意**：沒有驗證網域也能用 Resend 的測試網域 `onboarding@resend.dev` 寄信，但那只能寄給你自己的註冊信箱，家長收不到。正式上線一定要驗證自己的網域。

### 2. 取得 SMTP 憑證

到 **API Keys** → **Create API Key**，權限選 **Sending access**，名稱填 `supabase-auth` 之類好認的。

**金鑰只會顯示這一次**，先複製起來。

Supabase 要的是 SMTP 形式的帳密，對應關係是：

| Supabase 欄位 | 要填什麼 |
|---|---|
| Host | `smtp.resend.com` |
| Port | `465` |
| Username | `resend`（就是這個字，不是你的信箱） |
| Password | 剛才那把 API Key（`re_` 開頭那串） |

---

## 第二步：Supabase 這邊

進 https://supabase.com/dashboard，選專案 `your-project-ref`。

### 1. 設定 SMTP

**Project Settings** → **Authentication** → 往下找 **SMTP Settings** → 打開 **Enable Custom SMTP**：

- **Sender email**：`noreply@你的網域`（必須是上一步驗證過的網域）
- **Sender name**：`老莫機器人教育中心`
- **Host**：`smtp.resend.com`
- **Port**：`465`
- **Username**：`resend`
- **Password**：你的 Resend API Key

按 **Save**。

### 2. 設定網址（漏了這步，確認信的連結會指回 localhost）

**Authentication** → **URL Configuration**：

- **Site URL**：填正式網域（例如 `https://your-site.netlify.app` 或你自己的網域）
- **Redirect URLs**：把下面兩個都加進去
  - `https://你的正式網域/**`
  - `http://localhost:5173/**`（本機開發用）

### 3. 把信件範本改成中文（預設是英文的）

**Authentication** → **Email Templates**，至少改 **Confirm signup** 這一封。家長收到滿是英文的信會直接當成詐騙信刪掉。

**主旨**：

```
請確認您的信箱 — 老莫機器人教育中心
```

**內容**（HTML）：

```html
<h2>歡迎加入老莫機器人教育中心</h2>

<p>您好，感謝您註冊老莫機器人教育中心的報名系統。</p>

<p>請點選下面的連結完成信箱驗證，之後就可以登入填寫報名資訊：</p>

<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">
    確認我的信箱
  </a>
</p>

<p style="color:#64748b;font-size:14px;">
  如果按鈕沒有反應，請複製下面的網址貼到瀏覽器：<br>
  {{ .ConfirmationURL }}
</p>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

<p style="color:#64748b;font-size:14px;">
  如果您沒有註冊過本系統，請直接忽略這封信。
</p>
```

`{{ .ConfirmationURL }}` 是 Supabase 的變數，**不要改動**，它會被換成實際的驗證連結。

---

#### 重設密碼（Reset password）

家長忘記密碼時會收到這封。**這封一定要改**，因為它是家長第二常收到的信。

**主旨**：

```
重設您的密碼 — 老莫機器人教育中心
```

**內容**：

```html
<h2>重設密碼</h2>

<p>您好，我們收到了重設密碼的要求。</p>

<p>請點選下面的連結設定新密碼，連結在一小時內有效：</p>

<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">
    設定新密碼
  </a>
</p>

<p style="color:#64748b;font-size:14px;">
  如果按鈕沒有反應，請複製下面的網址貼到瀏覽器：<br>
  {{ .ConfirmationURL }}
</p>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

<p style="color:#64748b;font-size:14px;">
  如果這不是您本人的操作，請忽略這封信，您的密碼不會有任何變動。
</p>
```

---

#### 變更信箱（Change Email Address）

家長改註冊信箱時，新舊兩個信箱都會收到。

**主旨**：

```
確認您的新信箱 — 老莫機器人教育中心
```

**內容**：

```html
<h2>確認新的信箱地址</h2>

<p>您好，我們收到了將帳號信箱從 {{ .Email }} 變更為 {{ .NewEmail }} 的要求。</p>

<p>請點選下面的連結完成確認：</p>

<p>
  <a href="{{ .ConfirmationURL }}"
     style="display:inline-block;padding:12px 24px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;">
    確認變更
  </a>
</p>

<p style="color:#64748b;font-size:14px;">
  如果按鈕沒有反應，請複製下面的網址貼到瀏覽器：<br>
  {{ .ConfirmationURL }}
</p>

<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;">

<p style="color:#64748b;font-size:14px;">
  如果這不是您本人的操作，請立即聯絡老莫機器人教育中心。
</p>
```

---

#### 用不到的兩封

**Magic Link**（免密碼登入）與 **Invite user**（邀請使用者）目前的系統沒有用到——登入方式只開了信箱加密碼，管理員也是直接改資料庫的角色欄位。這兩封可以先不管，之後真的要用再改。

---

#### 貼上時的注意事項

- **變數不要動**：`{{ .ConfirmationURL }}`、`{{ .Email }}`、`{{ .NewEmail }}` 都是 Supabase 會替換的變數，連大小寫和空格都要照原樣。
- **改完按 Save**，每一封範本都是獨立儲存的。
- 改完先寄一封給自己看實際效果——範本編輯器裡的預覽不會渲染樣式。

---

## 第三步：驗證真的能寄

1. 到系統的註冊頁填一個你收得到的信箱，送出
2. 應該看到「請到信箱收確認信」的說明畫面（不是被踢回登入頁）
3. 收信，確認：
   - 寄件人是你設定的網域，不是 `noreply@mail.app.supabase.io`
   - 內容是中文
   - 點連結後回到系統，可以正常登入
4. 到 Resend 後台的 **Emails** 頁面，應該看得到這封信的送達紀錄

如果沒收到信，先看 Resend 後台有沒有紀錄：
- **有紀錄但顯示失敗** → 看失敗原因，多半是 DNS 沒設好或寄件網域對不上
- **完全沒有紀錄** → Supabase 的 SMTP 設定沒生效，回頭檢查 Host／Port／Username／Password

---

## 如果你決定不要信箱驗證

也可以不做上面這些，改成讓家長註冊完直接就能報名：

**Authentication** → **Providers** → **Email** → 關掉 **Confirm email**。

系統的程式碼兩種都支援，關掉之後註冊會直接拿到登入狀態、導向報名頁。

**但要知道代價**：任何人都能用不存在的信箱註冊，你會收到假報名；而且家長忘記密碼時沒辦法用信箱重設（重設密碼信本身也需要能寄信）。

補習班的情境下，我的建議是**維持信箱驗證並接上 Resend**——多花二十分鐘設定，換到的是「報名的人真的存在」與「家長能自己重設密碼」。

---

## 安全提醒

Resend 的 API Key 只放在 Supabase 主控台的 SMTP 設定裡。

**絕對不要**把它寫進 `.env` 的 `VITE_` 開頭變數，也不要放進前端程式碼——那會被打包進瀏覽器，任何人都能拿去用你的網域寄信。
