# WebSocket アーキテクチャ設計書

## 概要

Unitemate v2では、リアルタイム通信にWebSocketを使用し、効率的な差分更新システムを実装している。

## アーキテクチャ概要

### 従来のHTTPポーリング方式の課題
- 10秒間隔でのHTTPリクエストによる無駄なトラフィック
- 変更がない場合でも全データを取得する非効率性
- 複数コンポーネント間での状態同期の困難
- リアルタイム性の限界（最大10秒の遅延）

### 新しいWebSocket + DynamoDB Streams方式の利点
- **真のリアルタイム通信**: データ変更を即座に検知・配信
- **効率的な差分更新**: 変更された部分のみを送信
- **低コスト運用**: DynamoDB Streams利用で月額1円未満
- **高いスケーラビリティ**: ユーザー数増加に対応可能

## システム構成

```
[DynamoDB] → [DynamoDB Streams] → [queueStreamProcessor Lambda] → [WebSocket API] → [Frontend]
```

### 1. DynamoDB Streams
- **対象テーブル**: QueueTable
- **設定**: StreamViewType: `NEW_AND_OLD_IMAGES`
- **フィルタ**: #META#レコードのMODIFYイベントのみ処理

### 2. Stream処理Lambda関数 (`queueStreamProcessor`)
- **ハンドラー**: `src/handlers/queue_stream.process_queue_changes`
- **トリガー**: QueueTable DynamoDB Streams
- **機能**:
  - OLD_IMAGE vs NEW_IMAGEの差分計算
  - WebSocketクライアントへの効率的なブロードキャスト

### 3. WebSocket API Gateway
- **接続管理**: connectionsテーブルで接続IDを管理
- **認証**: user_idをクエリパラメータで受け取り
- **ハンドラー**:
  - `wsConnect`: 接続確立
  - `wsDisconnect`: 接続切断
  - `wsDefault`: メッセージ処理

## 差分検知システム

### メッセージ形式

#### 従来の`updateQueue`メッセージ（廃止予定）
```json
{
  "action": "updateQueue"
}
```

#### 新しい`queueDiff`メッセージ
```json
{
  "action": "queueDiff",
  "changes": {
    "total_waiting": {
      "old": 2,
      "new": 3,
      "delta": 1
    },
    "role_queues": {
      "MIDDLE": {
        "old_count": 2,
        "new_count": 3,
        "joined": ["889328415285600378"],
        "left": []
      },
      "BOTTOM_LANE": {
        "old_count": 2,
        "new_count": 3,
        "joined": ["889328415285600378"],
        "left": []
      }
    },
    "ongoing_matches": {
      "old": 0,
      "new": 1,
      "delta": 1
    }
  },
  "timestamp": 1758154671
}
```

### 差分計算ロジック

#### 1. 総待機人数 (`total_waiting`)
- **変更検知**: 新旧の値を比較
- **送信データ**: 変更前後の値とdelta

#### 2. ロール別キュー (`role_queues`)
- **変更検知**: 各ロールのユーザーIDリストを比較
- **送信データ**:
  - 人数の変化 (old_count → new_count)
  - 新規参加ユーザー (joined)
  - 離脱ユーザー (left)

#### 3. 進行中マッチ数 (`ongoing_matches`)
- **変更検知**: 新旧の値を比較
- **送信データ**: 変更前後の値とdelta

## フロントエンド実装

### 1. WebSocket接続管理 (`useWebSocket` Hook)

```typescript
interface UseWebSocketOptions {
  onConnected?: () => void;           // 接続成功時
  onQueueDiff?: (changes: unknown) => void; // 差分更新受信時
  onMatchUpdate?: (dynamicData: MatchDynamicData) => void;
  // その他のイベントハンドラー
}
```

#### 接続フロー
1. **認証確認** → user_idを取得
2. **WebSocket接続** → `wss://[api-id].execute-api.[region].amazonaws.com/[stage]?user_id=[user_id]`
3. **接続成功** → `onConnected()` → 初期キュー情報をHTTP APIで取得
4. **差分受信** → `onQueueDiff()` → 状態を部分更新

### 2. キュー状態管理 (`useQueueInfo` Hook)

```typescript
export const useQueueInfo = () => {
  return {
    queueInfo: QueueInfo | null;
    updateQueueInfo: (info: QueueInfo) => void; // 差分更新用
    refetch: () => Promise<void>;              // 初期取得用
  };
};
```

#### 状態更新フロー
1. **初期データ取得**: WebSocket接続成功時にHTTP APIを1回呼び出し
2. **差分更新**: WebSocketで受信した差分を既存状態に適用
3. **UI反映**: 更新された状態を外部プロップとしてコンポーネントに渡す

