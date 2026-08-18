# 心の天気チェックイン＋朝のやることタイマー 実装計画

更新日: 2026-08-18

## 目的

校内LANで運用するWebアプリとして、児童の「心の天気チェックイン」と「朝のやることタイマー」を統合する。

担任が朝のチェック項目を変更すると、その学級の全児童タブレットへ即時反映できる構成とする。あわせて、現在時刻・朝の会までの残り時間・タスクタイマーを一体化する。

## 基本方針

- 児童端末はブラウザで利用し、個別インストールを不要にする。
- 校内LANのローカルサーバーを中心にする。
- 原則として外部クラウドへ児童データを送信しない。
- 低学年（1〜3年）と高学年（4〜6年）は同一システムで、表示のみ最適化する。
- Canvasはマスコット・ゲージ・アニメーションに使用し、入力・チェック・管理画面は通常HTMLを併用する。
- 心の天気データとタスク進捗データは分離して管理する。

## 全体構成

```text
                     校内LAN
                        │
              ┌─────────────────┐
              │ ローカルサーバー │
              │ Node.js         │
              │ Express         │
              │ WebSocket       │
              │ JSON / SQLite   │
              └────────┬────────┘
                       │
          ┌────────────┼────────────┐
          │            │            │
       担任PC        児童1         児童2 …
     teacher.html    index.html    index.html
```

## 実装順

### Phase 1: 時計・タイマーを児童画面へ追加

最初に、ネットワーク同期より先に単体で動く時計機能を完成させる。

実装内容:

- 現在時刻表示
- 日付表示
- 朝の会開始時刻の設定
- 「朝の会まであと○分○秒」表示
- タスク用カウントダウンタイマー
- 一時停止 / 再開
- 担任操作用の「+5分」拡張を見越したAPI設計
- 低学年: 大きな時計・視覚ゲージ・ひらがな中心
- 高学年: デジタル時計・残時間・進捗率

追加予定:

```text
js/clock.js
js/timer.js
```

### Phase 2: タスクをJSONデータ化

現在の描画コードに直接タスクを書かず、表示データを分離する。

例:

```json
{
  "classId": "1-1",
  "date": "2026-08-19",
  "version": 1,
  "startTime": "08:15",
  "endTime": "08:30",
  "tasks": [
    {
      "id": "homework",
      "label": "しゅくだいを だす",
      "icon": "homework",
      "minutes": 2,
      "enabled": true
    },
    {
      "id": "health",
      "label": "けんこうチェック",
      "icon": "health",
      "minutes": 1,
      "enabled": true
    },
    {
      "id": "reading",
      "label": "ほんを よむ",
      "icon": "book",
      "minutes": 10,
      "enabled": true
    }
  ]
}
```

追加予定:

```text
data/templates.json
js/tasks.js
js/storage.js
```

### Phase 3: 担任用タスク編集画面

担任が毎朝30秒程度で変更できることを目標とする。

機能:

- 学級選択
- 今日のタスク一覧
- タスク追加 / 削除
- ON / OFF
- 所要時間変更
- 並び順変更
- アイコン選択
- 「今日だけ変更」
- 前日の設定をコピー
- テンプレート切替
  - いつもの朝
  - 月曜日
  - 雨の日
  - 集会の日
  - 行事の日
- 「クラスに反映」ボタン

追加予定:

```text
teacher.html
css/teacher.css
teacher/teacher.js
teacher/task-editor.js
```

### Phase 4: Node.jsローカルサーバー

校内LANの親機となるサーバーを実装する。

想定:

- Node.js
- Express
- WebSocket または Socket.IO
- 初期はJSON保存
- 将来必要ならSQLiteへ移行可能

主要API案:

```text
GET  /api/time
GET  /api/classes/:classId/today
POST /api/classes/:classId/tasks
POST /api/classes/:classId/progress
POST /api/classes/:classId/checkin
```

追加予定:

```text
server/server.js
server/routes.js
server/storage.js
```

### Phase 5: WebSocketで全タブレットへ即時反映

担任が「クラスに反映」を押したら、その学級の接続端末へ即時配信する。

ルーム例:

```text
class-1-1
class-1-2
class-4-1
```

要件:

