; タグの括弧
(tag "[" @punctuation.bracket)
(tag "]" @punctuation.bracket)

; @タグの@記号
(at_tag "@" @punctuation.special)

; タグ名
(tag_name) @function

; 制御フロー系タグ名はキーワードとして扱う
((tag_name) @keyword
 (#match? @keyword "^(if|elsif|else|endif|iscript|endscript|macro|endmacro|jump|call|return|s|for|endfor|while|endwhile|break|continue)$"))

; クリック待ち系タグ
((tag_name) @keyword
 (#match? @keyword "^(l|p|r|er|ct|cm|wd|wait)$"))

; 属性名
; @property は一部テーマでデフォルト色と区別しにくいため @type を使用
(attribute_name) @type

; 属性値
(quoted_string) @string
(unquoted_value) @string.special
(at_unquoted_value) @string.special

; 話者表示（#記号と話者名を同じ色に）
; @punctuation.special は一部テーマで未定義のため @text.literal を使用
(speaker) @text.literal

; コメント
(comment) @comment

; ラベル
; @label は一部テーマで未定義のため @enum を使用
(label) @enum
(label_name) @enum

; テキスト行
(text_line) @attribute

; インラインテキスト
(inline_text) @attribute

; スクリプトブロックの開始・終了タグ（括弧は punctuation、キーワード部分は keyword）
(iscript_open "[" @punctuation.bracket)
(iscript_open "iscript" @keyword)
(iscript_open "]" @punctuation.bracket)
(endscript_close "[" @punctuation.bracket)
(endscript_close "endscript" @keyword)
(endscript_close "]" @punctuation.bracket)
