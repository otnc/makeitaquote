# makeitaquote v9 詳細設計書

作成日: 2026-07-31対象バージョン: `makeitaquote@9.0.0`（v8 系との後方互換性は**持たない**）リポジトリ: https://github.com/otnc/makeitaquote リポジトリ構成のベース: [`oto-lab/npm-biome-ts`](https://github.com/oto-lab/npm-biome-ts)

---

## 1. 目的とスコープ

### 1.1 背景

現行 v8 は「Voids API に POST して URL か Buffer を受け取るだけ」の薄い Wrapper であり、以下の問題を抱えている。

| 問題 | 内容 |
| --- | --- |
| 外部 API 全面依存 | `api.voids.top` が落ちるとパッケージが機能停止する |
| エンドポイントの意味づけの誤り | `generate()` / `generateBeta()` を「本番とフォールバック」として README に書いているが、実際には**機能が異なる 2 つのエンドポイント**である（§2.1） |
| 型と実装の乖離 | `index.d.ts` が手書きで、実装と同期する保証がない |
| 責務の混在 | Discord 依存（`setFromMessage`）・整形（`displus`）・HTTP（`axios`）が 1 ファイルに同居 |
| 拡張余地の欠如 | 画像サイズ・配色・フォントが API 側に固定され、利用者が一切制御できない |

### 1.2 v9 のゴール

1. **API 非依存のローカル画像生成**を第一級の機能として実装する（`makeitaquote`）。
2. Voids API 依存の実装は**別サブパス**に隔離する（`makeitaquote/api`）。
3. TypeScript で書き直し、型定義を実装から自動生成する。
4. Discord カスタム絵文字・Twemoji・日本語テキストを正しく描画する。
5. 見た目（サイズ・配色・フォント・レイアウト）を利用者が制御できるようにする。
6. **フォント未設定でも日本語が描画できる**ようにする（§8）。
7. リポジトリ構成・CI・リリースフローを `oto-lab/npm-biome-ts` に揃える（§5）。

### 1.3 非スコープ

- v8 API との後方互換（**不要と決定済み**）
- ブラウザ環境での動作（Node.js 専用。`@napi-rs/canvas` がネイティブバインディングのため）
- 動画・GIF アニメーションの出力（アニメ絵文字も静止フレームとして描画する）

---

## 2. 現行実装の分析

### 2.1 `generate()` と `generateBeta()` は機能が異なる

現行コードを精読した結果、この 2 つは「同じ機能の本番／ベータ」ではない。**返すものが根本的に違う。**

```js
// index.js:171-172  —— /fakequote
const response = await axios.post(API_URL, this.format, { responseType: 'json' })
return response.data.url                        // ← JSON { url } を返す

// index.js:166-169  —— /fakequote + returnRawImage
const response = (await axios.post(API_URL, this.format)).data
const imageBuffer = await axios.get(response.url, { responseType: 'arraybuffer' })
return Buffer.from(imageBuffer.data, 'binary')  // ← URL を取ってから “もう一度” GET

// index.js:197-198  —— /fakequotebeta
const response = (await axios.post(BETA_API_URL, this.format, { responseType: 'arraybuffer' })).data
return Buffer.from(response)                    // ← 画像バイナリを直接返す
```

|  | `/fakequote` | `/fakequotebeta` |
| --- | --- | --- |
| レスポンス | `application/json` — `{ url: "..." }` | 画像バイナリ |
| 画像の所在 | **Voids 側にアップロードされ、ホスト URL が発行される** | どこにも保存されない。都度生成して返すだけ |
| URL の取得 | できる | **できない**（原理的に） |
| Buffer 取得時の往復数 | **2 往復**（POST → JSON → GET） | **1 往復** |
| Discord での使い方 | URL 文字列をそのまま `reply()` できる（`examples/miq-with-discordjs.md:15`） | `MessageAttachment` での添付が必要（`examples/beta-with-discordjs.md:15`） |

**この差が v9 の API 設計を決める。**

- 「URL が欲しい」→ `/fakequote` **しか選択肢がない**
- 「Buffer だけ欲しい」→ `/fakequotebeta` のほうが 1 往復で速く、しかも**画像が第三者のサーバーに残らない**

したがって v8 のように「メソッド名でエンドポイントを選ばせる」のではなく、**欲しいものを言えば適切なエンドポイントが自動的に選ばれる**設計にする（§6.4）。README の「`generate()` が使えないときは `generateBeta()`」という記述は誤解を招くため、v9 では**両者を対等な別機能として**説明し直す。

> 生成される画像デザインが両エンドポイントで同一かどうかはコードからは判定できない。フェーズ 3 の実装時に実出力を比較し、差があれば README の対応表に注記する。

### 2.2 廃止する依存・設定

| 対象 | 理由 |
| --- | --- |
| `axios` | `ky` に置換（§3.5） |
| `displus` | `setText(text, formatText)` の Markdown 除去のためだけに使われていた。整形は本パッケージの責務ではないため機能ごと廃止 |
| `.github/dependabot.yml` | **廃止**。ベーステンプレートに存在せず、ネイティブバイナリを含む本パッケージでは自動 PR の検証コストに見合わない。依存更新は手動で行う |

---

## 3. 技術選定

### 3.1 決定サマリ

| 領域 | 採用 | バージョン | 区分 |
| --- | --- | --- | --- |
| 描画エンジン | `@napi-rs/canvas` | `^1.0.3` | dependencies |
| 絵文字パース | `@twemoji/parser` | `^17.0.2` | dependencies |
| 日本語改行 | `budoux` | `^0.8.4` | dependencies |
| HTTP クライアント | `ky` | `^2.0.2` | dependencies |
| 言語 | TypeScript | `^6.0.3` | devDependencies |
| バンドラ | `tsdown` | `^0.22.14` | devDependencies |
| テスト | `vitest` + `@vitest/coverage-v8` | `^4.1.10` | devDependencies |
| Lint / Format | `@biomejs/biome` | `^2.5.6` | devDependencies |
| ランタイム | Node.js | `>=22` | engines |

すべて 2026-07-31 時点の最新を確認済み。バージョンはベーステンプレート `oto-lab/npm-biome-ts` と一致している。

### 3.2 描画エンジン: `@napi-rs/canvas`

**採用理由**

- Skia ベース（Chrome と同じ描画エンジン）で、テキストレンダリング品質が高い。
- **全主要プラットフォームのプリビルドバイナリを同梱**（v1.0.3 の `optionalDependencies` で確認）。

  ```
  darwin-x64 / darwin-arm64 / android-arm64
  linux-x64-gnu / linux-x64-musl
  linux-arm64-gnu / linux-arm64-musl
  linux-arm-gnueabihf / linux-riscv64-gnu
  win32-x64-msvc / win32-arm64-msvc
  ```

  特に **musl（Alpine）バイナリがある**点が node-canvas との決定的な差。Discord Bot は `node:*-alpine` で動かされることが多く、node-canvas だと Cairo・Pango・libjpeg 等を `apk add` する必要がある。

- Canvas 2D API 準拠なので、グラデーション・クリップ・フィルタ・行送りを自前で細かく組める。
- 活発にメンテナンスされている（v1.0.3 が 2026-07-28 リリース）。

**不採用にした選択肢**

| 候補 | 不採用理由 |
| --- | --- |
| `canvas`（node-canvas） | v3.2.3 でもプリビルド対象が狭く musl 非対応。ビルド失敗が最頻出のサポート案件になる |
| `skia-canvas` | 描画品質は良いが Alpine/musl 非対応、DL 数も一桁少ない |
| `satori` + `resvg-js` | アバターのグレースケール＋グラデーション合成が CSS 表現の制約を受ける。フォントを毎回 Buffer で渡す必要がある。ネイティブ依存が結局 2 つになる |

**注意点**

