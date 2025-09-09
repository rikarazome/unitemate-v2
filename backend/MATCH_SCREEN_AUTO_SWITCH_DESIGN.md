# 自動試合画面切り替え機能 設計書

## 概要
マッチメイキング完了時に参加プレイヤーの画面を自動で試合画面に切り替える機能を実装する。
既存の5秒間隔キューデータフェッチを活用して効率的に実現する。

## 現状分析

### フロントエンド
- `useQueueInfo`フック: 5秒間隔で`/api/queue`をフェッチ
- キューデータ構造:
  ```typescript
  {
    total_waiting: number,
    ongoing_matches: number,
    role_data: {...}
  }
  ```

### バックエンド
- `get_queue_status`: Metaデータから統計情報を返す
- Metaデータ構造（現在）:
  ```python
  {
    "namespace": "default",
    "user_id": "#META#",
    "total_waiting": 0,
    "ongoing_matches": 0,
    "role_data": {...}
  }
  ```

## 設計

### 1. Metaデータ拡張
- `ongoing_match_players`フィールドを追加
- 進行中の試合に参加中のプレイヤーIDリストを保持

```python
# 新しいMetaデータ構造
{
  "namespace": "default", 
  "user_id": "#META#",
  "total_waiting": 0,
  "ongoing_matches": 2,
  "ongoing_match_players": ["user1", "user2", "user3", "user4", ...],
  "role_data": {...}
}
```

### 2. バックエンド修正箇所

#### A. マッチ作成時（matchmaking.py）
**場所**: `create_match_record`関数内
**タイミング**: 試合データ作成後、プレイヤーのassigned_match_id設定後
**処理**: 
```python
# マッチ参加プレイヤーIDを収集
all_player_ids = [p[0] for p in team_a] + [p[0] for p in team_b]

# Metaデータのongoing_match_playersに追加
queue_table.update_item(
    Key={"namespace": NAMESPACE, "user_id": "#META#"},
    UpdateExpression="SET ongoing_match_players = list_append(if_not_exists(ongoing_match_players, :empty), :players)",
    ExpressionAttributeValues={
        ":empty": [],
        ":players": all_player_ids
    }
)
```

#### B. 試合完了時（match_judge.py）
**場所**: `process_match_result`関数内
**タイミング**: 試合ステータスを"done"に更新後、assigned_match_idをリセット後
**処理**:
```python
# 試合参加プレイヤーIDを収集
team_a_ids = [p[0] for p in team_a]
team_b_ids = [p[0] for p in team_b] 
completed_player_ids = team_a_ids + team_b_ids

# Metaデータから削除（DynamoDBでリスト要素削除は複雑なため、再構築する）
# 現在のongoing_match_playersを取得し、完了したプレイヤーを除外して更新
```

#### C. キューデータ取得時（queue.py）
**場所**: `get_queue_status`関数内
**追加**: レスポンスに`ongoing_match_players`を含める
```python
response_body = {
    "total_waiting": total_waiting,
    "ongoing_matches": ongoing,
    "ongoing_match_players": response["Item"].get("ongoing_match_players", []),
    "role_data": role_data,
}
```

### 3. フロントエンド修正箇所

#### A. 型定義拡張
**場所**: `frontend/src/hooks/useUnitemateApi.ts`
```typescript
// QueueInfo型にongoing_match_playersを追加
export interface QueueInfo {
  total_waiting: number;
  ongoing_matches: number;
  ongoing_match_players: string[];  // 追加
  role_data: {...};
}
```

#### B. 自動試合検知ロジック
**場所**: `frontend/src/components/UnitemateApp.tsx`
**タイミング**: `useQueueInfo`でキューデータ取得時
```typescript
useEffect(() => {
  if (!queueInfo || !userInfo || currentMatch) return;
  
  // ongoing_match_playersに自分のIDが含まれているかチェック
  if (queueInfo.ongoing_match_players?.includes(userInfo.user_id)) {
    // 試合情報を取得して画面を切り替え
    getCurrentMatch().then(setCurrentMatch);
  }
}, [queueInfo, userInfo, currentMatch]);
```

## 実装順序
1. Metaデータ構造拡張（queue.py）
2. マッチ作成時の更新処理（matchmaking.py）
3. 試合完了時の更新処理（match_judge.py）
4. フロントエンド型定義・検知ロジック実装

## 注意点
- DynamoDBのリスト操作は複雑なため、ongoing_match_playersの要素削除は慎重に実装
- 複数試合が同時進行する場合のプレイヤーIDの重複を考慮
- エラーハンドリング: ongoing_match_playersが存在しない場合のデフォルト値設定