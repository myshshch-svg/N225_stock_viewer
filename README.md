# 日経225 ミニチャート一覧

日経平均採用225銘柄の日足ミニチャートを1ページで一覧表示する静的サイト。
[stock-life.net のテーマ別ミニチャート一覧](https://www.stock-life.net/theme/related/a101-nikkei225.html)（更新停止）の代替として作成。

公開URL: https://myshshch-svg.github.io/N225_stock_viewer/

## 仕組み

- **フロントエンド**: Vite + React + TypeScript。225銘柄のローソク足チャートを canvas に直接描画。
  カードは IntersectionObserver で画面に近づいたときにデータを遅延読み込みする。
- **データ**: GitHub Actions が平日 16:30 JST に Yahoo Finance chart API から全銘柄の日足（1年分）を取得し、
  ビルドして GitHub Pages へデプロイする。データはリポジトリにはコミットしない。
- **銘柄リスト**: [src/n225.json](src/n225.json)（コード・銘柄名・業種）。
  日経平均の銘柄入替があったら手動で編集する。

## 開発

```bash
npm install
node scripts/fetch-data.mjs   # public/data/ に株価データを取得（約2分）
npm run dev
```

## デプロイ

GitHub リポジトリの Settings → Pages → Source を「GitHub Actions」に設定すれば、
main への push と毎平日のスケジュール実行で自動デプロイされる。
