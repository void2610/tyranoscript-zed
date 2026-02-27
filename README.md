# TyranoScript for Zed

[TyranoScript](https://tyrano.jp/)（`.ks`ファイル）の[Zed](https://zed.dev/)エディタ向け言語サポート拡張です。

## 機能

- シンタックスハイライト（タグ、属性、コメント、ラベル、テキスト）
- 括弧の自動補完（`[]`、`""`）
- コメントのトグル（`; `）

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

## 関連リポジトリ

- [tree-sitter-tyranoscript](https://github.com/void2610/tree-sitter-tyranoscript) — Tree-sitter文法定義

## ライセンス

[MIT](LICENSE)
