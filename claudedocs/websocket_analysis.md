# WebSocket使用状況分析レポート

## 現在の実装状況

### 1. WebSocketの現在の使用方法

#### フロントエンド (useWebSocket.ts)
- **5秒間隔のポーリング**: `askQueueInfo`を5秒ごとに送信してキュー情報を取得
- **60秒間隔のping**: 接続維持のため
- **試合購読機能**: `subscribeMatch`で特定試合の動的データを購読

#### バックエンド (websocket.py)
- **broadcast_queue_update()**: キュー変更時に全接続者へ通知（ただし現在は未使用）
- **notify_match_found()**: マッチ成立時に該当ユーザーへ通知（未使用）
- **broadcast_match_update()**: 試合情報変更時に購読者へ配信

### 2. 通信頻度の分析

#### 現在のトラフィックパターン
```
ユーザー数 N の場合:
- キュー情報取得: N × 12回/分 = 12N リクエスト/分
- ping: N × 1回/分 = N リクエスト/分
- 合計: 13N リクエスト/分

例: 100人同時接続時
- 1,300 リクエスト/分
- 78,000 リクエスト/時
```

#### 問題点
1. **非効率的なポーリング**: キュー状態が変わらなくても5秒ごとに問い合わせ
2. **未活用の機能**: `broadcast_queue_update`が実装されているが使われていない
3. **HTTPとの重複**: ユーザー情報更新がHTTPとWebSocketで重複可能

## 改善案の評価

### 提案1: キュー情報のイベントドリブン化

#### 実装内容
```python
# queue.py - キュー参加/離脱時
def join_queue():
    # 既存の処理...

    # WebSocketでブロードキャスト
    from src.handlers.websocket import broadcast_queue_update
    broadcast_queue_update()  # 全接続者にキュー更新を通知

# useWebSocket.ts - フロントエンド
// 5秒ポーリングを削除し、updateQueueイベントでのみ再取得
case "updateQueue":
    // APIからキュー情報を再取得
    refetchQueueInfo();
```

#### 効果
- **通信量削減**: 13N → 1N リクエスト/分（92%削減）
- **リアルタイム性向上**: 変更があった時のみ即座に更新
- **実装難易度**: 低（既存関数を呼ぶだけ）

### 提案2: ユーザーデータの差分配信

#### 現状の問題
- ユーザープロフィール更新時にHTTP APIで全データを再取得
- レート変更、バッジ装着などの頻繁な更新で通信量増大

#### 実装案
```python
# users.py - プロフィール更新時
def update_profile():
    # 既存の更新処理...

    # 変更された部分のみをWebSocketで配信
    changes = {"rate": new_rate, "updated_at": timestamp}
    broadcast_user_update(user_id, changes)

# フロントエンド
case "user_update":
    // 差分データをローカルステートにマージ
    mergeUserData(message.changes);
```

#### 効果
- HTTPリクエスト削減（プロフィール更新時の再取得が不要）
- データ転送量削減（全データではなく差分のみ）

### 提案3: マッチ情報のリアルタイム更新強化

#### 現在の課題
- ロビーID更新、ホスト変更時にHTTP APIで全データ再取得
- 既に`broadcast_match_update`が実装済みだが活用不足

#### 改善実装
```python
# matches.py
def update_lobby_id():
    # 既存処理...

    # 既存の broadcast_match_update を活用
    from src.handlers.websocket import broadcast_match_update
    broadcast_match_update(match_id, "lobby_id_updated")
```

## 実装優先順位と影響評価

### 優先度1: キュー情報のイベントドリブン化
- **実装工数**: 2時間
- **影響範囲**: 小（既存コードの活用）
- **効果**: 大（通信量92%削減）
- **リスク**: 低（フォールバックとして従来のポーリングも残せる）

### 優先度2: マッチ情報のWebSocket活用
- **実装工数**: 1時間
- **影響範囲**: 小（既存関数の呼び出し追加）
- **効果**: 中（マッチ参加者の体験向上）
- **リスク**: 低

### 優先度3: ユーザーデータの差分配信
- **実装工数**: 4-6時間
- **影響範囲**: 中（新規実装必要）
- **効果**: 中（頻繁な更新時に効果的）
- **リスク**: 中（データ整合性の考慮必要）

## 推奨実装手順

1. **Phase 1（即座に実装可能）**
   - `join_queue`/`leave_queue`に`broadcast_queue_update()`呼び出し追加
   - フロントエンドの5秒ポーリングを削除/調整
   - 既存の`broadcast_match_update`活用

2. **Phase 2（検証後実装）**
   - ユーザーデータ差分配信の設計
   - データ整合性の確保機構
   - エラーハンドリングとフォールバック

## 結論

提案された改善案は技術的に実装可能で、特に**キュー情報のイベントドリブン化は即座に実装でき、大幅な通信量削減（92%）が期待できます**。既存のWebSocket機能が実装済みなので、それらを活用するだけで改善が可能です。

ユーザーデータの差分配信は効果的ですが、データ整合性の考慮が必要なため、段階的な実装を推奨します。