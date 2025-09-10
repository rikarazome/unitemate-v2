# Unitemate V2 - システム設計仕様書

## 重要な注意事項

### AWS Lambda デプロイメントの注意点

#### Python依存関係の管理
- **JWTライブラリ**: `python-jose[cryptography]` を使用（PyJWTではなく）
  - AWS Lambda環境との互換性が高い
  - cryptography 39.x系で安定動作
- **requirements.txt生成**: `uv pip compile pyproject.toml -o requirements.txt`
  - **重要**: `--no-deps`フラグは使用しない（依存関係が壊れる）
- **serverless.yml設定**:
  ```yaml
  pythonRequirements:
    dockerizePip: true  # 必須：Lambda用バイナリを正しくビルド
    # pipCmdExtraArgs は設定しない
  ```

#### デプロイ時の注意
- Dockerデスクトップの起動が必要（`dockerizePip: true`のため）
- Windows環境でビルドされたバイナリはLambda（Linux）で動作しない
- すべてのLambda関数が同じrequirements.txtを共有するため、一部の変更が全体に影響

#### トラブルシューティング
- cryptographyのインポートエラーが発生した場合：
  1. dockerizePip: trueが設定されているか確認
  2. Dockerが起動しているか確認
  3. requirements.txtに余計なオプションがないか確認

## マスターデータ管理設計

### データソース仕様
**⚠️ マスターデータは以下の設計に従い、適切なデータソースから管理する**

#### ポケモンデータ
- **データソース**: `./pokemon.csv`
- **管理方法**: CSV→JSON変換してフロントエンド側で管理
- **フィールド**: `display`, `jp_name`, `index_number`, `type`, `icon` など
- **注意**: DynamoDBのマスターデータテーブルには格納**しない**

#### 勲章（バッジ）データ  
- **データソース**: `./achievements.csv`
- **管理方法**: CSV→JSON変換後、DynamoDBマスターデータテーブルで管理
- **フィールド**: `condition`, `display`, `start_color`, `end_color`, `char_color`, `image_card`, `banner_image`
- **DynamoDBキー構造**: `data_type: "BADGE"`, `id: [badge_id]`

#### 設定データ
- **管理方法**: DynamoDBマスターデータテーブルで管理
- **有効な設定ID**:
  - `lobby_create_timeout`: ロビー作成制限時間（秒）
  - `lobby_join_timeout`: ロビー入室制限時間（秒）  
  - `rules_content`: ルール内容
  - `announcement_content`: お知らせ内容
- **DynamoDBキー構造**: `data_type: "SETTING"`, `id: [setting_id]`

#### ロール・シーズンデータ
- **管理方法**: システムで管理**しない**
- **注意**: ロール情報やシーズン情報は現在のシステム設計に含まれない

### アチーブメント（勲章）追加手順

#### 1. データ追加
1. `achievements.csv`に新しい勲章データを追加
   - 各カラム（`condition`, `display`, `start_color`, `end_color`, `char_color`, `image_card`, `banner_image`）を適切に設定
   - `display`が空の行は無視されるため、必ず値を設定

#### 2. マスターデータ更新

**自動化スクリプト使用（推奨）:**

マスターデータのみ更新（METAデータは変更しない）:
```bash
cd backend
python scripts/add_achievements.py --stage dev --prod --master-only
```

全データ初期化（METAデータも初期化）:
```bash
cd backend
python scripts/add_achievements.py --stage dev --prod
```

**手動実行の場合:**

マスターデータのみ更新:
```bash
# 1. achievements.csvからmaster-data-seed.jsonを生成
cd backend/scripts
python convert_achievements.py

# 2. マスターデータのみ更新（dev環境）
cd backend
python scripts/update_master_data.py --stage dev

# 3. 本番環境への反映（必要に応じて）
python scripts/update_master_data.py --stage prd
```

全データ初期化:
```bash
# 1. achievements.csvからmaster-data-seed.jsonを生成
cd backend/scripts
python convert_achievements.py

# 2. マスターデータを更新（dev環境）
cd backend
python scripts/initialize_data.py --stage dev

# 3. 本番環境への反映（必要に応じて）
python scripts/initialize_data.py --stage prd
```

#### 3. 確認事項
- マスターデータテーブルのBADGE項目数が正しく増加していることを確認
- フロントエンドでバッジが正常に表示されることを確認
- バッジ取得条件のロジックが実装されていることを確認（必要に応じて）

#### 4. 注意点
- 既存のバッジIDは変更しない（`badge_001`, `badge_002`...の連番形式）
- 削除したい場合は`is_active: false`を設定（物理削除は避ける）
- カラーコードは有効なHTML色形式（`#RRGGBB`）で設定

### マスターデータテーブル構造
```
Table: unitemate-v2-master-data-{stage}
Partition Key: data_type (String)
Sort Key: id (String)

有効なdata_type:
- "BADGE": 勲章データ
- "SETTING": システム設定
```

## 【重要】命名規則統一リスト

### データ構造の統一命名規則
**⚠️ アプリ全体で以下の命名を統一すること（フロントエンド・バックエンド・DB・型定義・API全て）**

#### チーム関連
- ✅ **使用**: `team_a`, `team_b` (snake_case)
- ❌ **禁止**: `team_A`, `team_B`, `teamA`, `teamB`

#### ボイスチャンネル関連
- ✅ **使用**: `vc_a`, `vc_b` (snake_case)
- ❌ **禁止**: `vc_A`, `vc_B`

#### ユーザー統計関連
- ✅ **使用**: `match_count` (試合数)
- ❌ **禁止**: `unitemate_num_record`, `num_record`
- ✅ **使用**: `win_count` (勝利数)
- ❌ **禁止**: `unitemate_num_win`, `num_win`, `wins`
- ✅ **使用**: `win_rate` (勝率)
- ❌ **禁止**: `unitemate_winrate`, `winrate`
- ✅ **使用**: `max_rate` (最高レート)
- ❌ **禁止**: `unitemate_max_rate`, `best_rate`
- ✅ **使用**: `last_rate_delta` (前回レート変動)
- ❌ **禁止**: `unitemate_last_rate_delta`
- ✅ **使用**: `last_match_id` (最終試合ID)
- ❌ **禁止**: `unitemate_last_match_id`

#### ID関連
- ✅ **使用**: `user_id` (snake_case)
- ❌ **禁止**: `userId` (camelCase)
- ✅ **使用**: `match_id` (snake_case)
- ❌ **禁止**: `matchId` (camelCase)

### 進行状況チェックリスト
- [x] backend/src/handlers/ 配下全ファイル ✅ 完了
- [x] backend/src/models/ 配下全ファイル ✅ 完了（元々問題なし）
- [x] backend/src/services/ 配下全ファイル ✅ 完了（元々問題なし）
- [x] backend/src/repositories/ 配下全ファイル ✅ 完了（元々問題なし）
- [x] frontend/src/components/ 配下全ファイル ✅ 完了
- [x] frontend/src/hooks/ 配下全ファイル ✅ 完了
- [x] frontend/src/types/ 配下全ファイル ✅ 完了
- [x] backend/tests/ 配下全ファイル ✅ 完了
- [ ] マイグレーションスクリプト 🔄 要確認

## 【重要】試合結果報告の設計（Legacy準拠）

### 結果報告フロー
**フロントエンドが責任を持つ処理:**
1. 現在の試合情報から自分がどちらのチーム（A/B）に所属しているか判定
2. 試合結果を以下の形式で送信：
   - 自分のチームが勝利: `"A-win"` または `"B-win"`
   - 相手チームが勝利: `"B-win"` または `"A-win"` 
   - 無効試合: `"invalid"`

**バックエンドの処理:**
1. 各プレイヤーからの報告（`"A-win"`, `"B-win"`, `"invalid"`）を単純集計
2. 多数決で最終結果を決定
3. レート計算と統計更新

### 報告データ形式
```json
{
  "result": "A-win",  // "A-win", "B-win", "invalid" のいずれか
  "banned_pokemon": "pikachu",     // ポケモンIDは display の小文字
  "picked_pokemon": "absol",       // ポケモンIDは display の小文字
  "pokemon_move1": "サイコカッター",  // そのポケモンの 1_a または 1_b から選択
  "pokemon_move2": "つじぎり",       // そのポケモンの 2_a または 2_b から選択
  "violation_report": "player_id_1,player_id_2"  // 通報対象（カンマ区切り）
}
```

**重要:** 
- フロントエンドは必ず自分のチームを判定してから、チームベースの結果（A-win/B-win）を送信すること
- `"win"`や`"lose"`という相対的な結果は送信しない
- ポケモンIDは必ず display フィールドの小文字を使用（例: "pikachu", "absol", "garchomp"）
- わざはそのポケモンのデータから選択（1_a/1_b からわざ1を、2_a/2_b からわざ2を選択）

## 【重要】ステータス値の統一規則

**マッチのステータスは以下の値のみを使用する（Legacyとの互換性のため）:**
- `matched`: 進行中のマッチ
- `done`: 完了したマッチ

**使用禁止のステータス値:**
- `in_progress`, `finished`, `waiting`, `cancelled`, `completed` などは使用しない
- フロントエンド・バックエンド・DB・ドキュメント全てで`matched`/`done`に統一

## アプリケーション概要

- **Unitemate**: ポケモンユナイトの非公式レーティングツール
- ゲーム本体の外部ツールとして動作
- プレイヤーのマッチングとレート管理を支援
- ゲーム内機能を直接操作することはできない

