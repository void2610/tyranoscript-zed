// TyranoScript LSPサーバー - 補完・ホバードキュメント機能を提供
import {
  createConnection,
  TextDocuments,
  ProposedFeatures,
  InitializeParams,
  InitializeResult,
  TextDocumentPositionParams,
  CompletionItem,
  CompletionItemKind,
  Hover,
  MarkupKind,
  TextDocumentSyncKind,
  InsertTextFormat,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";
import { TAG_DATABASE, TAG_NAMES, TagDefinition } from "./tagDatabase";
import {
  WorkspaceScanner,
  TAG_STORAGE_MAPPING,
} from "./workspaceScanner";

// stdio接続でLSPサーバーを作成
const connection = createConnection(ProposedFeatures.all);
const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);
const scanner = new WorkspaceScanner();

connection.onInitialize((params: InitializeParams): InitializeResult => {
  // ワークスペースルートを取得しスキャナーを初期化
  const rootUri = params.rootUri ?? params.workspaceFolders?.[0]?.uri;
  if (rootUri && scanner.initialize(rootUri)) {
    // バックグラウンドでスキャン実行
    scanner.scanAll().catch(() => {});
  }

  return {
    capabilities: {
      textDocumentSync: TextDocumentSyncKind.Incremental,
      completionProvider: {
        // "[", "@", スペース, '"' で補完をトリガー
        triggerCharacters: ["[", "@", " ", '"'],
        resolveProvider: false,
      },
      hoverProvider: true,
    },
  };
});

/**
 * カーソル位置のタグコンテキストを解析する
 * 戻り値: タグ名と、カーソルがパラメータ部分にあるかどうか
 */
interface TagContext {
  tagName: string;
  isInParams: boolean;
  /** カーソル位置までに既に使用されているパラメータ名 */
  usedParams: string[];
}

function getTagContext(lineText: string, character: number): TagContext | null {
  const textUpToCursor = lineText.substring(0, character);

  // [] タグの検出: 最後の未閉じ "[" を探す
  const bracketMatch = textUpToCursor.match(/\[(\w+)((\s+.*)?)$/);
  if (bracketMatch) {
    const tagName = bracketMatch[1];
    const afterTag = bracketMatch[2];
    const isInParams = afterTag.length > 0;
    const usedParams = extractUsedParams(afterTag);
    return { tagName, isInParams, usedParams };
  }

  // @タグの検出: 行頭の@タグ
  const atMatch = textUpToCursor.match(/^@(\w+)((\s+.*)?)$/);
  if (atMatch) {
    const tagName = atMatch[1];
    const afterTag = atMatch[2];
    const isInParams = afterTag.length > 0;
    const usedParams = extractUsedParams(afterTag);
    return { tagName, isInParams, usedParams };
  }

  return null;
}

/**
 * テキストから既に使用されているパラメータ名を抽出する
 */
function extractUsedParams(text: string): string[] {
  const params: string[] = [];
  const regex = /(\w+)\s*=/g;
  let match;
  while ((match = regex.exec(text)) !== null) {
    params.push(match[1]);
  }
  return params;
}

/**
 * カーソル位置が "[" の直後か "@" の直後かを判定する
 * タグ名補完のトリガーに使用
 */
function isTagNameTrigger(lineText: string, character: number): "bracket" | "at" | null {
  const textUpToCursor = lineText.substring(0, character);

  // "[" の直後で、まだタグ名を入力中（閉じ括弧なし）
  if (/\[\w*$/.test(textUpToCursor)) {
    return "bracket";
  }

  // 行頭 "@" の直後
  if (/^@\w*$/.test(textUpToCursor)) {
    return "at";
  }

  return null;
}

/** パラメータ値コンテキスト */
interface ParamValueContext {
  tagName: string;
  paramName: string;
  currentValue: string;
}

/**
 * カーソルが paramName="..." の値入力中にあるかを判定する
 */
function getParamValueContext(
  lineText: string,
  character: number
): ParamValueContext | null {
  // まずタグコンテキストを取得
  const tagCtx = getTagContext(lineText, character);
  if (!tagCtx) return null;

  const textUpToCursor = lineText.substring(0, character);

  // パラメータ値の入力中かを判定: paramName="value まで入力している状態
  const valueMatch = textUpToCursor.match(/(\w+)\s*=\s*"([^"]*)$/);
  if (!valueMatch) return null;

  return {
    tagName: tagCtx.tagName,
    paramName: valueMatch[1],
    currentValue: valueMatch[2],
  };
}

