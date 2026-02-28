// ワークスペーススキャン・インデックス管理モジュール
import * as fs from "fs";
import * as path from "path";

/** プロジェクト内のラベル定義 */
export interface LabelDefinition {
  name: string; // ラベル名（*の後の部分）
  file: string; // 定義元ファイルの相対パス
  line: number;
}

/** プロジェクト内のマクロ定義 */
export interface MacroDefinition {
  name: string;
  file: string;
  line: number;
}

/** アセットカテゴリ */
export type AssetCategory =
  | "bgimage"
  | "fgimage"
  | "image"
  | "bgm"
  | "sound"
  | "video"
  | "scenario"
  | "others";

/** タグ名 → アセットディレクトリの対応マップ */
export const TAG_STORAGE_MAPPING: Map<string, AssetCategory> = new Map([
  ["bg", "bgimage"],
  ["bg2", "bgimage"],
  ["chara_new", "fgimage"],
  ["chara_face", "fgimage"],
  ["chara_mod", "fgimage"],
  ["chara_show", "fgimage"],
  ["chara_layer", "fgimage"],
  ["image", "image"],
  ["cursor", "image"],
  ["graph", "image"],
  ["mask", "image"],
  ["playbgm", "bgm"],
  ["fadeinbgm", "bgm"],
  ["xchgbgm", "bgm"],
  ["playse", "sound"],
  ["fadeinse", "sound"],
  ["movie", "video"],
  ["bgmovie", "video"],
  ["layer_video", "video"],
  ["jump", "scenario"],
  ["call", "scenario"],
  ["link", "scenario"],
  ["glink", "scenario"],
  ["clickable", "scenario"],
  ["button", "scenario"],
]);

/** アセットキャッシュエントリ */
interface AssetCacheEntry {
  files: string[];
  timestamp: number;
}

/** KSファイルごとのインデックス */
interface KsFileIndex {
  labels: LabelDefinition[];
  macros: MacroDefinition[];
}

/** キャッシュTTL（ミリ秒） */
const CACHE_TTL = 30_000;

/**
 * ワークスペーススキャナー
 * プロジェクト内のアセット・ラベル・マクロを走査しインデックスを管理する
 */
export class WorkspaceScanner {
  private rootPath: string = "";
  private dataPath: string = "";
  private initialized: boolean = false;

  // アセットファイルキャッシュ（カテゴリ別）
  private assetCache: Map<AssetCategory, AssetCacheEntry> = new Map();

  // KSファイルインデックス（ファイルパスをキーに）
  private ksFileIndices: Map<string, KsFileIndex> = new Map();

  /**
   * ワークスペースルートを設定しdataディレクトリの存在を確認する
   */
  initialize(rootUri: string): boolean {
    try {
      // file:// URI をファイルパスに変換
      const url = new URL(rootUri);
      this.rootPath = decodeURIComponent(url.pathname);
      this.dataPath = path.join(this.rootPath, "data");

      if (fs.existsSync(this.dataPath)) {
        this.initialized = true;
        return true;
      }
    } catch {
      // URIパースエラー時は初期化失敗
    }
    this.initialized = false;
    return false;
  }

  /**
   * アセットスキャンとKSファイルスキャンを並行実行する
   */
  async scanAll(): Promise<void> {
    if (!this.initialized) return;
    await Promise.all([this.scanAssets(), this.scanKsFiles()]);
  }

  /**
   * 全アセットカテゴリのディレクトリを走査する
   */
  private async scanAssets(): Promise<void> {
    const categories: AssetCategory[] = [
      "bgimage",
      "fgimage",
      "image",
      "bgm",
      "sound",
      "video",
      "scenario",
      "others",
    ];
    for (const category of categories) {
      this.scanAssetCategory(category);
    }
  }

  /**
   * 指定カテゴリのアセットディレクトリを走査しキャッシュに格納する
   */
  private scanAssetCategory(category: AssetCategory): void {
    const dirPath = path.join(this.dataPath, category);
    try {
      if (!fs.existsSync(dirPath)) {
        this.assetCache.set(category, { files: [], timestamp: Date.now() });
        return;
      }
      const files = this.readDirRecursive(dirPath, dirPath);
      this.assetCache.set(category, { files, timestamp: Date.now() });
    } catch {
      this.assetCache.set(category, { files: [], timestamp: Date.now() });
    }
  }

