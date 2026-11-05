# 実装引き継ぎ

## 基準
- 作成日：2026-11-05
- 引き継ぎ元ソースコミット：7c47500d40085a88e4dec846b807aba87db7dfff
- 公開URL：https://kuku-star-duel.hayato363.chatgpt.site
- Sites project ID：appgprj_6ad049ae617081919005becf2f8651bd
- 最新既知バージョン：appgprj_6ad049ae617081919005becf2f8651bd~appgver_c82314d93f40819189a1f1c056953f0f
- 改良前のGitHubコミット：3b3d59cc69742b592aab8fec5ae838a7a6a68fde。今回の変更・検証・返却時の注意は RETURN_TO_CHATGPT.md を参照。

## 実装済み
UI：全画面を「どうぶつスクール」に統一。クリーム・コーラル・水色、茶色の輪郭、丸角の立体ボタン。学校背景と動物はSVG、文字と操作はHTML/CSS。M PLUS Rounded 1cをOFLライセンス付きで同一オリジンから配信し、外部フォントサービスは不要。既存アバターの固定色・パーツID・価格・装備の座標は維持し、正解時だけ画面上の表情を短時間笑顔にする（保存アバターは変更しない）。
練習：段ごとの上り・下り・ランダムは9問。複数段は10/20/30問。テンキーと物理キーボードに対応。
間違いは再入力でき、答えを見ると誤答扱い。正解後は約1秒表示して自動で次問へ進み、最終問は結果へ進む。「つぎへ」は待たずに進む操作として残す。答えを見た場合は、自分で確認してから「つぎへ」で進む。
結果：緑の黒板風。時間、問題数、誤答、メダル、自己記録、間違えた問題を表示。
タイマー：performance.now()に基づく実測。解答中だけ加算し、間違い後の考える時間と待機制限は含む。正解後から次の問題までの待機は含まない。
メダル：練習完了・全問正解・時間に応じて獲得。同一練習の二重受領を防止。無誤答のタイムのみ自己記録。
アバター：星・猫・うさぎ・くま・ロボット。顔、頭装備、アクセサリー、背景を組み合わせるSVG方式。色変更なし。旧有料金色は一度だけ返金。
対戦：1台を2人で使う方式と2台のオンライン方式。オンラインは6桁部屋番号、2人まで、ホスト開始、3秒カウントダウン。早押しと両者解答モード、両者の準備確認、両者の答え表示同意。アバターを互いに表示。正解で問題が終了すると約1秒後に次問／結果へ自動進行する。じっくりは両者正解まで待つ。オンラインは各端末が既存のnextを自動送信し、サーバーが両者の準備を確認する。答え表示で終了した問題は手動で進む。切断・通信エラー・非表示・レート制限時は自動送信を待つ。

## 保存と通信
ブラウザーlocalStorageの kuku-adventure-v1 にメダル・装備・記録を保存。同じブラウザーで1プロフィール。別端末共有や復元バックアップは未実装。
部屋認証トークンはsessionStorageの kuku-room-v1。サーバーへ送るアバターは許可された部品IDのみ。
Cloudflare Worker + D1。POST /api/room。サーバー採点、CAS更新、約900msポーリング。2時間で部屋期限切れ。期限切れレコードの掃除は部屋作成時の機会的処理。
トークン形式検証、同一オリジン検証、リクエストサイズ制限、デバイス・ネットワーク単位レート制限あり。空のguestトークンによる認証問題は修正済み。
公開サイトであり、Classroom配布はクラス限定アクセス制御ではない。教員承認方式は採用しないという利用者の方針。

## 主なファイル
- public/legacy/index.html, style.css, adventure.css：画面と見た目
- public/legacy/school.css, school-scene.svg：どうぶつスクールの共通テーマ・学校の背景。既存CSSの後にschool.cssを読み込む。
- public/legacy/fonts/：同梱の日本語フォント、OFLライセンス、配布元・変換の説明
- public/legacy/adventure.js：ホーム、練習、結果、装備画面
- public/legacy/practice-engine.js：問題順・計時
- public/legacy/profile.js：保存、メダル、装備、自己記録
- public/legacy/avatar.js：SVGと装備カタログ
- public/legacy/network.js：オンライン対戦クライアント
- public/legacy/engine.js, app.js：共有端末対戦
- lib/room.mjs：オンライン部屋のサーバー処理
- lib/avatar.mjs：サーバー用アバターID検証
- app/api/room/route.ts：Worker DB接続
- app/page.tsx：/legacy/index.html へ誘導
- db/schema.ts, drizzle/：DBと既存マイグレーション
- .openai/hosting.json：SitesのDBバインディング（DB）
- README.md：元のスターターの技術資料。DBが空との記述等は現在のアプリには当てはまらないため、本書を優先。

## 新しいローカル環境での起動
Node.js >=22.13.0、依存関係取得用ネットワークが必要。
空の展開先では portable プロファイルが既定となる。
```sh
npm run install:ci
node tests/adventure.mjs
node tests/rooms.mjs
node tests/security.mjs
node tests/client.mjs
node tests/practice-auto.mjs
node tests/shared-auto.mjs
node tests/online-auto.mjs
npm run build
```
初回のローカルDBにのみ、次を順に適用する（本番DBを対象にしない）。
```sh
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_happy_old_lace.sql
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0001_unknown_jetstream.sql
npm run dev
```
表示されたローカルURLを開く。ビルド済みWorkerの確認は npm start。
Sitesの管理環境ではSitesスキルのインストール・ビルド・プレビュー手順を優先する。
2台の実機からlocalhostを共有することはできない。実機検証は適切に構成した検証URLを使用する。

## 検証範囲
4本のテスト：問題順、計時、メダル・装備・保存、アバター検証、実D1エミュレーター上の部屋作成と参加競合・採点・認証・期限、レート制限、クライアント通信。
追加3本：練習・共有端末・オンラインの正解後自動進行、最終結果、待機時間の計時除外、ヒント時の手動進行、手動操作との競合、古いタイマー、オンラインの両者準備・切断復帰・非表示・429待機。
手動で確認する項目：タブレットのテンキー、9問完了と結果、再読み込みで記録維持、装備購入、別ブラウザー2人でアバター共有と採点、切断と復帰。
今回の改良では既存4本と追加3本、ビルド、headless Chromium 155の実ブラウザーで練習・保存・共有端末対戦・独立2環境オンライン対戦を検証。物理タブレット・学校の実機一斉利用・本番Sitesでの確認は未実施。

## 未実装・改善候補（実装依頼ではない）
1. 間違いからの再練習、苦手な段への支援。
2. 自動進行の表示時間を選ぶ設定など操作の調整。
3. 接続回復の改善、クラス全体の実機同時利用試験。
4. 学習記録・装備のバックアップ／復元。
5. 教員による出題範囲・時間の設定。
ユーザーが次に選んだ内容から進める。

## 移転時の注意
コードの移動と公開先・DBの移転は別。ZIPに本番DB・権限・認証情報は含まない。
別ドメインへ移すとlocalStorageは共有されず、既存児童のメダルや装備は自動移行しない。必要なら公開先変更前に移行方法を実装する。
Sites以外ではWorkerのDBバインディング、DB作成、マイグレーション、公開手順を新たに設定する。現在のサイトと同じ公開URLをZIPだけで引き継ぐことはできない。