- `GlobalFonts.register(buffer, name)` は渡された Buffer のメモリを**参照する**（コピーしない）。登録に使った Buffer を解放・再利用してはならない（[Brooooooklyn/canvas#1006](https://github.com/Brooooooklyn/canvas/issues/1006)）。`FontRegistry` が Buffer への参照を保持し続けることで対処する。
- WOFF2 の読み込み可否がバージョンにより不安定。**自動取得するフォントは TTF に限定する**（§8.2）。

### 3.3 絵文字描画: 自前実装（既存ライブラリはアルゴリズム参考のみ）

候補として挙がった 2 ライブラリのソースを精読した結果、**依存としては採用せず、アルゴリズムを参考に自前実装する**。

| ライブラリ | 版 | 依存 | 判定 |
| --- | --- | --- | --- |
| `node-canvas-with-twemoji-and-discord-emoji`（flazepe） | 1.2.2 (2025-02) | `canvas@^3.1.0`, `@twemoji/parser@^15.1.1` | 参考実装 |
| `@miq4d/canvas-with-discord-content` | 2.1.2 (2026-06) | `canvas@^2.11.2`, `twemoji@^14.0.2` | 参考実装 |

**依存として採用しない理由**

1. **どちらも `require("canvas")` を内部で直接呼んでいる**（`utils/loadTwemojiImageByUrl.js:2`）。`@napi-rs/canvas` と併用できず、採用すると描画エンジンが node-canvas に固定される。
2. **行折り返しに非対応**。`drawTextWithTwemoji.js:38-40` の `maxWidth` は `ctx.setTransform(scale, 0, 0, 1, 0, 0)` による**横方向の圧縮**であって word wrap ではない。MiQ は本文の折り返しが中核機能なので、どちらを使ってもレイアウト層は自前で書くことになる。
3. 画像キャッシュが jsDelivr URL のみ対象・上限なしの `Map`。常駐 Bot でメモリが単調増加する。
4. 描画ループ内で逐次 `await loadImage(url)` している。絵文字 20 個で 20 往復の直列 HTTP になる。
5. `@miq4d` 版は `canvas@^2` + `twemoji@14`（`@twemoji/parser` の前身）と依存が古い。

**継承する設計**

- `@twemoji/parser` の `parse(text, { assetType })` でテキストを走査し、標準絵文字の `indices` と CDN URL を得る。
- Discord カスタム絵文字は正規表現 `/<(a)?:(\w{2,32}):(\d{17,20})>/` で検出し、`https://cdn.discordapp.com/emojis/{id}.{png|gif}` に解決する。
- 絵文字は `fontSize` 四方の `drawImage` として、テキストのベースライン基準で配置する。

**追加で実装するもの**

- 行折り返し（BudouX + グラフェム境界 + 禁則、§7.3）
- LRU キャッシュ（上限・TTL・in-flight 合流・負のキャッシュ、§9.2）
- アニメ絵文字（`<a:...>`）の 1 フレーム目描画
- 取得失敗時のフォールバック
- 絵文字取得の**並列プリフェッチ**

### 3.4 日本語の改行: BudouX（kuromoji ではない）

改行位置の決定に形態素解析を使いたいという要望に対し、`kuromoji` / `kuroshiro` を調査した結果、**`budoux` を採用する**。

| 候補 | 版 / 更新 | 展開サイズ | 判定 |
| --- | --- | --- | --- |
| `kuromoji` | 0.1.2 / **2022-06** | **41.3 MB** | 不採用 |
| `kuroshiro` | 1.2.0 / **2022-06** | – | 不採用 |
| `kuroshiro-analyzer-kuromoji` | 1.1.0 / **2022-05** | – | 不採用 |
| `kuromojin`（kuromoji ラッパ） | 3.0.1 / 2025-04 | kuromoji 依存 | 不採用 |
| **`budoux`** | **0.8.4 / 2026-05** | **2.6 MB**（全言語。日本語モデルのみなら数十 KB） | **採用** |

**kuromoji 系を採らない理由**

1. **展開サイズ 41.3 MB**。IPADic 辞書を丸ごと含む。画像生成ライブラリの依存としては過大で、`@napi-rs/canvas` のバイナリと合わせるとインストールサイズが 50MB を超える。
2. **辞書のロードが非同期かつ数秒かかる**。Bot の初回リクエストが目に見えて遅くなる。
3. **2022 年から更新が止まっている**。`kuroshiro` 系も同様。
4. **そもそも用途に対して過剰**。必要なのは「品詞・読み・原形」ではなく「ここで改行してよいか」の一点だけ。形態素解析は目的ではなく手段であり、より直接的な手段が存在する。

**BudouX を採る理由**

1. **改行位置の決定そのものを目的に Google が作ったライブラリ**。Chrome の CSS `word-break: auto-phrase`（Chrome 119+）の実装に使われているものと同じ AdaBoost モデル。
2. **同期 API**。辞書ロード待ちがない。

   ```ts
   import { jaModel, Parser } from 'budoux'
   const parser = new Parser(jaModel)
   parser.parse('今日は天気です。') // → ['今日は', '天気です。']
   ```

   `loadDefaultJapaneseParser()` ではなく `Parser` + `jaModel` を直接使うことで、`HTMLProcessor` を含まない最小構成になる。

3. **日本語モデルのみを import できる**ため、実際にバンドルされるのは数十 KB。
4. 中国語（簡体・繁体）・タイ語のモデルも同梱されており、将来の多言語対応の余地がある。
5. 2026-05 更新と現役。

**位置づけ**: BudouX は「文節境界を返す」だけであり、**折り返しアルゴリズム全体を置き換えるものではない**。§7.3 の候補位置決定において「CJK は字単位で折る」という素朴な規則の**代わりに文節境界を優先候補として使う**、という組み込み方をする。BudouX が失敗しても字単位フォールバックで必ず折れるので、品質向上の上乗せとして機能する。

### 3.5 HTTP クライアント: `ky`

- 依存ゼロ、Fetch API ベース、~15KB。
- リトライ・タイムアウト・フックが組み込み。絵文字 CDN の一時的失敗に強い。

**`ky` は ESM-only**（`ky@2.0.2` の `package.json` は `"type": "module"`、`exports` に `require` 条件なし）。

Node 22.12+ では `require(ESM)` が動くが、22.0–22.11 では動かない。`engines` が `>=22` である以上そこに依存できないため、**`tsdown` の `deps.alwaysBundle` で CJS 出力にバンドルして埋め込む**（§5.5）。`ky` は依存ゼロなので副作用がない。

### 3.6 Discord 型の扱い

`setFromMessage()` のために `discord.js` へ依存しない。**構造的型（duck typing）**で受ける。

```ts
export interface MessageLike {
  content: string
  author: {
    username: string
    globalName?: string | null
    global_name?: string | null
    discriminator?: string | null
    displayAvatarURL?: (options?: unknown) => string
  }
  member?: {
    displayName?: string
    nickname?: string | null
    displayAvatarURL?: (options?: unknown) => string
  } | null
}
```

discord.js v13 / v14 / discord.js-selfbot-v13 のいずれの `Message` もこの形を満たすため、`peerDependencies` すら不要。テストでもモックが容易になる。

---

## 4. パッケージ構成

### 4.1 方針

**単一 npm パッケージ + subpath exports**。npm 上のパッケージ名は `makeitaquote` 1 つ。

```
require('makeitaquote')      →  ローカル画像生成（API 非依存）
require('makeitaquote/api')  →  Voids API クライアント
```

サブパス名は `voids` ではなく **`api`** とする。「外部 API を叩く側」という役割を表し、将来 Voids 以外の API 実装を足しても名前が破綻しない。

### 4.2 依存の分離

`makeitaquote/api` は `ky` しか使わない。`@napi-rs/canvas`（バイナリ ~10MB）や `budoux` を引かせたくない。

`@napi-rs/canvas` は `optionalDependencies` ではなく通常の `dependencies` に置く。本体こそが v9 の主機能であり、optional にすると「入っていない」状態に陥りやすいため。

その代わり **`src/api/*` は `@napi-rs/canvas` と `budoux` を一切 import しない**ようにビルド境界を切り、`makeitaquote/api` を import しただけではネイティブモジュールがロードされない状態を保証する（build 検証で担保、§5.8）。

### 4.3 ディレクトリ構成

ベーステンプレートに従い、**テストはソースに併置**（`src/**/*.test.ts`）する。`test/` ディレクトリは作らない。

```
makeitaquote/
├── .editorconfig
├── .gitattributes
├── .gitignore
├── biome.json
├── package.json
├── tsconfig.json
├── tsdown.config.ts
├── vitest.config.ts
├── CONTRIBUTING.md
├── LICENSE
├── README.md
├── .github/
│   ├── FUNDING.yml                     # 既存を維持
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── ISSUE_TEMPLATE/
│   │   ├── 1-bug-report.yml
│   │   ├── 2-feature-request.yml
│   │   └── config.yml
│   └── workflows/
│       ├── ci.yml
│       └── release.yml
│   └── （dependabot.yml は削除）
├── scripts/
│   └── check-build.js                  # ビルド成果物の検証（§5.8）
└── src/
    ├── index.ts                        # ルートエントリ（re-export のみ）
    ├── core/
    │   ├── MiQ.ts
    │   ├── MiQ.test.ts
    │   ├── quote.ts
    │   ├── source.ts                   # MessageLike → QuoteData
    │   ├── source.test.ts
    │   ├── errors.ts
    │   └── types.ts
    ├── theme/
    │   ├── presets.ts                  # dark / light / color
    │   ├── resolve.ts
    │   ├── resolve.test.ts
    │   └── types.ts
    ├── render/
    │   ├── pipeline.ts
    │   ├── pipeline.test.ts            # smoke test（実際に PNG を生成）
    │   ├── background.ts
    │   ├── avatar.ts
    │   ├── quoteText.ts
    │   ├── attribution.ts
    │   └── canvasFactory.ts            # @napi-rs/canvas の唯一の import 地点
    ├── text/
    │   ├── segment.ts
    │   ├── segment.test.ts
    │   ├── measure.ts
    │   ├── breakpoint.ts               # BudouX + グラフェム + 禁則
    │   ├── breakpoint.test.ts
    │   ├── wrap.ts
    │   ├── wrap.test.ts
    │   ├── fit.ts
    │   ├── fit.test.ts
    │   └── draw.ts
    ├── emoji/
    │   ├── resolve.ts
    │   ├── resolve.test.ts
    │   ├── loader.ts
    │   └── cache.ts
    ├── font/
    │   ├── registry.ts
    │   ├── autoload.ts
    │   ├── autoload.test.ts
    │   ├── diskCache.ts
    │   └── sources.ts
    ├── output/
    │   └── encode.ts
    ├── http/
    │   └── client.ts
    ├── util/
    │   ├── lru.ts
    │   ├── lru.test.ts
    │   ├── grapheme.ts
    │   └── assert.ts
    ├── __fixtures__/                   # テスト用の PNG / メッセージモック
    │   ├── emoji-1f600.png
    │   ├── avatar.png
    │   └── messages.ts
    └── api/
        ├── index.ts                    # サブパスエントリ
        ├── client.ts                   # VoidsMiQ
        ├── client.test.ts
        ├── endpoints.ts
        └── types.ts
```

`__fixtures__/` は `tsdown` の `entry` に含めないためビルド成果物に入らない。`files: ["dist"]` なので npm 配布物にも含まれない。

---

## 5. リポジトリ構成（`oto-lab/npm-biome-ts` 準拠）

ベーステンプレートの各ファイルをそのまま採用し、**本パッケージ固有の事情による差分のみ**を加える。差分は §5.9 に一覧する。

### 5.1 `package.json`

テンプレートのフィールド順・スクリプト名を踏襲する。`exports` にサブパス `./api` を追加した点が主な差分。

```jsonc
{
  "name": "makeitaquote",
  "version": "9.0.0",
  "description": "Generate \"Make it a Quote\" images locally, or via an external API.",
  "keywords": [
    "img", "image", "gen", "generate", "miq",
    "makeitaquote", "quote", "discord", "canvas", "api"
  ],
  "homepage": "https://github.com/otnc/makeitaquote#readme",
  "bugs": { "url": "https://github.com/otnc/makeitaquote/issues" },
  "repository": {
    "type": "git",
    "url": "git+https://github.com/otnc/makeitaquote.git"
  },
  "license": "ISC",
  "author": "otoneko.",
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.mjs",
  "types": "dist/index.d.mts",
  "exports": {
    ".": {
      "types": {
        "import": "./dist/index.d.mts",
        "require": "./dist/index.d.cts"
      },
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./api": {
      "types": {
        "import": "./dist/api/index.d.mts",
        "require": "./dist/api/index.d.cts"
      },
      "import": "./dist/api/index.mjs",
      "require": "./dist/api/index.cjs"
    },
    "./package.json": "./package.json"
  },
  "files": ["dist"],
  "engines": { "node": ">=22" },
  "scripts": {
    "build": "tsdown",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit",
    "format": "biome format --write",
    "format:check": "biome format",
    "lint": "biome lint",
    "lint:fix": "biome lint --write",
    "check": "biome check --write",
    "ci": "biome ci",
    "check:build": "node scripts/check-build.js",
    "prepublishOnly": "npm run build"
  },
  "dependencies": {
    "@napi-rs/canvas": "^1.0.3",
    "@twemoji/parser": "^17.0.2",
    "budoux": "^0.8.4",
    "ky": "^2.0.2"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.5.6",
    "@types/node": "^22.20.1",
    "@vitest/coverage-v8": "^4.1.10",
    "tsdown": "^0.22.14",
    "typescript": "^6.0.3",
    "vitest": "^4.1.10"
  }
}
```

> **2026-08-01 での訂正**: `"license"` はその後 **ISC → MIT** に変更された。姉妹パッケージのライセンス方針に合わせたもので、v9 系がこの変更の起点。上のスナップショットは設計時点の記録としてそのまま残すが、現在の `package.json` / `LICENSE` / README / THIRD-PARTY-NOTICES.md はすべて MIT を指している。

- テンプレートの `setup` スクリプトと `scripts/setup.js` は**採用しない**。既存リポジトリでありプレースホルダの置換が不要なため。
- `check:build` を追加（§5.8）。
- `@types/node` は `engines` に合わせて **`^22`**（テンプレート準拠）。ランタイムが Node 22 なので 25 系の型を入れると存在しない API が型上通ってしまう。

### 5.2 `biome.json`

テンプレートのものをそのまま使い、`files.includes` に `examples/**` を足すだけ。

```jsonc
{
  "$schema": "https://biomejs.dev/schemas/2.5.6/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": {
    "ignoreUnknown": true,
    "includes": ["src/**", "scripts/**", "examples/**", "*.ts", "*.json"]
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2,
    "lineWidth": 100,
    "lineEnding": "lf"
  },
  "linter": {
    "enabled": true,
    "rules": { "preset": "recommended" }
  },
  "assist": {
    "enabled": true,
    "actions": { "source": { "organizeImports": "on" } }
  },
  "javascript": {
    "formatter": {
      "quoteStyle": "single",
      "semicolons": "asNeeded",
      "trailingCommas": "all"
    }
  }
}
```

**コードスタイル**（テンプレート由来。本設計書のコード例もこれに従っている）

- **セミコロンなし**（`semicolons: "asNeeded"`）
- シングルクォート
- 末尾カンマあり
- インデント 2 スペース、行幅 100
- 改行 LF

`console.warn` / `console.info` をフォント関連（§8.3）で使うが、Biome の `recommended` プリセットに `noConsole` は含まれないため追加設定は不要。

### 5.3 `tsconfig.json`

テンプレートのものをそのまま使う。テストは `src` 配下にあるため `include` の追加は不要。

```jsonc
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2024"],
    "strict": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "declaration": true,
    "isolatedModules": true,
    "resolveJsonModule": true
  },
  "include": ["src", "tsdown.config.ts", "vitest.config.ts"]
}
```

> `noUncheckedIndexedAccess` / `exactOptionalPropertyTypes` はテンプレートに含まれていないため追加しない。テンプレートとの差異を増やさないことを優先する。必要になった時点で別途議論する。

### 5.4 `.gitattributes` / `.editorconfig`

テンプレートの `.gitattributes` は 1 行のみ。バイナリは Git が NUL バイトで自動判定するため、`src/__fixtures__/*.png` を置いても問題は起きない。**テンプレートのまま採用する。**

```gitattributes
# Normalize all text files to LF, regardless of the platform or the
# contributor's core.autocrlf setting, so Biome's formatter (which writes LF)
# never disagrees with what's checked out on Windows.
* text=auto eol=lf
```

`.editorconfig` はテンプレートに存在しないが、エディタ側でも LF を担保するため追加する（Biome・Git と合わせて 3 重）。

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
insert_final_newline = true
indent_style = space
indent_size = 2
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

> 本リポジトリは Windows で開発されているため、`.gitattributes` 導入時に一度だけ既存ファイルの正規化が必要。 `git add --renormalize . && git commit -m "Normalize line endings to LF"`

### 5.5 `.gitignore`

テンプレートのものをそのまま採用する（`.private/` が既に含まれている）。現行の `tests` エントリは不要になる。

```gitignore
.private/
node_modules/
dist/
coverage/
*.log
.DS_Store
.env
.env.*
!.env.example
```

### 5.6 `tsdown.config.ts`

テンプレートの構成に、エントリ追加と依存の外部化設定を加える。

```ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/api/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // Node >= 22 supports ES2024
  target: 'node22',
  platform: 'node',
  deps: {
    // ky is ESM-only; inline it so the CJS build doesn't `require()` an ESM package.
    alwaysBundle: ['ky'],
    // Native bindings must stay as imports — a bundled .node file won't load.
    neverBundle: ['@napi-rs/canvas', '@twemoji/parser', 'budoux'],
  },
})
```

> **実装時の訂正**: tsdown の移行ガイドには `deps: { external, noExternal }` とあるが、0.22.14 の実際の `DepsConfig` は **`neverBundle` / `alwaysBundle`** に改名されている。旧名を書くと型エラーになる。

`src/api/index.ts` をエントリに追加すると、`dist/api/index.{mjs,cjs,d.mts,d.cts}` が出力され、§5.1 の `exports` と対応する。

**tsup からの主な差分**（移行時の注意）

| tsup | tsdown |
| --- | --- |
| `external` / `noExternal` がトップレベル | **`deps: { neverBundle, alwaysBundle }` に改名**（0.22 で名称変更） |
| CJS が既定 | **ESM が既定**。`format` を明示する |
| `cjsInterop` | `cjsDefault` |

**ESM / CJS 両対応の注意点**

| 項目 | 扱い |
| --- | --- |
| `ky` | `deps.alwaysBundle` でバンドル。CJS からの `require('ky')` を回避 |
| `@napi-rs/canvas` | `external`。`.node` バイナリを含むためバンドル不可 |
| `@twemoji/parser` / `budoux` | CJS/ESM 両対応済み。external のままで良い |
| `import.meta` | CJS 出力で壊れるため **`src/` 内で使用禁止**。パス解決は `node:os` / `node:path` で組む（`scripts/` 内は ESM 専用なので使用可） |
| Top-level await | 同上、`src/` 内で使用禁止 |

### 5.7 `vitest.config.ts`

テンプレートに coverage 設定を追加する。

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/__fixtures__/**'],
    },
  },
})
```

### 5.8 `scripts/check-build.js`

ビルド成果物に対する検証。`vitest` の `include` が `src/**` に限定されており、また `dist` が必要なため、独立したスクリプトとして CI の build ジョブで実行する。

検証項目:

1. `require('./dist/index.cjs')` が成功し、`MiQ` を export している
2. `import('./dist/index.mjs')` が成功し、`MiQ` を export している
3. `require('./dist/api/index.cjs')` / `import('./dist/api/index.mjs')` が成功し、`VoidsMiQ` を export している
4. **`dist/api/index.{cjs,mjs}` のソース文字列に `@napi-rs/canvas` と `budoux` が現れない**（§4.2 の依存分離の担保）
5. `dist/**` に `require("ky")` が現れない（`deps.alwaysBundle` が効いていることの確認）
6. `dist/**` に CRLF が混入していない
7. `dist/index.d.mts` / `dist/api/index.d.cts` などの型定義が生成されている

依存を増やさないため `node:assert` と `node:fs` のみで書く。Biome の `files.includes` に `scripts/**` が含まれているので lint/format 対象になる。

### 5.9 テンプレートからの差分一覧

| 項目 | テンプレート | 本パッケージ | 理由 |
| --- | --- | --- | --- |
| `exports` | `.` のみ | `.` + `./api` + `./package.json` | サブパス分割（§4.1） |
| `tsdown.entry` | 1 エントリ | 2 エントリ | 同上 |
| `tsdown.deps` | なし | `alwaysBundle: ['ky']`, `neverBundle: ['@napi-rs/canvas', …]` | ESM-only 依存とネイティブバイナリ（§5.6） |
| `scripts/setup.js` | あり | **削除** | 既存リポジトリでプレースホルダ置換が不要 |
| `scripts/check-build.js` | なし | **追加** | 依存分離とデュアルフォーマットの検証（§5.8） |
| `biome.files.includes` | `src`, `scripts`, `*.ts`, `*.json` | + `examples/**` | サンプルコードも lint 対象にする |
| `vitest.coverage` | なし | 追加 | `test:coverage` スクリプトが存在するため設定を明示 |
| `.editorconfig` | なし | **追加** | エディタ側でも LF を担保 |
| CI マトリクス | `ubuntu` × Node 22/24 | **+ `windows` / `macos` / `alpine`** | ネイティブバイナリを含むため（§5.10） |
| `.github/dependabot.yml` | なし | **削除**（現行から） | 指示どおり廃止（§2.2） |
| `.github/FUNDING.yml` | なし | **維持**（現行のまま） | 既存の設定を壊さない |

### 5.10 `.github/workflows/ci.yml`

テンプレートの `<setup-steps>` / `<pm>` を npm 向けに展開したうえで、**プラットフォームマトリクスを拡張**する。

`@napi-rs/canvas` はプラットフォームごとに別バイナリを読み込むため、ubuntu だけでは Windows・macOS・musl の破損を検出できない。ここはテンプレートから意図的に逸脱する。

```yaml
name: ci

on:
  push:
    branches: [main, release/*]
  pull_request:
    branches: [main, release/*]

jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
        node-version: [22, 24]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
          cache: npm
      - run: npm install
      - run: npm run ci
      - run: npm run typecheck
      - run: npm run test

  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm install
      - run: npm run build
      - run: npm run check:build

  alpine:
    runs-on: ubuntu-latest
    container: node:22-alpine
    steps:
      - uses: actions/checkout@v4
      - run: npm install
      - run: npm run test
```

`fail-fast: false` にするのは、特定プラットフォームだけで落ちたときに他の結果も見たいため。

`npm run ci`（= `biome ci`）は全 OS で走るが、`.gitattributes` により作業ツリーが LF に正規化されるので、Windows でもフォーマット差分は出ない。

### 5.11 `.github/workflows/release.yml`

テンプレートのものを npm 向けに展開してそのまま使う。**npm Trusted Publishing（OIDC）**により `NPM_TOKEN` を持たない。

```yaml
name: release

on:
  workflow_dispatch:
    inputs:
      version:
        description: 'Version to release: a semver bump (patch/minor/major/prerelease) or an explicit version (e.g. 0.1.0)'
        required: true
        default: patch

permissions:
  contents: write # push the version commit/tag and create the GitHub Release
  id-token: write # npm trusted publishing (OIDC)

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm install
      - run: npm run ci
      - run: npm run typecheck
      - run: npm run test
      - run: npm run build
      - run: npm run check:build          # ← 差分: 公開前に成果物を検証

      - name: Bump version
        id: bump
        run: |
          OLD="$(node -p "require('./package.json').version")"
          npm version "${{ inputs.version }}" --no-git-tag-version --allow-same-version >/dev/null
          NEW="$(node -p "require('./package.json').version")"
          echo "version=v${NEW}" >> "$GITHUB_OUTPUT"
          if [ "$OLD" = "$NEW" ]; then
            echo "changed=false" >> "$GITHUB_OUTPUT"
            echo "::notice::Version is already ${NEW}; skipping the bump commit but still releasing."
          else
            echo "changed=true" >> "$GITHUB_OUTPUT"
          fi

      - run: npm install -g npm@11
      - run: npm publish --access public --provenance

      - name: Commit, tag and push
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          if [ "${{ steps.bump.outputs.changed }}" = "true" ]; then
            git commit -am "release: ${{ steps.bump.outputs.version }}"
          fi
          if ! git rev-parse -q --verify "refs/tags/${{ steps.bump.outputs.version }}" >/dev/null; then
            git tag "${{ steps.bump.outputs.version }}"
          fi
          git push origin HEAD "${{ steps.bump.outputs.version }}"

      - name: Create GitHub Release
        env:
          GH_TOKEN: ${{ github.token }}
        run: gh release create "${{ steps.bump.outputs.version }}" --title "${{ steps.bump.outputs.version }}" --generate-notes
```

**公開前の準備（1 回だけ）**: npmjs.com の `makeitaquote` → Settings → Publishing access → Trusted publishers で GitHub の `otnc/makeitaquote` / `release.yml` を登録する。これをしないと `npm publish` が失敗する。

### 5.12 Issue / PR テンプレート・CONTRIBUTING

テンプレートの以下をそのまま持ち込み、プレースホルダを本リポジトリの値に置換する。

- `.github/ISSUE_TEMPLATE/1-bug-report.yml`
- `.github/ISSUE_TEMPLATE/2-feature-request.yml`
- `.github/ISSUE_TEMPLATE/config.yml`
- `.github/PULL_REQUEST_TEMPLATE.md`
- `CONTRIBUTING.md`

バグ報告テンプレートには、本パッケージ固有の項目として以下を追加する。

- OS / アーキテクチャ（`@napi-rs/canvas` のバイナリ選択に直結）
- Node.js のバージョン
- 実行環境（ローカル / Docker / Alpine / サーバーレス）
- 使用しているエントリ（`makeitaquote` か `makeitaquote/api` か）

---

## 6. 公開 API 設計

### 6.1 ルート（`makeitaquote`）

```ts
export { MiQ } from './core/MiQ'
export { defineTheme, themes } from './theme/presets'
export { fonts } from './font/registry'
export {
  AssetFetchError,
  FontNotAvailableError,
  MiQError,
  RenderError,
  ValidationError,
} from './core/errors'
export type {
  AutoFontOptions,
  EncodeOptions,
  FontSource,
  MessageLike,
  MiQOptions,
  OutputFormat,
  QuoteData,
  QuoteInput,
  Segment,
  Theme,
  ThemeInput,
  ThemeName,
} from './core/types'
```

### 6.2 `MiQ` クラス

```ts
class MiQ {
  constructor(options?: MiQOptions)

  // ---- 入力 ----
  setText(text: string): this
  setAvatar(avatar: string | URL | Buffer | Uint8Array | null): this
  setUsername(username: string): this
  setDisplayName(displayName: string): this
  setWatermark(watermark: string): this

  setFromMessage(message: MessageLike): this
  setFromObject(input: QuoteInput): this

  // ---- 見た目 ----
  setTheme(theme: ThemeName | ThemeInput): this
  setSize(width: number, height: number): this

  // ---- 取得 ----
  getData(): Readonly<QuoteData>
  getTheme(): Readonly<Theme>
  clone(): MiQ

  // ---- 出力 ----
  render(): Promise<Canvas>
  toBuffer(format?: OutputFormat, options?: EncodeOptions): Promise<Buffer>
  toStream(format?: OutputFormat, options?: EncodeOptions): Promise<Readable>
  toDataURL(format?: OutputFormat, options?: EncodeOptions): Promise<string>
}

interface MiQOptions {
  theme?: ThemeName | ThemeInput
  /** 既定 true。未登録フォントを URL から自動取得する（§8） */
  autoFont?: boolean | AutoFontOptions
  /** true にすると未登録フォントで FontNotAvailableError を投げる */
  strictFonts?: boolean
  /** アセット取得失敗時の挙動。既定 'text' */
  onAssetError?: 'ignore' | 'text' | 'throw'
  signal?: AbortSignal
}
```

### 6.3 使用例

```ts
import { MiQ } from 'makeitaquote'
import { writeFile } from 'node:fs/promises'

