# TyranoScript for Zed

[English](README.md)

[TyranoScript](https://tyrano.jp/)（`.ks`ファイル）の[Zed](https://zed.dev/)エディタ向け言語サポート拡張です。

## 機能

- シンタックスハイライト（タグ、属性、コメント、ラベル、テキスト）
- 括弧の自動補完（`[]`、`""`）
- コメントのトグル（`; `）
- タグ名・パラメータの補完（Language Server）
- `storage=""` でアセットファイル補完（bgimage, fgimage, bgm 等）
- `target=""` でラベル補完
- ユーザー定義マクロの補完
- ホバーによるタグ・パラメータのドキュメント表示（Language Server）
- 定義へジャンプ（Go to Definition）— ラベル・マクロ・シナリオファイル
- 参照検索（Find References）— ラベル・マクロの全使用箇所
- 診断（Diagnostics）
  - 必須パラメータ欠落（エラー）
  - 存在しないファイル参照（警告）
  - 未定義タグ/マクロ（警告）
  - 未定義ラベル参照（警告）
  - 未使用ラベル（警告）
  - `; tyranoscript-disable-next-line` などによる警告の個別抑制

## インストール

### Zed Extension Marketplace から（公開後）

Zed の Extensions パネルで「TyranoScript」を検索してインストール。

### 開発版として

1. このリポジトリをクローン
   ```bash
   git clone https://github.com/void2610/tyranoscript-zed.git
   ```
2. Zed を開く → **Extensions** → **Install Dev Extension**
3. クローンしたフォルダを選択
4. `.ks` ファイルを開いてハイライトを確認

## ハイライトの例

```
; コメント
*label_name

[bg storage="bg_room.png" time=1000]
[chara_show name="hero" pos=center]

春子「こんにちは！」[l]

[if exp="f.flag == 1"]
フラグが立っています。
[endif]
```

- **タグ名**（`bg`, `chara_show`）→ 関数カラー
- **制御タグ**（`if`, `endif`, `macro`）→ キーワードカラー
- **属性名**（`storage`, `time`）→ プロパティカラー
- **属性値**（`"bg_room.png"`, `1000`）→ 文字列カラー
- **コメント**（`; ...`）→ コメントカラー
- **ラベル**（`*label_name`）→ ラベルカラー

## アーキテクチャ

- **Tree-sitter文法**: [tree-sitter-tyranoscript](https://github.com/void2610/tree-sitter-tyranoscript)でパース
- **Language Server**: [tyranoscript-lsp](https://github.com/void2610/tyranoscript-lsp)（[`@void2610/tyranoscript-lsp`](https://www.npmjs.com/package/@void2610/tyranoscript-lsp)）— エディタ非依存のLSPサーバー（補完・ホバー・診断・ワークスペース認識）
- **Zed拡張（WASM）**: Rust製のWASMバイナリがLSPサーバーのインストール・起動を管理

## 謝辞

- タグ辞書データは [orukRed/tyranosyntax](https://github.com/orukRed/tyranosyntax)（VSCode拡張）の `tyrano.Tooltip.json` を基に作成しました。

## 関連リポジトリ

- [tyranoscript-lsp](https://github.com/void2610/tyranoscript-lsp) — Language Server（エディタ非依存）
- [tree-sitter-tyranoscript](https://github.com/void2610/tree-sitter-tyranoscript) — Tree-sitter文法定義

## ライセンス

[MIT](LICENSE)
