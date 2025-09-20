# プロフィールキャッシュテスト計画

## テスト対象
- `useProfileStore` の localStorage キャッシュ動作
- 楽観的更新の動作
- パフォーマンス改善の確認

## テストシナリオ

### 1. 初期ロード動作
**期待結果**: サーバーからデータ取得 → localStorage に保存
**確認方法**:
- コンソールログ: `[ProfileStore] Loaded from server and cached`
- Network タブでAPIコール確認
- Application → Local Storage でキャッシュデータ確認

### 2. キャッシュからの読み込み
**期待結果**: 有効期限内はキャッシュから読み込み
**確認方法**:
- ページリロード後、コンソールログ: `[ProfileStore] Loaded from cache`
- Network タブでAPIコールが発生しないことを確認

### 3. プロフィール編集の楽観的更新
**期待結果**: UIが即座に更新され、その後サーバー同期
**確認方法**:
- プロフィール編集時、コンソールログ: `[ProfileStore] Static data updated optimistically:`
- UIが即座に反映されることを確認
- Network タブでPUTリクエスト確認

### 4. キャッシュ期限切れ動作
**期待結果**:
- 静的データ: 24時間後に期限切れ
- 動的データ: 5分後に期限切れ
**確認方法**:
- localStorage のタイムスタンプ確認
- 期限切れ後の再取得確認

### 5. ログアウト時のクリーンアップ
**期待結果**: ログアウト時にキャッシュクリア
**確認方法**:
- ログアウト時、コンソールログ: `[ProfileStore] Cleared on logout`
- localStorage からデータが削除されることを確認

## パフォーマンス確認項目

### API呼び出し削減
- **Before**: `useUser` + `useUserInfo` で重複呼び出し
- **After**: 統一された `useProfileStore` で1回の呼び出し
- **測定**: Network タブでAPI呼び出し回数比較

### 応答性改善
- **Before**: プロフィール編集後にrefetch待ち
- **After**: 楽観的更新で即座反映
- **測定**: 編集からUI反映までの時間

### キャッシュヒット率
- **目標**: 2回目以降のアクセスでキャッシュヒット
- **測定**: サーバーアクセスログとクライアントログの比較

## 検証用のlocalStorageキー

```javascript
// 検証用コンソールコマンド
// キャッシュデータ確認
console.log('Static:', localStorage.getItem('unitemate_static_profile'));
console.log('Dynamic:', localStorage.getItem('unitemate_dynamic_profile'));

// キャッシュタイムスタンプ確認
console.log('Static timestamp:', localStorage.getItem('unitemate_static_profile_timestamp'));
console.log('Dynamic timestamp:', localStorage.getItem('unitemate_dynamic_profile_timestamp'));

// キャッシュクリア（テスト用）
localStorage.removeItem('unitemate_static_profile');
localStorage.removeItem('unitemate_dynamic_profile');
localStorage.removeItem('unitemate_static_profile_timestamp');
localStorage.removeItem('unitemate_dynamic_profile_timestamp');
```

## 既知の制限事項

1. **ブラウザ依存**: localStorage容量制限（通常5-10MB）
2. **同期問題**: 複数タブでの同期は実装予定（Phase 3）
3. **バージョン管理**: データ構造変更時の互換性（今後検討）

## 次のステップ

### Phase 2 準備
- API分離エンドポイントの実装
- 差分更新機能の追加
- ETagサポートの検討

### 測定指標
- **目標API削減率**: 50-90%
- **プロフィール編集応答性**: 即座反映（<100ms）
- **初回ロード時間**: ベースライン測定