// フォント設定は不要。初回のみ Noto Sans JP が自動取得される（§8）
const png = await new MiQ()
  .setText('吾輩は猫である。名前はまだ無い。')
  .setAvatar('https://cdn.discordapp.com/avatars/.../avatar.webp?size=512')
  .setUsername('otoneko.')
  .setDisplayName('音猫｡')
  .setWatermark('Make it a Quote')
  .setTheme('dark')
  .toBuffer('png')

await writeFile('quote.png', png)
```

```ts
// discord.js から
import { AttachmentBuilder } from 'discord.js'
import { MiQ } from 'makeitaquote'

const buffer = await new MiQ().setFromMessage(message).toBuffer('png')
await message.reply({
  files: [new AttachmentBuilder(buffer, { name: 'quote.png' })],
})
```

```ts
// テーマのカスタマイズ
const buffer = await new MiQ()
  .setFromMessage(message)
  .setTheme({
    extends: 'light',
    background: '#FFF8E7',
    text: { color: '#2B2B2B', font: 'Noto Serif JP' },
    avatar: { grayscale: false, position: 'right' },
  })
  .setSize(1600, 900)
  .toBuffer('webp', { quality: 90 })
```

### 6.4 API サブパス（`makeitaquote/api`）

§2.1 で確認したエンドポイントの機能差を、そのまま API 形状に反映する。

```ts
export class VoidsMiQ {
  constructor(options?: VoidsOptions)

