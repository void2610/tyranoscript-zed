((comment) @content
  (#set! "language" "comment"))

; [iscript]...[endscript] 内をJavaScriptとしてハイライト
((script_block
  (script_content) @content)
 (#set! "language" "javascript"))

; []タグの exp/cond 属性値をJavaScriptとしてハイライト
((attribute
  name: (attribute_name) @_attr_name
  value: (attribute_value
    (quoted_string
      (string_content) @content)))
 (#match? @_attr_name "^(exp|cond)$")
 (#set! "language" "javascript"))

; @タグの exp/cond 属性値をJavaScriptとしてハイライト
((at_attribute
  name: (attribute_name) @_attr_name
  value: (at_attribute_value
    (quoted_string
      (string_content) @content)))
 (#match? @_attr_name "^(exp|cond)$")
 (#set! "language" "javascript"))
