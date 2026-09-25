# 驗證紀錄

驗證日期：2026-09-25。以下結果使用隔離的測試瀏覽器資料，不包含或修改使用者的真實訓練紀錄。

## 結果

- Node.js：8 項資料模型測試通過。
- Chrome 手機尺寸模擬：19 項完整操作測試通過，沒有 console error 或未捕捉的 runtime error。
- WebKit 26.5／iPhone 13 模擬：9 項相容性檢查通過，沒有未捕捉的 runtime error。
- JavaScript 語法檢查通過。
- 實際檢視 Chrome 與 WebKit 截圖，修正了日期標籤換行、輸入框字級、備註佔位及底部按鈕遮擋。

## 需求檢查表

| 項目 | 驗證方式與結果 |
| --- | --- |
| App 啟動 | 首頁顯示三階段、固定四頁導覽；通過 |
| 新增自訂 Exercise | 新增 Cable Fly、自訂 Cable 分類、1.25 kg 增量；通過 |
| 修改 Exercise | 修改名稱後讀回 IndexedDB；通過 |
| 刪除 Exercise | 動作庫移除，過去名稱快照與組數仍保留；通過 |
| Favorite | 設定、取消、重新設定；通過 |
| Warm-up | 儲存速度／坡度／時間，坡度保留於歷史、複製文字、JSON 與上次值；WebKit 另測 15 reps × 2 sets；通過 |
| Strength | ±5／±1 操作、連續三組、RPE、備註；通過 |
| 每組編輯與刪除 | 修改第二組次數、刪除第二組後讀回；通過 |
| Cardio | 速度、坡度、時間、距離儲存；通過 |
| 上次重量帶入 | 透過 JSON 匯入較早日期，今天自動帶入 45 kg／10 reps；通過 |
| Refresh 資料保留 | 真正重整頁面後讀取原紀錄；通過 |
| History | 依日期查看三階段、單動作歷史；通過 |
| 複製給 ChatGPT | 讀取 Chrome 真實剪貼簿，確認日期、階段、組數、RPE、備註；通過 |
| 剪貼簿拒絕時 | WebKit 模擬寫入失敗，確認完整文字與全選功能；通過 |
| Export JSON | 實際下載並解析檔案；通過 |
| Import JSON | 還原備份、拒絕格式錯誤的檔案且原資料不變；通過 |
| 排序 | 上移第二個重訓項目，確認保存順序；通過 |
| 單位／主題 | 45 kg 正確顯示為 99.21 lb，深淺主題切換；通過 |
| 清除資料 | 確認後清空動作及訓練，再匯入還原；通過 |
| Manifest／Icons | standalone、相對 start URL、192／512 PNG 資源正常；Apple icon 180×180 已提供 |
| Service Worker | ready、controller、App Shell Cache Storage 實際存在；通過 |
| Offline | Chrome 設為斷網後重整、記錄、再重整；通過 |
| WebKit 無伺服器 | 結束專用測試伺服器，確認直接 HTTP 請求失敗，瀏覽器仍能由 SW 重整與記錄；通過 |
| iPhone 基本相容性 | WebKit iPhone 13 模擬的 IndexedDB、表單、觸控尺寸與頁面流程；通過 |
| 手機排版 | Chrome 320／390 px 無水平捲動；WebKit 驗證完成按鈕整個位於導覽列上方 |

## 測試限制

沒有操作實體 iPhone，不能把引擎模擬等同真機驗收。尚需真機確認 Safari 分享選單「加入主畫面」、standalone 顯示、主畫面圖示、安全區域、鍵盤與飛航模式下冷啟動。

WebKit 的 `setOffline(true)` 在 Service Worker 導覽有已知測試工具問題，因此 WebKit 測試改用關閉實際 origin 的方式驗證，而 Chrome 仍執行真正的離線模擬。問題紀錄：[Playwright #42775](https://github.com/microsoft/playwright/issues/42775)。

GitHub Pages workflow 已在使用者 repository 成功執行，網站位於 https://zack901225.github.io/gym-log/ 。實驗性 WebMCP 只在瀏覽器提供 API 時註冊唯讀工具；目前瀏覽器未提供原生 WebMCP，因此未驗證其實際註冊，這不影響 App 的任何必要功能。

## 重現方式

見 README「測試」段落。自動產生的證據（在 `.gitignore` 排除）包括：

- `test-results/browser-results.json`
- `test-results/webkit-results.json`
- `test-results/today-empty.png`
- `test-results/today-recorded.png`
- `test-results/record.png`
- `test-results/webkit-record.png`

## iPhone 安裝後快速驗收

1. 從主畫面開啟，確認沒有一般 Safari 網址列。
2. 設定頁等待「離線資源已備妥」。
3. 新增一個自己的動作，記錄兩組。
4. 完全關閉後開啟，確認紀錄仍在。
5. 開啟飛航模式，再關閉／開啟 App，記錄第三組。
6. 關閉飛航模式，複製文字到 ChatGPT。
7. 匯出 JSON 到「檔案」，確認備份確實保存。