  setText(text: string): this
  setAvatar(avatar: string | null): this
  setUsername(username: string): this
  setDisplayName(displayName: string): this
  setColor(color: boolean): this
  setWatermark(watermark: string): this

  setFromMessage(message: MessageLike): this
  setFromObject(input: QuoteInput): this

  getData(): Readonly<QuoteData>

  /**
   * ホストされた画像 URL を取得する。
   * → 常に /fakequote を使う（URL を返せるのはこちらだけ）
   * 生成画像は Voids 側にアップロードされる点に注意。
   */
  toURL(): Promise<string>

  /**
   * 画像バイナリを取得する。
   * → 既定で /fakequotebeta を使う（1 往復で済み、画像が外部に保存されない）
   * → { hosted: true } で /fakequote 経由（POST → URL → GET の 2 往復）に切り替える
   */
  toBuffer(options?: { hosted?: boolean }): Promise<Buffer>
}

export interface VoidsOptions {
  baseUrl?: string // 既定 'https://api.voids.top'
  timeout?: number // 既定 15000
  retry?: number // 既定 2
  headers?: Record<string, string>
  signal?: AbortSignal
}

export class VoidsApiError extends MiQError {
  readonly status?: number
  readonly body?: unknown
  readonly endpoint: '/fakequote' | '/fakequotebeta'
}

/** 実装のフォールバック用に、エンドポイントの能力を公開する */
export const endpoints: {
  readonly hosted: { path: '/fakequote'; returns: 'url'; roundTripsForBuffer: 2 }
  readonly direct: { path: '/fakequotebeta'; returns: 'binary'; roundTripsForBuffer: 1 }
}
```

**v8 からの改善点**

- 「メソッド名でエンドポイントを選ぶ」（`generate` / `generateBeta`）のをやめ、**欲しい成果物を言えば適切なエンドポイントが選ばれる**ようにした。
- `toBuffer()` が既定で `/fakequotebeta` を使うことで、v8 の `generate(true)` にあった**無駄な 2 往復が消える**。
- 画像が外部にアップロードされるのは `toURL()`（および `toBuffer({ hosted: true })`）を呼んだときだけであることが、コード上明示される。
- クラス名は `VoidsMiQ`。`MiQ` という別名も同時に export し、`import { MiQ } from 'makeitaquote/api'` でも書けるようにする（ローカル版と併用する場合は `VoidsMiQ` を使う）。

### 6.5 相互運用

`QuoteData` / `MessageLike` / エラー基底 `MiQError` はルートと api で共有する。

```ts
import { MiQ } from 'makeitaquote'
import { VoidsMiQ } from 'makeitaquote/api'

const data = new MiQ().setFromMessage(message).getData()

// API を優先し、落ちていたらローカルにフォールバックする
let png: Buffer
try {
  png = await new VoidsMiQ().setFromObject(data).toBuffer()
} catch {
  png = await new MiQ().setFromObject(data).toBuffer('png')
}
```

---

## 7. 描画設計

### 7.1 レイアウト仕様（既定 `dark` テーマ）

既定キャンバス: **1280 × 720**（16:9）。座標は幅 `W` / 高さ `H` に対する比率で定義し、`setSize()` に追随させる。

```
┌───────────────────────────────────────────────────────────┐
│                          ░░▒▒▓▓                            │
│  ┌─────────────────┐        ▓▓                             │
│  │                 │        ▓▓                             │
│  │  avatar (cover) │        ▓▓      “ 引用文がここに      │
│  │  grayscale      │        ▓▓        入る。長ければ      │
│  │                 │        ▓▓        折り返される ”      │
│  │                 │        ▓▓                             │
│  │                 │        ▓▓            - 音猫｡         │
│  │                 │        ▓▓            @otoneko.       │
│  └─────────────────┘        ▓▓                             │
│                                          Make it a Quote  │
└───────────────────────────────────────────────────────────┘
 0                  0.5W    0.62W                          W
                     └─ グラデーション ─┘
```

| 要素 | 既定値 |
| --- | --- |
| キャンバス | `1280 × 720`、背景 `#000000` |
| アバター領域 | `x: 0 → 0.5W`、`y: 0 → H`。`object-fit: cover` 相当でクロップ |
| グレースケール | `dark` / `light` は有効、`color` は無効 |
| フェード | `createLinearGradient(0.30W, 0, 0.62W, 0)`：`rgba(bg,0)` → `rgba(bg,1)`。ストップは `0 / 0.55 / 1` の 3 点 |
| テキスト領域 | `x: 0.54W → 0.96W`（幅 `0.42W`）、`y: 0.10H → 0.78H` |
| 本文フォント | 初期 `0.062H`（=45px @720）、自動縮小（§7.4）、`textAlign: center`、行送り `1.35em` |
| 引用符 | 本文を `“` `”` で囲む（テーマで変更・無効化可能） |
| display name | 本文ブロック下 `0.055H`、サイズ `0.040H`、`- {displayName}` |
| username | display name 下 `0.030H`、サイズ `0.028H`、色 `#9A9A9A`、`@{username}` |
| watermark | 右下 `x: 0.96W`, `y: 0.94H`、`textAlign: right`、サイズ `0.024H`、色 `#6E6E6E` |

`light` テーマは背景 `#FFFFFF`、本文 `#111111`、username `#666666`、watermark `#999999`、グラデーション終端色を白に変更。

### 7.2 描画パイプライン

```
1. validate(data)            必須項目・型の検証            → ValidationError
2. resolveTheme(themeInput)  部分指定 → 完全な Theme
3. ensureFonts(theme)        必要フォントの確認・自動取得   → §8
4. prefetchAssets(data)      アバター + 絵文字を並列取得    → AssetFetchError
     ├─ loadAvatar()
     └─ prefetchEmojis()     セグメント走査 → URL 集合 → 並列 fetch
5. createCanvas(W, H)
6. drawBackground()
7. drawAvatar()              cover クロップ → グレースケール → drawImage
8. drawGradient()
9. layoutText()              セグメント化 → フィッティング → 折り返し
10. drawQuote()
11. drawAttribution()
12. drawWatermark()
13. return canvas
```

4 で全アセットを先読みするのが要点。参考ライブラリは描画ループ内で `await loadImage(url)` していたため直列 HTTP になっていた。v9 では 9 で確定したセグメント集合から URL を重複排除し、`Promise.allSettled` で並列取得してから 10 に入る。

### 7.3 テキストセグメント化と折り返し

**セグメント型**

```ts
type Segment =
  | { kind: 'text'; value: string }
  | { kind: 'emoji'; source: 'twemoji'; url: string; raw: string }
  | {
      kind: 'emoji'
      source: 'discord'
      url: string
      raw: string
      id: string
      name: string
      animated: boolean
    }
```

**セグメント化**（`text/segment.ts`）

1. `@twemoji/parser` の `parse(text, { assetType: 'png' })` で標準絵文字の `indices` と `url` を得る。
2. 絵文字区間で分割し、間のテキストを `{ kind: 'text' }` として積む。
3. 各テキスト片に `/<(a)?:(\w{2,32}):(\d{17,20})>/g` を適用してさらに分割する。URL は `https://cdn.discordapp.com/emojis/{id}.{ext}?size=64`（`animated` なら `.gif`）。GIF は 1 フレーム目のみ描画される。これは仕様として README に明記する。
4. 空文字セグメントを除去する。

**幅計測**（`text/measure.ts`）

```
width(segment) =
  kind === 'text'  → ctx.measureText(value).width
  kind === 'emoji' → fontSize + emojiSideMargin * 2      (既定 margin = fontSize * 0.08)
```

絵文字はベースライン基準で `drawImage(img, x + sideMargin, y - fontSize + topMargin - baseline, fontSize, fontSize)` に配置する（`topMargin = fontSize * 0.10`）。

**改行候補位置の決定**（`text/breakpoint.ts`）

3 層で候補を作り、優先度の高い順に採用する。

| 優先度 | 種別 | 決定方法 |
| --- | --- | --- |
| 1 | ハード改行 | 入力中の `\n`。必ずここで折る |
| 2 | 単語境界（ラテン系） | 半角スペース・タブ・ハイフンの直後 |
| 2 | **文節境界（日本語）** | **BudouX の `new Parser(jaModel).parse()` が返すチャンク境界** |
| 3 | 絵文字境界 | 絵文字セグメントの前後 |
| 4 | グラフェム境界（最終手段） | `Intl.Segmenter(locale, { granularity: 'grapheme' })` |

BudouX の適用単位は「連続するテキストセグメント」。絵文字を挟むと文脈が切れるため、絵文字で区切られた各テキスト片に対して個別に `parse()` する。BudouX が単一チャンクしか返さない（＝分割できない）場合は優先度 4 のグラフェム境界に落ちる。