/**
 * タグ名補完の候補を生成する
 */
function createTagCompletions(trigger: "bracket" | "at"): CompletionItem[] {
  return TAG_NAMES.map((name, index) => {
    const tag = TAG_DATABASE.get(name)!;
    // 必須パラメータのみをスニペットに含める
    const requiredParams = tag.params.filter((p) => p.required);
    let insertText: string;
    let insertTextFormat: InsertTextFormat;

    if (requiredParams.length > 0) {
      // スニペット: 必須パラメータをプレースホルダーとして追加
      const paramSnippets = requiredParams
        .map((p, i) => `${p.name}="\${${i + 1}}"`)
        .join(" ");
      if (trigger === "bracket") {
        insertText = `${name} ${paramSnippets}]`;
      } else {
        insertText = `${name} ${paramSnippets}`;
      }
      insertTextFormat = InsertTextFormat.Snippet;
    } else {
      if (trigger === "bracket") {
        insertText = `${name}]`;
      } else {
        insertText = name;
      }
      insertTextFormat = InsertTextFormat.PlainText;
    }

    return {
      label: name,
      kind: CompletionItemKind.Function,
      detail: tag.description.split("\n")[0],
      documentation: {
        kind: MarkupKind.Markdown,
        value: createTagDocumentation(tag),
      },
      insertText,
      insertTextFormat,
      sortText: String(index).padStart(4, "0"),
    };
  });
}

/**
 * パラメータ補完の候補を生成する
 */
function createParamCompletions(
  tagName: string,
  usedParams: string[]
): CompletionItem[] {
  const tag = TAG_DATABASE.get(tagName);
  if (!tag) return [];

  // 既に使用されているパラメータを除外
  const availableParams = tag.params.filter(
    (p) => !usedParams.includes(p.name)
  );

  return availableParams.map((param, index) => {
    const requiredLabel = param.required ? " (必須)" : "";
    return {
      label: param.name,
      kind: CompletionItemKind.Property,
      detail: `${param.name}${requiredLabel}`,
      documentation: {
        kind: MarkupKind.Markdown,
        value: param.description,
      },
      // スニペット: param="" の形式で挿入
      insertText: `${param.name}="\${1}"`,
      insertTextFormat: InsertTextFormat.Snippet,
      // 必須パラメータを優先的に表示
      sortText: (param.required ? "0" : "1") + String(index).padStart(4, "0"),
    };
  });
}

/**
 * タグのMarkdownドキュメントを生成する
 */
function createTagDocumentation(tag: TagDefinition): string {
  let doc = `**[${tag.name}]**\n\n`;
  doc += `${tag.description}\n\n`;

  if (tag.params.length > 0) {
    doc += "**パラメータ:**\n\n";
    for (const param of tag.params) {
      const requiredMark = param.required ? " `必須`" : "";
      doc += `- **${param.name}**${requiredMark}: ${param.description}\n`;
    }
  }

  return doc;
}

/**
 * マクロ補完の候補を生成する
 */
function createMacroCompletions(trigger: "bracket" | "at"): CompletionItem[] {
  const macros = scanner.getMacros();
  return macros.map((macro, index) => {
    const insertText =
      trigger === "bracket" ? `${macro.name}]` : macro.name;
    return {
      label: macro.name,
      kind: CompletionItemKind.Function,
      detail: macro.description ? macro.description.split("\n")[0] : `マクロ (${macro.file})`,
      documentation: {
        kind: MarkupKind.Markdown,
        value: `**[${macro.name}]** — ユーザー定義マクロ\n\n${macro.description ? macro.description + "\n\n" : ""}定義元: \`${macro.file}\` (行 ${macro.line + 1})`,
      },
      insertText,
      insertTextFormat: InsertTextFormat.PlainText,
      // タグ補完の後に表示（5000番台）
      sortText: String(5000 + index).padStart(6, "0"),
    };
  });
}

