# 好好練 · ONE MORE SET

給自己在健身房用的輕量 PWA。打開就是今天的「熱身 → 重訓 → 有氧」，以按鈕快速記錄，再一鍵複製純文字給 ChatGPT。

原生 HTML、CSS、JavaScript；無框架、無帳號、無後端、無外部字型或 CDN。正式使用只需要部署 `dist/` 裡的靜態檔案。

## 本機啟動

安裝 Node.js 22 或更新版本，在這個專案資料夾開啟終端機：

```sh
npm start
```

不需要 `npm install`。用電腦瀏覽器開啟 **http://127.0.0.1:4173**。不要直接雙擊 `index.html`，`file://` 無法正常使用模組和 Service Worker。

若 PowerShell 不允許執行 `npm.ps1`，改用 `npm.cmd start` 或：

```sh
node scripts/serve.mjs
```

這個網址只供同一台電腦使用，不能直接在 iPhone 開啟。手機正式使用請先部署到 HTTPS 網址。

## 日常使用

1. **今天**：依序新增熱身、重訓、有氧；訓練名稱可留白。
2. **挑動作**：常用動作優先，分類按鈕可左右滑動。星號可以切換常用。
3. **重訓**：顯示最近一次較早日期的訓練。新一天預填上次第一組重量／次數；同一天繼續時預填今天最後一組。
4. **完成這組**：按完就儲存，下組保留相同數值。± 按鈕依動作設定調整重量，次數用 ±1／±5，也能點數字直接輸入。RPE 可不選，再點同一個數字可取消。
5. **更正**：每組旁的筆形按鈕可編輯，× 可刪除；首頁 ↑／↓ 調整同階段內的動作順序。
6. **熱身／有氧**：熱身可記時間、速度、坡度、次數、組數；有氧可記速度、坡度、時間與選填距離。按完成才算完成紀錄。
7. **備註**：展開「備註（選填）」。完成紀錄時一起保存，也可按「只儲存備註」。未按儲存的欄位是草稿。
8. **複製給 ChatGPT**：複製日期、訓練名稱、三個階段、每組重量次數、RPE 與備註。未完成的項目不會混入輸出。瀏覽器拒絕剪貼簿權限時，提供可全選複製的文字頁面。

同一天再次選相同動作會開啟既有項目；第一版每個動作每階段一天保留一筆項目，其中重訓可有多組。首頁以裝置本地日期換日；跨午夜時，已開啟的紀錄畫面仍保存到畫面標示的日期，返回「今天」才切到新的一天。

## 動作庫與歷史

- 預載 22 個常見動作，包括胸、背、肩、腿、手臂、熱身、有氧。
- 可以新增、改名、改類型、改增量、改分類、設常用、刪除。
- 分類欄可直接輸入新名稱；分類清單會自動擴充。
- 動作庫點名稱可看最近 10 次訓練，點筆形按鈕編輯設定。
- 修改或刪除動作不改寫歷史的名稱快照與組數。
- 「歷史」依日期顯示完整三階段紀錄，也能複製當天文字。

## 設定與備份

- **kg／lb**：重量統一以 kg 保存，切換單位會換算顯示，沒有把原數字直接換標籤。速度與距離固定為 km/h、km。
- **深色／淺色／跟隨系統**。
- **匯出 JSON**：包含動作、分類、訓練、備註、設定與資料版本。
- **匯入 JSON**：先驗證格式與數值，再提示取代現有資料；匯入是整份還原，不是合併。錯誤檔案不會清掉原資料，檔案上限 20 MB。
- **清除所有資料**：確認後清除訓練與自訂／預設動作，重設顯示設定；之後可以新增動作或匯入備份。

請定期把備份存到「檔案」或其他安全位置。IndexedDB 能跨重新整理／關閉頁面保留，但不是雲端備份：清除網站資料、移除 App、瀏覽器儲存空間回收等仍可能移除紀錄。Safari 與主畫面 App 可能使用不同儲存空間，建議固定從主畫面使用；換入口或換手機時用 JSON 匯出／匯入。

## 部署到 GitHub Pages

專案已附 `.github/workflows/pages.yml`，只發布 `dist/`，不會發布你的本機 IndexedDB 或測試檔案。