  /**
   * ディレクトリを再帰的に走査しファイルの相対パスリストを返す
   */
  private readDirRecursive(dirPath: string, basePath: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          results.push(...this.readDirRecursive(fullPath, basePath));
        } else {
          // ベースパスからの相対パスを格納
          results.push(path.relative(basePath, fullPath));
        }
      }
    } catch {
      // 読み取りエラーは無視
    }
    return results;
  }

  /**
   * data/scenario/ 配下の .ks ファイルを全件読み込み、ラベルとマクロを抽出する
   */
  private async scanKsFiles(): Promise<void> {
    const scenarioPath = path.join(this.dataPath, "scenario");
    if (!fs.existsSync(scenarioPath)) return;

    const ksFiles = this.findKsFiles(scenarioPath);
    this.ksFileIndices.clear();

    for (const filePath of ksFiles) {
      try {
        const content = fs.readFileSync(filePath, "utf-8");
        const relativePath = path.relative(this.dataPath, filePath);
        this.indexKsContent(relativePath, content);
      } catch {
        // 読み取りエラーは無視
      }
    }
  }

  /**
   * 指定ディレクトリ配下の .ks ファイルを再帰的に検索する
   */
  private findKsFiles(dirPath: string): string[] {
    const results: string[] = [];
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          results.push(...this.findKsFiles(fullPath));
        } else if (entry.name.endsWith(".ks")) {
          results.push(fullPath);
        }
      }
    } catch {
      // 読み取りエラーは無視
    }
    return results;
  }

  /**
   * KSファイルの内容からラベルとマクロを正規表現で抽出しインデックスに格納する
   */
  private indexKsContent(relativePath: string, content: string): void {
    const labels: LabelDefinition[] = [];
    const macros: MacroDefinition[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // ラベル検出: 行頭の *xxx
      const labelMatch = line.match(/^\*(\w+)/);
      if (labelMatch) {
        labels.push({
          name: labelMatch[1],
          file: relativePath,
          line: i,
        });
      }

      // マクロ検出: [macro name="xxx"]
      const macroMatch = line.match(/\[macro\s+name\s*=\s*"(\w+)"\s*\]/i);
      if (macroMatch) {
        macros.push({
          name: macroMatch[1],
          file: relativePath,
          line: i,
        });
      }
    }

    this.ksFileIndices.set(relativePath, { labels, macros });
  }

  /**
   * 単一ファイルのインクリメンタル更新（編集中ファイルのインデックスを差し替え）
   */
  updateFile(uri: string, content: string): void {
    if (!this.initialized) return;

    try {
      const url = new URL(uri);
      const filePath = decodeURIComponent(url.pathname);

      // dataディレクトリからの相対パスを算出
      const relativePath = path.relative(this.dataPath, filePath);

      // data/scenario/ 配下の .ks ファイルのみ対象
      if (relativePath.startsWith("scenario") && filePath.endsWith(".ks")) {
        this.indexKsContent(relativePath, content);
      }
    } catch {
      // URIパースエラーは無視
    }
  }

  /**
   * 指定カテゴリのアセットファイル一覧を返す
   * キャッシュTTL超過時は自動再スキャンする
   */
  getAssetsForCategory(category: AssetCategory): string[] {
    if (!this.initialized) return [];

    const cached = this.assetCache.get(category);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return cached.files;
    }

    // キャッシュ期限切れ: 再スキャン
    this.scanAssetCategory(category);
    return this.assetCache.get(category)?.files ?? [];
  }

  /**
   * 全ラベル定義を返す
   */
  getLabels(): LabelDefinition[] {
    const labels: LabelDefinition[] = [];
    for (const index of this.ksFileIndices.values()) {
      labels.push(...index.labels);
    }
    return labels;
  }

  /**
   * 全マクロ定義を返す
   */
  getMacros(): MacroDefinition[] {
    const macros: MacroDefinition[] = [];
    for (const index of this.ksFileIndices.values()) {
      macros.push(...index.macros);
    }
    return macros;
  }

  /**
   * シナリオファイル一覧を返す（.ks拡張子）
   */
  getScenarioFiles(): string[] {
    return this.getAssetsForCategory("scenario");
  }

  /**
   * 初期化済みかどうかを返す
   */
  isInitialized(): boolean {
    return this.initialized;
  }
}