**折り返し**（`text/wrap.ts`）

1. ハード改行で分割。
2. 各行について候補位置つきのトークン列を作る。
3. 貪欲法で詰め、`maxWidth` 超過時に**直前の最も優先度の高い候補位置**で折る。
4. 候補がない長大トークン（連続する英数字・URL など）はグラフェム単位で強制分割する。
5. 簡易禁則処理:
   - 行頭禁則（前行へ追い出す）: `、。，．）］｝〉》」』】〕！？ゝゞーぁぃぅぇぉっゃゅょゎヵヶ` と小書き仮名
   - 行末禁則（次行へ送る）: `（［｛〈《「『【〔`
6. グラフェムクラスタを分断しないことを `Intl.Segmenter` で保証する（サロゲートペア・結合文字・ZWJ 絵文字列）。

### 7.4 フォント自動フィッティング

```
maxFontSize = theme.text.size            (既定 0.062H)
minFontSize = theme.text.minSize         (既定 0.030H)

for size = maxFontSize down to minFontSize, step -1:
    lines = wrap(segments, size, areaWidth)
    blockHeight = lines.length * size * lineHeight
    if blockHeight <= areaHeight: break

if 収まらない:
    theme.text.overflow === 'shrink'   → minFontSize で描画（はみ出しはクリップ）
    theme.text.overflow === 'ellipsis' → 末尾を '…' に切り詰め（既定）
    theme.text.overflow === 'error'    → RenderError を投げる
```

線形探索は最大 30 回程度の `wrap()` 呼び出しになるが、`measureText` 結果を `Map<string, number>` でメモ化し、BudouX の `parse()` 結果もフォントサイズに依存しないため一度だけ計算してキャッシュすれば実測 1ms 未満に収まる。二分探索は「サイズを下げると必ず収まる」が禁則処理の影響で単調にならない稀なケースがあるため採らない。

### 7.5 アバター処理

```ts
// 1. 読み込み: URL / Buffer / null
//    null または取得失敗 → theme.avatar.fallback（既定: 単色 + イニシャル文字）

// 2. cover クロップ
const scale = Math.max(destW / img.width, destH / img.height)
const sw = destW / scale
const sh = destH / scale
const sx = (img.width - sw) / 2
const sy = (img.height - sh) / 2

// 3. グレースケール
//    第一選択: ctx.filter = 'grayscale(100%)' → drawImage → ctx.filter = 'none'
//    フォールバック: オフスクリーンで getImageData → 輝度変換 → putImageData
//    （起動時に 1x1 canvas で filter 対応を検出し結果をキャッシュ）
ctx.drawImage(img, sx, sy, sw, sh, 0, 0, destW, destH)
```

輝度式は Rec.709（`0.2126R + 0.7152G + 0.0722B`）。

`theme.avatar.shape` で `'rect'`（既定・オリジナル準拠）/ `'circle'` / `'rounded'` を選べる。後者 2 つは `ctx.clip()` で切り抜く。

---

## 8. フォント設計 — 「設定なしで動く」

### 8.1 課題

Skia はシステムフォントを拾うが、Alpine コンテナや最小構成の Linux には日本語フォントが存在しない。何もしなければ日本語が豆腐（□）になる。一方で日本語フォントを npm パッケージに同梱すると 10MB 近く増える。

**解決策: フォントを npm には同梱せず、必要になった時点で CDN から取得し、ディスクにキャッシュする。**

### 8.2 取得元

`@napi-rs/canvas` の WOFF2 対応がバージョンにより不安定なため、**TTF に限定する**。実在と到達性を確認済み。

| 用途 | URL | サイズ |
| --- | --- | --- |
| 日本語（既定） | `https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosansjp/NotoSansJP%5Bwght%5D.ttf` | **9.6 MB** |
| ラテン（既定） | `https://cdn.jsdelivr.net/gh/google/fonts@main/ofl/notosans/NotoSans%5Bwdth,wght%5D.ttf` | **2.0 MB** |

いずれも可変フォント（Variable Font）で全ウェイトを含む。google/fonts に静的インスタンス（`static/NotoSansJP-Regular.ttf`）は存在しないことを確認済み（404）。

`@fontsource/*` の WOFF2 サブセット（1 ファイル数百 KB）のほうが軽量だが、WOFF2 の読み込み可否が確実でないため既定にはしない。`fontSource` オプションで利用者が差し替えられるようにする。

カラー絵文字フォント（`NotoColorEmoji.ttf`, 10.7 MB）は**取得しない**。絵文字は Twemoji / Discord CDN の画像として描画するため不要（§3.3）。

### 8.3 API と挙動

```ts
export const fonts = {
  // ---- 明示的な登録 ----
  registerFromPath(path: string, alias?: string): boolean
  register(data: Buffer, alias: string): boolean
  registerFromDir(dir: string): number

  // ---- URL からの取得 ----
  /** URL から取得して登録する。ディスクキャッシュを経由する */
  registerFromURL(url: string, alias: string): Promise<boolean>
  /** 既定フォント（Noto Sans JP / Noto Sans）を確実に用意する */
  ensureDefaults(options?: AutoFontOptions): Promise<void>

  // ---- 問い合わせ ----
  families(): string[]
  has(family: string): boolean
  /** ディスクキャッシュの場所と使用量 */
  cacheInfo(): { dir: string; files: string[]; bytes: number }
  clearCache(): Promise<void>
}

export interface AutoFontOptions {
  /** 既定 true。false で自動取得を完全に無効化 */
  enabled?: boolean
  /** ダウンロード先。既定は下記の解決順 */
  cacheDir?: string
  /** 取得するフォントの定義。既定は Noto Sans JP + Noto Sans */
  sources?: FontSource[]
  /** ダウンロードのタイムアウト。既定 60000 */
  timeout?: number
  /** 進捗コールバック。未指定なら console.info に 1 行出す */
  onProgress?: (info: { name: string; received: number; total: number }) => void
}

export interface FontSource {
  family: string // 'Noto Sans JP'
  url: string
  /** ファイル名。省略時は URL から導出 */
  fileName?: string
  /** 整合性検証用（任意）。'sha256-...' */
  integrity?: string
}
```

**キャッシュディレクトリの解決順**

1. `AutoFontOptions.cacheDir`
2. 環境変数 `MIQ_FONT_CACHE_DIR`
3. `$XDG_CACHE_HOME/makeitaquote/fonts`
4. `~/.cache/makeitaquote/fonts`（Linux/macOS）/ `%LOCALAPPDATA%\makeitaquote\fonts`（Windows）
5. `os.tmpdir()/makeitaquote-fonts`（上記が書き込み不可の場合）

**自動取得のトリガと流れ**

```
render() の ensureFonts(theme):
  1. theme.text.font などで要求されているファミリを列挙
  2. GlobalFonts.families() と登録済みエイリアスで解決を試みる
  3. すべて解決できた → 何もしない（ネットワークアクセスなし）
  4. 解決できないものがある かつ autoFont.enabled:
       a. ディスクキャッシュにファイルがあれば registerFromPath して終了（ネットワークなし）
       b. なければ CDN から取得:
            - 初回のみ console.info で通知
              「makeitaquote: downloading Noto Sans JP (9.6 MB) to ~/.cache/... (first run only)」
            - 一時ファイルに書き出し → 完了後に rename（部分ファイルを残さない）
            - registerFromPath で登録
       c. 取得に失敗 → console.warn を出し、システムフォントで描画を続行
  5. autoFont.enabled === false かつ未解決:
       - strictFonts なら FontNotAvailableError
       - そうでなければ console.warn（初回のみ）を出して続行
```

**設計上の要点**

- **ネットワークアクセスは「本当に必要なときの初回だけ」**。2 回目以降はディスクキャッシュから読むため一切発生しない。システムに日本語フォントがある環境（多くの開発機）では最初から発生しない。
- ダウンロードは**一時ファイル → rename** の 2 段階。中断された部分ファイルが次回に読まれる事故を防ぐ。
- 同一プロセス内の**同時ダウンロードは in-flight promise で合流**させる。複数の `MiQ` が同時に `render()` しても 1 回しか落とさない。
- 複数プロセスの同時ダウンロードは、一時ファイル名に PID を含めることで衝突を避ける（最後に rename したものが勝つ。内容は同一なので問題ない）。
- **黙ってネットワークに出ることはしない**。初回は必ず 1 行ログを出し、`autoFont: false` で完全に無効化できる。CI や閉域環境向けに、`MIQ_FONT_CACHE_DIR` に事前配置しておけばオフラインで動く。
- `GlobalFonts.register()` の Buffer 参照問題（§3.2）を避けるため、**自動取得したフォントは必ずファイルに書いてから `registerFromPath()` で登録する**。

**フォント解決の優先順**

1. `theme.*.font` に指定されたファミリ
2. 利用者が明示登録したファミリ（登録順）
3. 自動取得された既定フォント（Noto Sans JP → Noto Sans）
4. システムフォント
5. `sans-serif`

**Docker での推奨**

README に、ビルド時にフォントを焼き込んでランタイムのダウンロードをなくす例を載せる。

```dockerfile
ENV MIQ_FONT_CACHE_DIR=/app/.fonts
RUN node -e "import('makeitaquote').then(m => m.fonts.ensureDefaults())"
```

---

## 9. サブシステム設計

### 9.1 テーマ

```ts
export interface Theme {
  width: number
  height: number
  background: string
  avatar: {
    grayscale: boolean
    position: 'left' | 'right'
    widthRatio: number // 既定 0.5
    shape: 'rect' | 'circle' | 'rounded'
    fallback: { background: string; color: string } | null
  }
  gradient: {
    enabled: boolean
    startRatio: number // 既定 0.30
    endRatio: number // 既定 0.62
    stops: Array<[offset: number, alpha: number]> // 既定 [[0,0],[0.55,0.85],[1,1]]
  }
  text: {
    color: string
    font: string
    size: number // 0 < v <= 1 なら H に対する比率、> 1 なら px
    minSize: number
    lineHeight: number // 既定 1.35
    align: 'left' | 'center' | 'right'
    quotes: [open: string, close: string] | null // 既定 ['“', '”']
    overflow: 'ellipsis' | 'shrink' | 'error'
    area: { x: number; y: number; width: number; height: number }
    /** 改行に BudouX を使うか。既定 true */
    phraseBreak: boolean
    /** BudouX のモデル。既定 'ja' */
    locale: 'ja' | 'zh-hans' | 'zh-hant' | 'none'
  }
  displayName: { color: string; font: string; size: number; prefix: string }
  username: { color: string; font: string; size: number; prefix: string }
  watermark: {
    color: string
    font: string
    size: number
    position: 'bottom-right' | 'bottom-left' | 'bottom-center'
  }
  emoji: { sideMarginRatio: number; topMarginRatio: number; size: 64 | 72 | 128 }
}

export type ThemeInput = DeepPartial<Theme> & { extends?: ThemeName }
export type ThemeName = 'dark' | 'light' | 'color'
```

| プリセット | 背景 | 本文 | アバター | 用途 |
| --- | --- | --- | --- | --- |
| `dark` | `#000000` | `#FFFFFF` | グレースケール | 既定。オリジナル MiQ 準拠 |
| `light` | `#FFFFFF` | `#111111` | グレースケール | 白背景・黒文字 |
| `color` | `#000000` | `#FFFFFF` | カラーのまま | v8 の `setColor(true)` 相当 |

`defineTheme(input: ThemeInput): Theme` で `extends` の解決と比率／絶対値の正規化を行う。

### 9.2 絵文字キャッシュ

