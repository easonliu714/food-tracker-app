export type VersionLog = {
  version: string;
  date: string;
  content: string;
};

const BASE_LOGS_TW: VersionLog[] = [
  {
    version: 'V1.0.26',
    date: '2026-05-17',
    content: '[修正] 設定頁改版履歷正式改用多國語言履歷來源，修正 APK 已升版但履歷仍停留在 V1.0.20 的問題。\n[修正] 將 profile 頁面中的 getVersionLogs 從舊 i18n 檔案拆出，改由 lib/version-logs.ts 統一管理。\n[優化] 後續版本履歷與 App 版本號同步維護，降低打包後顯示舊履歷的風險。'
  },
  {
    version: 'V1.0.25',
    date: '2026-05-17',
    content: '[新增] 正式補齊 V1.0.21～V1.0.24 多國語言改版履歷，支援繁體中文、簡體中文、English、日本語、한국어。\n[優化] 統一 Health Connect 同步、步數、睡眠、授權與版本履歷相關文案，避免設定頁切換語言時出現未翻譯 key。\n[管理] 建立後續版本維護規則：每次功能修正同步更新版本號與多語履歷。'
  },
  {
    version: 'V1.0.24',
    date: '2026-05-17',
    content: '[修正] 睡眠同步改用本地跨日睡眠區間：前一天 22:00 到當天 10:00，更符合 Fitbit 與 Health Connect 的睡眠歸屬邏輯。\n[修正] 修正因查詢當日 00:00～23:59 導致睡眠只抓到 0.1h / 0.3h 片段的問題。\n[優化] 保留 Health Connect 睡眠來源與查詢區間診斷資訊，便於後續比對 Fitbit。'
  },
  {
    version: 'V1.0.23',
    date: '2026-05-17',
    content: '[修正] Health Connect 步數與睡眠改為依資料來源分組，優先採用 Fitbit，其次 Google Fit，避免多來源資料重複加總。\n[修正] 修正步數約為 Fitbit 2～3 倍的不合理偏高問題。\n[優化] 新增 Health Connect 來源診斷資訊，可追蹤 raw records、selected origin 與來源統計。'
  },
  {
    version: 'V1.0.22',
    date: '2026-05-17',
    content: '[修正] 補強 Android 14+ / Android 16 Health Connect 授權入口，新增 VIEW_PERMISSION_USAGE activity-alias。\n[修正] 側載 APK 安裝後 Nomi 無法出現在 Health Connect 應用程式權限清單的問題。\n[驗證] Nomi 已可在 Health Connect 內授權讀取步數、睡眠與運動資料。'
  },
  {
    version: 'V1.0.21',
    date: '2026-05-16',
    content: '[修正] 補強 AndroidManifest Health Connect 權限宣告，包含 READ_STEPS、READ_SLEEP、READ_EXERCISE 與 ACTIVITY_RECOGNITION。\n[優化] 新增 Health Connect 初始化與權限診斷邏輯，避免只回傳 true/false 而無法判斷失敗原因。\n[管理] 將 app.config.ts 與 package.json 版本升級納入 APK 測試核對流程。'
  },
  {
    version: 'V1.0.20',
    date: '2026-02-11',
    content: '本次更新包含多項體驗優化與錯誤修正：\n1. 修正導覽過程中輸入名稱時，對話框被鍵盤遮擋的問題。\n2. 修復 Android Health Connect 健康數據同步授權失敗的問題。\n3. 優化導覽亮框定位技術，完美適配各種螢幕尺寸，解決框線偏移問題。\n4. 優化 App 啟動流程，移除多餘的歡迎畫面，進入主畫面更快速。'
  }
];

const BASE_LOGS_CN: VersionLog[] = [
  {
    version: 'V1.0.26',
    date: '2026-05-17',
    content: '[修正] 设置页版本记录正式改用多语言版本记录来源，修正 APK 已升版但版本记录仍停留在 V1.0.20 的问题。\n[修正] 将 profile 页面中的 getVersionLogs 从旧 i18n 文件拆出，改由 lib/version-logs.ts 统一管理。\n[优化] 后续版本记录与 App 版本号同步维护，降低打包后显示旧版本记录的风险。'
  },
  ...BASE_LOGS_TW.slice(1).map((log) => ({
    ...log,
    content: log.content
      .replaceAll('新增', '新增')
      .replaceAll('修正', '修正')
      .replaceAll('優化', '优化')
      .replaceAll('管理', '管理')
      .replaceAll('補強', '补强')
      .replaceAll('設定', '设置')
      .replaceAll('資料', '数据')
      .replaceAll('語言', '语言')
      .replaceAll('繁體中文', '繁体中文')
      .replaceAll('簡體中文', '简体中文')
      .replaceAll('同步', '同步')
      .replaceAll('步數', '步数')
      .replaceAll('睡眠', '睡眠')
      .replaceAll('授權', '授权')
      .replaceAll('應用程式', '应用程序')
      .replaceAll('讀取', '读取')
      .replaceAll('紀錄', '记录')
      .replaceAll('啟動', '启动')
  }))
];