/**
 * storage パラメータのアセットファイル補完候補を生成する
 */
function createStorageCompletions(tagName: string): CompletionItem[] {
  const category = TAG_STORAGE_MAPPING.get(tagName);
  if (!category) return [];

  const files = scanner.getAssetsForCategory(category);
  return files.map((file, index) => ({
    label: file,
    kind: CompletionItemKind.File,
    detail: `${category}/`,
    sortText: String(index).padStart(4, "0"),
  }));
}

/**
 * target パラメータのラベル補完候補を生成する
 */
function createTargetCompletions(): CompletionItem[] {
  const labels = scanner.getLabels();
  return labels.map((label, index) => ({
    label: `*${label.name}`,
    kind: CompletionItemKind.Reference,
    detail: label.file,
    documentation: {
      kind: MarkupKind.Markdown,
      value: `ラベル **\*${label.name}**\n\n定義元: \`${label.file}\` (行 ${label.line + 1})`,
    },
    sortText: String(index).padStart(4, "0"),
  }));
}

// 補完ハンドラ
connection.onCompletion(
  (params: TextDocumentPositionParams): CompletionItem[] => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return [];

    const line = document.getText({
      start: { line: params.position.line, character: 0 },
      end: { line: params.position.line, character: params.position.character },
    });

    // 1. タグ名補完 + マクロ補完: "[" or "@" の直後
    const trigger = isTagNameTrigger(line, params.position.character);
    if (trigger) {
      const tagItems = createTagCompletions(trigger);
      const macroItems = createMacroCompletions(trigger);
      return [...tagItems, ...macroItems];
    }

    // 2. パラメータ値補完: storage="" / target="" の値入力中
    const valueCtx = getParamValueContext(line, params.position.character);
    if (valueCtx) {
      if (valueCtx.paramName === "storage") {
        return createStorageCompletions(valueCtx.tagName);
      }
      if (valueCtx.paramName === "target") {
        return createTargetCompletions();
      }
      // その他のパラメータ値は補完なし
      return [];
    }

    // 3. パラメータ名補完
    const context = getTagContext(line, params.position.character);
    if (context && context.isInParams) {
      return createParamCompletions(context.tagName, context.usedParams);
    }

    return [];
  }
);

// ホバーハンドラ
connection.onHover(
  (params: TextDocumentPositionParams): Hover | null => {
    const document = documents.get(params.textDocument.uri);
    if (!document) return null;

    // カーソル位置の行全体を取得
    const lineText = document.getText({
      start: { line: params.position.line, character: 0 },
      end: { line: params.position.line + 1, character: 0 },
    }).replace(/\n$/, "");

    const character = params.position.character;

    // カーソル位置の単語を取得
    const wordRange = getWordRangeAtPosition(lineText, character);
    if (!wordRange) return null;

    const word = lineText.substring(wordRange.start, wordRange.end);

    // タグ名としてのホバー: [tagName ...] または @tagName の中
    const tagHover = getTagHover(lineText, character, word);
    if (tagHover) return tagHover;

    // パラメータ名としてのホバー
    const paramHover = getParamHover(lineText, character, word);
    if (paramHover) return paramHover;

    return null;
  }
);

/**
 * 指定位置にある単語の範囲を取得する
 */
function getWordRangeAtPosition(
  lineText: string,
  character: number
): { start: number; end: number } | null {
  // 単語文字（英数字とアンダースコア）の範囲を検出
  if (character >= lineText.length) return null;

  const wordRegex = /\w+/g;
  let match;
  while ((match = wordRegex.exec(lineText)) !== null) {
    const start = match.index;
    const end = start + match[0].length;
    if (character >= start && character < end) {
      return { start, end };
    }
  }
  return null;
}

/**
 * タグ名に対するホバー情報を返す
 */