1. 在 GitHub 建立 repository（例如 `gym-log`）。使用免費帳號時可選公開 repository；**程式碼公開不代表你手機裡的紀錄會上傳**。
2. 將整份專案推送到 `main`，包含隱藏的 `.github` 資料夾。不要上傳 `test-results/`、`node_modules/` 或私人 JSON 備份。
3. 在 repository 的 **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**。
4. 開啟 **Actions → Deploy GitHub Pages → Run workflow**，或再次推送 `main` 觸發部署。
5. 成功後在 Pages 頁面取得 HTTPS 網址，通常為 `https://你的帳號.github.io/gym-log/`。

Workflow 會先跑資料測試與語法檢查，再發布靜態檔案。若預設分支不是 `main`，請修改 workflow 的 `branches`。GitHub Pages 的自訂 workflow 設定可參考 [GitHub 官方文件](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)。

所有資源路徑、manifest 起始網址與 Service Worker 都是相對路徑，支援 GitHub Pages 的 repository 子目錄。也可把 `dist/` 內容部署到其他 HTTPS 靜態網站空間，不需要 build、資料庫或環境變數。

此專案的 GitHub repository 為 [zack901225/gym-log](https://github.com/zack901225/gym-log)。首次啟用 Pages 並成功部署後，可用 `https://zack901225.github.io/gym-log/` 開啟 App。

## iPhone Safari 與主畫面

1. 用 Safari 開啟部署後的 **HTTPS 網址**。
2. 點 Safari 的分享按鈕，選「加入主畫面」。較新版本若顯示「作為網頁 App 開啟」選項，保持開啟，再按加入。
3. 從新圖示開啟 App；首次保持連線，前往「設定」，確認 **✓ 離線資源已備妥**。
4. 之後可在無網路的健身房繼續使用。可先以飛航模式關閉再開啟 App，完成一組、重開確認資料仍在。

已設定 `display: standalone`、手機 viewport、安全區域、Apple touch icon（180×180）、PWA icons（192×192／512×512）與 Service Worker。Safari 加入主畫面的系統操作參考 [Apple 官方說明](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios)。

相容性以現代 iPhone Safari 為目標（建議 iOS 16.4 以上）。桌面 WebKit 模擬不等於實體 iPhone；主畫面安裝、鍵盤、安全區域及真機飛航模式仍需在手機確認。

## 離線與更新

Service Worker 預先快取 HTML、CSS、JavaScript、manifest、圖示。訓練資料獨立存在 IndexedDB，快取更新不會刪除訓練。

發布新版本時，將 `dist/sw.js` 的 `CACHE`（如 `one-more-set-v1`）改成新版本再部署。連線開啟一次讓新版資源下載，關閉該網站的所有分頁及主畫面 App，再開啟即可使用新版。刻意不在訓練途中強制重新載入。若改網址／網域，本機儲存不會自動搬移，請先備份。

## 專案結構

```text
dist/
  index.html          App 入口、iPhone metadata
  styles.css          手機優先介面與三種主題
  app.js              畫面、路由、互動與匯入匯出
  model.js            資料模型、預設動作、格式驗證、文字輸出
  storage.js          IndexedDB 原子寫入與版本衝突保護
  manifest.json       PWA 設定
  sw.js               App Shell 離線快取
  icons/              主畫面與網站圖示
scripts/serve.mjs     零依賴本機靜態伺服器
tests/               資料測試、Chrome 操作測試、WebKit 相容性測試
.github/workflows/   GitHub Pages 自動部署
```

資料採 `schemaVersion: 1`。Workout 依日期儲存三種 entries；entry 保存動作 ID 與名稱快照；Strength set 保存 kg、reps、RPE、時間戳。Warm-up／Cardio entry 有 `completed` 區分已選動作與完成紀錄。每次寫入會等 IndexedDB transaction 完成才顯示成功；revision 衝突保護避免多分頁靜默覆蓋資料。

## 測試

不需額外套件的檢查：

```sh
npm test
npm run check
```

Chrome／WebKit 自動化測試需要 Playwright（僅測試用途，App 本身不需要）。已安裝 Playwright 時，可用 `PLAYWRIGHT_MODULE` 指向它，或在本機安裝測試套件：

```sh
npm install --no-save playwright
npx playwright install webkit
# 另一個終端機執行 npm start 後：
node tests/browser.mjs
node tests/webkit.mjs
```

Chrome 測試使用電腦上已安裝的 Chrome。WebKit 測試自建 4174 埠測試伺服器，關閉該伺服器後驗證快取；不會關閉你在 4173 埠的預覽。測試使用隔離的臨時瀏覽器資料，不會污染你的真實紀錄。結果與截圖在 `test-results/`。

完整驗證範圍與限制請見 [TESTING.md](TESTING.md)。