const BASE_LOGS_EN: VersionLog[] = [
  {
    version: 'V1.0.26',
    date: '2026-05-17',
    content: '[Fix] The Profile version history now uses the multilingual release-note source, fixing the case where the APK version was updated but the release notes still stopped at V1.0.20.\n[Fix] getVersionLogs was separated from the legacy i18n module and is now managed by lib/version-logs.ts.\n[Improved] Future release notes and app version numbers are maintained together to reduce stale-history risk after builds.'
  },
  {
    version: 'V1.0.25',
    date: '2026-05-17',
    content: '[New] Added official multilingual release notes for V1.0.21–V1.0.24 in Traditional Chinese, Simplified Chinese, English, Japanese, and Korean.\n[Improved] Unified copy for Health Connect sync, steps, sleep, permissions, and version history to prevent untranslated keys after switching languages.\n[Management] Established the maintenance rule that every functional change must update both the app version and multilingual release notes.'
  },
  {
    version: 'V1.0.24',
    date: '2026-05-17',
    content: '[Fix] Sleep sync now uses the local overnight window from 22:00 on the previous day to 10:00 on the selected day, matching Fitbit and Health Connect attribution more closely.\n[Fix] Fixed cases where querying 00:00–23:59 only captured tiny sleep fragments such as 0.1h or 0.3h.\n[Improved] Kept diagnostics for Health Connect sleep source and query window for Fitbit comparison.'
  },
  {
    version: 'V1.0.23',
    date: '2026-05-17',
    content: '[Fix] Health Connect steps and sleep records are now grouped by data origin, with Fitbit preferred first and Google Fit second to prevent duplicate aggregation across multiple sources.\n[Fix] Fixed inflated step totals that were about 2–3 times higher than Fitbit.\n[Improved] Added Health Connect source diagnostics including raw records, selected origin, and origin totals.'
  },
  {
    version: 'V1.0.22',
    date: '2026-05-17',
    content: '[Fix] Added Android 14+ / Android 16 Health Connect permission usage entry with VIEW_PERMISSION_USAGE activity-alias.\n[Fix] Fixed the issue where the sideloaded Nomi APK did not appear in the Health Connect app permission list.\n[Verified] Nomi can now be authorized in Health Connect to read steps, sleep, and exercise data.'
  },
  {
    version: 'V1.0.21',
    date: '2026-05-16',
    content: '[Fix] Strengthened AndroidManifest Health Connect permission declarations including READ_STEPS, READ_SLEEP, READ_EXERCISE, and ACTIVITY_RECOGNITION.\n[Improved] Added detailed Health Connect initialization and permission diagnostics instead of returning only true/false.\n[Management] Included app.config.ts and package.json version checks in the APK test flow.'
  },
  {
    version: 'V1.0.20',
    date: '2026-02-11',
    content: 'This update includes several experience optimizations and bug fixes:\n1. Fixed the issue where the dialog box was blocked by the keyboard when entering a name during the tutorial.\n2. Fixed Android Health Connect authorization failure while syncing health data.\n3. Improved tutorial highlight positioning for different screen sizes and fixed offset issues.\n4. Optimized app startup by removing unnecessary welcome screens.'
  }
];

const BASE_LOGS_JP: VersionLog[] = [
  {
    version: 'V1.0.26',
    date: '2026-05-17',
    content: '[修正] プロフィール画面のバージョン履歴が多言語リリースノートを参照するようになり、APKのバージョンは更新されているのに履歴がV1.0.20で止まる問題を修正しました。\n[修正] getVersionLogsを従来のi18nファイルから分離し、lib/version-logs.tsで一元管理するようにしました。\n[改善] 今後のリリースノートとアプリのバージョン番号を同時に管理し、ビルド後に古い履歴が表示されるリスクを低減しました。'
  },
  ...BASE_LOGS_EN.slice(1).map((log) => ({ ...log }))
];

const BASE_LOGS_KO: VersionLog[] = [
  {
    version: 'V1.0.26',
    date: '2026-05-17',
    content: '[수정] 프로필 화면의 버전 기록이 다국어 릴리스 노트 소스를 사용하도록 변경되어, APK 버전은 올라갔지만 기록이 V1.0.20에 머무르던 문제를 수정했습니다.\n[수정] getVersionLogs를 기존 i18n 파일에서 분리하고 lib/version-logs.ts에서 통합 관리하도록 했습니다.\n[개선] 앞으로 릴리스 노트와 앱 버전 번호를 함께 관리하여 빌드 후 오래된 기록이 표시될 위험을 줄였습니다.'
  },
  ...BASE_LOGS_EN.slice(1).map((log) => ({ ...log }))
];

export const getVersionLogs = (lang: string): VersionLog[] => {
  if (lang === 'zh-TW') return BASE_LOGS_TW;
  if (lang === 'zh-CN') return BASE_LOGS_CN;
  if (lang === 'ja') return BASE_LOGS_JP;
  if (lang === 'ko') return BASE_LOGS_KO;
  return BASE_LOGS_EN;
};
