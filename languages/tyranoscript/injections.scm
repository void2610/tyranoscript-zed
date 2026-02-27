((comment) @content
  (#set! "language" "comment"))

; [iscript]...[endscript] 内をJavaScriptとしてハイライト
((script_block
  (script_content) @content)
 (#set! "language" "javascript"))
