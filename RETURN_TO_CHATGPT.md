# RETURN_TO_CHATGPT — 九九スターバトル

作成日：2026-11-05（日本時間）

## コミットと作業範囲

- 作業開始時：`3b3d59cc69742b592aab8fec5ae838a7a6a68fde`
- 作業完了時：`246c1fd6fb1ae765900b859873721ae7402992fc`
- ローカルブランチ：`feature/animal-school-auto-advance`
- 完了コミットはコード・設定・依存固定ファイル・テスト・HANDOFFを含む。本書はID確定後に生成した返却資料で、ZIPに追加同梱している。
- 受け渡しブランチ：`handoff/animal-school-246c1fd`。ダウンロード用に改良コード・本書・ZIPを既存GitHubリポジトリへ反映する。mainと本番環境は更新しない。ZIPにコード一式を含む。
- 本番公開、本番D1の操作、新しいサーバー構築、外部サービスへの移転は実施していない。

## 変更内容

### どうぶつスクールUI

クリームを基調にコーラルと水色、太い茶色の輪郭、丸角、控えめな立体影で全画面を統一した。

- ホーム：SVGの学校・木・ノート・鉛筆、4キャラクター、最も大きい練習／対戦ボタン、補助サイズの着せ替え、自分のアバターと実保存メダル。
- 練習設定：大きな段の数字カード、短いモード名、選択枠とチェック。
- 問題：大きな式と入力欄、固定サイズのテンキー、短い穏やかな誤答表示、小動物の笑顔と軽いキラキラ。演出はpointer-events:none。
- 結果：緑の黒板、実際の計時・問題数・誤答・獲得メダル・記録、動物の応援と再練習／段変更。
- 対戦：自分／ともだちのアバターと得点、児童向けの接続・待機表示。共有端末にもアバターを表示。
- 着せ替え：大きいプレビュー、装備中／所持／未所持の状態タグ、練習へ戻る操作。
- M PLUS Rounded 1cのRegular/ExtraBoldを同梱。外部フォントサービスに接続しない。ライセンスは `public/legacy/fonts/OFL.txt`。
- アバターの固定色、パーツID、価格、装備の座標を維持。全5600組合せで描画座標と装備アンカーを比較した。笑顔は画面上の一時表現で、選択済みの顔・保存データは変更しない。

### 正解後の自動進行

- 練習／1台の2人対戦／オンラインの正解後、約1000ms表示して次問へ。最終問は結果へ進む。
- 練習の正解表示待機は計測時間に含めない。間違いの考え直し・再入力待機は従来どおり計時する。
- じっくり対戦は両者正解まで待つ。オンラインは既存nextを各端末が自動送信し、サーバーが両者readyを確認する。既存の3秒カウントダウンは維持。
- 答えを見る／両者skipで終了した問題は、読み返せるよう手動nextを維持。「つぎへ」は早送り・通信時の操作として残す。
- 退出・再開始・手動操作と古いタイマーの競合を防止。通信エラー、非表示、切断、429時の待機を維持。800msの遅いpollでも自動進行が止まらない修正と回帰テストを追加。

### 変更ファイル

- `HANDOFF.md`
- `public/legacy/adventure.js`
- `public/legacy/app.js`
- `public/legacy/avatar.js`
- `public/legacy/effects.js`
- `public/legacy/fonts/OFL.txt`
- `public/legacy/fonts/README.md`
- `public/legacy/fonts/mplus-rounded-extrabold.woff`
- `public/legacy/fonts/mplus-rounded-regular.woff`
- `public/legacy/index.html`
- `public/legacy/network.js`
- `public/legacy/school-scene.svg`
- `public/legacy/school.css`
- `tests/online-auto.mjs`
- `tests/practice-auto.mjs`
- `tests/shared-auto.mjs`

加えて本書をZIPに同梱。スクリーンショット・検証記録はZIPの `review/` に配置。

## 検証結果

開始コミットで既存4本を実行し全成功。改良後も次の7コマンドがすべて終了コード0・PASS。

```sh
node tests/adventure.mjs
node tests/rooms.mjs
node tests/security.mjs
node tests/client.mjs
node tests/practice-auto.mjs
node tests/shared-auto.mjs
node tests/online-auto.mjs
npm run build
```