### 3. 差分更新処理 (`updateQueueInfoFromDiff`)

```typescript
const updateQueueInfoFromDiff = useCallback((changes: any) => {
  const updatedQueueInfo = { ...queueInfo };

  // 総待機人数の更新
  if (changes.total_waiting) {
    updatedQueueInfo.total_waiting = changes.total_waiting.new;
  }

  // ロール別キューの更新
  if (changes.role_queues) {
    for (const [role, change] of Object.entries(changes.role_queues)) {
      updatedQueueInfo.role_counts[role] = change.new_count;
    }
  }

  updateQueueInfo(updatedQueueInfo);
}, [queueInfo, updateQueueInfo]);
```

## 環境設定

### バックエンド環境変数

```yaml
# WebSocket関連Lambda関数共通
CONNECTIONS_TABLE_NAME: ${self:custom.tableName.connections}
WEBSOCKET_API_ID: !Ref WebsocketsApi
AWS_STAGE: ${sls:stage}

# キュー操作関数追加設定
QUEUE_TABLE_NAME: ${self:custom.tableName.queue}
```

### フロントエンド環境変数

```env
VITE_WEBSOCKET_URL=wss://[api-id].execute-api.ap-northeast-1.amazonaws.com/dev
```

## デプロイメント設定

### DynamoDB Streams有効化

```yaml
QueueTable:
  Type: AWS::DynamoDB::Table
  Properties:
    StreamSpecification:
      StreamViewType: NEW_AND_OLD_IMAGES
```

### Stream処理Lambda

```yaml
queueStreamProcessor:
  handler: src/handlers/queue_stream.process_queue_changes
  events:
    - stream:
        type: dynamodb
        arn: !GetAtt QueueTable.StreamArn
        batchSize: 10
        startingPosition: TRIM_HORIZON
        filterCriteria:
          filters:
            - eventName: [MODIFY]
              dynamodb:
                Keys:
                  user_id:
                    S: ["#META#"]
```

## パフォーマンスとコスト

### DynamoDB Streams使用量とコスト

```
想定使用量:
- ピーク同時ユーザー: 100人
- 1時間あたりのキュー操作: 200回
- 月間Stream読み込み: 72,000回

コスト計算:
- 月額: $0.02 × (72,000 ÷ 100,000) = $0.014
- 年額: 約$0.17 (約25円)
```

### WebSocket接続コスト

```
- 接続料金: $1.00 per million connections
- メッセージ料金: $1.00 per million messages
- 実際の月額コスト: 10円未満（想定使用量）
```

## ログとモニタリング

### CloudWatch Logs確認箇所

1. **Stream処理ログ**: `/aws/lambda/unitemate-v2-[stage]-queueStreamProcessor`
2. **WebSocket接続ログ**: `/aws/lambda/unitemate-v2-[stage]-wsConnect`
3. **キュー操作ログ**: `/aws/lambda/unitemate-v2-[stage]-joinQueue`, `/aws/lambda/unitemate-v2-[stage]-leaveQueue`

### 主要なログメッセージ

```
[QueueStream] Processing #META# modification
[QueueStream] Queue changes detected: {...}
[QueueStream] Diff broadcast complete: X/Y sent
[WebSocket] Connected - fetching initial queue info
[QueueDiff] Applying changes: {...}
```

## トラブルシューティング

### よくある問題と解決策

#### 1. 差分更新が動作しない
- **確認点**: CloudWatch LogsでqueueStreamProcessorの実行を確認
- **原因**: 環境変数`WEBSOCKET_API_ID`の未設定
- **解決**: serverless.ymlで環境変数を設定

#### 2. WebSocket接続エラー
- **確認点**: フロントエンドで接続URLが正しく設定されているか
- **原因**: `VITE_WEBSOCKET_URL`の設定ミス
- **解決**: 正しいWebSocket URLを環境変数に設定

#### 3. 初期キュー情報が表示されない
- **確認点**: WebSocket接続成功ログとHTTP API呼び出しログ
- **原因**: `onConnected`コールバックが動作していない
- **解決**: useWebSocket hookの実装を確認

## 今後の拡張予定

### マッチング状態のリアルタイム更新
- マッチ成立時の即座な画面遷移
- ピック・バン状況のリアルタイム同期
- 試合結果報告の即時反映

### 接続品質の向上
- 接続断対応の強化
- 自動再接続機能の改善
- エラーハンドリングの詳細化

### 監視とアラート
- 接続数の監視
- エラー率の追跡
- パフォーマンスメトリクスの収集

---

**更新履歴**
- 2025-01-18: 初版作成 - DynamoDB Streams + WebSocket差分更新システム実装