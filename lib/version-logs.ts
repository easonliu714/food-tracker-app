export type VersionLog = {
  version: string;
  date: string;
  content: string;
};

const LOGS_TW: VersionLog[] = [
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

const LOGS_CN: VersionLog[] = [
  {
    version: 'V1.0.25',
    date: '2026-05-17',
    content: '[新增] 正式补齐 V1.0.21～V1.0.24 多语言版本记录，支持繁体中文、简体中文、English、日本語、한국어。\n[优化] 统一 Health Connect 同步、步数、睡眠、授权与版本记录相关文案，避免设置页切换语言时出现未翻译 key。\n[管理] 建立后续版本维护规则：每次功能修正同步更新版本号与多语言版本记录。'
  },
  {
    version: 'V1.0.24',
    date: '2026-05-17',
    content: '[修正] 睡眠同步改用本地跨日睡眠区间：前一天 22:00 到当天 10:00，更符合 Fitbit 与 Health Connect 的睡眠归属逻辑。\n[修正] 修正因查询当天 00:00～23:59 导致睡眠只抓到 0.1h / 0.3h 片段的问题。\n[优化] 保留 Health Connect 睡眠来源与查询区间诊断信息，便于后续比对 Fitbit。'
  },
  {
    version: 'V1.0.23',
    date: '2026-05-17',
    content: '[修正] Health Connect 步数与睡眠改为按数据来源分组，优先采用 Fitbit，其次 Google Fit，避免多来源数据重复加总。\n[修正] 修正步数约为 Fitbit 2～3 倍的不合理偏高问题。\n[优化] 新增 Health Connect 来源诊断信息，可追踪 raw records、selected origin 与来源统计。'
  },
  {
    version: 'V1.0.22',
    date: '2026-05-17',
    content: '[修正] 补强 Android 14+ / Android 16 Health Connect 授权入口，新增 VIEW_PERMISSION_USAGE activity-alias。\n[修正] 侧载 APK 安装后 Nomi 无法出现在 Health Connect 应用权限列表的问题。\n[验证] Nomi 已可在 Health Connect 内授权读取步数、睡眠与运动数据。'
  },
  {
    version: 'V1.0.21',
    date: '2026-05-16',
    content: '[修正] 补强 AndroidManifest Health Connect 权限声明，包含 READ_STEPS、READ_SLEEP、READ_EXERCISE 与 ACTIVITY_RECOGNITION。\n[优化] 新增 Health Connect 初始化与权限诊断逻辑，避免只返回 true/false 而无法判断失败原因。\n[管理] 将 app.config.ts 与 package.json 版本升级纳入 APK 测试核对流程。'
  },
  {
    version: 'V1.0.20',
    date: '2026-02-11',
    content: '本次更新包含多项体验优化与错误修正：\n1. 修正导航过程中输入名称时，对话框被键盘遮挡的问题。\n2. 修复 Android Health Connect 健康数据同步授权失败的问题。\n3. 优化导航亮框定位技术，完美适配各种屏幕尺寸，解决框线偏移问题。\n4. 优化 App 启动流程，移除多余的欢迎画面，进入主画面更快速。'
  }
];

const LOGS_EN: VersionLog[] = [
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

const LOGS_JP: VersionLog[] = [
  {
    version: 'V1.0.25',
    date: '2026-05-17',
    content: '[新規] V1.0.21〜V1.0.24 の多言語版リリースノートを正式に追加しました。繁體中文、简体中文、English、日本語、한국어に対応しています。\n[改善] Health Connect同期、歩数、睡眠、権限、バージョン履歴に関する文言を統一し、言語切替時に未翻訳のキーが表示されないようにしました。\n[管理] 今後の機能修正では、アプリのバージョン番号と多言語リリースノートを同時に更新する運用にしました。'
  },
  {
    version: 'V1.0.24',
    date: '2026-05-17',
    content: '[修正] 睡眠同期をローカル時間の夜間ウィンドウ（前日22:00〜当日10:00）に変更し、FitbitおよびHealth Connectの睡眠日付の扱いにより近づけました。\n[修正] 当日00:00〜23:59の検索により、0.1h / 0.3h のような断片的な睡眠だけが取得される問題を修正しました。\n[改善] Fitbitとの比較に使えるよう、Health Connectの睡眠データ元と検索ウィンドウの診断情報を保持しました。'
  },
  {
    version: 'V1.0.23',
    date: '2026-05-17',
    content: '[修正] Health Connectの歩数と睡眠をデータ元ごとに集計し、Fitbitを優先、次にGoogle Fitを採用することで複数ソースの重複加算を防止しました。\n[修正] Fitbitの約2〜3倍になっていた歩数の過大表示を修正しました。\n[改善] raw records、selected origin、source totalsを含むHealth Connectソース診断を追加しました。'
  },
  {
    version: 'V1.0.22',
    date: '2026-05-17',
    content: '[修正] Android 14+ / Android 16向けにHealth Connect権限使用エントリを追加し、VIEW_PERMISSION_USAGE activity-aliasを設定しました。\n[修正] サイドロードされたNomi APKがHealth Connectのアプリ権限一覧に表示されない問題を修正しました。\n[検証] NomiがHealth Connectで歩数、睡眠、運動データの読み取り権限を取得できるようになりました。'
  },
  {
    version: 'V1.0.21',
    date: '2026-05-16',
    content: '[修正] AndroidManifestのHealth Connect権限宣言を強化し、READ_STEPS、READ_SLEEP、READ_EXERCISE、ACTIVITY_RECOGNITIONを追加しました。\n[改善] Health Connectの初期化と権限状態を詳細に診断できるようにし、true/falseだけでは原因が分からない問題を改善しました。\n[管理] APKテスト時に app.config.ts と package.json のバージョン確認を行う運用にしました。'
  },
  {
    version: 'V1.0.20',
    date: '2026-02-11',
    content: '今回のアップデートには、いくつかの体験改善と不具合修正が含まれています：\n1. チュートリアル中に名前を入力する際、キーボードによってダイアログが隠れる問題を修正しました。\n2. Android Health Connectとの健康データ同期時の認証失敗問題を修正しました。\n3. チュートリアルのハイライト位置を改善し、さまざまな画面サイズでのずれを修正しました。\n4. 不要なウェルカム画面を削除し、起動後すばやくメイン画面へ入れるようにしました。'
  }
];

const LOGS_KO: VersionLog[] = [
  {
    version: 'V1.0.25',
    date: '2026-05-17',
    content: '[신규] V1.0.21～V1.0.24의 다국어 릴리스 노트를 정식으로 추가했습니다. 번체 중국어, 간체 중국어, 영어, 일본어, 한국어를 지원합니다.\n[개선] Health Connect 동기화, 걸음 수, 수면, 권한, 버전 기록 관련 문구를 통일하여 언어 전환 시 번역되지 않은 키가 보이지 않도록 했습니다.\n[관리] 앞으로 기능이 변경될 때마다 앱 버전과 다국어 릴리스 노트를 함께 업데이트하도록 했습니다.'
  },
  {
    version: 'V1.0.24',
    date: '2026-05-17',
    content: '[수정] 수면 동기화가 현지 시간 기준 전날 22:00부터 당일 10:00까지의 야간 구간을 사용하도록 변경되어 Fitbit 및 Health Connect의 수면 날짜 귀속 방식과 더 잘 맞습니다.\n[수정] 00:00～23:59 조회로 인해 0.1h / 0.3h 같은 짧은 수면 조각만 가져오던 문제를 수정했습니다.\n[개선] Fitbit과 비교할 수 있도록 Health Connect 수면 데이터 출처와 조회 구간 진단 정보를 보존했습니다.'
  },
  {
    version: 'V1.0.23',
    date: '2026-05-17',
    content: '[수정] Health Connect의 걸음 수와 수면 기록을 데이터 출처별로 그룹화하고 Fitbit을 우선, Google Fit을 그다음으로 사용하여 여러 출처의 중복 합산을 방지했습니다.\n[수정] Fitbit보다 약 2～3배 높게 표시되던 걸음 수 문제를 수정했습니다.\n[개선] raw records, selected origin, origin totals를 포함한 Health Connect 출처 진단 정보를 추가했습니다.'
  },
  {
    version: 'V1.0.22',
    date: '2026-05-17',
    content: '[수정] Android 14+ / Android 16 Health Connect 권한 사용 진입점을 보강하고 VIEW_PERMISSION_USAGE activity-alias를 추가했습니다.\n[수정] 사이드로드된 Nomi APK가 Health Connect 앱 권한 목록에 나타나지 않던 문제를 수정했습니다.\n[검증] 이제 Nomi가 Health Connect에서 걸음 수, 수면, 운동 데이터 읽기 권한을 받을 수 있습니다.'
  },
  {
    version: 'V1.0.21',
    date: '2026-05-16',
    content: '[수정] AndroidManifest의 Health Connect 권한 선언을 보강하여 READ_STEPS, READ_SLEEP, READ_EXERCISE, ACTIVITY_RECOGNITION을 포함했습니다.\n[개선] Health Connect 초기화와 권한 상태를 자세히 진단하도록 하여 true/false만으로는 원인을 알 수 없던 문제를 개선했습니다.\n[관리] APK 테스트 과정에서 app.config.ts와 package.json 버전 확인을 포함했습니다.'
  },
  {
    version: 'V1.0.20',
    date: '2026-02-11',
    content: '이번 업데이트에는 여러 가지 경험 개선과 버그 수정이 포함되어 있습니다:\n1. 튜토리얼 중 이름 입력 시 키보드가 대화 상자를 가리는 문제를 수정했습니다.\n2. Android Health Connect 건강 데이터 동기화 권한 실패 문제를 수정했습니다.\n3. 다양한 화면 크기에 맞도록 튜토리얼 하이라이트 위치를 개선하고 오프셋 문제를 해결했습니다.\n4. 불필요한 시작 화면을 제거하여 메인 화면으로 더 빠르게 진입하도록 했습니다.'
  }
];

export const getVersionLogs = (lang: string): VersionLog[] => {
  if (lang === 'zh-TW') return LOGS_TW;
  if (lang === 'zh-CN') return LOGS_CN;
  if (lang === 'ja') return LOGS_JP;
  if (lang === 'ko') return LOGS_KO;
  return LOGS_EN;
};
