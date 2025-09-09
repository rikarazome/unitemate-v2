import random
import uuid

# 重要: キューシステムとマッチシステムは別物
# - キュー: ユーザーがマッチングを待つための待機システム
# - マッチ: キューに十分な人数が集まった後に作られる実際の対戦
# 現在はキューの入退室とキュー情報表示のみを実装中
# マッチメイキング機能は後で実装予定
from ..models.queue import InQueueRequest, QueueEntry
from ..repositories.queue_repository import QueueRepository
from ..services.user_service import UserService


class QueueService:
    def __init__(self):
        self.queue_repository = QueueRepository()
        self.user_service = UserService()
        # match_serviceは現在不要（マッチメイキング実装時に追加予定）

    def get_queue_status(self) -> dict:
        """キューの現在状態を取得

        現在キューで待機中のプレイヤー情報を返す
        """
        entries = self.queue_repository.get_all_entries()

        # キュー情報を整理
        queue_info = {"total_players": len(entries), "players": []}

        for entry in entries:
            # ユーザー詳細情報を取得
            user = self.user_service.get_user_by_user_id(entry.user_id)
            if user:
                player_info = {
                    "user_id": entry.user_id,
                    "trainer_name": user.trainer_name,
                    "discord_username": user.discord_username,
                    "selected_roles": entry.selected_roles,
                    "inqueued_at": entry.inqueued_at,
                }
                queue_info["players"].append(player_info)

        return queue_info

    def join_queue(self, auth0_user_id: str, request: InQueueRequest) -> bool:
        """キューに参加

        Args:
            auth0_user_id: Auth0のユーザーID
            request: キュー参加リクエスト

        Returns:
            参加成功時True、失敗時False
        """
        # ユーザー情報を取得
        user = self.user_service.get_user_by_auth0_sub(auth0_user_id)
        if not user:
            print(f"User not found for auth0_sub: {auth0_user_id}")
            return False

        # 既にキューに入っているかチェック
        existing_entry = self.queue_repository.get_entry_by_user(user.user_id)
        if existing_entry:
            print(f"User {user.user_id} already in queue")
            return False

        # キューエントリを作成
        entry = QueueEntry.create_new_entry(
            user_id=user.user_id, selected_roles=request.selected_roles, blocking=request.blocking
        )

        # キューに追加
        success = self.queue_repository.add_entry(entry)
        if success:
            print(f"User {user.user_id} joined queue with roles {request.selected_roles}")

        return success

    def leave_queue(self, auth0_user_id: str) -> bool:
        """キューから離脱

        Args:
            auth0_user_id: Auth0のユーザーID

        Returns:
            離脱成功時True、失敗時False
        """
        # ユーザー情報を取得
        user = self.user_service.get_user_by_auth0_sub(auth0_user_id)
        if not user:
            print(f"User not found for auth0_sub: {auth0_user_id}")
            return False

        # キューから削除
        success = self.queue_repository.remove_entry(user.user_id)
        if success:
            print(f"User {user.user_id} left queue")

        return success

    def get_user_queue_status(self, auth0_user_id: str) -> dict | None:
        """ユーザーのキュー状態を取得

        Args:
            auth0_user_id: Auth0のユーザーID

        Returns:
            キュー状態情報、キューにいない場合None
        """
        # ユーザー情報を取得
        user = self.user_service.get_user_by_auth0_sub(auth0_user_id)
        if not user:
            print(f"User not found for auth0_sub: {auth0_user_id}")
            return None

        # キューエントリを取得
        entry = self.queue_repository.get_entry_by_user(user.user_id)
        if not entry:
            return None

        # キュー状態を返す
        return {
            "user_id": entry.user_id,
            "selected_roles": entry.selected_roles,
            "inqueued_at": entry.inqueued_at,
            "position_in_queue": self._get_queue_position(entry),
        }

    def _get_queue_position(self, entry: QueueEntry) -> int:
        """キュー内での位置を取得（参考情報）"""
        all_entries = self.queue_repository.get_all_entries()
        # 参加時刻の早い順にソート
        sorted_entries = sorted(all_entries, key=lambda x: x.inqueued_at)

        for i, queue_entry in enumerate(sorted_entries):
            if queue_entry.user_id == entry.user_id:
                return i + 1  # 1-indexed

        return -1  # 見つからない場合

    def process_matchmaking(self) -> list:
        """マッチメイキング処理（定期実行）

        注意: 現在はキューシステムのみ実装中のため、実際のマッチメイキングは行わない
        将来的にマッチメイキング機能を実装する際に拡張予定
        """
        print("Matchmaking process called, but not implemented yet")
        return []  # 現在は何もマッチを作成しない
