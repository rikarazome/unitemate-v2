# プロフィール情報アーキテクチャ分析・改善提案

## 現在の問題点

### 1. 重複するデータ取得
- **問題**: `useUser`と`useUserInfo`フックが似たようなユーザーデータを取得している
- **影響**: 同一データに対する重複API呼び出し、パフォーマンス低下
- **コスト**: 不要なLambda実行とDynamoDB読み取り

### 2. 非効率なキャッシュ戦略
- **問題**: プロフィール更新時に`refetch(true)`で全データを強制再取得
- **影響**: 編集後に変更されていないデータまで再取得、応答性の低下
- **コスト**: API呼び出し頻度の増加

### 3. データ混在問題
- **問題**: 静的データ（名前、アバター等）と動的データ（レート、試合数等）が一緒に管理
- **影響**: 少ない変更でも大きなデータセット全体を転送
- **コスト**: 帯域幅とレスポンス時間の浪費

### 4. リアルタイム同期の欠如
- **問題**: 勲章獲得、プロフィール変更がリアルタイムで反映されない
- **影響**: ユーザー体験の低下、変更の見落とし
- **コスト**: サポート対応コストの増加

## データ分類

### 静的プロフィールデータ（変更頻度: 低）
```typescript
- trainer_name: string           // トレーナー名
- twitter_id: string            // Twitter ID
- bio: string                   // 自己紹介
- preferred_roles: string[]     // 希望ロール
- favorite_pokemon: string[]    // 好きなポケモン
- current_badge: string         // 装備勲章1
- current_badge_2: string       // 装備勲章2
- owned_badges: string[]        // 所持勲章
- discord_username: string      // Discord名
- discord_avatar_url: string    // Discordアバター
```

### 動的ゲームデータ（変更頻度: 高）
```typescript
- rate: number                  // 現在レート
- max_rate: number             // 最高レート
- match_count: number          // 試合数
- win_count: number            // 勝利数
- win_rate: number             // 勝率
- penalty_count: number        // ペナルティ数
- season_data: SeasonData[]    // シーズンデータ
```

## 改善提案

### Phase 1: 統一プロフィールフックとローカルキャッシュ

#### 目標
- `useUser`と`useUserInfo`の統合
- localStorageによる基本キャッシュ実装
- プロフィール編集の即座反映

#### 実装内容
1. **統一フック作成**: `useProfileStore`
2. **ローカルキャッシュ**: 静的データの24時間キャッシュ
3. **楽観的更新**: プロフィール編集時の即座UI反映

#### 期待効果
- API呼び出し50%削減
- プロフィール編集の応答性向上
- コードの一元化

### Phase 2: API分離とエンドポイント最適化

#### 目標
- 静的データと動的データのAPI分離
- 必要最小限のデータ転送
- 効率的なキャッシュ戦略

#### 実装内容
1. **APIエンドポイント分離**:
   - `GET /api/users/me/profile` - 静的プロフィール（長期キャッシュ）
   - `GET /api/users/me/stats` - 動的統計（短期キャッシュ）
   - `PUT /api/users/me/profile` - 静的データのみ更新

2. **キャッシュヘッダー最適化**:
   - 静的データ: `Cache-Control: max-age=86400` (24時間)
   - 動的データ: `Cache-Control: max-age=300` (5分)

3. **差分更新**:
   - 変更されたフィールドのみ送信
   - ETagによる条件付きリクエスト

#### 期待効果
- データ転送量70%削減
- レスポンス時間50%向上
- サーバー負荷軽減

## WebSocket活用案（Phase 3 検討中）

### 提案内容
- 既存WebSocket基盤の拡張
- リアルタイムプロフィール同期
- 勲章獲得の即座通知
- クロスタブ同期

### 実装案
```typescript
// WebSocketメッセージ拡張
interface ProfileMessage {
  action: 'subscribeProfile' | 'profileUpdate' | 'badgeAcquired';
  data: {
    userId: string;
    changes: Partial<StaticUserData>;
    timestamp: number;
  };
}
```

### 期待効果
- リアルタイム体験の向上
- 多デバイス間の自動同期
- 勲章獲得の即座フィードバック

## 実装優先度

### 高優先度（Phase 1 & 2）
1. **統一プロフィールフック作成** - API呼び出し重複解消
2. **ローカルキャッシュ実装** - プロフィール編集の高速化
3. **API分離** - データ転送最適化

### 検討中（Phase 3）
1. **WebSocket拡張** - リアルタイム同期
2. **クロスタブ同期** - マルチタブ体験向上

## 成功指標

### パフォーマンス
- プロフィール関連API呼び出し: 90%削減目標
- 初期ページロード時間: 60%短縮目標
- プロフィール更新レスポンス: 即座反映

### コスト効率
- Lambda実行回数削減
- DynamoDB読み取り単位削減
- CloudWatch Logsコスト削減

### ユーザー体験
- プロフィール編集の応答性向上
- データ更新の信頼性向上
- リアルタイム通知（Phase 3）

## 技術的リスク

### リスク要因
- **キャッシュ整合性**: 古いデータの表示リスク
- **ブラウザストレージ制限**: localStorage容量制限
- **マイグレーション**: 既存コンポーネントへの影響

### 対策
- **バージョニング**: データの整合性チェック
- **Fallback機能**: キャッシュ失敗時のサーバー取得
- **段階的移行**: 機能フラグによる段階リリース

## 次のアクション

1. **Phase 1実装**: 統一プロフィールフックの作成
2. **Phase 2実装**: API分離とキャッシュ最適化
3. **Phase 3検討**: WebSocket拡張の詳細設計

---

*作成日: 2025-09-20*
*最終更新: 2025-09-20*