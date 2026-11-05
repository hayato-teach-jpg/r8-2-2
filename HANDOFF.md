# 実装引き継ぎ

## 基準
- 作成日：2026-11-05
- ソースコミット：7c47500d40085a88e4dec846b807aba87db7dfff
- 公開URL：https://kuku-star-duel.hayato363.chatgpt.site
- Sites project ID：appgprj_6ad049ae617081919005becf2f8651bd
- 最新既知バージョン：appgprj_6ad049ae617081919005becf2f8651bd~appgver_c82314d93f40819189a1f1c056953f0f
- この資料とAGENTS.mdは引き継ぎ用の追加資料。本番ソースの振る舞いは変更していない。

## 実装済み
練習：段ごとの上り・下り・ランダムは9問。複数段は10/20/30問。テンキーと物理キーボードに対応。
間違いは再入力でき、答えを見ると誤答扱い。正解後は「つぎへ」で進む。
結果：緑の黒板風。時間、問題数、誤答、メダル、自己記録、間違えた問題を表示。
タイマー：performance.now()に基づく実測。解答中だけ加算し、間違い後の考える時間と待機制限は含む。正解後から次の問題までの待機は含まない。
メダル：練習完了・全問正解・時間に応じて獲得。同一練習の二重受領を防止。無誤答のタイムのみ自己記録。
アバター：星・猫・うさぎ・くま・ロボット。顔、頭装備、アクセサリー、背景を組み合わせるSVG方式。色変更なし。旧有料金色は一度だけ返金。
対戦：1台を2人で使う方式と2台のオンライン方式。オンラインは6桁部屋番号、2人まで、ホスト開始、3秒カウントダウン。早押しと両者解答モード、両者の次へ待ち、両者の答え表示同意。アバターを互いに表示。

## 保存と通信
ブラウザーlocalStorageの kuku-adventure-v1 にメダル・装備・記録を保存。同じブラウザーで1プロフィール。別端末共有や復元バックアップは未実装。
部屋認証トークンはsessionStorageの kuku-room-v1。サーバーへ送るアバターは許可された部品IDのみ。
Cloudflare Worker + D1。POST /api/room。サーバー採点、CAS更新、約900msポーリング。2時間で部屋期限切れ。期限切れレコードの掃除は部屋作成時の機会的処理。
トークン形式検証、同一オリジン検証、リクエストサイズ制限、デバイス・ネットワーク単位レート制限あり。空のguestトークンによる認証問題は修正済み。
公開サイトであり、Classroom配布はクラス限定アクセス制御ではない。教員承認方式は採用しないという利用者の方針。

## 主なファイル
- public/legacy/index.html, style.css, adventure.css：画面と見た目
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
手動で確認する項目：タブレットのテンキー、9問完了と結果、再読み込みで記録維持、装備購入、別ブラウザー2人でアバター共有と採点、切断と復帰。
過去のブラウザー確認は実施済み。今回の準備では自動テストを再実行。新PCでのクリーンインストールや学校の実機一斉利用は未検証。

## 未実装・改善候補（実装依頼ではない）
1. 間違いからの再練習、苦手な段への支援。
2. 自動で次へ進む設定など操作の調整。
3. 接続回復の改善、クラス全体の実機同時利用試験。
4. 学習記録・装備のバックアップ／復元。
5. 教員による出題範囲・時間の設定。
ユーザーが次に選んだ内容から進める。

## 移転時の注意
コードの移動と公開先・DBの移転は別。ZIPに本番DB・権限・認証情報は含まない。
別ドメインへ移すとlocalStorageは共有されず、既存児童のメダルや装備は自動移行しない。必要なら公開先変更前に移行方法を実装する。
Sites以外ではWorkerのDBバインディング、DB作成、マイグレーション、公開手順を新たに設定する。現在のサイトと同じ公開URLをZIPだけで引き継ぐことはできない。