- ページ再読み込み不要
- タスク変更をリアルタイム反映
- 既に完了した同一IDタスクは完了状態を維持
- 各設定に `version` を付与
- 児童端末は受信した `version` をACKとして返す
- 担任画面に「反映済み端末数」を表示

追加予定:

```text
js/socket-client.js
js/sync.js
server/websocket.js
```

### Phase 6: 端末登録・途中参加・オフライン復旧

初回のみ児童タブレットに以下を登録する。

```text
学年
学級
出席番号または端末番号
```

LocalStorage / IndexedDBに保持し、翌日以降は自動接続する。

要件:

- 起動時に最新設定をREST APIから取得
- 接続中の変更はWebSocketで受信
- Wi-Fi切断時も最新設定で継続
- 再接続後に自動同期
- 途中登校児童も最新設定を取得

追加予定:

```text
setup.html
js/device-setup.js
js/storage.js
```

### Phase 7: 担任ダッシュボード＋心の天気統合

担任が一画面で教室の朝の状態を確認できるようにする。

表示内容:

- 現在時刻
- 朝の会までの残時間
- 接続端末数
- 設定反映済み端末数
- タスク完了人数 / 進捗率
- 座席表または一覧
- 児童ごとの心の天気
- 児童ごとのタスク進捗

心の天気は刺激的な警告表示ではなく、「今日は声をかけてみよう」程度の静かな支援表示とする。

## 時計同期設計

端末個別の時計差を避けるため、サーバー時刻を基準にする。

1. 児童端末が `GET /api/time` を呼ぶ。
2. 端末ローカル時刻との差分を算出する。
3. 補正値を保持する。
4. 表示時計・朝の会までの残時間・タスクタイマーに補正を適用する。

目標は、教室内の全タブレットでほぼ同じ時刻を表示すること。

## 時刻に連動した自動表示

例:

```text
08:15  おはよう！ あさのじゅんびを はじめよう！
08:25  あと5ふんだよ
08:29  あと1ぷん。さいごのかくにん！
08:30  あさのかいが はじまるよ
```

担任側には以下を用意する。

```text
一時停止
再開
+5分
終了
```

## データ分離

### タスク系

- 今日のタスク設定
- タスク完了状態
- 接続端末状態
- 設定version

### 心の天気系

- 心の天気
- 任意の一言メモ
- 入力時刻

心の天気データは担任画面以外へ表示しない。
保存期間を設定可能にする。

## 想定フォルダ構成

```text
school-checkin-timer/
├─ index.html
├─ teacher.html
├─ setup.html
├─ css/
│  ├─ style.css
│  └─ teacher.css
├─ js/
│  ├─ app.js
│  ├─ draw_low.js
│  ├─ draw_high.js
│  ├─ mascot_intro.js
│  ├─ sprite_atlas.js
│  ├─ clock.js
│  ├─ timer.js
│  ├─ tasks.js
│  ├─ socket-client.js
│  ├─ sync.js
│  ├─ storage.js
│  └─ device-setup.js
├─ teacher/
│  ├─ teacher.js
│  ├─ task-editor.js
│  └─ classroom-view.js
├─ assets/
│  ├─ mascot/
│  ├─ weather/
│  ├─ tasks/
│  ├─ stamps/
│  └─ sounds/
├─ data/
│  ├─ templates.json
│  └─ classes.json
└─ server/
   ├─ server.js
   ├─ routes.js
   ├─ websocket.js
   ├─ storage.js
   └─ data/
```

## 現時点で確認できたリポジトリ状態

2026-08-18時点で、リポジトリの `main` 直下には `git clone/` ディレクトリがあり、その下に `school-checkin-timer/`、さらにその中に `assets/` が置かれている状態だった。

通常のアプリルートとしては不自然なネストのため、本実装前に整理対象とする。

ただし、既存素材を誤って削除しないよう、まず別ブランチで調査・実装し、確認後にmainへ反映する。

## 次に行う作業

1. 現在の `assets/` 内容を確認する。
2. 既存素材を保持したまま正しいアプリルート構成へ整理する。
3. Phase 1として `index.html + css/style.css + js/clock.js + js/timer.js` を実装する。
4. ブラウザ単体で時計・朝の会までの残時間・タイマーを確認する。
5. その後Phase 2のJSONタスク化へ進む。
