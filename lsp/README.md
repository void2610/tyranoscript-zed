# @void2610/tyranoscript-lsp

[TyranoScript](https://tyrano.jp/)向けLanguage Serverです。[Zed](https://zed.dev/)拡張 [tyranoscript-zed](https://github.com/void2610/tyranoscript-zed) から利用されます。

## 機能

- タグ名の補完（`[` または `@` 入力時）
- パラメータの補完（使用済みパラメータを自動除外）
- 必須パラメータのスニペット自動挿入
- ホバーによるタグ・パラメータのドキュメント表示

## 開発

```bash
npm install
npm run build    # dist/server.js にバンドル
npm run watch    # ファイル変更時に自動ビルド
```

## 謝辞

タグ辞書データは [orukRed/tyranosyntax](https://github.com/orukRed/tyranosyntax)（VSCode拡張）の `tyrano.Tooltip.json` を基に作成しました。

## ライセンス

[MIT](../LICENSE)