- `util/lru.ts` に依存なしの LRU（`Map` の挿入順を利用、~50 行）を実装。`lru-cache` への依存は増やさない。
- 既定 `maxEntries: 256` / `ttlMs: 3_600_000`。
- **モジュールスコープのグローバルキャッシュ**。`MiQ` インスタンス単位ではなく Bot 全体で共有されるべき性質のもの。
- **同一 URL への同時リクエストを合流**させる（in-flight promise の共有）。
- 取得失敗した URL は**負のキャッシュ**（既定 60 秒）に入れ、リトライ嵐を防ぐ。

### 9.3 出力

```ts
type OutputFormat = 'png' | 'jpeg' | 'webp' | 'avif'
interface EncodeOptions {
  quality?: number // 1–100、既定 92。png では無視
}
```

| メソッド | 戻り値 | 備考 |
| --- | --- | --- |
| `toBuffer(format?, options?)` | `Promise<Buffer>` | 既定 `'png'` |
| `toStream(format?, options?)` | `Promise<Readable>` | `Readable.from(buffer)` |
| `toDataURL(format?, options?)` | `Promise<string>` | `data:image/png;base64,...` |
| `render()` | `Promise<Canvas>` | 利用者が独自に後処理する逃げ道 |

### 9.4 HTTP クライアント

```ts
// src/http/client.ts
import ky from 'ky'

export const createClient = (options: HttpOptions = {}) =>
  ky.create({
    timeout: options.timeout ?? 10_000,
    retry: {
      limit: options.retry ?? 2,
      methods: ['get', 'post'],
      statusCodes: [408, 413, 429, 500, 502, 503, 504],
      backoffLimit: 3_000,
    },
    headers: options.headers,
  })
```

アセット取得用・フォント取得用・Voids API 用でインスタンスを分ける（タイムアウト値が異なるため）。`MiQOptions.signal` を全リクエストへ伝播させる。

### 9.5 エラー階層

```
Error
└─ MiQError                    （全エラーが instanceof MiQError を満たす）
   ├─ ValidationError          入力の型・必須・範囲違反（field を持つ）
   ├─ FontNotAvailableError    strictFonts 時のフォント未解決
   ├─ AssetFetchError          アバター / 絵文字 / フォントの取得失敗（url, cause）
   ├─ RenderError              描画中の失敗（overflow: 'error' を含む）
   └─ VoidsApiError            Voids API のエラー（status, body, endpoint）
```

すべて `cause` を受け取り元例外を失わない。

---

## 10. テスト設計

### 10.1 方針

画像出力のピクセル比較はフォントのバージョン差・OS 差・Skia の更新で容易に壊れる。**純関数のロジックを厚くテストし、描画結果は smoke test に留める。**

テストはソースに併置（`src/**/*.test.ts`）。ベーステンプレートの `vitest.config.ts` の `include` に従う。

### 10.2 テストマトリクス

| 対象ファイル | 内容 |
| --- | --- |
| `text/segment.test.ts` | 入力文字列 → `Segment[]`。Twemoji / Discord 絵文字 / ZWJ 絵文字（👨‍👩‍👧‍👦）/ 肌色修飾 / 混在 |
| `text/breakpoint.test.ts` | BudouX の文節境界が期待どおり候補になるか。日本語・英語・混在。`phraseBreak: false` でグラフェム境界に落ちること |
| `text/wrap.test.ts` | 幅固定の fake `measureText` を注入して行分割を検証。CJK・長大 URL・禁則・改行混在 |
| `text/fit.test.ts` | 収まる／収まらない／`overflow` 3 種 |
| `theme/resolve.test.ts` | `extends` の合成、比率↔px 正規化、不正値の拒否 |
| `util/lru.test.ts` | 追い出し順序、TTL、in-flight 合流、負のキャッシュ |
| `emoji/resolve.test.ts` | Discord 絵文字 URL の生成（`animated` で拡張子が変わること、`size` パラメータ） |
| `font/autoload.test.ts` | fetch をスタブ化し、(a) キャッシュヒット時にネットワークが呼ばれない、(b) 一時ファイル→rename、(c) 同時呼び出しの合流、(d) 失敗時に例外を投げず warn で続行 |
| `core/source.test.ts` | discord.js v13 / v14 / selfbot 相当のモックから `QuoteData` を導出 |
| `core/MiQ.test.ts` | バリデーション、`clone()` の独立性、チェーンの戻り値 |
| `render/pipeline.test.ts` | 実際に PNG を生成し、(a) PNG シグネチャ、(b) 幅・高さ、(c) 特定座標の色が背景色と一致、(d) 例外が出ない |
| `api/client.test.ts` | `ky` をモックし、**`toURL()` が `/fakequote` を、`toBuffer()` が `/fakequotebeta` を叩くこと**、`toBuffer({ hosted: true })` が 2 往復すること、snake_case 変換、エラーマッピングを検証。**実 API は叩かない** |

絵文字 CDN・フォント CDN へのネットワークアクセスはテストで行わない。`emoji/loader.ts` と `font/autoload.ts` の fetch を注入可能にし、`src/__fixtures__/` を返すスタブを使う。

ビルド成果物の検証は `scripts/check-build.js` が担当する（§5.8）。vitest の対象外。

---

## 11. 実装フェーズ

| # | フェーズ | 内容 | 完了条件 |
| --- | --- | --- | --- |
| 0 | 既存資産の整理 | `index.js` / `index.d.ts` / `lib/` / `examples/*.js,md` / `.github/dependabot.yml` を削除。`.gitattributes` 導入 + `git add --renormalize .` | 作業ツリーが LF に統一される |
| 1 | 足場 | `oto-lab/npm-biome-ts` から `package.json` / `biome.json` / `tsconfig.json` / `tsdown.config.ts` / `vitest.config.ts` / `.gitignore` / `.editorconfig` / `.github/**` を移植し、§5.9 の差分を適用。`scripts/check-build.js` 作成 | `npm run ci && npm run typecheck && npm run build && npm run check:build` が通る |
| 2 | 型と入力 | `core/types.ts`, `errors.ts`, `quote.ts`, `source.ts` | `core/source.test.ts` が緑 |
| 3 | api | `api/*` を実装。エンドポイントの機能差（§2.1）を実出力で検証し、README の対応表を確定 | v8 と同等の生成ができ、`check:build` の依存分離チェックが緑 |
| 4 | テキスト層 | `text/segment.ts`, `measure.ts`, `breakpoint.ts`(BudouX), `wrap.ts`, `fit.ts` | 折り返し・禁則・文節境界のテストが緑（描画なし） |
| 5 | 絵文字層 | `emoji/*`, `util/lru.ts` | スタブ fetch でのテストが緑 |
| 6 | フォント層 | `font/registry.ts`, `autoload.ts`, `diskCache.ts`, `sources.ts` | フォント未設定の Alpine コンテナで日本語が描画できる |
| 7 | 描画層 | `theme/*`, `render/*`, `output/encode.ts` | `toBuffer()` が有効な PNG を返す |
| 8 | 仕上げ | README 全面改訂、`examples/*` を TS で書き直し、Issue/PR テンプレート、CONTRIBUTING | CI 全マトリクス緑 |
| 9 | 公開 | npm の Trusted Publisher 設定（§5.11）→ `release` ワークフローを手動実行 | `9.0.0` が publish される |

**フェーズ 3 を先に置く理由**: api は既存コードの移植で実装量が小さい。ここまでで「v8 相当の機能を持つ v9」が動く状態を作れるので、以降のローカル描画実装を落ち着いて進められる。

**フェーズ 6 をフェーズ 7 より前に置く理由**: フォントがないと描画結果を目視確認できないため。

---

## 12. 移行ガイド（README 掲載用）

```diff
- const { MiQ } = require('makeitaquote');
+ const { MiQ } = require('makeitaquote')             // ローカル生成に移行する場合
+ const { VoidsMiQ } = require('makeitaquote/api')    // API を使い続ける場合

  const buffer = await new MiQ()
      .setText(message.content)
      .setAvatar(url)
      .setUsername('otoneko.')
-     .setDisplayname('音猫｡')
+     .setDisplayName('音猫｡')
-     .setColor(true)
+     .setTheme('color')
      .setWatermark('Make it a Quote')
-     .generate(true);
+     .toBuffer('png')
```

| v8 | v9（ローカル） | v9（API） |
| --- | --- | --- |
| `new MiQ()` | `new MiQ()` | `new VoidsMiQ()` |
| `.setDisplayname(v)` | `.setDisplayName(v)` | `.setDisplayName(v)` |
| `.setColor(true)` | `.setTheme('color')` | `.setColor(true)` |
| `.setText(v, true)` | `.setText(stripDiscordMarkdown(v))` | 同左 |
| `.generate()` | ローカル生成に URL は存在しない | `.toURL()`（`/fakequote`） |
| `.generate(true)` | `.toBuffer('png')` | `.toBuffer({ hosted: true })`（2 往復） |
| `.generateBeta()` | `.toBuffer('png')` | **`.toBuffer()`**（`/fakequotebeta`、1 往復） |
| `.getFormat()` | `.getData()` | `.getData()` |

**その他の破壊的変更**

- `setText()` の第 2 引数（Markdown 除去）は廃止。`displus` 依存をやめたため。必要なら利用者側で前処理する。
- Node.js **22 以上**が必須。
- `makeitaquote/voids` ではなく **`makeitaquote/api`**。
- 初回実行時に日本語フォント（9.6 MB）が自動ダウンロードされる場合がある。`autoFont: false` で無効化できる（§8.3）。

**README で説明を改めるべき点**

v8 の README にある「API issue で `.generate()` が使えないときは `.generateBeta()` を使う」という記述は、実態と合っていない。両者は**返すものが違う別機能**（§2.1）であり、v9 では以下のように説明する。

> - 画像 URL が欲しい → `toURL()`（`/fakequote`。画像は Voids 側にホストされます）
> - 画像データだけ欲しい → `toBuffer()`（`/fakequotebeta`。1 往復で済み、画像は保存されません）

---

## 13. リスクと対策

| リスク | 影響 | 対策 |
| --- | --- | --- |
| 初回のフォント DL が 9.6 MB | 初回 `render()` が数秒かかる | 初回のみ console.info で明示。ディスクキャッシュで 2 回目以降ゼロ。Docker 向けにビルド時プリフェッチ手順を README に記載（§8.3）。より軽い `fontSource` に差し替え可能 |
| 閉域網・オフライン環境 | フォント DL が失敗 | 失敗しても例外にせず warn + システムフォントで続行。`MIQ_FONT_CACHE_DIR` に事前配置すればオフラインで完全動作 |
| `@napi-rs/canvas` のバイナリがない環境 | インストール／実行時に失敗 | `dependencies` に置き install 時点で気付ける状態にする。README に対応プラットフォーム表を載せ、非対応環境向けに `makeitaquote/api` を案内。CI で全 OS + Alpine を回す（§5.10） |
| Twemoji / Discord CDN の到達性・レート制限 | 絵文字が欠ける | ky のリトライ、LRU、負のキャッシュ、in-flight 合流。失敗時は例外にせず元テキストを描画（`onAssetError: 'text'` が既定） |
| `ky` の ESM-only による CJS 破損 | `require()` 利用者が全滅 | `tsdown` の `deps.alwaysBundle` でバンドル。`scripts/check-build.js` で `require('./dist/index.cjs')` の成功を CI で保証 |
| `GlobalFonts.register` の Buffer 参照問題 | フォントが化ける／クラッシュ | 自動取得フォントは必ずファイル経由で `registerFromPath()`。Buffer 登録時は registry が参照を保持 |
| BudouX の分割が不自然なケース | 改行位置が不自然 | 品質向上の上乗せという位置づけ。`phraseBreak: false` で無効化でき、無効化してもグラフェム境界で必ず折れる |
| dependabot 廃止で依存が古くなる | 脆弱性の見落とし | リリース前に `npm outdated` / `npm audit` を手動確認する手順を CONTRIBUTING に記載 |
| Trusted Publishing の設定漏れ | `release` ワークフローが publish で失敗 | フェーズ 9 の最初の手順として npmjs.com 側の設定を明記（§5.11） |
| TypeScript 6 が 1 世代前になる | 将来的な移行コスト | TS6 は TS7 への橋渡しとして設計された安定版。`tsdown` は Oxc ベースで型検査に tsc を使わないため、ビルドは TS のバージョンに縛られない |
| Voids API の恒久停止 | `makeitaquote/api` が無価値化 | 本体（ローカル生成）が主機能なので致命傷にならない。これが v9 の最大の狙い |
| 両エンドポイントの画像デザイン差 | 移行時に見た目が変わる可能性 | フェーズ 3 で実出力を比較し、差があれば README に注記（§2.1） |

