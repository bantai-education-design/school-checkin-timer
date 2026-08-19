# School Check-in Timer

朝の「心の天気」と朝の準備を入口に、担任が出席・健康観察・教室のようすを簡単に把握するための校内LAN向けWebアプリです。

## 主要画面

- `teacher.html` 担任ホーム
- `attendance.html` 今日の出席・健康観察
- `dashboard.html` 心の天気・教室のようす
- `monthly-attendance.html` 月間出席簿
- `term-attendance.html` 学期・年度集計
- `school-calendar.html` 授業日カレンダー
- `term-settings.html` 学期設定
- `setup.html` 児童端末初期設定
- `index.html` 児童画面
- `preview.html` 実装画面プレビュー

## 対応端末の考え方

児童端末はiPad / Androidのブラウザ利用を標準とし、原則として各端末へのアプリインストールは不要です。学校のMDM方針で許可される場合のみ、ホーム画面追加やPWA運用を検討します。

Webページ単独では指定時刻にSafari / Chromeを強制起動できません。自動起動・Web Clip・キオスク運用は学校のMDMや端末管理と組み合わせます。

## 低学年 / 高学年

担任の初期設定で配信モードを選びます。

- 低学年: ひらがな中心、大きな絵、アナログ時計
- 高学年: 漢字混じり、一覧性重視、デジタル時計

児童画面上では「低学年」「高学年」ではなく、設定された学年・組を表示する設計です。

## データの分離

次の情報は用途が近くても相互に自動変換・上書きしません。

- 出席
- 健康観察
- 心の天気

心の天気は診断・評価・順位付けのためではなく、担任が声をかける手がかりとして扱います。未チェックインを欠席確定にはしません。

## 出席簿

今日の出席確認に加え、月間・学期・年度の集計を行います。児童別の横合計、日別の縦合計、欠席理由、遅刻、早退、病欠、事故欠等を確認できる構成です。授業日カレンダーと学期設定を別管理し、振替休業日等を反映できるようにしています。

## C4th

担任ホームにC4th CSV名簿取込の受け皿があります。CSVはブラウザ内で読み込み、列対応を確認して名簿欄へ反映する設計です。実学校のCSV形式は導入前に確認します。

## 起動

Node.js 20以上を使用します。

```bash
npm install
npm run preflight
npm start
```

担任PCでは通常、次を開きます。

```text
http://localhost:8080/teacher.html
```

児童端末は担任PCのIPv4アドレスを使います。

```text
http://<担任PC-IP>:8080/
```

詳細は `LAN_SETUP.md` を参照してください。

## テスト

```bash
npm run preflight
npm run test:smoke
npm run test:visual
```

Visual Checkは1366 / 1024 / 768 / 375pxを中心に、低学年・高学年・担任・出席・ダッシュボード・月間・学期年度・学校暦・学期設定・初期設定・プレビューを確認します。横はみ出し、nowrap文字切れ、JavaScriptエラー、タスク画像読込、画像・文字・チェックマークの重なりも検査します。

## 保存領域

```text
server/data/classes/      学級設定・名簿・端末設定
server/data/history/      心の天気・朝の進捗履歴
server/data/attendance/   出席・健康観察・学校暦・確認履歴・行事メモ等
```

## 完成判定前に残る確認

コード・画面・自動テストとは別に、学校実機で次を確認します。

- Windows担任PCでの起動
- Windows Defender Firewall越しのLAN接続
- iPad / Androidブラウザからの接続
- 複数タブレットへのリアルタイム配信
- WebSocket切断 / 復帰
- 学校MDM方針
- C4th実CSVの列対応

詳細な最終確認項目は `QA_CHECKLIST.md`、現在地は `PHASE1_7_STATUS.md` を参照してください。