- build：成功。従来の静的ルート分類の警告は残るが終了コード0。
- Chrome 155/headless・実タッチ入力のエミュレーションで機能10項目成功。
- 練習9問→自動結果、待機時間除外（実時間10.20秒／練習記録1.7秒）、装備購入・再読み込み保存、ヒント時手動進行、再開始時の古いタイマー無効化。
- 共有端末の早押し5問とじっくり両者待機。独立した2BrowserContextでオンライン早押し・じっくり各5問、アバター、得点同期、自動結果。
- 正解時の一時的な笑顔・復元、保存した顔の不変、紙吹雪6個が入力を遮らないこと。
- 最終CSS保存後、主要7画面を横1280×800・縦768×1024で撮影。14レイアウトとも横はみ出し・44px未満の操作対象・操作中心点の遮蔽・横方向の画面外UIが0。
- document.fonts.ready後、同梱の400／800のフォント読込を14画面で確認。
- 全スクリーンショットは動作するローカルアプリから取得し、結果の数値も実行時の実測値。撮影と機能テストは別実行のため時間の数値は異なる。

ログ：`review/tests.txt`、`review/build.txt`、`review/browser-functional.json`、`review/browser-layout-final.json`。
スクリーンショット一覧：`review/index.html`。縦長画面には全体画像も用意している。

## 参考案との差と未確認事項

- 右側C案の学校・動物・配色・立体ボタンを参考に、操作可能なHTML/CSSと独立したSVGで再構成した。一枚絵を画面として貼り付けていない。
- 参考画像の全身キャラクター・制服・描き込みをそのまま複製せず、既存アバターの220×220座標と装備互換性を保つ簡潔なベクター表現にした。新しい制服・装備や色変更は追加していない。
- 物理タブレット（iPad/Safari/Android）、学校ネットワーク、多数台同時接続、スクリーンリーダー・実際の音声再生、本番ChatGPT Sitesでの確認は未実施。
- 画面内容によって縦スクロールは発生する。縦向きでも式・テンキー・ボタンの重なりがないことを確認した。
- 同梱フォントは計約3.3MB。初回読込中はフォールバックを表示し、読込後に丸い字体へ切り替わる。
- 自動進行の表示時間を選ぶ設定は追加していない。既定1000ms。
- 確認した範囲に未解決の機能不具合はない。既存のブラウザー単位保存、端末間バックアップ未実装、公開サイトのアクセス方針はそのまま。

## 追加依存関係

npm依存の追加・更新は0。package.json/package-lock.jsonは開始時と同一。上記のOFLフォント2ファイルと学校SVG/CSSを同梱した。FontToolsは準備時のTTF→WOFF変換にのみ使用し、アプリ依存には加えていない。フォントの字形や文字範囲は削っていない。

## DB・ブラウザー保存データ

- DBスキーマ変更・追加マイグレーション：なし。既存2本のSQLとDrizzle metaは変更なし。
- 今回の更新にDB適用順序はない。本番の既存テーブルに初回CREATE TABLEを再実行しない。
- localStorage `kuku-adventure-v1`／version1のメダル・装備・学習記録・claimsと、sessionStorage `kuku-room-v1` の形式は変更なし。移行処理は不要。
- 採点エンジン、サーバー側room処理、認証、入力検証、2人制限、レート制限は変更なし。

## 現在のChatGPT Sitesへ戻すとき

1. 現在のSitesプロジェクトを開き直して、IDを照合してから `kuku-duel/` のソースを反映する。新しい公開先・サーバーは作らない。
2. `.openai/hosting.json` の `project_id=appgprj_6ad049ae617081919005becf2f8651bd`、`d1=DB`、`r2=null` は変更していない。そのまま維持する。公開先は既存の `https://kuku-star-duel.hayato363.chatgpt.site` を維持する。
3. Worker＋D1、`POST /api/room`、build/・scripts/・依存固定ファイル・既存drizzle/を含むアプリとして反映する。GitHub Pagesや静的HTMLだけの構成に変えない。通信先は相対パス `/api/room` のまま。
4. Sites側の対応スキル・ビルド・プレビュー手順を優先し、上記テスト・ビルド・練習保存・2ブラウザー対戦を再確認してから、ChatGPT側で本番公開を行う。今回こちらでは本番操作をしていない。
5. 新規の `school.css`、`school-scene.svg`、fonts/とOFLを漏らさず反映し、school.cssが既存CSSの後に読まれることを保つ。既存の公開に必要なファイルは削除していない。
6. ZIPには秘密値・認証情報・.env・node_modules・.git・ローカルDB・ビルド生成物・実行プロファイルを含めていない。公開権限や本番DBの実体はZIPで移転されない。既存URLを維持してブラウザー保存の継続性を保つ。

## ローカルでの再確認

Node.js >=22.13.0（今回v24.22.1）、npm（今回11.9.0）。初回依存は `npm run install:ci`、ビルドは上記。新しいローカルDBだけを初期化する場合はHANDOFF.mdの2SQLを順に適用し、既存DBには重ねて適用しない。`npm run dev` で開発確認する。