---

## 14. v9.1 追加機能（縦長 / 反転 / 太字）

初版実装後、実利用のスクリーンショットをもとに追加した。

### 14.1 レイアウトの抽象化

`Theme.layout: 'side' | 'stacked'` を導入し、レイアウト計算を `src/render/layout.ts` に集約した。

|                | `side`                        | `stacked`                |
| -------------- | ----------------------------- | ------------------------ |
| アバター       | 幅 `widthRatio`、左右どちらか | キャンバス全面           |
| グラデーション | 水平（右配置時は自動ミラー）  | 垂直（上→下）            |
| 引用符         | インライン                    | ブロック（大きく上部に） |
| 区切り線       | 無効                          | 有効                     |
| 既定サイズ     | 1280×720                      | 800×1000                 |

プリセットに `stacked` レイアウトの `dark`/`light` 版を追加（計 5 種）。 `stacked` は縦長専用ではなく、横長キャンバスにも適用できる。

### 14.2 `text.area: 'auto'` — 反転対応の要

反転（テキスト左・アバター右）を `avatar.position` の指定だけで成立させるため、 `text.area` の既定値を `'auto'` とし、レイアウトと `position` から導出するようにした。

```
side:    width = 1 - widthRatio - gap * 2
         x     = position === 'right' ? gap : widthRatio + gap
stacked: { x: 0.08, y: 0.56, width: 0.84, height: 0.18 }
```

既定値（`widthRatio 0.5`, `gap 0.04`）は従来ハードコードしていた値（`x 0.54` / `width 0.42`）と一致するため、既存テーマの見た目は変わらない。`widthRatio` を変えたときにテキストが追随するようになった、という副次効果もある。

`watermark.position` にも `'auto'` を追加し、これを既定とした。`side` ではアバターの反対側に置く。反転時にウォーターマークがアバターに埋もれる問題への対処。

### 14.3 太字 — 可変フォントの制約と合成太字

**`ctx.font` に weight を指定しても効かないことが実測で判明した。**

```
normal   40px Noto Sans JP        width=120.36
bold     bold 40px Noto Sans JP   width=120.36
900      900 40px Noto Sans JP    width=120.36
300      300 40px Noto Sans JP    width=120.36
```

原因は、`GlobalFonts` に登録した**可変フォント（`NotoSansJP[wght].ttf`）の既定インスタンス（wght=400）しか Skia に見えていない**こと。google/fonts に静的インスタンスは存在しない（404 を確認済み、§8.2）。つまり自動取得フォントを使う限り、weight 指定は常に無視される。

**対処: 合成太字（`src/render/textStyle.ts`）**

1. ファミリごとに 1 回だけ、`100px` と `bold 100px` の `measureText` を比較して「本物の bold face があるか」を検出し、結果をキャッシュする。
2. 本物があれば `ctx.font` の weight がそのまま効くので、何もしない。
3. なければ `strokeText` を fill と同色・`fontSize * 0.045 * heaviness` の線幅で重ねてから `fillText` し、グリフを太らせる。

数値 weight は `(weight - 500) / 400` で線幅にマッピングするため、600 と 900 で太さが変わる。利用者がシステムに本物の Bold を持つフォントを登録した場合は、そちらが優先される。

> `ctx.save()` / `ctx.restore()` が `strokeStyle` を復元しないことも実測で判明したため、 `fillText` では明示的に退避・復元している。

### 14.4 その他の変更

- `text.quotes` を廃止し、`quoteMark: { display, chars, size, color, weight, gap }` に統合。 `display: 'block'` が縦長レイアウトの大きな引用符にあたる。
- `divider: { enabled, widthRatio, thickness, color, gap }` を追加（引用文と署名の間の罫線）。
- すべてのテキスト要素に `weight` を追加。
- **テストが実際に Twemoji / Discord CDN へアクセスしていたのを修正**。`pipeline.test.ts` で `fetch` をスタブ化した。ネットワーク遅延で 5 秒タイムアウトする不安定なテストであり、§10.1 に書いた「テストはネットワークに触れない」方針にも反していた。

### 14.5 縦長レイアウトの制約（解消済み）

§13 に「グラデーションが水平固定なので縦長レイアウトが破綻する」と記録していたが、 `gradient.direction` の追加により解消した。

---

## 15. v9.2 追加機能（フォント / Misskey / 既定の変更）

### 15.1 フォント: Google Fonts CSS API 経由の名前解決

**§8.2 の「jsDelivr の可変フォント URL をハードコード」方式を廃止し、Google Fonts CSS API で毎回解決する方式に変更した。**

```
GET https://fonts.googleapis.com/css2?family=Dela+Gothic+One
→ @font-face { src: url(https://fonts.gstatic.com/s/delagothicone/v19/….ttf) }
```

得られた利点:

|  | 旧（jsDelivr 固定 URL） | 新（CSS API） |
| --- | --- | --- |
| Noto Sans JP のサイズ | 9.6 MB（可変フォント全ウェイト） | **2.94 MB**（静的 Regular） |
| バージョン | `@main` 固定、更新に追随しない | URL に `v56` 等が入り**常に最新** |
| 対応フォント | 2 種をハードコード | **Google Fonts 全ファミリ** |
| 太字 | 可変フォントの制約で不可（§14.3） | `weights: [400, 700]` で**本物の Bold** |

**ライセンス方針**: Google Fonts は SIL OFL / Apache 2.0 / UFL のみを配布しているため、 **「CSS API で解決できる = 自由ライセンス」**が成り立つ。有償・ライセンス不明のフォントは API が 400 を返すので、名前指定では取得できない。他の配布元へフォールバックする実装は意図的に**持たない**。利用者が自分でライセンスを得たフォントは `registerFromPath()` / `registerFromURL()` で明示的に読み込める。

指定された 19 種のうち **17 種が利用可能**、2 種が不可（実測）:

- `Jiyu no Tsubasa` — Google Fonts になし、ライセンス不明
- `Castor Titling` — Google Fonts になし
- `Dacing Script` は `Dancing Script` のタイポ（`SUGGESTIONS` で誘導）

`catalogue.ts` に既知の不可フォントと typo を持たせ、400 のときに「なぜ取れないか」「代わりに何をすべきか」を含むメッセージを出す。

**`online: false`**: `AutoFontOptions.online`（`enabled` も別名として維持）でネットワークアクセスを完全に無効化できる。ディスクキャッシュとシステムフォントのみを使う。

### 15.2 フォントスタックのバグ（実装中に発見・修正）

`text.font` が `'Dela Gothic One, Noto Sans JP, sans-serif'` のとき、 **先頭のフォントがダウンロードされない**バグがあった。

原因: `prepareFonts` が `resolveFamily(request) === null` で「解決可能か」を判定していたため、スタック後方の `Noto Sans JP` が既に登録済みだと「解決できた」と見なして早期 return していた。

修正: `ensureStack()` を追加し、**スタックを先頭から辿って最初に使えるものが見つかるまで** 取得を試みる。先頭が取れれば後続は取得しない（無駄なダウンロードを避ける）。

### 15.3 Misskey カスタム絵文字

`:name:` / `:name@host:` / `:name@.:` を `https://{host}/emoji/{name}.webp` に解決する。

**オプトイン必須**とした。`:name:` は通常テキストで頻出し、特に `12:30:45` の `:30:` が誤爆する。`MiQOptions.misskey` にインスタンスが設定されたときだけ解釈する。

加えて正規表現に `(?<![A-Za-z0-9_])` の後読みを入れ、ASCII 英数字直後のコロンを除外する。これで `12:30:45` や `http://` が弾かれ、`テキスト:emoji:`（日本語直後）は通る。

| 記法          | 解決先                                       |
| ------------- | -------------------------------------------- |
| `:name:`      | 設定されたインスタンス                       |
| `:name@host:` | `host`（`remote: false` で無効化可）         |
| `:name@.:`    | 設定されたインスタンス（Misskey の連合表記） |

### 15.4 既定の変更・機能削除

- **`quoteMark.display` の既定を `'inline'` → `'none'`**。引用符なしが標準。 `stacked` プリセットのみ `'block'`。
- **`avatar.shape`（`circle` / `rounded`）を削除**。不要との判断。 `clipToShape()` とその呼び出しも削除した。

### 15.5 visual-check の再編

105 ケースは多すぎて差分が読み取れなかったため、**71 ケース・11 グループ**に整理し、グループごとのフォルダに出力するようにした。

```
.visual/
├── 01-themes/      05-typography/   09-sizes/
├── 02-layout/      06-fonts/        10-formats/
├── 03-text/        07-quotes/       11-discord/
├── 04-emoji/       08-avatar/
└── index.html
```

選定基準は「同じグループ内の他ケースと**見た目が明確に違う**こと」。ほぼ同じ絵になるバリエーション（weight 300/600、避けたフォーマット差など）はユニットテスト側に任せて除外した。`06-fonts` はカタログ 17 種を自動展開する。

絵文字グループは `assets/discordemoji.json` と `assets/misskeycustomemoji.json` の **実データ**を使うため、3 種の絵文字が実際に CDN から取得できることを目視確認できる。

---

## 16. v9.3 追加機能（色 / サイズ / 字形 / 公開ギャラリー）

### 16.1 折り返しの実バグ修正

**取得に失敗した絵文字で最終行がキャンバス外にはみ出す**バグがあった。

原因: レイアウトは絵文字を `fontSize` の正方形として測るが、描画時は画像が無いと `onAssetError: 'text'` によりソース文字列にフォールバックする。 `<:nope:123456789012345678>` は 26 文字あり、正方形 1 個分とは幅が桁違いに違う。

対処: `resolveEmojiSegments()` を追加し、**レイアウト前に**取得失敗した絵文字をテキストセグメントへ変換する。これで測定と描画が同じ対象を見るようになり、さらに副次効果として、長すぎるフォールバック文字列が通常のテキストと同様に折り返せるようになった（絵文字トークンは分割不能なので、以前は測定を直してもはみ出したままだった）。

### 16.2 色システム

`src/theme/color.ts` を追加。全ての色フィールドが `ColorInput` を受ける。

| 記法       | 例                                                        |
| ---------- | --------------------------------------------------------- |
| 16進       | `#RGB` `#RGBA` `#RRGGBB` `#RRGGBBAA`                      |
| 数値       | `0xRRGGBB` `0xRRGGBBAA`                                   |
| 配列       | `[r, g, b]` `[r, g, b, a]`（alpha は 0–1 / 0–255 両対応） |
| キーワード | `'transparent'`                                           |
| CSS 関数   | `rgb()` `rgba()`（`50%` 形式の alpha も可）               |