function getTagHover(
  lineText: string,
  character: number,
  word: string
): Hover | null {
  // [] タグ: [tagName の形式で、wordがタグ名部分にあるか
  const bracketRegex = /\[(\w+)/g;
  let match;
  while ((match = bracketRegex.exec(lineText)) !== null) {
    const tagStart = match.index + 1; // "[" の次
    const tagEnd = tagStart + match[1].length;
    if (character >= tagStart && character < tagEnd) {
      const tag = TAG_DATABASE.get(match[1]);
      if (tag) {
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: createTagDocumentation(tag),
          },
        };
      }
    }
  }

  // @タグ: @tagName の形式
  const atRegex = /^@(\w+)/;
  const atMatch = lineText.match(atRegex);
  if (atMatch) {
    const tagStart = 1; // "@" の次
    const tagEnd = tagStart + atMatch[1].length;
    if (character >= tagStart && character < tagEnd) {
      const tag = TAG_DATABASE.get(atMatch[1]);
      if (tag) {
        return {
          contents: {
            kind: MarkupKind.Markdown,
            value: createTagDocumentation(tag),
          },
        };
      }
    }
  }

  // 単語がタグ名と一致する場合のフォールバック
  if (TAG_DATABASE.has(word)) {
    // ただし、パラメータ値の中にある場合は除外
    const beforeWord = lineText.substring(0, character);
    // 直前に "=" があればパラメータ値なのでスキップ
    if (!/=\s*"?[^"]*$/.test(beforeWord)) {
      const tag = TAG_DATABASE.get(word)!;
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: createTagDocumentation(tag),
        },
      };
    }
  }

  return null;
}

/**
 * パラメータ名に対するホバー情報を返す
 */
function getParamHover(
  lineText: string,
  character: number,
  word: string
): Hover | null {
  // カーソル位置がタグ内にあるかを判定
  // 直前の "[" を探す
  let bracketStart = -1;
  for (let i = character; i >= 0; i--) {
    if (lineText[i] === "[") {
      bracketStart = i;
      break;
    }
    if (lineText[i] === "]") break; // 閉じ括弧に先に到達した場合はタグ外
  }

  let tagName: string | null = null;

  if (bracketStart >= 0) {
    const afterBracket = lineText.substring(bracketStart + 1);
    const tagMatch = afterBracket.match(/^(\w+)/);
    if (tagMatch) {
      tagName = tagMatch[1];
    }
  } else {
    // @タグの場合
    const atMatch = lineText.match(/^@(\w+)/);
    if (atMatch) {
      tagName = atMatch[1];
    }
  }

  if (!tagName) return null;

  const tag = TAG_DATABASE.get(tagName);
  if (!tag) return null;

  // wordがこのタグのパラメータ名と一致するか
  // かつ、直後に "=" が続くかチェック（パラメータ名として使われている場合）
  const afterWord = lineText.substring(character);
  const wordEnd = afterWord.match(/^\w*/);
  const charAfterWord =
    wordEnd && character + wordEnd[0].length < lineText.length
      ? lineText[character + wordEnd[0].length]
      : "";

  if (charAfterWord === "=") {
    const param = tag.params.find((p) => p.name === word);
    if (param) {
      const requiredMark = param.required ? " `必須`" : "";
      return {
        contents: {
          kind: MarkupKind.Markdown,
          value: `**${param.name}**${requiredMark}\n\n${param.description}`,
        },
      };
    }
  }

  return null;
}

// KSファイル変更時のインクリメンタル更新（500msデバウンス）
const updateTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();
documents.onDidChangeContent((change) => {
  const uri = change.document.uri;
  if (!uri.endsWith(".ks")) return;

  // 既存タイマーをクリア
  const existing = updateTimers.get(uri);
  if (existing) clearTimeout(existing);

  // 500ms後にインデックスを更新
  updateTimers.set(
    uri,
    setTimeout(() => {
      scanner.updateFile(uri, change.document.getText());
      updateTimers.delete(uri);
    }, 500)
  );
});

// ドキュメントマネージャーを接続にバインド
documents.listen(connection);

// サーバーを開始
connection.listen();
