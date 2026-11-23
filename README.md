# 🚗 智慧找車位與一鍵導航服務 (Smart Parking Finder)

🌐 **線上使用網址 (GitHub Pages)**：https://jackgao1234.github.io/smart-parking/

專為手機單手操作（如 Google Pixel）與行車前快速查詢設計的台灣停車場即時空位篩選與 Google Maps 一鍵導航服務。

## 核心特色
1. **自動優先列出有空位停車場**：根據目的地座標與搜尋半徑（800m ~ 3.5km），自動將有空位（`AVAILABLE` / `LIMITED`）的停車場依距離由近到遠排在最上方。
2. **無空位（滿位）醒目標記與防呆鎖定**：當停車場剩餘車位為 `0` 格時，明確標示「🚫 已滿位 (剩 0 格)」並**強制鎖定導航按鈕 (`canNavigate = false`)**，避免誤點導航過去白跑一趟。
3. **一鍵切換 Google Maps 汽車導航模式**：採用 Google Maps Universal Cross-Platform URL (`travelmode=driving&dir_action=navigate`)，在 Pixel 手機點擊即可直接喚起 Google Maps App 進入汽車導航。

## 快速啟動與測試

```bash
# 執行自動化測試 (Vitest 單元測試 + API 整合測試)
npm test

# 啟動開發伺服器 (預設 http://localhost:3000)
npm run dev
```

## 手機連線使用方式
若您的 Pixel 手機與電腦在同一個 Wi-Fi 網路下：
1. 啟動伺服器：`npm start`
2. 查看電腦的區網 IP（例如 `192.168.x.x`），在 Pixel 手機 Chrome 開啟 `http://<電腦區網IP>:3000`
3. 也可點擊瀏覽器選單「加到主畫面 (Add to Home screen)」，即可像原生 App 一樣秒開使用。