**数値表記の原理的制約**: `0x00FF0000` は数値として `0xFF0000` と完全に同一であり、先頭ゼロバイトを持つ色は数値では表現できない。判定は大小で行い（`> 0xFFFFFF` なら alpha バイト付き）、`0xFF0000` は「不透明な赤」と解釈する。長さが値の一部となる文字列表記を使えば曖昧さはない。この制約は型の doc とテストに明記した。

**`custom` プリセット**: 背景・本文・署名・ウォーターマークをすべて `transparent` にしたテーマ。完全透明の要素は**描画自体をスキップ**するので、`extends: 'custom'` の上に置いた色だけが画像に現れる。背景を指定しなければ透過 PNG が得られる。

### 16.3 サイズ

- **既定サイズを長辺 800 に**（横長 1422×800 / 縦長 800×1000）。
- **`setScale(factor)` を追加**。テーマ内の寸法はすべてキャンバスに対する比率なので、これは真のズームになる（レイアウトは一切変わらず解像度だけ変わる）。上限 8。
- **`setSize()` を非推奨化**。アスペクト比だけを変えて他を動かさないため、アバター・グラデーション・テキストの比率が崩れる。discord.js に倣い `process.emitWarning(..., { type: 'DeprecationWarning', code })` で 1 回だけ警告する（`--no-deprecation` で抑制でき、`console.warn` と違い標準的な制御が効く）。形状を変えたい場合は `setTheme({ width, height })` が正しい入口。
- **`sizeToAvatar: 'width' | 'height'`** を追加。アバターが原寸で描かれるようにキャンバス全体を 1 つの係数でスケールする。アスペクト比は保たれるので歪まない。
- `avatar.fit: 'cover' | 'contain'` を追加。

### 16.4 TOFU 対策（字形フォールバック）

ラテン専用フォントを指定すると日本語が豆腐になる問題。

**最初の実装は誤りだった。** 「プライマリが当該字形を持つか」を `measureText` の幅比較で判定しようとしたが、**字形を持たないフォントの実測幅は tofu と一致しない** （Vina Sans で `猫` を測ると monospace とは違う値が返り、実際には無関係な字形が描かれる）。プローブは常に「カバーしている」と誤答した。

実測で分かった正しい事実:

```
Vina Sans                  猫=81.0   A=41.0
Vina Sans, Noto Sans JP    猫=100.0  A=41.0   ← Noto の幅 / Vina の幅
Noto Sans JP               猫=100.0  A=57.4
```

**Skia はフォントスタックを字形単位で解決する。** つまりスタックを宣言するだけで正しく動く。判定は不要かつ有害だったので撤廃し、`needsGlyphFallback(text)` が非ラテン文字の存在だけを見て、フォールバックを**無条件に連結**する方式にした。不要なときのコストはゼロで、必要なときは確実に効く。

### 16.5 Discord / Misskey の入力オプション

- `setFromMessage(message, { avatar, name })`。既定は両方サーバー側（`'guild'` / `'nickname'`）で、その方が「そのサーバーの読み手が見たもの」に一致する。 `'global'` でアカウント側に切り替わる。どちらを選んでも他方がフォールバックになる。
- discord.js の `member.displayName` は「ニックネーム、無ければグローバル名」なので、ニックネーム判定では `member.nickname` を先に見る（そうしないと `'global'` 指定時にグローバル名が自分自身に隠される）。
- `misskey` が文字列・**配列**・オプションオブジェクトを受ける。複数インスタンス指定時、素の `:name:` はどれに属するか分からないため、セグメントに `alternativeUrls` を持たせ、ローダーが順に試して最初に成功したものを使う。

### 16.6 既定フォントの変更

既定を **M PLUS Rounded 1c**、その背後に **Noto Sans JP** とした。前者はこの用途に合う丸ゴシックでラテンもカバーし、後者はカバレッジが広いので取りこぼしの受け皿になる。§16.4 の通りスタックは字形単位で解決されるため、この 2 段構えは実際に機能する。

### 16.7 公開ギャラリー

`.visual/`（gitignore）を **`docs/visual/`（コミット対象）** に移し、 `DESIGN.md` はリポジトリルートへ移動した。

- `scripts/visual-check.js` は画像と `manifest.json`（ファイル名リストとメタ情報）を出力する
- `docs/` は素の HTML / CSS / JS 1 ファイルの静的サイトで、manifest を読んで一覧を組む。ビルド不要で、描画側に触れずに見せ方だけ変更できる
- GitHub Pages のソースは **`main` ブランチの `/docs`**。Actions でのデプロイは採らなかった: `docs/` を Pages 対象にするという要件にはブランチ配信が素直に対応し、 `environment` / `pages: write` / OIDC が一切不要になる
- リリースワークフローは**独立したジョブ**でギャラリーを再生成し `main` にコミットする。フォント・絵文字 CDN を使うため、その不調が publish を止めないよう release の後段に置いた

**画像サイズ**: 全 77 ケースをフル解像度 PNG で出すと 19MB になり、コミットする成果物として過大だった。**検証はフル解像度の生バイトに対して行い**、書き出す方だけ長辺 900px の WebP に縮小している（1.9MB）。検証の厳密さは落とさずリポジトリだけ軽くなる。

**文言**: 公開物なので、切り取られて単体で目にされても問題ない文章のみを使う。パブリックドメイン（夏目漱石『吾輩は猫である』）とライブラリ自体についての中立的な記述で、実在の人物の発言と読めるものは置かない。

---

## 17. 実装で判明した設計との差分

実装（2026-07-31 完了）で、設計時の想定と実際が食い違った点。いずれも実装側を正とし、本書を追随させてある。

| # | 設計時の想定 | 実際 | 対応 |
| --- | --- | --- | --- |
| 1 | tsdown は `deps: { external, noExternal }` | 0.22.14 は **`neverBundle` / `alwaysBundle`**。旧名は型エラー | §5.6 を改名後の名前に修正 |
| 2 | BudouX にタイ語モデル `thModel` がある | export されているのは `jaModel` / `zhHansModel` / `zhHantModel` のみ（タイ語は `loadDefaultThaiParser` 経由） | `PhraseLocale` から `'th'` を削除 |
| 3 | ky の `HTTPError` から `response.clone().text()` でボディを読める | ky v2 は `HTTPError` 生成時にボディを消費済み。しかも **error に付く response はフックが見たものと別インスタンス**なので WeakMap でも追えない | `afterResponse` フックをリクエスト単位で渡し、クロージャに退避する `captureErrorBody()` を実装（§6.4 の実装詳細） |
| 4 | ky v2 のフック引数は `(request, options, response)` | **単一オブジェクト** `{ request, options, response, retryCount }` | 実装で対応 |
| 5 | `throwHttpErrors: false` にすればボディを読めてリトライも効く | ky v2 では **リトライも無効化される**（実測：試行 1 回のみ） | 採らず、#3 の方式に |
| 6 | `GlobalFonts.registerFromPath` は boolean を返す | `FontKey \| null` を返す | `Boolean()` で正規化 |
| 7 | `Canvas#encode` は全形式で `(format, quality)` | **AVIF のみ `(format, AvifConfig)`** | `encode.ts` で分岐 |
| 8 | 2 エントリなら独立したバンドルになる | tsdown が共有チャンク（`dist/source-*.{cjs,mjs}`）を生成する | 実測で canvas / budoux は含まれず tree shaking が効いていた。`check-build.js` を「エントリから到達可能な全チャンクを辿る」＋「実際に require して `require.cache` を見る」検査に強化（§5.8） |
| 9 | グラデーション既定は `startRatio 0.30 / endRatio 0.62` | アバター右端（`0.5W`）でのアルファが 0.88 程度にしかならず、**タイル境界が縦線として見える**（特に light） | 既定を `0.22 / 0.5` に変更し、アバター右端でちょうどアルファ 1 に到達させた |
| 10 | フォールバックアバターのイニシャルは短辺の 0.4 | 実出力で巨大すぎた | 0.22 に変更 |
| 11 | `fonts.ensureDefaults()` / `registerFromURL()` を registry に置く | registry ↔ autoload が循環する | `src/font/index.ts` で合成して公開（§8.3 の API 形状は設計どおり） |
| 12 | `test/{unit,integration}/` に配置 | ベーステンプレート準拠で `src/**/*.test.ts` に併置 | §4.3 のとおり実装 |

**設計どおりに機能したことの確認**

- `makeitaquote/api` を `require()` しても `node_modules` から何もロードされない（`ky` はバンドル済み、canvas は到達不能）。`check-build.js` の 46 検査で担保。
- フォント自動取得が実際に動作し、**設定ゼロで日本語が描画できる**ことを実出力で確認。
- BudouX による文節改行と禁則処理が実出力で機能（`。` が行頭に来ない、文節境界で折れる）。
- 全 174 テスト・型検査・Biome・ビルド検査がグリーン。

---

## 18. 補足: 参考にした一次情報

すべて 2026-07-31 時点で確認。

- 現行 `index.js` の `generate` / `generateBeta` 実装（エンドポイントの機能差、§2.1）
- `examples/miq-with-discordjs.md` / `examples/beta-with-discordjs.md`（URL 返信 vs 添付という使い分けの裏づけ）
- [`oto-lab/npm-biome-ts`](https://github.com/oto-lab/npm-biome-ts) の全構成ファイル（`package.json` / `biome.json` / `tsconfig.json` / `tsdown.config.ts` / `vitest.config.ts` / `.gitattributes` / `.gitignore` / `.github/workflows/{ci,release}.yml` / `scripts/setup.js`）
- `@napi-rs/canvas@1.0.3` の `optionalDependencies`（プリビルド対象プラットフォーム）
- `node-canvas-with-twemoji-and-discord-emoji@1.2.2` の `src/drawTextWithTwemoji.js` / `src/utils/splitEntitiesFromText.js` / `src/utils/loadTwemojiImageByUrl.js`（セグメント化・絵文字配置・キャッシュのアルゴリズム、`canvas` への直接依存、`maxWidth` の実装）
- `@miq4d/canvas-with-discord-content@2.1.2` の `package.json`（依存バージョン）
- `kuromoji@0.1.2` / `kuroshiro@1.2.0` の `time.modified` と `dist.unpackedSize`（41.3 MB、2022 年で更新停止）
- `budoux@0.8.4` の README と `dist.unpackedSize`（`Parser` + `jaModel` の同期 API）
- `ky@2.0.2` の `type` / `exports`（ESM-only）
- `typescript` の `dist-tags`（`latest: 7.0.2`、6 系の最新は `6.0.3`）
- `tsdown@0.22.14` / `vitest@4.1.10` / `@biomejs/biome@2.5.6` の最新版
- jsDelivr 上の Noto フォントの実在・サイズ確認（`curl -I`：NotoSansJP 9,589,900 bytes / NotoSans 2,049,096 bytes、static 版は 404）
- [Brooooooklyn/canvas#1006](https://github.com/Brooooooklyn/canvas/issues/1006)（`GlobalFonts.register` の Buffer 参照問題）
- [tsdown: Migrate from tsup](https://tsdown.dev/guide/migrate-from-tsup)（設定項目の対応。ただし実際の `DepsConfig` は §14-1 のとおり改名されている）
- `tsdown@0.22.14` の `dist/types-*.d.mts` にある `DepsConfig`（`neverBundle` / `alwaysBundle`）
- `ky@2.0.2` のフック引数とエラー時のレスポンス消費挙動（実測、§14-3〜5）