## 目次
1. [システムアーキテクチャ](#システムアーキテクチャ)
2. [データ構造・型システム](#データ構造型システム)
3. [勲章（バッジ）システム](#勲章バッジシステム)
4. [マッチメイキングシステム](#マッチメイキングシステム)
5. [API設計](#api設計)
6. [DynamoDBテーブル構成](#dynamodbテーブル構成)
7. [UI/UXデザインパターン](#uiuxデザインパターン)
8. [認証・セキュリティ](#認証セキュリティ)
9. [リアルタイム機能](#リアルタイム機能)
10. [エラーハンドリング](#エラーハンドリング)
11. [パフォーマンス最適化](#パフォーマンス最適化)
12. [環境設定・デプロイメント](#環境設定デプロイメント)

## システムアーキテクチャ

### 全体構成
- **フロントエンド**: React 19 + TypeScript + Vite
- **バックエンド**: Serverless Framework + AWS Lambda (Python 3.12)
- **データベース**: Amazon DynamoDB
- **認証**: Auth0 (JWT)
- **リアルタイム通信**: WebSocket (API Gateway)

### フロントエンドコンポーネント階層
```
App.tsx
├── Layout.tsx
│   └── UnitemateApp.tsx
│       ├── MatchScreen.tsx
│       │   ├── NamePlate.tsx
│       │   ├── RoleSelector.tsx
│       │   └── PokemonSelector.tsx
│       ├── RankingScreen.tsx
│       └── ProfileEditModal.tsx
│           ├── BadgeSelector.tsx
│           └── UserCreationForm.tsx
└── PlayerInfoModal.tsx
    ├── SeasonDataModal.tsx
    └── PokemonPoolModal.tsx
```

### レスポンシブデザイン戦略
- **Mobile-first アプローチ**
- **ブレークポイント**: sm(640px), md(768px), lg(1024px)
- **フレキシブル幅**: `min-w-[120px] max-w-[300px]`
- **動的フォントサイズ**: `text-[10px] sm:text-xs md:text-sm`
- **モバイル対応**: `max-[500px]:` ブレークポイントで全画面表示

## データ構造・型システム

### コア型定義

#### ユーザーシステム
```typescript
interface User {
  user_id: string;                    // Discord ID
  auth0_sub: string;                  // Auth0識別子
  discord_username: string;
  discord_discriminator?: string;     // 旧Discord形式
  discord_avatar_url?: string;
  trainer_name: string;               // トレーナー名（アプリ内表示名）
  twitter_id?: string;                // Twitter ID (@付き)
  preferred_roles?: string[];         // 希望ロール
  favorite_pokemon?: Record<string, string[]>; // ロール別好きなポケモン (各ロール最大4体)
  current_badge?: string;             // 装着勲章1
  current_badge_2?: string;           // 装着勲章2
  owned_badges: string[];             // 所持勲章リスト
  bio?: string;                       // 自己紹介
  rate: number;                       // 現在レート
  unitemate_max_rate: number;         // 最高レート
  win_count: number;                  // 勝利数
  unitemate_winrate: number;          // 勝率
  past_seasons: SeasonRecord[];       // 過去シーズンデータ
  created_at: number;                 // 作成日時
  updated_at: number;                 // 更新日時
}

interface SeasonRecord {
  season_period: string;              // シーズン期間 (例: "2024-01-01 to 2024-03-31")
  total_matches: number;              // 試合数
  win_count: number;                  // 勝利数
  final_rate: number;                 // 最終レート
  final_rank?: number;                // 最終順位
}
```

#### マッチシステム
```typescript
interface MatchPlayer {
  user_id: string;
  trainer_name: string;
  discord_username?: string;
  discord_avatar_url?: string;
  twitter_id?: string;
  rate: number;
  max_rate: number;
  current_badge?: string;
  current_badge_2?: string;
  role?: string;                      // TOP_LANE, MIDDLE, BOTTOM_LANE, SUPPORT, TANK
  pokemon?: string;                   // 使用ポケモン
}

interface Match {
  match_id: string;
  team_a: {
    team_id: string;
    team_name: string;
    is_first_attack: boolean;
    voice_channel: string;            // VC番号
    players: MatchPlayer[];
  };
  team_b: {
    team_id: string;
    team_name: string;
    is_first_attack: boolean;
    voice_channel: string;            // VC番号
    players: MatchPlayer[];
  };
  status: 'matched' | 'done';
  started_at?: number;
  completed_at?: number;
  lobby_id?: string;                  // ユナイト内ロビーID
  host_user_id?: string;              // ホストユーザー
  winner_team?: 'A' | 'B';           // 勝利チーム
  user_reports: string[];             // 結果報告済みユーザー
}
```

#### キューシステム

##### キューエントリー（個別ユーザー）
```typescript
interface QueueEntry {
  namespace: string;                  // "default" (Legacy互換)
  user_id: string;                    // Discord ID
  selected_roles: string[];           // 選択ロール（最低2つ以上）
  blocking: string[];                 // ブロックリスト
  inqueued_at: number;                // キュー参加時刻（Unix timestamp）
}
```

##### キューメタデータ（#META#エントリー）
```typescript
interface QueueMeta {
  namespace: string;                  // "default"
  user_id: "#META#";                 // 特別なキー
  role_queues: {
    TOP_LANE: string[];              // このロールを選択したユーザーIDリスト
    MIDDLE: string[];
    BOTTOM_LANE: string[];
    SUPPORT: string[];
    TANK: string[];
  };
  total_waiting: number;              // 総待機人数（ユニークユーザー数）
  lock: 0 | 1;                       // マッチメイキングロック
  ongoing_matches: number;            // 進行中マッチ数
  latest_match_id?: number;          // 最後に作成されたマッチID
  // ongoing_match_players?: string[]; // マッチング済みプレイヤー（必要性要検討）
}
```

**設計方針:**
- メタデータにはユーザーIDとロール情報のみを保持（レート情報は保存しない）
- join_queue時: ユーザーをロール別リストに追加、総人数をインクリメント
- leave_queue時: ユーザーをロール別リストから削除、総人数をデクリメント
- マッチメイキング時のみ各ユーザーの最新レートをUsersテーブルから取得
- これによりメタデータの更新が軽量化され、レートの整合性も保証される

#### レコードシステム
```typescript
interface Record {
  record_id: string;                  // match_id + user_id
  user_id: string;
  match_id: string;
  pokemon?: string;                   // 使用ポケモン
  team: 'A' | 'B';                   // 所属チーム
  is_winner: boolean;                 // 勝利フラグ
  rate_before: number;                // 試合前レート
  rate_after: number;                 // 試合後レート
  rate_delta: number;                 // レート変動
  started_date: number;               // 試合開始日時
  completed_date: number;             // 試合完了日時
  team_a_players: string[];           // チームAメンバー
  team_b_players: string[];           // チームBメンバー
  created_at: number;                 // レコード作成日時
}
```

### バッジシステム
```typescript
interface Badge {
  id: string;                         // badge_001, badge_002...
  condition: string;                  // 取得条件説明
  display: string;                    // 表示名
  start_color: string | null;         // グラデーション開始色
  end_color: string | null;           // グラデーション終了色
  char_color: string | null;          // 文字色
  image_card: string | null;          // カード画像URL
  banner_image: string | null;        // バナー画像URL
  type: 'gradient' | 'image' | 'text_color' | 'basic';
}
```

### バリデーション型
```typescript
// フォームバリデーション
type ValidationErrors = Record<string, string>;

interface FormValidation {
  isValid: boolean;
  errors: ValidationErrors;
}

// ロール別好きなポケモン（各ロール最大4体、ロール間での被りOK）
interface FavoritePokemon {
  TOP_LANE?: string[];     // 最大4体
  MIDDLE?: string[];       // 最大4体  
  BOTTOM_LANE?: string[];  // 最大4体
  SUPPORT?: string[];      // 最大4体
  TANK?: string[];         // 最大4体
}

// API リクエスト・レスポンス
interface ApiResponse<T = any> {
  statusCode: number;
  body: {
    data?: T;
    error?: string;
    message?: string;
  };
}
```

## 勲章（バッジ）システム

### 概要
勲章システムは、ユーザーの実績や購入によって取得できる装飾アイテムです。
ネームプレートの見た目を変更することができ、最大2つまで装着可能です。

### データ構造

#### 1. マスターデータ（バックエンド: DynamoDB MasterDataテーブル）
```typescript
interface BadgeMasterData {
  data_type: "BADGE";           // 固定値
  id: string;                   // badge_XXX形式
  condition: string;            // 取得条件の説明
  display: string;              // 表示名
  is_purchasable: boolean;      // 購入可能かどうか
  price: number | null;         // 購入価格（購入可能な場合のみ）
  is_active: boolean;          // 有効/無効フラグ
  category: string;            // カテゴリ（season/purchase/special/event）
  created_at: string;          // 作成日時
  updated_at: string;          // 更新日時
}
```

#### 2. 見た目データ（フロントエンド: badges.json）
```typescript
interface BadgeDesign {
  id: string;                  // マスターデータと紐付けるID
  start_color: string | null;  // グラデーション開始色
  end_color: string | null;    // グラデーション終了色
  char_color: string | null;   // 文字色（画像背景時に使用）
  image_card: string | null;   // カード画像URL
  banner_image: string | null; // ランキング用横長画像URL
  type: 'gradient' | 'image' | 'text_color' | 'basic'; // 勲章タイプ
}
```

#### 3. ユーザー所持情報（バックエンド: DynamoDB Usersテーブル）
- **勲章所持情報**: `Users.owned_badges` フィールド（勲章IDのリスト）
- **装着勲章**: `Users.current_badge`, `Users.current_badge_2` フィールド

### API設計

#### 勲章マスターデータ取得
```
GET /api/badges
Response: {
  badges: [
    {
      id: "badge_001",
      condition: "シーズン1最終一位", 
      display: "[S1]1st",
      is_purchasable: false,
      is_active: true,
      category: "season"
    }
  ]
}
```

#### ユーザー所持勲章更新（管理者/システム用）
```
POST /api/users/{userId}/badges
Body: {
  badge_ids: ["badge_001", "badge_012"],
  action: "add" | "remove"
}
```

#### 装着勲章更新
```
PUT /api/users/me/badges/equip
Body: {
  primary_badge: "badge_017",
  secondary_badge: "badge_001"
}
```

### デザイン適用ルール

#### 優先順位
- image_card > グラデーション > 単色
- 1つ目の勲章のimage_cardが最優先

#### グラデーション適用
- **1つ目の勲章**: `start_color` が適用される
- **2つ目の勲章**: `end_color` が適用される
- **2つ目が未設定の場合**: 1つ目の`end_color`を使用
- **画像勲章**: `image_card` がある場合はグラデーションを上書き

#### 文字色
- **画像背景時**: `char_color` または白
- **それ以外**: 白
- **デフォルト**: 透明背景、黒文字

#### ランキング表示
- 横長レイアウト時は`banner_image`を優先使用

### 適用箇所
- プロフィールタブのネームプレート
- プロフィール編集画面のプレビューネームプレート
- マッチング画面のネームプレート
- 対戦画面のネームプレート
- ランキング行の背景デザイン（NamePlateコンポーネントは使わない）

### 勲章所持・装着のバリデーション
- 装着時に所持確認を実施
- 同じ勲章を2つの枠に装着することは禁止
- フロントエンドでは所持している勲章のみ選択可能

### 実装フェーズ

#### フェーズ1（現在）
1. ✅ 見た目データ（badges.json）の作成
2. ✅ Usersテーブルにowned_badgesフィールド追加
3. ✅ NamePlateコンポーネントの勲章装飾対応
4. ⏳ マスターデータのDB登録
5. ⏳ 勲章取得APIの実装
6. ⏳ フロントエンドで所持勲章のみ選択可能にする

#### フェーズ2（将来）
1. 勲章購入機能の実装
2. 勲章取得条件の自動判定
3. 勲章カテゴリ別表示
4. 勲章コレクション画面

### 注意事項
- 勲章IDは一度決めたら変更しない（badge_XXX形式）
- 見た目データの変更はフロントエンドのみで完結
- 所持情報の変更は必ずバックエンドAPIを通す
- 同じ勲章を1つ目と2つ目に同時装着不可

#### システム設定マスターデータ
マスターデータ（MasterDataTable）で以下の設定を管理：

```typescript
interface SettingMasterData {
  data_type: "SETTING";
  id: string;                    // 設定キー
  name: string;                  // 設定名（日本語）
  description: string;           // 設定の説明
  value: number | string;        // 設定値
  is_active: boolean;           // 有効フラグ
  created_at: string;           // 作成日時
  updated_at: string;           // 更新日時
}
```

**設定項目:**
- `lobby_create_timeout`: ロビー作成制限時間（秒）デフォルト: 150
- `lobby_join_timeout`: ロビー入室制限時間（秒）デフォルト: 250
- `rules_content`: ルールタブの表示内容（Markdown形式）
- `announcement_content`: お知らせタブの表示内容（Markdown形式）

## 管理者システム

### アクセス制御
- **管理者ユーザー**: `rikarazome` (user_id: 889328415285600378)
- **アクセスURL**: `/admin_control`
- **認証方式**: ログイン状態 + `isAdmin` フィールドによる権限検証
- **未認証時の動作**: トップドメイン（`/`）にリダイレクト
- **画面表示**: 管理者以外には何も表示されない

### 管理者権限の実装
- **データベース**: Userテーブルに `isAdmin` フィールド（boolean）を追加
- **デフォルト値**: false（一般ユーザー）
- **管理者設定**: rikarazome ユーザーの isAdmin を true に設定
- **権限チェック**: 
  - フロントエンド: User データの isAdmin フィールドで判定
  - バックエンド: API リクエスト時に isAdmin を検証

### 管理機能
- 手動マッチメイキング実行
- 対戦画面の確認・操作
- ダミーユーザーログイン機能
- ユーザー管理機能
- システム設定変更
- デバッグ情報表示
- ランキング手動計算
- テスト用一括操作機能

### セキュリティ要件
- フロントエンド: isAdmin フィールドによるUI制御（表示のみ）
- バックエンド: 管理者限定API のリクエスト時に isAdmin 検証必須
- 管理者でない場合は403 Forbiddenを返却
- isAdmin フィールドはユーザー自身では変更不可
- **ダミーAuth制限**: 管理者権限判定にダミーAuthは使用禁止（セキュリティリスク回避）

### ダミーAuth システム

#### 概要
テスト用ダミーアカウントでのログイン機能。Discord認証をバイパスして、テストユーザーとしてログインできる。

#### ダミーユーザー識別
- **識別方法**: user_idが`dummy_user_`で始まるユーザーをダミーユーザーとして扱う
- **例**: `dummy_user_1`, `dummy_user_2`, ... `dummy_user_10`
- **is_dummyフラグは使用しない**（user_idパターンで判定）

#### ログイン認証
- **エンドポイント**: `POST /api/auth/dummy/login`
- **パスワード形式**: `test_password_{番号}` （例: dummy_user_1のパスワードは`test_password_1`）
- **トークン形式**: `dummy|discord|{user_id}`

#### 制限事項
- **用途**: 対戦画面操作のデバッグ専用
- **適用範囲**: 対戦画面、マッチング動作の確認のみ
- **禁止事項**: 
  - 管理者権限の付与・判定に使用禁止
  - 重要なシステム操作への適用禁止
  - 本番環境での使用禁止
- **セキュリティ**: 簡易的なトークン生成のため、セキュリティが脆弱

### ダミーAuth トークン処理の注意事項
**問題**: ダミーユーザーがプロフィール編集で404エラーになる問題が過去に複数回発生

**根本原因**:
1. ダミーtoken format: `"dummy|discord|dummy_user_X"` 
2. 通常のAuth0 token lookup: `get_user_by_auth0_sub()` で検索
3. データベースの不整合: legacy `app_username` vs 新 `trainer_name` field

**解決パターン**:
1. **Token識別**: `auth0_user_id.startswith("dummy|discord|")` でダミーユーザー検出
2. **ID抽出**: `auth0_user_id.split("|")[-1]` でユーザーIDを抽出 
3. **Direct lookup**: `get_user_by_user_id()` を使用
4. **レガシーフィールド対応**: UserRepositoryでの `app_username` → `trainer_name` 自動変換

**実装箇所**:
- `backend/src/handlers/users.py`: `get_me()`, `update_profile()` 関数
- `backend/src/repositories/user_repository.py`: レガシーフィールド変換

**予防策**: 新しいダミーユーザーAPIエンドポイントを追加する際は、必ずこのパターンを適用すること
- 管理機能へのアクセスログ記録

### テスト用一括操作機能

#### 概要
管理者画面に実装されたテスト効率化機能。ダミーユーザーを使用した一括操作により、手動テストの工数を大幅に削減。

#### 機能仕様

**全員インキュー（10人）**
- ダミーユーザー最大10人を全ロール選択でキューに追加
- 各ユーザーを個別にダミーログインしてから `/api/queue/join` を実行
- 全ロール選択: `['TOP_LANE', 'MIDDLE', 'BOTTOM_LANE', 'SUPPORT', 'TANK']`
- 処理間隔: 200ms の待機時間を挟んで順次実行

**全員結果報告（A勝利）**
- 進行中の試合を自動検出
- 参加プレイヤーを team_A / team_B に分類
- team_A: `result: 'win'` で勝利報告
- team_B: `result: 'lose'` で敗北報告
- 使用ポケモン: team_A は「ピカチュウ」、team_B は「イーブイ」
- 各プレイヤーを個別にダミーログインしてから `/api/matches/{match_id}/report` を実行

**キュー全削除**
- 全ダミーユーザーをキューから削除
- 各ユーザーを個別にダミーログインしてから `/api/queue/leave` を実行
- キューにいないユーザーのエラーは無視

#### 技術実装

**共通パターン**
```typescript
// 1. ダミーユーザー一覧取得
const usersResponse = await callApi<{ users: any[] }>('/api/auth/dummy/users');

// 2. 各ユーザーを個別にダミーログイン
const loginResponse = await callApi('/api/auth/dummy/login', {
  method: 'POST',
  body: JSON.stringify({
    user_id: user.user_id,
    trainer_name: user.trainer_name,
    rate: user.rate || 1500
  })
});

// 3. そのユーザーのトークンで本番APIを実行
const response = await fetch(`${API_BASE_URL}/api/endpoint`, {
  headers: {
    'Authorization': `Bearer ${token}`
  },
  // ...
});
```

#### 設計思想

**本番API使用**
- デバッグ専用APIは作成せず、既存の本番APIを活用
- ダミーユーザー認証を通じて、本番と同じフローでテスト実行
- フロントエンドで操作の自動化のみを行う

**テスト効率化**
- 従来: 10人分の画面操作を手動実行（インキュー + 報告）
- 改善後: ボタン1つで一括操作が完了
- マッチメイキング → 試合報告 → 結果集計の流れを効率的にテスト可能

#### セキュリティ考慮事項
- 管理者権限 (`isAdmin=true`) のユーザーのみアクセス可能
- ダミーユーザーのみを対象とした操作（本番ユーザーには影響なし）
- 確認ダイアログによる誤操作防止（キュー全削除のみ）
- 操作ログは各API呼び出しで自動記録

## ペナルティシステム

### 基本概念
- **通報機能**: 対戦後に迷惑行為プレイヤーを通報
- **ペナルティ付与**: 一定数以上の通報でペナルティが加算
- **ペナルティ管理**: `penalty_count`（累積）と`penalty_correction`（軽減）の差分で管理
- **参加制限**: 実効ペナルティ6以上でマッチング禁止、それ以下はタイムアウト
- **タイムアウト時間**: 実効ペナルティ数 × 30分
- **自動軽減**: 50試合ごとに`penalty_correction`を+1

### ペナルティ計算式
```
実効ペナルティ = penalty_count - penalty_correction
```

### 通報判定ロジック
ペナルティが付与される条件：
1. **同じチームの4人から通報**された場合
2. **全体から6人以上通報**された場合

```python
def check_penalty_conditions(user_reports: list[dict], target_user: str, teams: dict) -> bool:
    """指定ユーザーがペナルティ対象かチェック"""
    reports_against_user = [r for r in user_reports if r["reported_id"] == target_user]
    
    if not reports_against_user:
        return False
    
    # 条件1: 同じチームの4人からの通報
    target_team = get_user_team(target_user, teams)
    same_team_reporters = [r["reporter_id"] for r in reports_against_user 
                          if get_user_team(r["reporter_id"], teams) == target_team]
    if len(set(same_team_reporters)) >= 4:
        return True
    
    # 条件2: 全体から6人以上の通報（重複除去）
    unique_reporters = set(r["reporter_id"] for r in reports_against_user)
    if len(unique_reporters) >= 6:
        return True
        
    return False
```

### データ構造

#### User テーブル拡張
```python
class User(BaseModel):
    # 既存フィールド...
    penalty_count: int = Field(default=0, description="累積ペナルティ数（減らない）")
    penalty_correction: int = Field(default=0, description="ペナルティ軽減数")
    last_penalty_time: int | None = Field(default=None, description="最後のペナルティ付与時刻")
    penalty_timeout_until: int | None = Field(default=None, description="ペナルティタイムアウト終了時刻")
    
    @property
    def effective_penalty(self) -> int:
        """実効ペナルティ数を計算"""
        return max(0, self.penalty_count - self.penalty_correction)
```

#### Match テーブル拡張  
```python
class Match(BaseModel):
    # 既存フィールド...
    user_reports: list[dict] = Field(default_factory=list, description="通報リスト")
    penalty_players: list[str] = Field(default_factory=list, description="ペナルティが付与されたプレイヤー")
    
# user_reports の構造:
# [{
#   "reporter_id": "user1",
#   "reported_id": "user5", 
#   "timestamp": 1640995200,
#   "reason": "迷惑行為"
# }]
```

### API設計

#### 通報機能
```
POST /api/matches/{match_id}/report
{
  "reported_users": ["user1", "user2"],
  "reason": "迷惑行為の詳細"
}
```

### フロントエンド実装

#### ペナルティ状態の計算と表示
```typescript
const calculateEffectivePenalty = (user: User): number => {
  return Math.max(0, user.penalty_count - user.penalty_correction);
};

const PenaltyStatus: FC<{ user: User }> = ({ user }) => {
  const effectivePenalty = calculateEffectivePenalty(user);
  const canMatch = effectivePenalty < 6;
  const timeoutMinutes = effectivePenalty * 30;
  const timeoutRemaining = calculateTimeoutRemaining(user);
  
  if (!canMatch) {
    return (
      <div className="penalty-banned">
        <span className="text-red-600">⚠️ ペナルティレベル{effectivePenalty}</span>
        <p>マッチング参加禁止</p>
        <p className="text-sm">累積: {user.penalty_count}, 軽減: {user.penalty_correction}</p>
      </div>
    );
  }
  
  if (timeoutRemaining > 0) {
    return (
      <div className="penalty-timeout">
        <span className="text-orange-600">⏰ ペナルティタイムアウト中</span>
        <p>残り時間: {formatTime(timeoutRemaining)}</p>
        <p className="text-sm">実効ペナルティ: {effectivePenalty}</p>
      </div>
    );
  }
  
  return null;
};
```

### バックエンド実装パターン

#### ペナルティ付与処理
```python
def apply_penalty(user_id: str) -> User:
    """ペナルティを付与（penalty_countのみ増加）"""
    user = get_user(user_id)
    user.penalty_count += 1  # 累積ペナルティを増加
    user.last_penalty_time = int(time.time())
    
    # 実効ペナルティでタイムアウト計算
    effective_penalty = user.penalty_count - user.penalty_correction
    if effective_penalty < 6:
        timeout_seconds = effective_penalty * 30 * 60  # 30分 × 実効ペナルティ数
        user.penalty_timeout_until = int(time.time()) + timeout_seconds
    else:
        user.penalty_timeout_until = None  # 無期限禁止
    
    update_user(user)
    return user
```

#### ペナルティ軽減処理（50試合ごと）
```python
def check_and_apply_penalty_reduction(user: User, completed_matches: int) -> User:
    """50試合ごとにpenalty_correctionを増加"""
    reduction_cycles = completed_matches // 50
    current_corrections = user.penalty_correction
    
    if reduction_cycles > current_corrections:
        # 新たな軽減を適用
        user.penalty_correction = reduction_cycles
        
        # タイムアウト再計算
        effective_penalty = user.penalty_count - user.penalty_correction
        if effective_penalty < 6:
            if effective_penalty == 0:
                user.penalty_timeout_until = None
            else:
                timeout_seconds = effective_penalty * 30 * 60
                user.penalty_timeout_until = int(time.time()) + timeout_seconds
    
    return user
```

#### キュー参加チェック
```python
def can_join_queue(user: User) -> tuple[bool, str]:
    """キュー参加可能かチェック（実効ペナルティで判定）"""
    effective_penalty = user.penalty_count - user.penalty_correction
    
    if effective_penalty >= 6:
        return False, f"ペナルティレベル{effective_penalty}: マッチング参加禁止"
        
    if user.penalty_timeout_until and user.penalty_timeout_until > time.time():
        remaining = user.penalty_timeout_until - time.time()
        remaining_minutes = int(remaining // 60)
        return False, f"ペナルティタイムアウト中: 残り{remaining_minutes}分"
        
    return True, ""
```

### シーズンリセット時の処理
```python
def reset_season_penalties(user: User) -> User:
    """シーズンリセット時のペナルティ処理"""
    effective_penalty = user.penalty_count - user.penalty_correction
    
    if effective_penalty <= 5:
        # 実効ペナルティが5以下の場合はリセット
        user.penalty_count = 0
        user.penalty_correction = 0
        user.penalty_timeout_until = None
        user.last_penalty_time = None
    # 6以上の場合は変更なし（ペナルティ継続）
    
    return user
```

### セキュリティ考慮事項
- 通報は認証済みユーザーのみ
- 同一試合での重複通報防止
- 自分自身・同じチームへの通報防止
- penalty_correctionはシステムのみが変更可能
- 管理者による通報内容確認・ペナルティ調整機能

### 既存デバッグ機能の移行
以下の機能を一般ユーザー画面から管理者画面に移行：
- 手動マッチメイキングボタン
- 対戦画面へのアクセス機能
- ダミーユーザーログイン機能
- システム状態確認機能

## 管理者ユーザー管理機能

### 概要
管理者がユーザー情報を検索・編集できる機能を管理画面に追加

### 機能仕様

#### ユーザー検索機能
- **検索条件**
  - ユーザーID（Discord ID）
  - トレーナー名（部分一致）
  - Discord名（部分一致）
- **検索結果表示**
  - ユーザー基本情報
  - 現在のステータス
  - ペナルティ情報
  - 所持勲章リスト

#### 編集可能項目
```typescript
interface AdminEditableUserFields {
  // レート関連
  rate: number;              // 現在レート
  max_rate: number;          // 最高レート
  
  // ペナルティ関連
  penalty_count: number;     // 累積ペナルティ数
  penalty_correction: number; // ペナルティ軽減数
  penalty_timeout_until: number | null; // タイムアウト終了時刻
  
  // 勲章関連
  owned_badges: string[];    // 所持勲章リスト
  current_badge: string;     // 装着中の勲章1
  current_badge_2: string;   // 装着中の勲章2
  
  // 管理フラグ
  is_admin: boolean;         // 管理者権限
  is_banned: boolean;        // アカウント凍結（新規追加）
}
```

### API設計

#### ユーザー検索エンドポイント
```
GET /api/admin/users/search
Query Parameters:
  - user_id?: string         // Discord ID完全一致
  - trainer_name?: string    // トレーナー名部分一致
  - discord_name?: string    // Discord名部分一致
  - limit?: number          // 検索結果上限（デフォルト: 20）

Response:
{
  "users": [
    {
      "user_id": "123456789",
      "trainer_name": "プレイヤー1",
      "discord_username": "player1",
      "rate": 1500,
      "penalty_count": 2,
      "penalty_correction": 1,
      "owned_badges": ["badge1", "badge2"],
      ...
    }
  ],
  "total_count": 15
}
```

#### ユーザー詳細取得
```
GET /api/admin/users/{user_id}

Response:
{
  "user": { /* 完全なユーザー情報 */ },
  "recent_matches": [ /* 最近の試合履歴 */ ],
  "penalty_history": [ /* ペナルティ履歴 */ ]
}
```

#### ユーザー情報更新
```
PUT /api/admin/users/{user_id}
{
  "rate": 1600,
  "penalty_count": 0,
  "owned_badges": ["badge1", "badge2", "badge3"],
  "is_banned": false
}

Response:
{
  "success": true,
  "updated_user": { /* 更新後のユーザー情報 */ },
  "changes": {
    "rate": { "old": 1500, "new": 1600 },
    "penalty_count": { "old": 2, "new": 0 }
  }
}
```

## 管理者試合管理機能

### 概要
管理者が進行中の試合を一覧表示し、各試合の詳細情報（プレイヤー情報、結果報告状況、通報内容）を確認できる機能

### 機能仕様

#### 試合一覧表示
- **表示項目**
  - 試合ID
  - 試合状態（matched/done）
  - 開始時刻
  - 参加プレイヤー（チームA/B）
  - 結果報告数（例: 7/10）
  - ロビーID
  - ホストプレイヤー

#### 試合詳細画面
```typescript
interface AdminMatchDetailView {
  // 基本情報
  match_id: string;
  status: 'matched' | 'done';
  matched_unixtime: number;
  lobby_id?: string;
  host_user_id?: string;
  winner_team?: 'A' | 'B';
  
  // チーム情報（詳細プレイヤー情報付き）
  team_a: MatchPlayerData[];
  team_b: MatchPlayerData[];
  
  // 結果報告詳細
  user_reports: {
    user_id: string;
    trainer_name: string;
    reported_at: number;
    result: 'win' | 'lose';
    team: 'A' | 'B';
    reported_players?: string[]; // 通報したプレイヤーID
    report_reason?: string; // 通報理由
  }[];
  
  // 通報集計
  penalty_reports: {
    [user_id: string]: {
      trainer_name: string;
      report_count: number; // 通報された回数
      reporters: {
        user_id: string;
        trainer_name: string;
        team: 'A' | 'B';
        reason?: string;
      }[];
    };
  };
  
  // ペナルティ判定状態
  penalty_status: {
    processed: boolean;
    penalty_players: string[];
    processing_time?: number;
  };
}
```

### API設計

#### 進行中試合一覧取得
```
GET /api/admin/matches
Query Parameters:
  - status?: 'matched' | 'done' | 'all'
  - limit?: number (デフォルト: 50)
  - offset?: number

Response:
{
  "matches": [
    {
      "match_id": "12345",
      "status": "matched",
      "matched_unixtime": 1704000000,
      "team_a_count": 5,
      "team_b_count": 5,
      "report_count": 7,
      "lobby_id": "ABC123",
      "host_trainer_name": "ホストプレイヤー"
    }
  ],
  "total_count": 25
}
```

#### 試合詳細取得
```
GET /api/admin/matches/{match_id}

Response:
{
  "match": { /* 完全な試合情報 */ },
  "reports": [ /* 結果報告詳細 */ ],
  "penalty_summary": { /* 通報集計情報 */ }
}
```

#### 試合ステータス更新
```
PUT /api/admin/matches/{match_id}/status
{
  "status": "done",
  "reason": "不正な試合のため"
}
```

#### 手動ペナルティ処理
```
POST /api/admin/matches/{match_id}/process-penalties
{
  "penalty_players": ["user_id_1", "user_id_2"],
  "skip_players": ["user_id_3"] // ペナルティを免除するプレイヤー
}
```

### フロントエンド実装

#### 試合管理タブ
```typescript
const AdminMatchManagement: React.FC = () => {
  const [matches, setMatches] = useState<AdminMatchSummary[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'matched' | 'done'>('matched');
  
  return (
    <div className="admin-match-management">
      {/* フィルター */}
      <div className="filters mb-4">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">全て</option>
          <option value="matched">進行中</option>
          <option value="completed">完了</option>
        </select>
      </div>
      
      {/* 試合一覧 */}
      <MatchList 
        matches={matches}
        onSelectMatch={setSelectedMatch}
      />
      
      {/* 試合詳細 */}
      {selectedMatch && (
        <MatchDetailModal
          matchId={selectedMatch}
          onClose={() => setSelectedMatch(null)}
        />
      )}
    </div>
  );
};
```

#### 試合詳細モーダル
```typescript
const MatchDetailModal: React.FC<{ matchId: string }> = ({ matchId }) => {
  // 結果報告状況の可視化
  // 通報集計の表示
  // ペナルティ判定状態の確認
  // 手動介入機能（試合キャンセル、ペナルティ調整）
};
```

### セキュリティ考慮事項
- 管理者権限の確認（is_admin = true）
- 監査ログの記録（誰がいつ何を変更したか）
- 手動ペナルティ処理時の理由記録必須

### フロントエンド実装

#### ユーザー管理画面コンポーネント
```typescript
const AdminUserManagement: React.FC = () => {
  const [searchParams, setSearchParams] = useState({
    user_id: '',
    trainer_name: '',
    discord_name: ''
  });
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [editMode, setEditMode] = useState(false);

  return (
    <div className="admin-user-management">
      {/* 検索フォーム */}
      <UserSearchForm 
        params={searchParams}
        onSearch={handleSearch}
      />
      
      {/* 検索結果一覧 */}
      <UserSearchResults 
        users={searchResults}
        onSelectUser={setSelectedUser}
      />
      
      {/* ユーザー詳細・編集 */}
      {selectedUser && (
        <UserDetailPanel
          user={selectedUser}
          editMode={editMode}
          onEdit={handleEditUser}
          onToggleEditMode={setEditMode}
        />
      )}
    </div>
  );
};
```

#### ユーザー編集フォーム
```typescript
const UserEditForm: React.FC<{ user: User }> = ({ user }) => {
  const [formData, setFormData] = useState({
    rate: user.rate,
    penalty_count: user.penalty_count,
    penalty_correction: user.penalty_correction,
    owned_badges: [...user.owned_badges],
    is_admin: user.is_admin,
    is_banned: user.is_banned || false
  });

  const effectivePenalty = formData.penalty_count - formData.penalty_correction;

  return (
    <form className="user-edit-form">
      {/* レート編集 */}
      <div className="form-section">
        <h4>レート情報</h4>
        <input 
          type="number" 
          value={formData.rate}
          onChange={(e) => setFormData({...formData, rate: parseInt(e.target.value)})}
        />
      </div>

      {/* ペナルティ編集 */}
      <div className="form-section">
        <h4>ペナルティ情報</h4>
        <label>
          累積ペナルティ: 
          <input type="number" value={formData.penalty_count} />
        </label>
        <label>
          軽減数: 
          <input type="number" value={formData.penalty_correction} />
        </label>
        <p>実効ペナルティ: {effectivePenalty}</p>
      </div>

      {/* 勲章管理 */}
      <div className="form-section">
        <h4>勲章管理</h4>
        <BadgeManager 
          ownedBadges={formData.owned_badges}
          onUpdate={(badges) => setFormData({...formData, owned_badges: badges})}
        />
      </div>

      {/* 管理フラグ */}
      <div className="form-section">
        <h4>アカウント管理</h4>
        <label>
          <input 
            type="checkbox" 
            checked={formData.is_admin}
            onChange={(e) => setFormData({...formData, is_admin: e.target.checked})}
          />
          管理者権限
        </label>
        <label>
          <input 
            type="checkbox" 
            checked={formData.is_banned}
            onChange={(e) => setFormData({...formData, is_banned: e.target.checked})}
          />
          アカウント凍結
        </label>
      </div>
    </form>
  );
};
```

### バックエンド実装

#### 管理者権限チェックデコレータ
```python
def require_admin(func):
    """管理者権限を要求するデコレータ"""
    @wraps(func)
    def wrapper(event, context):
        user_id = extract_user_id_from_event(event)
        user = user_service.get_user_by_auth0_sub(user_id)
        
        if not user or not user.is_admin:
            return create_error_response(403, "管理者権限が必要です")
            
        return func(event, context)
    return wrapper
```

#### ユーザー検索ハンドラー
```python
@require_admin
def admin_search_users(event: dict, context: dict) -> dict:
    """管理者用ユーザー検索"""
    params = event.get("queryStringParameters", {})
    
    # 検索条件構築
    filter_expressions = []
    expression_values = {}
    
    if params.get("user_id"):
        filter_expressions.append("user_id = :user_id")
        expression_values[":user_id"] = params["user_id"]
    
    if params.get("trainer_name"):
        filter_expressions.append("contains(trainer_name, :trainer_name)")
        expression_values[":trainer_name"] = params["trainer_name"]
        
    # DynamoDB検索実行
    # ...
    
    return create_success_response({
        "users": users,
        "total_count": len(users)
    })
```

#### ユーザー更新ハンドラー
```python
@require_admin  
def admin_update_user(event: dict, context: dict) -> dict:
    """管理者用ユーザー情報更新"""
    user_id = event["pathParameters"]["user_id"]
    updates = json.loads(event["body"])
    
    # 現在のユーザー情報取得
    user = user_service.get_user_by_user_id(user_id)
    if not user:
        return create_error_response(404, "ユーザーが見つかりません")
    
    # 変更履歴記録用
    changes = {}
    
    # 各フィールドの更新
    for field, new_value in updates.items():
        if field in ADMIN_EDITABLE_FIELDS:
            old_value = getattr(user, field)
            if old_value != new_value:
                changes[field] = {"old": old_value, "new": new_value}
                setattr(user, field, new_value)
    
    # 監査ログ記録
    log_admin_action(
        admin_id=extract_user_id_from_event(event),
        action="update_user",
        target_user=user_id,
        changes=changes
    )
    
    # ユーザー更新
    updated_user = user_service.update_user(user)
    
    return create_success_response({
        "success": True,
        "updated_user": updated_user.model_dump(),
        "changes": changes
    })
```

### セキュリティ考慮事項

#### 権限管理
- すべての管理機能は `is_admin=true` のユーザーのみアクセス可能
- 管理者自身の `is_admin` フラグは変更不可
- 重要な変更には確認ダイアログを表示

#### 監査ログ
```python
class AdminAuditLog(BaseModel):
    """管理者操作ログ"""
    log_id: str
    admin_id: str          # 操作した管理者
    action: str            # 実行したアクション
    target_user: str       # 対象ユーザー
    changes: dict          # 変更内容
    timestamp: int         # 操作時刻
    ip_address: str        # 操作元IP
```

#### 変更制限
- レート変更は±500の範囲内
- ペナルティ軽減数は累積数を超えない
- 勲章の付与は存在する勲章のみ

### UI/UXガイドライン

#### 検索画面
- リアルタイム検索は避け、明示的な検索ボタンで実行
- 検索結果は20件ずつページネーション
- ユーザーIDコピーボタンを設置

#### 編集画面  
- 変更前後の値を並べて表示
- 危険な操作（アカウント凍結等）は赤色で警告
- 保存前に変更内容の確認画面を表示

#### 操作履歴
- 各ユーザーの変更履歴を表示
- いつ、誰が、何を変更したかを明確に記録

## マッチメイキングシステム

### 試合結果処理の最適化（2025年実装）

#### 効率的な進行中試合管理
従来の全マッチテーブルスキャンから、METAデータによる直接ID管理に変更：

**課題**: 
- 2分ごとのマッチメイキング前に試合結果処理を実行
- 全マッチテーブルをスキャンして進行中試合を検索するのは非効率
- 10人全員の報告を待つと処理が遅延

**解決策**: 
1. **進行中試合ID管理**: QueueMeta に `ongoing_match_ids` フィールドを追加
2. **部分報告での処理**: 7人以上の報告があれば処理を実行（従来の可変閾値から固定閾値に変更）
3. **効率的な処理フロー**: 進行中試合IDリストから直接マッチを取得

#### 実装詳細

**QueueMeta 拡張**:
```python
class QueueMeta(BaseModel):
    # 既存フィールド...
    ongoing_match_ids: list[int] = Field(default_factory=list, description="進行中のマッチIDリスト")
```

**進行中試合の管理フロー**:
1. **マッチ作成時**: `queue_repo.add_ongoing_matches([match_id])` で進行中リストに追加
2. **結果処理時**: `queue_repo.get_ongoing_match_ids()` で進行中試合を取得
3. **試合完了時**: `queue_repo.remove_ongoing_matches([match_id])` で完了試合を削除

**処理閾値の最適化**:
```python
def is_report_enough(reports: list[dict], timeout_count: int) -> bool:
    """報告数が十分かチェック（7人以上の報告が必要）"""
    # タイムアウト機能は使用せず、常に7人以上の報告を待つ
    return len(reports) >= 7
```

**効率化されたgather_match処理**:
```python
def gather_match(event, context):
    """進行中試合の結果集計（効率化版）"""
    queue_repo = QueueRepository()
    
    # 進行中試合IDリストを直接取得（全テーブルスキャン不要）
    ongoing_match_ids = queue_repo.get_ongoing_match_ids()
    
    # 各進行中試合を処理
    for match_id in ongoing_match_ids:
        success = process_match_result(match_id)
        # 完了した試合を進行中リストから削除
        if is_match_completed(match_id):
            completed_match_ids.append(match_id)
    
    # 完了した試合をまとめて削除
    queue_repo.remove_ongoing_matches(completed_match_ids)
```

**パフォーマンス向上**:
- **スキャン削減**: 全マッチテーブルスキャンからIDベースの直接アクセスに変更
- **処理時間短縮**: 7人以上の報告で即座に処理開始
- **リソース効率**: 不要なデータベース読み込みを削減

### Queue メタデータ構造

Queueテーブルに以下のメタデータフィールドを追加：

```
previous_matched_unixtime: int | null
  - 前回のマッチメイクが実行された日時（UNIX timestamp）
  - 初期値: null
  - フロントエンド表示対象

previous_user_count: int
  - 前回のマッチメイクに参加したユーザー数
  - 初期値: 0
  - フロントエンド表示対象

latest_match_id: int
  - 最新のマッチメイクで作成された試合ID
  - 初期値: 0
  - 内部管理用（フロントエンド非表示）

unused_vc: list[int]
  - 使用されていないVC番号のリスト
  - 初期値: [1, 3, 5, 7, 9, ..., 99] (1から99までの奇数)
  - 内部管理用（フロントエンド非表示）
```

## WebSocketシステム

### WebSocket試合購読システム（2025年実装）

#### 概要
従来のHTTP APIポーリング（5秒間隔）から、WebSocketのプッシュ型通信に移行し、リアルタイム性の向上とリソース効率化を実現。

#### 問題点
- **HTTPポーリングの非効率性**: 5秒ごとに`/api/matches/current`を呼び出し
- **無駄なトラフィック**: 変更がなくても定期的にリクエスト
- **遅延**: 最大5秒の更新遅延
- **サーバー負荷**: 多数のクライアントからの定期的なリクエスト

#### 解決策：WebSocket試合購読

##### メッセージフロー

**1. 試合購読開始**
```typescript
// クライアント → サーバー
{
  "action": "subscribeMatch",
  "matchId": "12345"
}

// サーバー → クライアント（成功応答）
{
  "type": "subscribeMatchSuccess",
  "matchId": "12345",
  "match": { /* 現在の試合データ */ }
}
```

**2. 試合データ更新通知**
```typescript
// サーバー → クライアント（試合データ更新時）
{
  "type": "matchUpdate",
  "matchId": "12345",
  "match": { /* 更新された試合データ */ },
  "updateType": "lobby_id_updated" | "player_joined" | "status_changed" | "match_completed"
}
```

**3. 試合購読解除**
```typescript
// クライアント → サーバー
{
  "action": "unsubscribeMatch",
  "matchId": "12345"
}

// サーバー → クライアント（確認）
{
  "type": "unsubscribeMatchSuccess",
  "matchId": "12345"
}
```

##### サーバー側実装

**WebSocketハンドラー拡張**:
```python
# src/handlers/websocket.py

def handle_subscribe_match(connection_id: str, match_id: str):
    """試合購読を開始"""
    # ConnectionsテーブルにサブスクリプションINDEXを追加
    connections_table.update_item(
        Key={"connection_id": connection_id},
        UpdateExpression="SET subscribed_match_id = :match_id",
        ExpressionAttributeValues={":match_id": match_id}
    )
    
    # 現在の試合データを送信
    match_data = get_match_data(match_id)
    send_message(connection_id, {
        "type": "subscribeMatchSuccess",
        "matchId": match_id,
        "match": match_data
    })

def handle_unsubscribe_match(connection_id: str, match_id: str):
    """試合購読を解除"""
    connections_table.update_item(
        Key={"connection_id": connection_id},
        UpdateExpression="REMOVE subscribed_match_id"
    )

def broadcast_match_update(match_id: str, update_type: str):
    """特定の試合を購読している全接続に更新を送信"""
    # subscribed_match_id INDEXで効率的に検索
    subscribers = connections_table.query(
        IndexName="subscribed_match_id-index",
        KeyConditionExpression="subscribed_match_id = :match_id",
        ExpressionAttributeValues={":match_id": match_id}
    )
    
    match_data = get_match_data(match_id)
    message = {
        "type": "matchUpdate",
        "matchId": match_id,
        "match": match_data,
        "updateType": update_type
    }
    
    for subscriber in subscribers["Items"]:
        send_message(subscriber["connection_id"], message)
```

**試合更新時のトリガー**:
各試合更新API（ロビーID更新、ホスト変更、試合報告など）で`broadcast_match_update`を呼び出し：

```python
# src/handlers/matches.py
def update_lobby_id(event, context):
    # ... ロビーID更新処理 ...
    
    # WebSocket購読者に通知
    broadcast_match_update(match_id, "lobby_id_updated")
    
    return response
```

##### クライアント側実装

**useWebSocketフック拡張**:
```typescript
// src/hooks/useWebSocket.ts
export const useWebSocket = () => {
  const [subscribedMatchId, setSubscribedMatchId] = useState<string | null>(null);
  const [matchData, setMatchData] = useState<MatchData | null>(null);

  const subscribeMatch = useCallback((matchId: string) => {
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    
    ws.send(JSON.stringify({
      action: "subscribeMatch",
      matchId
    }));
    setSubscribedMatchId(matchId);
  }, [ws]);

  const unsubscribeMatch = useCallback(() => {
    if (!ws || !subscribedMatchId) return;
    
    ws.send(JSON.stringify({
      action: "unsubscribeMatch",
      matchId: subscribedMatchId
    }));
    setSubscribedMatchId(null);
  }, [ws, subscribedMatchId]);

  // メッセージハンドラー
  useEffect(() => {
    if (!ws) return;
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      
      switch (data.type) {
        case "subscribeMatchSuccess":
          setMatchData(data.match);
          break;
        case "matchUpdate":
          setMatchData(data.match);
          // 試合完了時は自動的に購読解除
          if (data.updateType === "match_completed") {
            setSubscribedMatchId(null);
          }
          break;
      }
    };
  }, [ws]);

  return { subscribeMatch, unsubscribeMatch, matchData };
};
```

##### DynamoDBスキーマ更新

**Connectionsテーブル**:
```typescript
{
  connection_id: string;         // PK
  user_id: string;
  connected_at: number;
  subscribed_match_id?: string;  // 購読中の試合ID
}

// GSI追加
subscribed_match_id-index: {
  PK: subscribed_match_id
  SK: connection_id
}
```

##### 移行計画

1. **Phase 1**: WebSocket購読システムの実装
2. **Phase 2**: クライアント側でWebSocket購読を利用開始
3. **Phase 3**: HTTPポーリングの削除
4. **Phase 4**: 不要なAPI エンドポイントの廃止（`/api/matches/current`）

##### 期待される効果

- **トラフィック削減**: 変更時のみ通信（従来: 5秒ごと → 変更時のみ）
- **リアルタイム性向上**: 即座に更新通知（従来: 最大5秒遅延 → 即時）
- **サーバー負荷軽減**: APIコール激減
- **クライアント負荷軽減**: 不要なポーリング処理削除

### VC（ボイスチャンネル）管理システム

#### VC番号の構造
- **利用可能VC**: 1, 3, 5, 7, 9, ..., 99 (奇数のみ)
- **チームA**: 奇数VC番号を使用 (例: 1, 3, 5...)
- **チームB**: チームAのVC番号 + 1 の偶数を使用 (例: 2, 4, 6...)

#### VC割り当てロジック
1. `unused_vc` リストから最初の2つの奇数を取得
2. 1つ目の奇数をチームAに割り当て
3. 1つ目の奇数+1をチームBに割り当て
4. 2つ目の奇数をチームA（2試合目）に割り当て
5. 2つ目の奇数+1をチームB（2試合目）に割り当て
6. 使用したVC番号を `unused_vc` から削除

#### VC返還ロジック
- 試合ステータスが `done` になった時
- 該当試合で使用していたチームAのVC番号（奇数）を `unused_vc` に追加
- 返還は昇順でソートして管理

### マッチID生成システム

#### 連番ID管理
- `latest_match_id` を基準とした連番生成
- 新規マッチ作成時: `latest_match_id + 1` を使用
- 作成完了後: 新しいIDで `latest_match_id` を更新

#### 複数マッチ同時作成時の処理
例: `latest_match_id = 2`, キューに20人以上いる場合
1. 1つ目のマッチ: ID = 3 で作成
2. 2つ目のマッチ: ID = 4 で作成
3. `latest_match_id` を 4 に更新

#### IDの一意性保証
- DynamoDB の条件付き書き込みを使用してID競合を防止
- 同時リクエスト時はリトライ機構で対応

### 戦績処理システム（Legacy完全準拠）

#### プレイヤー戦績更新仕様

**更新対象フィールド（usersテーブル）**:
- `rate`: 現在レート（ELO16アルゴリズム + 初心者ボーナス）
- `unitemate_max_rate`: 最高到達レート
- `unitemate_num_record`: 総試合数
- `unitemate_num_win`: 勝利数
- `unitemate_winrate`: 勝率（%、四捨五入）
- `unitemate_last_rate_delta`: 最新のレート変動
- `unitemate_last_match_id`: 処理済み最終マッチID（重複処理防止）
- `assigned_match_id`: 現在割り当てマッチID（処理後に0にリセット）

**ELOレーティング計算**:
```python
# 基本ELO計算（K=16）
if result == "A-win":
    delta = round(16 * (1 - (1 / (10 ** ((rate_b - rate_a) / 400) + 1))))
    new_rate_a = rate_a + delta
    new_rate_b = rate_b - delta
elif result == "B-win":
    delta = round(16 * (1 - (1 / (10 ** ((rate_a - rate_b) / 400) + 1))))
    new_rate_a = rate_a - delta
    new_rate_b = rate_b + delta

# 初心者ボーナス適用
if num_record < 20:
    corrected_delta = delta + 5
else:
    corrected_delta = delta
```

**戦績レコード作成（recordsテーブル）**:
```python
record_data = {
    "user_id": user_id,
    "match_id": int(match_id),
    "pokemon": pokemon if pokemon and pokemon != "null" else "null",
    "rate_delta": int(corrected_rate_delta),
    "started_date": int(started_date),
    "winlose": (1 if win else 0)  # 0: 敗北, 1: 勝利, 2: 無効試合
}
```

**重複処理防止**:
- `unitemate_last_match_id`で処理済みマッチIDを記録
- 同一マッチIDでの重複処理を防止
- 新規ユーザー作成時は初期値0で作成

**統計値計算**:
- 勝率: `round(勝利数 * 100 / 総試合数)`
- 最高レート: `max(現在の最高レート, 新レート)`

**エラーハンドリング**:
- ユーザーデータ不存在時は初期値で新規作成
- DynamoDB更新失敗時はログ出力してFalse返却
- recordsテーブル更新失敗時も同様

#### 処理フロー（process_match_result内）

1. **試合結果判定**: 7人以上の報告から多数決で勝敗決定
2. **プレイヤーペア処理**: チームA vs チームBで1対1のレート計算
3. **戦績更新**: 各プレイヤーのusersテーブル更新
4. **戦績レコード作成**: recordsテーブルに個別レコード追加
5. **ペナルティ処理**: 50試合ごとのペナルティ軽減

#### デバッグ確認項目

**戦績が更新されない場合の原因**:
1. `unitemate_last_match_id`による重複処理判定
2. DynamoDBのUpdateExpression構文エラー
3. recordsテーブルのスキーマ不整合
4. プレイヤーペアリングの問題

### 統合スケジューラー設計（Legacy方式からの変更）

#### Legacy方式との違い
**Legacy設計**:
- マッチメイキング: Step Functions（20秒間隔、1分サイクル）
- 結果処理: EventBridge（5分間隔の独立スケジューラー）

**新設計**:
- 統合処理: EventBridge（2分間隔で結果集計→マッチメイキングを順次実行）
- 利点: DEV/本番環境での処理フロー統一、手動実行時の整合性確保

#### 統合処理関数（match_make）

**処理フロー**:
1. **STEP 1**: 結果集計処理（gather_match機能を統合）
   - 進行中試合の報告状況確認
   - 7人以上報告のある試合を結果確定
   - 完了試合の後処理（VC返却、ongoing_matches更新）

2. **STEP 2**: 新規マッチメイキング処理
   - キューからプレイヤー取得
   - 10人以上で新規マッチ作成
   - VC割り当て、チーム分け

#### 実装方針
- 両処理は同一ロック機構で保護
- STEP 1でエラーが発生してもSTEP 2は継続実行
- 結果はステップごとに分離してレスポンス

### マッチメイキング実行フロー詳細

#### 事前準備
1. 現在時刻取得（UNIX timestamp）
2. キュー参加者数カウント
3. `latest_match_id` 取得
4. `unused_vc` 状態確認

#### マッチ作成処理
1. 必要なVC番号を `unused_vc` から確保
2. 新しいマッチIDを `latest_match_id + 1` から生成
3. マッチデータ作成（チーム分け、VC割り当て含む）
4. 各ユーザーに `assigned_match_id` 設定

#### メタデータ更新
1. `previous_matched_unixtime` に実行時刻設定
2. `previous_user_count` に参加者数設定
3. `latest_match_id` に最新のマッチID設定
4. `unused_vc` から使用したVC番号を削除

### 試合完了時の処理

#### VC返還条件
- 試合ステータスが `done` に変更された時
- または管理者による試合キャンセル時

#### 返還処理
1. 該当マッチの `vc_A` 番号を取得（奇数）
2. その番号を `unused_vc` リストに追加
3. `unused_vc` を昇順ソート
4. DynamoDB更新

### フロントエンド表示項目

#### キュー画面で表示する情報
- 前回マッチメイク時刻: `previous_matched_unixtime`
- 前回参加者数: `previous_user_count`
- 現在のキュー参加者数（リアルタイム）

#### 非表示項目
- `latest_match_id`
- `unused_vc`

### エラーハンドリング

#### VC不足時の対応
- `unused_vc` が空の場合はマッチメイキングを一時停止
- 管理者通知を送信

### マッチ成立後のタイマー管理システム

マッチメイク成功後、ロビー作成と入室に制限時間を設けて試合の進行を管理する。

#### 制限時間設定
- **ロビー作成制限時間**: 150秒（マスターデータで変更可能）
- **ロビー入室制限時間**: 250秒（マスターデータで変更可能）

#### 表示フェーズと状態遷移

**1. ロビー作成待機フェーズ**
- 表示: "X秒以内にロビーが建たない場合、試合を無効にしてください"
- X = 150秒からカウントダウン
- 条件: マッチ成立直後から開始

**2. ロビー作成タイムアウト**
- 表示: "ロビーが建っていない場合は試合を無効にしてください"
- 条件: 150秒経過してもロビー番号が設定されない場合

**3. ロビー入室フェーズ**
- 表示: "Y秒以内にゲーム内ロビーに全員揃わない場合、試合を無効にしてください"
- Y = 250秒からカウントダウン
- 条件: ロビー番号の変更を検知した時点で開始

**4. 試合開始準備完了**
- 表示: "速やかに試合を開始してください。揃っていない場合は試合を無効にしてください"
- 条件: 250秒経過後

#### UI表示仕様
- カウントダウンタイマーを大きく表示（MM:SS形式）
- 残り30秒以下で文字色を赤色に変更
- 各フェーズに応じてメッセージを切り替え
- ロビー番号が設定された場合は表示

#### 技術仕様
- フロントエンドでタイマー管理
- マッチ成立時刻（matched_unixtime）を基準に計算
- 制限時間はマスターデータのSETTING型から取得
- ロビー番号の変更監視でフェーズ切り替え

#### ID競合時の対応
- DynamoDB条件付き書き込み失敗時はリトライ
- 最大3回リトライ後はエラーログ出力

### 初期データ設定

#### Queue メタデータ初期化
```json
{
  "namespace": "default",
  "meta_type": "matchmaking_config",
  "previous_matched_unixtime": null,
  "previous_user_count": 0,
  "latest_match_id": 0,
  "unused_vc": [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23, 25, 27, 29, 31, 33, 35, 37, 39, 41, 43, 45, 47, 49, 51, 53, 55, 57, 59, 61, 63, 65, 67, 69, 71, 73, 75, 77, 79, 81, 83, 85, 87, 89, 91, 93, 95, 97, 99]
}
```

## DynamoDBテーブル構成

### 必要なテーブル（運用中）
1. **UsersTable** ✅ - ユーザー情報、レート、勲章所持（owned_badges）
2. **MatchesTable** ✅ - マッチ情報
3. **RecordsTable** ✅ - 試合記録
4. **QueueTable** ✅ - マッチメイキングキュー + メタデータ
5. **ConnectionsTable** ✅ - WebSocket接続管理
6. **MasterDataTable** ✅ - ロールマスター、勲章マスター、システム設定データ
7. **RankingsTable** ✅ - ランキングのキャッシュ（パフォーマンス向上）

### 削除済みテーブル（不要）
- ~~AchievementsTable~~ - 勲章マスターはMasterDataTableで管理
- ~~UserBadgesTable~~ - ユーザーの勲章所持はUsers.owned_badgesで管理
- ~~PokemonTable~~ - ポケモンデータはフロントエンドの静的データで管理

### テーブル設計の原則
- 勲章データは全部フロント側で管理、バックエンドで保持するのは各ユーザーがどの勲章を持っているかのデータのみ
- 静的マスターデータ（ポケモン等）はフロントエンド管理
- キャッシュが必要なもの（ランキング）のみDynamoDBテーブル化

### MasterDataTable

システム全体で使用するマスターデータを管理します。

- **プライマリキー:** data_type (パーティションキー), id (ソートキー)

| 項目名                 | 型       | 説明                                           |
| :--------------------- | :------- | :--------------------------------------------- |
| **data_type (PK)**     | string   | データタイプ（POKEMON, ACHIEVEMENT, SETTING）  |
| **id (PK)**            | string   | データID                                       |
| name                   | string   | 表示名                                         |
| description            | string   | 説明（オプション）                             |
| value                  | string   | 設定値（SETTING系データで使用）                |
| image_url              | string   | 画像URL（ポケモン、勲章で使用）                |
| rank                   | string   | ランク（勲章で使用）                           |
| rarity                 | string   | レア度（ポケモンで使用）                       |
| is_active              | boolean  | 有効フラグ                                     |
| display_order          | number   | 表示順序                                       |

### SettingMasterData

システム設定を管理するMasterDataのサブセットです。

**制限時間設定:**

```typescript
interface SettingMasterData {
  data_type: "SETTING";
  id: string;
  value: number;
}

// 設定項目:
// - lobby_create_timeout: ロビー作成制限時間（秒）デフォルト150
// - lobby_join_timeout: ロビー入室制限時間（秒）デフォルト250
```

### users

- **プライマリキー (PK):** `user_id`
- **グローバルセカンダリインデックス (GSI):** `Auth0SubIndex` (パーティションキー: `auth0_sub`)

| 項目名                 | 型     | 説明                                                                                 |
| :--------------------- | :----- | :----------------------------------------------------------------------------------- |
| **user_id (PK)**       | string | ユーザーのプライマリキー。Auth0 の`sub`クレーム（Discord のネイティブ ID）と同じ値。 |
| **auth0_sub (GSI PK)** | string | Auth0 のユーザー識別子。GSI `Auth0SubIndex`のパーティションキー。                    |
| discord_username       | string | Discord のユーザー名。                                                               |
| discord_discriminator  | string | Discord の識別子（例: #1234）。新しいユーザー名形式では null になる可能性がある。    |
| discord_avatar_url     | string | Discord のアバター画像の URL。                                                       |
| trainer_name           | string | トレーナー名（アプリ内表示名）                                                       |
| twitter_id             | string | Twitter ID (@付き)                                                                   |
| preferred_roles        | list   | 希望ロール                                                                           |
| favorite_pokemon       | map    | ロール別好きなポケモン (各ロール最大4体)                                             |
| current_badge          | string | 装着勲章1                                                                            |
| current_badge_2        | string | 装着勲章2                                                                            |
| owned_badges           | list   | 所持勲章リスト                                                                       |
| bio                    | string | 自己紹介                                                                             |
| rate                   | number | 現在のレート。初期値は 1500。                                                        |
| unitemate_max_rate     | number | 最高レート。初期値は 1500。                                                          |
| win_count              | number | 勝利数。                                                                             |
| match_count            | number | 総試合数                                                                            |
| unitemate_winrate      | number | 勝率                                                                                 |
| past_seasons           | list   | 過去シーズンデータ                                                                   |
| penalty_count          | number | 累積ペナルティ数（減らない）デフォルト: 0                                            |
| penalty_correction     | number | ペナルティ軽減数 デフォルト: 0                                                       |
| last_penalty_time      | number | 最後のペナルティ付与時刻                                                             |
| penalty_timeout_until  | number | ペナルティタイムアウト終了時刻                                                       |
| is_admin               | boolean| 管理者権限 デフォルト: false                                                         |
| is_banned              | boolean| アカウント凍結 デフォルト: false                                                     |
| created_at             | number | レコード作成日時 (unixtime)。                                                        |
| updated_at             | number | レコード最終更新日時 (unixtime)。                                                    |

**ユーザー作成フロー:**
1. **自動ユーザー作成**: `/api/users/me` エンドポイントでユーザー情報が見つからない場合、Auth0プロフィール情報から自動的にユーザーレコードを作成
2. **初期値設定**: 
   - `rate`: 1500
   - `unitemate_max_rate`: 1500 
   - `trainer_name`: Discord username
   - `discord_username`: Auth0から取得
   - `discord_avatar_url`: Auth0から取得
   - `penalty_count`: 0
   - `penalty_correction`: 0
   - `is_admin`: false
   - `is_banned`: false
3. **エラーハンドリング**: 404エラーの場合は自動作成、その他のエラーは通常通り処理

**ペナルティシステム:**
- `penalty_count`: 累積ペナルティ数（減らない）
- `penalty_correction`: ペナルティ軽減数（50試合ごとに+1）
- **実効ペナルティ**: `penalty_count - penalty_correction`
- 実効ペナルティ6以上でマッチング禁止、それ以下は時間制限

**過去シーズンデータ:**
```typescript
interface SeasonRecord {
  season_period: string;      // シーズン期間 (例: "2024-01-01 to 2024-03-31")
  total_matches: number;      // 試合数
  win_count: number;          // 勝利数
  final_rate: number;         // 最終レート
  final_rank?: number;        // 最終順位
}
```

### queue

マッチング待機中のユーザー情報を管理する。マッチメイキング時に削除される一時的なデータ。

- **プライマリキー:** namespace (固定: "default"), user_id

| 項目名                 | 型       | 説明                                           |
| :--------------------- | :------- | :--------------------------------------------- |
| **namespace (PK)**     | string   | 名前空間。固定値 "default"                     |
| **user_id (PK)**       | string   | ユーザーID（Discord ID）                       |
| blocking               | string   | ブロックするユーザーID（任意）                 |
| selected_roles         | list     | 選択したロールのリスト（例: ["TOP_LANE", "MIDDLE"]） |
| inqueued_at            | number   | キュー参加日時（unixtime）                     |

**設計方針:**
- `selected_roles`: ユーザーが選択した複数のロール（ロールキューシステム対応）
- `inqueued_at`: キュー参加時刻。待ち時間は `current_time - inqueued_at` で算出
- レート情報は削除（マッチメイキング時にusersテーブルから最新値を取得）
- `discord_id` は削除（`user_id` と同じ値のため冗長）
- `created_at` は削除（`inqueued_at` と同じ値のため冗長）
- `wait_time` フィールドは廃止（リアルタイム計算で十分）
- `desired_role`: 廃止（`selected_roles` に統一）
- `range_spread_*`: 廃止（不要な複雑性を排除）

### matches

マッチ情報を管理する。プレイヤーの詳細情報を含めることで、プレイヤー情報表示時のDB取得を不要にする。

- **プライマリキー:** namespace, match_id
- **GSI:** status_index (パーティションキー: namespace, ソートキー: status)

| 項目名                 | 型       | 説明                                           |
| :--------------------- | :------- | :--------------------------------------------- |
| **namespace (PK)**     | string   | 名前空間。固定値 "default"                     |
| **match_id (PK)**      | number   | マッチID                                       |
| team_A                 | list     | チームAの情報（詳細なプレイヤー情報の配列）    |
| team_B                 | list     | チームBの情報（詳細なプレイヤー情報の配列）    |
| matched_unixtime       | number   | マッチ成立日時（unixtime）                     |
| status                 | string   | 試合状態（"matched", "done"） |
| vc_A                   | number   | チームAのVC番号                                |
| vc_B                   | number   | チームBのVC番号                                |
| lobby_number           | string   | ロビー番号（ホストが設定）                     |
| host_user_id           | string   | ホストユーザーID                               |
| winner_team            | string   | 勝利チーム（A or B）                           |
| user_reports           | list     | 結果報告済みユーザーリスト                     |

**team_A/team_B の構造:**
各チーム情報は以下の形式のオブジェクト配列：
```typescript
interface MatchPlayerData {
  user_id: string;
  trainer_name: string;
  discord_username?: string;
  discord_avatar_url?: string;
  twitter_id?: string;
  rate: number;
  best_rate: number;
  current_badge?: string;
  current_badge_2?: string;
  role: string;                    // TOP_LANE, MIDDLE, BOTTOM_LANE, SUPPORT, TANK
  preferred_roles?: string[];      // 得意ロール情報
  favorite_pokemon?: string[];     // お気に入りポケモン
  bio?: string;                    // 一言コメント
}
```

**設計方針:**
- マッチ作成時にusersテーブルからプレイヤーの詳細情報を取得して保存
- プレイヤー情報モーダル表示時に追加のDB取得が不要
- マッチ作成時点のスナップショットとして情報を保持

**role の値:**
- `TOP_LANE`: 上レーン
- `MIDDLE`: 中央レーン  
- `BOTTOM_LANE`: 下レーン
- `SUPPORT`: サポート
- `TANK`: タンク

**マッチングロジック:**
- マッチメイク時に各プレイヤーにロールが自動割り当て
- team_A/team_Bの各要素にロール情報が含まれる
- フロントエンドでロール表示に使用

### records

試合結果記録を管理する。各ユーザーが参加した試合ごとに作成される戦績データ。

- **プライマリキー:** user_id (パーティションキー), match_id (ソートキー)
- **設計思想:** Legacy システムと完全互換。ユーザーごとの試合履歴を効率的に取得

| 項目名                 | 型       | 説明                                           |
| :--------------------- | :------- | :--------------------------------------------- |
| **user_id (PK)**       | string   | ユーザーID（Discord ID）                       |
| **match_id (SK)**      | number   | 対応するマッチID                               |
| pokemon                | string   | 使用ポケモン                                   |
| rate_delta             | number   | レート変動量（初心者ボーナス込み）             |
| started_date           | number   | 試合開始日時（unixtime）                       |
| winlose                | number   | 勝敗（0: 敗北, 1: 勝利, 2: 無効試合）          |

**データ取得パターン:**
- ユーザーの試合履歴取得: `user_id` でクエリ、`match_id` 降順で最新50件取得
- `/api/users/me` エンドポイントで自動的に最新50件の試合履歴を含めて返却

**Legacy互換性:**
- 旧システムのテーブル構造を完全踏襲
- namespace, record_id などの不要なフィールドは削除
- team_A, team_B の情報は matches テーブルから取得可能なため削除

## API設計

### RESTful API エンドポイント

#### ユーザー管理
```
GET    /api/users/me                  # 自分の情報取得
POST   /api/users                     # ユーザー作成
PUT    /api/users/me/profile          # プロフィール更新
GET    /api/users/ranking/public      # 公開ランキング取得
```

#### キュー・マッチング
```
GET    /api/queue                     # キュー状況取得
POST   /api/queue/join                # キュー参加
DELETE /api/queue/leave               # キュー離脱
GET    /api/matches/current           # 現在のマッチ取得
PUT    /api/matches/{id}/lobby        # ロビーID更新
POST   /api/matches/{id}/report       # 試合結果報告
```

#### レコード
```
GET    /api/records/me                # 自分の試合履歴
GET    /api/records/match/{id}        # マッチのレコード
GET    /api/records/stats/{userId}    # ユーザー統計
```

### リクエスト・レスポンス パターン

#### 成功レスポンス
```json
{
  "statusCode": 200,
  "headers": {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json"
  },
  "body": {
    "data": {...},
    "message": "Success"
  }
}
```

#### エラーレスポンス
```json
{
  "statusCode": 400,
  "headers": {...},
  "body": {
    "error": "バリデーションエラー",
    "details": {
      "field": "trainer_name",
      "message": "トレーナー名は必須です。"
    }
  }
}
```

### 認証パターン
- **Authorization Header**: `Bearer {JWT_TOKEN}`
- **Lambda Authorizer**: Auth0 JWT 検証
- **User Context**: `event.requestContext.authorizer.lambda.user_id`

## UI/UXデザインパターン

### NamePlateコンポーネント設計

#### レスポンシブサイジング
```typescript
// 幅ベースのフォントサイズ決定
const getFontSize = (width: number) => {
  if (width <= 140) return 'text-[10px]';
  if (width <= 200) return 'text-xs';
  return 'text-sm';
};

// サイズ制約
const sizeClasses = 'min-w-[120px] max-w-[300px] h-8';
```

#### チーム配置パターン
```tsx
// チームBは右寄せレイアウト
const layoutClasses = teamId === 'B' 
  ? 'flex-row-reverse text-right' 
  : 'flex-row text-left';
```

### モーダルデザインシステム

#### 基本構造
```tsx
const Modal = ({ isOpen, onClose, children }) => (
  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto m-4">
      <div className="flex justify-between items-center p-4 border-b">
        <h2>タイトル</h2>
        <button onClick={onClose}>×</button>
      </div>
      <div className="p-4">{children}</div>
    </div>
  </div>
);
```

#### モバイル適応
```css
/* フル画面表示（500px以下） */
@media (max-width: 500px) {
  .modal {
    @apply fixed inset-0 m-0 rounded-none max-w-none max-h-none;
  }
}
```

### フォームバリデーションパターン

#### バリデーション関数
```typescript
export const validateTrainerName = (value: string): string | undefined => {
  if (!value.trim()) return "トレーナー名は必須です。";
  if (value.length > 50) return "トレーナー名は50文字以内で入力してください。";
  return undefined;
};

export const validateTwitterId = (value: string): string | undefined => {
  if (value && !value.startsWith('@')) {
    return "Twitter IDは@マーク付きで入力してください。";
  }
  if (value && value.length > 16) {
    return "Twitter IDは16文字以内で入力してください。";
  }
  return undefined;
};
```

#### フォーム状態管理
```typescript
const useFormValidation = <T>(initialData: T, validators: ValidationSchema<T>) => {
  const [formData, setFormData] = useState<T>(initialData);
  const [errors, setErrors] = useState<ValidationErrors>({});
  
  const validate = (field?: keyof T) => {
    const newErrors: ValidationErrors = {};
    const fieldsToValidate = field ? [field] : Object.keys(validators);
    
    fieldsToValidate.forEach(key => {
      const validator = validators[key as keyof T];
      const error = validator?.(formData[key as keyof T]);
      if (error) newErrors[key as string] = error;
    });
    
    setErrors(prev => ({ ...prev, ...newErrors }));
    return Object.keys(newErrors).length === 0;
  };
  
  return { formData, setFormData, errors, validate };
};
```

## 認証・セキュリティ

### Auth0 認証フロー

1. **フロントエンド**: Auth0 Universal Login
2. **JWT 取得**: `access_token` を取得
3. **API 呼び出し**: `Authorization: Bearer {token}` ヘッダー付き
4. **Lambda Authorizer**: JWT を検証し、ユーザーコンテキストを設定
5. **権限チェック**: ユーザー/管理者ロールベース

### セキュリティパターン

#### JWT検証 (Python)
```python
import jwt
from jwt import PyJWKClient

def verify_jwt_token(token: str, domain: str, audience: str):
    jwks_client = PyJWKClient(f"https://{domain}/.well-known/jwks.json")
    signing_key = jwks_client.get_signing_key_from_jwt(token)
    
    return jwt.decode(
        token,
        signing_key.key,
        algorithms=["RS256"],
        audience=audience,
        issuer=f"https://{domain}/"
    )
```

#### 入力サニタイゼーション
```python
from pydantic import BaseModel, validator

class CreateUserRequest(BaseModel):
    trainer_name: str
    
    @validator('trainer_name')
    def validate_trainer_name(cls, v):
        if not v.strip():
            raise ValueError('トレーナー名は必須です。')
        return v.strip()[:50]  # 長さ制限
```

## リアルタイム機能

### Legacyシステムの通信方式（参考）

#### 情報取得方式の詳細
1. **キュー情報**: WebSocketで`{"action": "updateQueue"}`でリアルタイム更新
2. **ユーザー情報**: 基本的にはポーリング（必要時のみ取得）
3. **マッチング成立通知**: WebSocketで`{"action": "match_found"}`で即座に通知

#### Legacy WebSocket通信フロー
```
1. 接続時: wss://api.unitemate.com/websocket?user_id={user_id}
2. キュー変更時: サーバー → 全接続者に {"action": "updateQueue"} 送信
3. マッチング成立時: サーバー → 該当ユーザーに {"action": "match_found"} 送信
4. フロントエンド: WebSocket受信 → UI即座に更新（ポーリング不要）
```

### 新システムのWebSocket設計

#### 接続管理
```python
# 接続テーブル構造
Connections = {
    "connection_id": str,  # WebSocket接続ID
    "user_id": str,       # ユーザーID  
    "connected_at": int,   # 接続時刻
}
```

#### メッセージタイプ
```typescript
// サーバー → クライアント メッセージ
interface WebSocketMessage {
  action: 'queue_update' | 'match_found' | 'match_cancelled' | 'user_update';
  data: any;
  timestamp: number;
}

// queue_update: キュー状況変更時（参加者数、レート分布等）
// match_found: マッチング成立時（マッチ詳細情報）  
// match_cancelled: マッチキャンセル時
// user_update: ユーザー情報変更時（レート、勲章等）
```

#### バックエンド通知タイミング
```python
# キュー参加/離脱時
async def broadcast_queue_update():
    connections = get_all_connections()
    message = {"action": "queue_update", "data": get_queue_status()}
    await broadcast_to_connections(connections, message)

# マッチング成立時  
async def notify_match_found(user_ids: list, match_data: dict):
    connections = get_connections_by_user_ids(user_ids)
    message = {"action": "match_found", "data": match_data}
    await broadcast_to_connections(connections, message)
```

#### フロントエンド受信ハンドラー
```typescript
const handleWebSocketMessage = (event: MessageEvent) => {
  const message = JSON.parse(event.data);
  
  switch (message.action) {
    case 'queue_update':
      // キュー情報を即座に更新（ポーリング不要）
      updateQueueStatus(message.data);
      break;
    case 'match_found':
      // マッチング画面に自動遷移
      setCurrentMatch(message.data);
      break;
    case 'match_cancelled':
      // マッチ画面から戻る
      setCurrentMatch(null);
      break;
    case 'user_update':
      // ユーザー情報更新
      updateUserInfo(message.data);
      break;
  }
};
```

#### 接続フロー
```typescript
// WebSocket接続確立
const connectWebSocket = () => {
  const ws = new WebSocket(`wss://api.unitemate.com/websocket?user_id=${userId}`);
  
  ws.onmessage = handleWebSocketMessage;
  ws.onopen = () => console.log('WebSocket connected');
  ws.onclose = () => setTimeout(connectWebSocket, 5000); // 再接続
  
  return ws;
};

// ポーリングを完全廃止
// ✅ WebSocketでリアルタイム更新
// ❌ setInterval(fetchQueueStatus, 5000) は不要
```

## エラーハンドリング

### フロントエンドエラーハンドリング

#### API呼び出しパターン
```typescript
const apiCall = async <T>(url: string, options: RequestInit): Promise<T> => {
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAccessToken()}`,
        ...options.headers
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.body?.data || data;
  } catch (error) {
    console.error('API呼び出しエラー:', error);
    throw error;
  }
};
```

#### グローバルエラーハンドラー
```typescript
const ErrorBoundary = ({ children }) => {
  const [hasError, setHasError] = useState(false);
  
  useEffect(() => {
    const handleError = (error: ErrorEvent) => {
      console.error('グローバルエラー:', error);
      setHasError(true);
    };
    
    window.addEventListener('error', handleError);
    return () => window.removeEventListener('error', handleError);
  }, []);
  
  if (hasError) {
    return <div>エラーが発生しました。ページをリロードしてください。</div>;
  }
  
  return children;
};
```

### バックエンドエラーハンドリング

#### 標準エラーレスポンス
```python
def create_error_response(status_code: int, message: str, details: dict = None):
    return {
        "statusCode": status_code,
        "headers": {
            "Access-Control-Allow-Origin": "*",
            "Content-Type": "application/json"
        },
        "body": json.dumps({
            "error": message,
            "details": details or {}
        })
    }
```

#### Lambda例外ハンドリング
```python
def lambda_handler(event, context):
    try:
        # ビジネスロジック
        return create_success_response(result)
    except ValueError as e:
        return create_error_response(400, str(e))
    except Exception as e:
        logger.error(f"予期しないエラー: {e}")
        return create_error_response(500, "内部サーバーエラー")
```

## パフォーマンス最適化

### フロントエンド最適化

#### マスターデータキャッシュ戦略

**設計原則**
- マスターデータ（ポケモン、バッジ、ロール、設定値など）は変更頻度が低いため、アプリケーションライフサイクル中は一度取得すればキャッシュを維持
- 設定値（タイムアウト値など）の変更は非常に稀なため、ページリロード時のみ再取得

**実装戦略**
```typescript
// useMasterData フック - セッション中は一度のみ取得
export const useMasterData = () => {
  const [masterData, setMasterData] = useState<MasterDataResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // 認証状態変更時のみフェッチ（定期フェッチなし）
    if (shouldFetchMasterData()) {
      fetchMasterDataOnce();
    }
  }, [isAuthenticated]);

  return { masterData, loading, error };
};

// 設定値取得ヘルパー - デフォルト値で即座に動作開始
const getSettingValue = (settings: Setting[], key: string, defaultValue: number): number => {
  return settings 
    ? Number(settings.find(s => s.id === key)?.value) || defaultValue
    : defaultValue;
};
```

**タイムアウト設定の取得**
- `lobby_create_timeout`: デフォルト150秒
- `lobby_join_timeout`: デフォルト250秒
- マスターデータ未取得時でもデフォルト値で即座に動作開始
- バックグラウンドで取得完了後に正確な値に更新

#### コンポーネントメモ化
```typescript
const NamePlate = React.memo(({ user, teamId, width }) => {
  const badgeStyle = useMemo(() => 
    getBadgeStyle(user.current_badge, user.current_badge_2),
    [user.current_badge, user.current_badge_2]
  );
  
  const fontSize = useMemo(() => getFontSize(width), [width]);
  
  return (
    <div className={`nameplate ${badgeStyle} ${fontSize}`}>
      {user.trainer_name}
    </div>
  );
});
```

#### デバウンス処理
```typescript
const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
};

// 使用例
const [searchTerm, setSearchTerm] = useState('');
const debouncedSearchTerm = useDebounce(searchTerm, 300);

useEffect(() => {
  if (debouncedSearchTerm) {
    performSearch(debouncedSearchTerm);
  }
}, [debouncedSearchTerm]);
```

### バックエンド最適化

#### DynamoBD バッチ操作
```python
# バッチライト
with rankings_table.batch_writer() as batch:
    for ranking in rankings_data:
        batch.put_item(Item=ranking)

# バッチリード
response = dynamodb.batch_get_item(
    RequestItems={
        'users-table': {
            'Keys': [{'user_id': user_id} for user_id in user_ids]
        }
    }
)
```

#### Lambda 最適化
```python
# コールドスタート最適化
import json
import boto3

# グローバルスコープで初期化
dynamodb = boto3.resource('dynamodb')
users_table = dynamodb.Table(os.environ['USERS_TABLE_NAME'])

def lambda_handler(event, context):
    # ハンドラー内では再初期化しない
    pass
```

## 環境設定・デプロイメント

### 環境変数設定

#### フロントエンド (.env)
```bash
# Auth0設定
VITE_AUTH0_DOMAIN=your-domain.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_AUTH0_AUDIENCE=https://api.unitemate.com

# API設定
VITE_API_BASE_URL=https://api-dev.unitemate.com
VITE_WEBSOCKET_URL=wss://ws-dev.unitemate.com
```

#### バックエンド (serverless.yml)
```yaml
environment:
  AUTH0_DOMAIN: ${env:AUTH0_DOMAIN}
  AUTH0_AUDIENCE: ${env:AUTH0_AUDIENCE}
  USERS_TABLE_NAME: ${self:custom.tableName.users}
  MATCHES_TABLE_NAME: ${self:custom.tableName.matches}
  QUEUE_TABLE_NAME: ${self:custom.tableName.queue}
  RECORDS_TABLE_NAME: ${self:custom.tableName.records}
  RANKINGS_TABLE_NAME: ${self:custom.tableName.rankings}
  CONNECTIONS_TABLE_NAME: ${self:custom.tableName.connections}
  MASTER_DATA_TABLE_NAME: ${self:custom.tableName.masterData}
```

### デプロイメント手順

#### フロントエンド
```bash
# ビルド
npm run build

# 静的ホスティング（Vercel/Netlify/S3）
npm run deploy
```

#### バックエンド
```bash
# 開発環境
cd backend
sls deploy --stage dev

# 本番環境
sls deploy --stage prd
```

### CI/CD パイプライン
```yaml
# GitHub Actions例
name: Deploy
on:
  push:
    branches: [main]
    
jobs:
  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy Backend
        run: |
          cd backend
          npm install
          sls deploy --stage prd
          
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Deploy Frontend
        run: |
          cd frontend
          npm install
          npm run build
          npm run deploy
```

---

## シーズン管理システム設計

### 概要
管理画面からシーズン設定を行い、スケジューラーと各種機能がシーズン期間とマッチ時間の両方をチェックして動作するシステム。

### シーズンデータ構造

#### DynamoDBマスターデータテーブル
```
data_type: "SEASON"
id: [season_id]  # 例: "season_2024_winter"
```

#### シーズンモデル
```typescript
interface Season {
  data_type: "SEASON";
  id: string;              // シーズンID（例：season_2024_winter）
  name: string;            // シーズン名（例：2024年冬シーズン）
  description?: string;    // シーズンの説明
  start_date: number;      // 開始日時（UNIXタイムスタンプ、JST）
  end_date: number;        // 終了日時（UNIXタイムスタンプ、JST）
  image_url?: string;      // シーズンイメージのURL
  theme_color?: string;    // テーマカラー（HEX、デフォルト: #ff6b35）
  is_active: boolean;      // アクティブ状態（同時に1つのみアクティブ可能）
  created_at: number;      // 作成日時
  updated_at: number;      // 更新日時
}
```

### API エンドポイント

#### 管理者用（認証必須）
- `GET /api/admin/seasons` - 全シーズン取得
- `GET /api/admin/seasons/{seasonId}` - シーズン詳細取得
- `POST /api/admin/seasons` - シーズン作成
- `PUT /api/admin/seasons/{seasonId}` - シーズン更新
- `DELETE /api/admin/seasons/{seasonId}` - シーズン削除
- `POST /api/admin/seasons/{seasonId}/activate` - シーズンアクティベート

#### パブリック（認証不要）
- `GET /api/seasons/active` - アクティブシーズン情報取得

### スケジューラー統合設計

#### 統合処理フロー
1. **結果集計** - 完了した試合の結果を処理
2. **ランキング計算** - ユーザーランキングを更新（2分ごと実行で高頻度更新）
3. **マッチメイキング** - 新規マッチを作成

#### 詳細スケジュール設定（レガシー準拠）
```yaml
# 平日午前（JST 00:00-04:00 = UTC 15:00-18:00 前日）
cron(0/2 15-18 ? * SUN,MON,TUE,WED,THU *)

# 平日午後（JST 14:00-23:59 = UTC 05:00-14:59）  
cron(0/2 5-14 ? * MON,TUE,WED,THU,FRI *)

# 金曜日（JST 14:00-23:59 = UTC 05:00-14:59）
cron(0/2 5-14 ? * FRI *)

# 土曜日（終日 = UTC 00:00-23:59）
cron(0/2 * ? * SAT *)

# 日曜日（JST 09:00-翌03:59 = UTC 00:00-18:59）
cron(0/2 0-18 ? * SUN *)
```

#### 二重バリデーション
全てのマッチ関連処理で以下をチェック：
1. **シーズン期間チェック** - アクティブシーズンが存在し、現在時刻が期間内
2. **マッチ時間チェック** - 平日14:00-翌04:00、土日終日の時間内

### バリデーション適用箇所

#### スケジューラー（match_make関数）
```python
# シーズン期間バリデーション
season_service = SeasonService()
if not season_service.is_season_active_now():
    return {"statusCode": 200, "body": "No active season"}

# マッチ時間バリデーション  
if not is_match_time_active():
    return {"statusCode": 200, "body": "Outside match hours"}
```

#### キュー参加（join_queue関数）
```python
# シーズン期間バリデーション
if not season_service.is_season_active_now():
    return create_error_response(400, "現在シーズン期間外のため、キューに参加できません。")

# マッチ時間バリデーション
if not is_match_time_active():
    return create_error_response(400, "現在マッチ時間外です。...")
```

### フロントエンド連携

#### シーズン情報取得
- **取得タイミング**: アプリ読み込み時に1回のみ（マスターデータと同様）
- **表示箇所**: メインページ上部にシーズンバナー表示
- **表示内容**: 
  - シーズン名、期間、説明
  - テーマカラーでのスタイリング
  - 残り日数警告（7日以下）
  - 次シーズン予告

#### 管理画面UI
- **場所**: `/admin_control` の「シーズン管理」タブ
- **機能**:
  - シーズン一覧表示（作成日時順）
  - 新規シーズン作成フォーム
  - シーズン編集・削除
  - アクティベーション（他シーズンは自動非アクティブ化）

### 技術実装詳細

#### SeasonService
```python
class SeasonService:
    def get_active_season() -> Optional[Season]
    def is_season_active_now() -> bool
    def create_season(request: SeasonCreateRequest) -> bool
    def update_season(season_id: str, request: SeasonUpdateRequest) -> bool
    def activate_season(season_id: str) -> bool
```

#### TimeValidator
```python
def is_match_time_active() -> bool:
    """JST時間でマッチ時間判定（平日14:00-翌04:00、土日終日）"""
    
def get_match_schedule_info() -> dict:
    """スケジュール情報取得"""
```

#### フロントエンドHook
```typescript
export const useSeasonInfo = () => {
  // 読み込み時に1回のみ取得（5分間隔更新は削除）
  useEffect(() => {
    fetchSeasonInfo();
  }, []);
}
```

### 運用上の注意点

1. **シーズン切り替え**: 新シーズン開始前にアクティベーションが必要
2. **時間設定**: JST基準での設定、UTCとの時差を考慮
3. **データ整合性**: アクティブシーズンは常に1つのみ
4. **バリデーション**: スケジューラーとキュー参加の両方でチェック
5. **UI更新**: シーズン情報はページリロードで更新（リアルタイム更新なし）

---

**重要**: この設計仕様は確定版です。今後の実装はこの仕様に厳密に従って行ってください。変更が必要な場合は、必ずこのドキュメントを更新してから実装を進めること。