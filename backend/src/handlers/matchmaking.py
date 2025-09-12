"""
マッチメイクハンドラー - Legacy互換の新システム

新マッチメイクアルゴリズムとLegacyのインフラを統合し、
2分間隔でマッチメイクを実行する。

主な機能:
- キューロック機構による同時実行防止
- 新マッチメイクアルゴリズム (matchmake_top_first) の統合
- ロール割り当て付きマッチレコード作成
- VC割り当てシステム
- 詳細ログ出力とエラーハンドリング
"""

import json
import logging
import os
import random
import time
import traceback
from typing import Any

import boto3
from botocore.exceptions import ClientError

from src.repositories.queue_repository import QueueRepository
from src.services.discord_service import send_discord_match_notification
from src.services.season_service import SeasonService
from src.utils.response import create_error_response, create_success_response
from decimal import Decimal
from boto3.dynamodb.conditions import Key

# DynamoDBクライアント
dynamodb = boto3.resource("dynamodb")

# 環境変数からテーブル名を取得
QUEUE_TABLE_NAME = os.environ["QUEUE_TABLE_NAME"]
MATCHES_TABLE_NAME = os.environ["MATCHES_TABLE_NAME"]
USERS_TABLE_NAME = os.environ["USERS_TABLE_NAME"]
RECORDS_TABLE_NAME = os.environ["RECORDS_TABLE_NAME"]
RANKINGS_TABLE_NAME = os.environ.get("RANKINGS_TABLE_NAME")

# テーブルオブジェクト
queue_table = dynamodb.Table(QUEUE_TABLE_NAME)
matches_table = dynamodb.Table(MATCHES_TABLE_NAME)
users_table = dynamodb.Table(USERS_TABLE_NAME)
records_table = dynamodb.Table(RECORDS_TABLE_NAME)
rankings_table = dynamodb.Table(RANKINGS_TABLE_NAME) if RANKINGS_TABLE_NAME else None

# ロガー設定
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# 定数
ROLES = ["TOP", "MID", "BOTTOM", "SUPPORT", "TANK"]
SLOTS = [(r, k) for r in ROLES for k in range(2)]  # 10スロット
NAMESPACE = "default"  # Legacy互換のnamespace


def matchmake_top_first(queue: list[dict]) -> list[dict[str, list[dict]]]:
    """
    新マッチメイクアルゴリズム（複数試合対応）
    queue: [{'id': str, 'rating': int|float, 'roles': List[str]}, ...]
           - rating 降順で渡すのが前提
    戻り値: [{'teamA': [...], 'teamB': [...]}, ...] / マッチ不可なら []
    """
    n = len(queue)
    if n < 10:
        logger.info(f"Insufficient players for matchmaking: {n} < 10")
        return []

    # 同時に作成可能な最大試合数を計算
    max_matches = n // 10
    logger.info(f"Starting matchmaking with {n} players, max possible matches: {max_matches}")
    
    matches = []
    remaining_queue = queue.copy()

    # ---------- 二部グラフ完全マッチ (DFS) ----------
    def find_matching(m: int, current_queue: list):
        adj = [[] for _ in range(m)]  # localP -> slotIdx
        for idx in range(m):
            pref = set(current_queue[idx]["roles"])
            for sIdx, (role, _) in enumerate(SLOTS):
                if role in pref:
                    adj[idx].append(sIdx)

        slot_of = [-1] * len(SLOTS)  # slotIdx -> localP

        def dfs(u, seen):
            for sIdx in adj[u]:
                if seen[sIdx]:
                    continue
                seen[sIdx] = True
                if slot_of[sIdx] == -1 or dfs(slot_of[sIdx], seen):
                    slot_of[sIdx] = u
                    return True
            return False

        chosen_local = [False] * m
        for u in range(m):  # 先頭優先
            seen = [False] * len(SLOTS)
            if dfs(u, seen):
                chosen_local[u] = True
        if sum(chosen_local) < len(SLOTS):
            return False, []
        return True, slot_of

    # 複数試合を順次作成
    for match_num in range(max_matches):
        current_n = len(remaining_queue)
        if current_n < 10:
            logger.info(f"Match {match_num + 1}: Insufficient remaining players: {current_n} < 10")
            break
            
        logger.info(f"Creating match {match_num + 1} with {current_n} remaining players")

        # ---------- 1) 先頭プレフィックスを最小化 ----------
        prefix = 10
        slot_map = []
        while prefix <= current_n:
            ok, slot_map = find_matching(prefix, remaining_queue)
            if ok:
                logger.info(f"Match {match_num + 1}: Found valid assignment with {prefix} players")
                break
            prefix += 1
        else:
            logger.warning(f"Match {match_num + 1}: No valid assignment found with {current_n} players")
            break

        # ---------- 2) ロール→プレイヤー2名ずつ ----------
        role_to_idx = {r: [] for r in ROLES}
        for sIdx, localP in enumerate(slot_map):
            qIdx = localP  # prefix 部分なので同じ
            role = SLOTS[sIdx][0]
            role_to_idx[role].append(qIdx)

        # ---------- 3) 2^5 通りで最小レート差 ----------
        total = sum(remaining_queue[i]["rating"] for v in role_to_idx.values() for i in v)
        target = total / 2
        best = None  # (diff, A_idx, B_idx)
        for mask in range(1 << 5):
            A, B = [], []
            for bit, role in enumerate(ROLES):
                i1, i2 = role_to_idx[role]
                if (mask >> bit) & 1:
                    A.append(i2)
                    B.append(i1)
                else:
                    A.append(i1)
                    B.append(i2)
            diff = abs(sum(remaining_queue[i]["rating"] for i in A) - target)
            if best is None or diff < best[0]:
                best = (diff, A, B)
        _, A_idx, B_idx = best

        logger.info(f"Match {match_num + 1}: Team balance - Rating difference: {best[0]:.2f}")

        # ---------- 4) 結果構築 ----------
        teamA, teamB = [], []
        matched_indices = set()
        for role in ROLES:
            i1, i2 = role_to_idx[role]
            matched_indices.update([i1, i2])
            if i1 in A_idx:
                teamA.append({"player": remaining_queue[i1], "role": role})
                teamB.append({"player": remaining_queue[i2], "role": role})
            else:
                teamA.append({"player": remaining_queue[i2], "role": role})
                teamB.append({"player": remaining_queue[i1], "role": role})

        matches.append({"teamA": teamA, "teamB": teamB})
        logger.info(f"Match {match_num + 1}: Successfully created")

        # マッチしたプレイヤーを残りキューから削除
        remaining_queue = [player for i, player in enumerate(remaining_queue) if i not in matched_indices]
        logger.info(f"Match {match_num + 1}: {len(matched_indices)} players matched, {len(remaining_queue)} players remaining")

    logger.info(f"Matchmaking completed: {len(matches)} matches created")
    return matches


def acquire_lock() -> bool:
    """
    キューロックを取得
    戻り値: True=成功、False=失敗
    """
    try:
        queue_table.update_item(
            Key={"namespace": NAMESPACE, "user_id": "#META#"},
            UpdateExpression="SET #lock = :lock_value",
            ExpressionAttributeNames={"#lock": "lock"},
            ExpressionAttributeValues={":lock_value": 1},
        )
        logger.info("Queue lock acquired successfully")
        return True
    except ClientError as e:
        logger.error(f"Failed to acquire lock: {e}")
        return False


def release_lock() -> bool:
    """
    キューロックを解放
    戻り値: True=成功、False=失敗
    """
    try:
        queue_table.update_item(
            Key={"namespace": NAMESPACE, "user_id": "#META#"},
            UpdateExpression="SET #lock = :lock_value",
            ExpressionAttributeNames={"#lock": "lock"},
            ExpressionAttributeValues={":lock_value": 0},
        )
        logger.info("Queue lock released successfully")
        return True
    except ClientError as e:
        logger.error(f"Failed to release lock: {e}")
        return False


def is_locked() -> bool:
    """
    キューロック状態を確認
    戻り値: True=ロック中、False=アンロック
    """
    try:
        response = queue_table.get_item(Key={"namespace": NAMESPACE, "user_id": "#META#"})
        if "Item" in response:
            return response["Item"].get("lock", 0) == 1
        return False
    except ClientError as e:
        logger.error(f"Failed to check lock status: {e}")
        return False


def get_queue_players() -> list[dict[str, Any]]:
    """
    キューからプレイヤーデータを取得
    戻り値: プレイヤーリスト
    """
    try:
        # 全キューエントリを取得
        from boto3.dynamodb.conditions import Attr

        response = queue_table.scan(FilterExpression=Attr("user_id").ne("#META#") & Attr("namespace").eq(NAMESPACE))

        players = []
        for item in response.get("Items", []):
            user_id = item.get("user_id")

            # usersテーブルから最新レートを取得
            try:
                user_response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})
                if "Item" not in user_response:
                    logger.warning(f"User {user_id} not found in users table, skipping")
                    continue

                user_data = user_response["Item"]
                current_rate = int(user_data.get("rate", 1500))
            except Exception as e:
                logger.error(f"Failed to get user data for {user_id}: {e}")
                current_rate = 1500  # フォールバック

            # selected_rolesを取得
            selected_roles = item.get("selected_roles", ["TOP_LANE"])

            # DynamoDBのList形式から文字列リストに変換
            if isinstance(selected_roles, list):
                roles_list = []
                for role_item in selected_roles:
                    if isinstance(role_item, dict) and "S" in role_item:
                        roles_list.append(role_item["S"])
                    elif isinstance(role_item, str):
                        roles_list.append(role_item)

                # Legacy形式をUnite形式に変換
                roles_array = []
                for role in roles_list:
                    # Legacy形式（TOP, MID等）をUnite形式（TOP_LANE, MIDDLE等）に変換
                    if role == "TOP_LANE":
                        roles_array.append("TOP")
                    elif role == "MIDDLE":
                        roles_array.append("MID")
                    elif role == "BOTTOM_LANE":
                        roles_array.append("BOTTOM")
                    elif role == "SUPPORT":
                        roles_array.append("SUPPORT")
                    elif role == "TANK":
                        roles_array.append("TANK")
                    else:
                        # 既にLegacy形式の場合はそのまま
                        roles_array.append(role)
            else:
                # フォールバック
                roles_array = ["TOP"]

            player_data = {
                "id": user_id,
                "rating": float(current_rate),  # usersテーブルから取得した最新レート
                "roles": roles_array,  # 新アルゴリズム用：配列形式
                # Legacy互換のため元データも保持
                "original_data": item,
            }
            players.append(player_data)

        # ランダムに昇順または降順でソート（50%ずつ）
        is_descending = random.random() < 0.5  # 50%の確率でTrue
        players.sort(key=lambda x: x["rating"], reverse=is_descending)
        
        sort_order = "descending" if is_descending else "ascending"
        logger.info(f"Sorting players by rate in {sort_order} order")

        logger.info(f"Retrieved {len(players)} players from queue")

        # デバッグ用：プレイヤーのロール希望を出力
        for player in players:
            logger.info(f"Player {player['id']}: rate={player['rating']}, roles={player['roles']}")

        return players

    except ClientError as e:
        logger.error(f"Failed to get queue players: {e}")
        return []


def assign_voice_channels() -> tuple[int, int]:
    """
    VC割り当て（QueueRepository使用）
    戻り値: (vc_a, vc_b) のタプル
    """
    try:
        queue_repo = QueueRepository()

        # 1つのVC番号を取得（チームA用の奇数）
        used_vcs = queue_repo.use_vc_channels(1)

        if not used_vcs or len(used_vcs) < 1:
            raise Exception("UnusedVCが不足しています。")

        # VC割り当て
        vc_a = used_vcs[0]  # チームA: 奇数
        vc_b = vc_a + 1  # チームB: 奇数+1の偶数

        logger.info(f"Assigned VCs: Team A={vc_a}, Team B={vc_b}")
        return vc_a, vc_b

    except Exception as e:
        logger.error(f"Failed to assign voice channels: {e}")
        raise


def get_next_match_id() -> int:
    """
    次のマッチIDを取得・更新（QueueRepository使用）
    戻り値: 新しいマッチID
    """
    try:
        queue_repo = QueueRepository()

        # 現在のメタデータを取得
        meta = queue_repo.get_meta()
        if not meta:
            raise Exception("Queue metadata not found")

        # 新しいマッチIDを生成
        new_match_id = meta.latest_match_id + 1

        # メタデータを更新
        success = queue_repo.update_latest_match_id(new_match_id)
        if not success:
            raise Exception("Failed to update latest match ID")

        logger.info(f"Generated new match ID: {new_match_id}")
        return new_match_id

    except Exception as e:
        logger.error(f"Failed to get next match ID: {e}")
        raise


def create_match_record(
    match_id: int, team_a_data: list[dict], team_b_data: list[dict], vc_a: int, vc_b: int
) -> dict[str, Any]:
    """
    マッチレコードを作成（新フォーマット）

    Args:
        match_id: マッチID
        team_a_data: チームAのプレイヤー・ロールデータ
        team_b_data: チームBのプレイヤー・ロールデータ
        vc_a: チームAのVC番号
        vc_b: チームBのVC番号

    Returns:
        作成されたマッチレコード

    """
    try:
        # 新フォーマット: オブジェクト形式で詳細情報を含める
        team_a_formatted = []
        team_b_formatted = []

        # チームAの処理: usersテーブルから詳細情報を取得
        for player_role in team_a_data:
            player = player_role["player"]
            role = player_role["role"]
            user_id = player["id"]

            # usersテーブルから詳細情報を取得
            try:
                user_response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})
                if "Item" in user_response:
                    user_data = user_response["Item"]
                    current_rate = int(user_data.get("rate", 1500))
                    best_rate = int(user_data.get("max_rate", current_rate))

                    # 詳細なプレイヤー情報をオブジェクト形式で作成
                    formatted = {
                        "user_id": user_id,
                        "trainer_name": user_data.get("trainer_name", user_id),
                        "discord_username": user_data.get("discord_username"),
                        "discord_avatar_url": user_data.get("discord_avatar_url"),
                        "twitter_id": user_data.get("twitter_id"),
                        "rate": Decimal(current_rate),
                        "best_rate": Decimal(best_rate),
                        "current_badge": user_data.get("current_badge"),
                        "current_badge_2": user_data.get("current_badge_2"),
                        "role": role,
                        "preferred_roles": user_data.get("preferred_roles", []),
                        "favorite_pokemon": user_data.get("favorite_pokemon", []),
                        "bio": user_data.get("bio", ""),
                    }
                else:
                    # デフォルト値
                    formatted = {
                        "user_id": user_id,
                        "trainer_name": user_id,
                        "rate": 1500,
                        "best_rate": 1500,
                        "role": role,
                        "preferred_roles": [],
                        "favorite_pokemon": [],
                        "bio": "",
                    }
            except Exception as e:
                logger.error(f"Failed to get user data for {user_id}: {e}")
                formatted = {
                    "user_id": user_id,
                    "trainer_name": user_id,
                    "rate": Decimal(1500),
                    "best_rate": Decimal(1500),
                    "role": role,
                    "preferred_roles": [],
                    "favorite_pokemon": [],
                    "bio": "",
                }

            team_a_formatted.append(formatted)

        # チームBの処理: usersテーブルから詳細情報を取得
        for player_role in team_b_data:
            player = player_role["player"]
            role = player_role["role"]
            user_id = player["id"]

            # usersテーブルから詳細情報を取得
            try:
                user_response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})
                if "Item" in user_response:
                    user_data = user_response["Item"]
                    current_rate = int(user_data.get("rate", 1500))
                    best_rate = int(user_data.get("max_rate", current_rate))

                    # 詳細なプレイヤー情報をオブジェクト形式で作成
                    formatted = {
                        "user_id": user_id,
                        "trainer_name": user_data.get("trainer_name", user_id),
                        "discord_username": user_data.get("discord_username"),
                        "discord_avatar_url": user_data.get("discord_avatar_url"),
                        "twitter_id": user_data.get("twitter_id"),
                        "rate": Decimal(current_rate),
                        "best_rate": Decimal(best_rate),
                        "current_badge": user_data.get("current_badge"),
                        "current_badge_2": user_data.get("current_badge_2"),
                        "role": role,
                        "preferred_roles": user_data.get("preferred_roles", []),
                        "favorite_pokemon": user_data.get("favorite_pokemon", []),
                        "bio": user_data.get("bio", ""),
                    }
                else:
                    # デフォルト値
                    formatted = {
                        "user_id": user_id,
                        "trainer_name": user_id,
                        "rate": 1500,
                        "best_rate": 1500,
                        "role": role,
                        "preferred_roles": [],
                        "favorite_pokemon": [],
                        "bio": "",
                    }
            except Exception as e:
                logger.error(f"Failed to get user data for {user_id}: {e}")
                formatted = {
                    "user_id": user_id,
                    "trainer_name": user_id,
                    "rate": Decimal(1500),
                    "best_rate": Decimal(1500),
                    "role": role,
                    "preferred_roles": [],
                    "favorite_pokemon": [],
                    "bio": "",
                }

            team_b_formatted.append(formatted)

        # マッチレコード作成（DynamoDB用にDecimal変換）
        match_record = {
            "namespace": NAMESPACE,
            "match_id": Decimal(match_id),
            "team_a": team_a_formatted,
            "team_b": team_b_formatted,
            "matched_unixtime": Decimal(int(time.time())),
            "status": "matched",
            "user_reports": [],
            "penalty_player": [],
            "judge_timeout_count": Decimal(0),
            "vc_a": vc_a,
            "vc_b": vc_b,
        }

        # DynamoDBに保存
        matches_table.put_item(Item=match_record)

        # 進行中試合リストに追加
        queue_repo = QueueRepository()
        queue_repo.add_ongoing_matches([match_id])

        logger.info(f"Match record created: ID={match_id}, VC_A={vc_a}, VC_B={vc_b}, added to ongoing matches")
        return match_record

    except ClientError as e:
        logger.error(f"Failed to create match record: {e}")
        raise


def update_ongoing_match_players_add(team_a_data: list[dict], team_b_data: list[dict]) -> bool:
    """
    進行中試合に参加するプレイヤーIDリストを更新（追加）
    自動試合画面切り替え機能のためのMETAデータ更新

    Args:
        team_a_data: チームAのプレイヤー・ロールデータ
        team_b_data: チームBのプレイヤー・ロールデータ

    Returns:
        成功したかどうか

    """
    try:
        # 全プレイヤーIDを収集
        all_player_ids = []

        for player_role in team_a_data:
            user_id = player_role["player"]["original_data"]["user_id"]
            all_player_ids.append(user_id)

        for player_role in team_b_data:
            user_id = player_role["player"]["original_data"]["user_id"]
            all_player_ids.append(user_id)

        # METAデータのongoing_match_playersに追加
        queue_table.update_item(
            Key={"namespace": NAMESPACE, "user_id": "#META#"},
            UpdateExpression="SET ongoing_match_players = list_append(if_not_exists(ongoing_match_players, :empty), :players)",
            ExpressionAttributeValues={":empty": [], ":players": all_player_ids},
        )

        logger.info(f"Added {len(all_player_ids)} players to ongoing_match_players: {all_player_ids}")
        return True

    except ClientError as e:
        logger.error(f"Failed to update ongoing_match_players: {e}")
        return False


def remove_matched_players(players: list[dict]) -> bool:
    """
    マッチしたプレイヤーをキューから削除

    Args:
        players: 削除するプレイヤーリスト

    Returns:
        成功したかどうか

    """
    try:
        # プレイヤーIDとロール情報を収集
        removed_players = {}
        for player_role in players:
            user_id = player_role["player"]["original_data"]["user_id"]
            selected_roles = player_role["player"]["original_data"].get("selected_roles", [])
            removed_players[user_id] = selected_roles

        # バッチでキューから削除
        with queue_table.batch_writer() as batch:
            for user_id in removed_players.keys():
                batch.delete_item(Key={"namespace": NAMESPACE, "user_id": user_id})

        logger.info(f"Removed {len(removed_players)} matched players from queue")

        # メタ情報を更新（total_waitingとrole_queues）
        update_meta_after_removal(removed_players)
        
        return True

    except ClientError as e:
        logger.error(f"Failed to remove matched players: {e}")
        return False


def update_meta_after_removal(removed_players: dict) -> bool:
    """
    プレイヤー削除後にメタ情報を更新
    
    Args:
        removed_players: 削除されたプレイヤーのIDとロール情報の辞書
    
    Returns:
        成功したかどうか
    """
    try:
        # 現在のメタ情報を取得
        resp = queue_table.get_item(Key={"namespace": NAMESPACE, "user_id": "#META#"})
        if "Item" not in resp:
            logger.warning("Meta data not found during update_meta_after_removal")
            return False
            
        meta_item = resp["Item"]
        role_queues = meta_item.get("role_queues", {})
        total_waiting = meta_item.get("total_waiting", 0)
        
        # 削除されたプレイヤーをロール別キューから削除
        for user_id, selected_roles in removed_players.items():
            for role in selected_roles:
                if role in role_queues and user_id in role_queues[role]:
                    role_queues[role].remove(user_id)
        
        # 総待機人数を再計算（ユニークなユーザーIDの数）
        all_users = set()
        for users in role_queues.values():
            all_users.update(users)
        total_waiting = len(all_users)
        
        # メタデータを更新（role_queuesとtotal_waitingのみ）
        queue_table.update_item(
            Key={"namespace": NAMESPACE, "user_id": "#META#"},
            UpdateExpression="SET total_waiting = :tw, role_queues = :rq",
            ExpressionAttributeValues={
                ":tw": total_waiting,
                ":rq": role_queues,
            },
        )
        
        logger.info(f"Updated meta after removal: total_waiting={total_waiting}")
        return True
        
    except ClientError as e:
        logger.error(f"Failed to update meta after removal: {e}")
        return False


def update_assigned_match_ids(players: list[dict], match_id: int) -> bool:
    """
    マッチしたプレイヤーのassigned_match_idを設定（Legacy準拠）

    Args:
        players: マッチしたプレイヤーリスト（チームA + チームB）
        match_id: 設定するマッチID

    Returns:
        成功したかどうか

    """
    try:
        for player_role in players:
            user_id = player_role["player"]["original_data"]["user_id"]
            users_table.update_item(
                Key={"namespace": NAMESPACE, "user_id": user_id},
                UpdateExpression="SET assigned_match_id = :m",
                ExpressionAttributeValues={":m": match_id},
            )

        logger.info(f"Updated assigned_match_id for {len(players)} players to match_id={match_id}")
        return True

    except ClientError as e:
        logger.error(f"Failed to update assigned_match_ids: {e}")
        return False


def update_queue_meta() -> bool:
    """
    キューメタ情報を更新（Legacy準拠）
    キューに残っているプレイヤーの情報に基づいてMETAデータを更新
    ongoing_matchesも正確にカウントする

    Returns:
        成功したかどうか

    """
    try:
        from boto3.dynamodb.conditions import Attr, Key

        # キューに残っているプレイヤー情報を取得
        response = queue_table.scan(
            FilterExpression=Attr("user_id").ne("#META#") & Attr("namespace").eq(NAMESPACE),
            ProjectionExpression="user_id, selected_roles",
        )

        players = response.get("Items", [])

        # ロール別キューの初期化（直接作成）
        role_queues = {
            "TOP_LANE": [],
            "SUPPORT": [],
            "MIDDLE": [],
            "BOTTOM_LANE": [],
            "TANK": [],
        }

        for player in players:
            user_id = player.get("user_id")
            selected_roles = player.get("selected_roles", ["TOP_LANE"])

            if isinstance(selected_roles, list):
                for role_item in selected_roles:
                    role = role_item
                    if isinstance(role_item, dict) and "S" in role_item:
                        role = role_item["S"]

                    if role in role_queues:
                        role_queues[role].append(user_id)

        # 進行中のマッチ数をカウント（Legacy準拠）
        ongoing_matches_count = count_ongoing_matches()

        # METAデータを更新（レート情報を削除）
        queue_table.update_item(
            Key={"namespace": NAMESPACE, "user_id": "#META#"},
            UpdateExpression="SET total_waiting = :tw, role_queues = :rq, ongoing_matches = :om",
            ExpressionAttributeValues={
                ":tw": len(players),  # 残りプレイヤー数も更新
                ":rq": role_queues,  # ロール別キュー（プレイヤーIDのみ）
                ":om": ongoing_matches_count,  # 進行中マッチ数も更新
            },
        )

        logger.info(f"Updated queue meta: {len(players)} players remaining, {ongoing_matches_count} ongoing matches")
        return True

    except ClientError as e:
        logger.error(f"Failed to update queue meta: {e}")
        return False


def count_ongoing_matches() -> int:
    """
    進行中のマッチ数をカウント（Legacy準拠）
    status="matched"のマッチを過去2時間以内でカウント

    Returns:
        進行中のマッチ数

    """
    try:
        from boto3.dynamodb.conditions import Attr, Key

        current_time = int(time.time())
        two_hours_ago = current_time - 2 * 3600  # 2時間前

        # status="matched"のマッチを検索
        response = matches_table.query(
            IndexName="status_index",
            KeyConditionExpression=Key("namespace").eq(NAMESPACE) & Key("status").eq("matched"),
            FilterExpression=Attr("matched_unixtime").gte(two_hours_ago),
            ProjectionExpression="match_id",
        )

        ongoing_count = len(response.get("Items", []))
        logger.info(f"Found {ongoing_count} ongoing matches")
        return ongoing_count

    except ClientError as e:
        logger.error(f"Failed to count ongoing matches: {e}")
        return 0


def execute_match_gathering() -> dict:
    """
    試合結果集計処理を実行（match_judge.gather_matchの機能を統合）

    Returns:
        集計結果の辞書
    """
    try:
        # match_judge.gather_match の処理をここに統合
        try:
            from src.handlers.match_judge import process_match_result
        except ImportError:
            # 相対インポートを試す
            from .match_judge import process_match_result

        queue_repo = QueueRepository()

        # 進行中試合IDリストを取得
        ongoing_match_ids = queue_repo.get_ongoing_match_ids()

        if not ongoing_match_ids:
            logger.info("No ongoing matches found for gathering")
            return {"processed_matches": 0, "total_matches": 0, "completed_matches": 0, "remaining_ongoing": 0}

        logger.info(f"Found {len(ongoing_match_ids)} ongoing matches for gathering: {ongoing_match_ids}")

        processed_count = 0
        completed_match_ids = []

        # 各進行中試合を処理
        for match_id in ongoing_match_ids:
            success = process_match_result(match_id)
            if success:
                processed_count += 1

                # 試合が完了したかチェック
                try:
                    response = matches_table.get_item(Key={"namespace": NAMESPACE, "match_id": match_id})
                    if "Item" in response:
                        match_item = response["Item"]
                        if match_item.get("status") == "done":
                            completed_match_ids.append(match_id)
                            logger.info(f"Match {match_id} completed and marked for removal from ongoing list")
                except Exception as e:
                    logger.error(f"Error checking match {match_id} status: {e}")

        # 完了した試合を進行中リストから削除
        if completed_match_ids:
            queue_repo.remove_ongoing_matches(completed_match_ids)
            logger.info(f"Removed {len(completed_match_ids)} completed matches from ongoing list")

        # ongoing_matches数を更新
        remaining_ongoing = len(ongoing_match_ids) - len(completed_match_ids)
        queue_repo.update_ongoing_matches(remaining_ongoing)

        logger.info(
            f"Match gathering completed: processed {processed_count}/{len(ongoing_match_ids)} matches, {len(completed_match_ids)} completed"
        )

        return {
            "processed_matches": processed_count,
            "total_matches": len(ongoing_match_ids),
            "completed_matches": len(completed_match_ids),
            "remaining_ongoing": remaining_ongoing,
        }

    except Exception as e:
        error_details = traceback.format_exc()
        logger.error(f"Error in match gathering: {e}")
        logger.error(f"Full traceback: {error_details}")
        return {
            "processed_matches": 0,
            "total_matches": 0,
            "completed_matches": 0,
            "remaining_ongoing": 0,
            "error": str(e),
            "traceback": error_details,
        }


def match_make(event, context):
    """
    統合マッチ処理：結果集計 → 新規マッチメイキングの順で実行
    本番環境で2分間隔で実行され、DEV環境では手動実行される
    Lambda関数のエントリーポイント
    """
    start_time = time.time()
    logger.info("=== Integrated Match Processing: Gather + Matchmaking started ===")

    try:
        # バリデーション: シーズン期間チェック
        season_service = SeasonService()
        if not season_service.is_season_active_now():
            logger.info("Match processing skipped: No active season")
            return {"statusCode": 200, "body": json.dumps({"message": "No active season - match processing skipped"})}

        logger.info("Season validation passed - proceeding with match processing")

        # 1. ロック取得
        if not acquire_lock():
            logger.warning("Failed to acquire lock - another process may be running")
            return {"statusCode": 423, "body": json.dumps({"error": "Match processing is currently locked"})}

        try:
            # STEP 1: 試合結果集計を実行（gather_match機能を統合）
            logger.info("Step 1: Executing match result gathering...")
            gather_result = execute_match_gathering()

            if gather_result["processed_matches"] > 0:
                logger.info(
                    f"Match gathering completed: {gather_result['processed_matches']} matches processed, {gather_result['completed_matches']} completed"
                )
            else:
                logger.info("No matches to process in gathering phase")

            # STEP 2: ランキング計算を実行
            logger.info("Step 2: Executing ranking calculation...")
            ranking_result = execute_ranking_calculation()
            logger.info(f"Ranking calculation completed: {ranking_result['rankings_count']} rankings updated")

            # STEP 3: 新規マッチメイキングを実行
            logger.info("Step 3: Executing new matchmaking...")
            
            # マッチメイキング実行前に現在のキュー人数を記録
            try:
                resp = queue_table.get_item(Key={"namespace": NAMESPACE, "user_id": "#META#"})
                if "Item" in resp:
                    current_total = resp["Item"].get("total_waiting", 0)
                    current_time = int(time.time())
                    # 前回マッチ情報を更新（マッチが成立してもしなくても記録）
                    queue_table.update_item(
                        Key={"namespace": NAMESPACE, "user_id": "#META#"},
                        UpdateExpression="SET previous_matched_unixtime = :pmt, previous_user_count = :puc",
                        ExpressionAttributeValues={
                            ":pmt": current_time,
                            ":puc": current_total,
                        },
                    )
                    logger.info(f"Updated previous match info: time={current_time}, count={current_total}")
            except Exception as e:
                logger.error(f"Failed to update previous match info: {e}")
            
            # 2. プレイヤー取得
            players = get_queue_players()
            if len(players) < 10:
                logger.info(f"Insufficient players for matchmaking: {len(players)} < 10")
                # プレイヤーが不足の場合もキューメタ情報を更新
                update_queue_meta()

                # 結果集計は実行されたので、その結果も含める
                end_time = time.time()
                processing_time = end_time - start_time

                logger.info(f"=== Integrated Match Processing completed (gather only) ===")
                logger.info(
                    f"Gather phase: {gather_result['processed_matches']} matches processed, {gather_result['completed_matches']} completed"
                )
                logger.info(f"Matchmaking phase: Insufficient players ({len(players)} < 10)")

                return {
                    "statusCode": 200,
                    "body": json.dumps(
                        {
                            "message": "Integrated processing completed: gather only (insufficient players for new matches)",
                            "gather_results": gather_result,
                            "player_count": len(players),
                            "processing_time": processing_time,
                        }
                    ),
                }

            # 3. マッチメイク実行（get_queue_playersで既に最新レート取得済み）
            match_results = matchmake_top_first(players)
            if not match_results:
                logger.warning("Matchmaking algorithm failed to find valid matches")
                # マッチが成立しなかった場合もキューメタ情報を更新
                update_queue_meta()

                # 結果集計は実行されたので、その結果も含める
                end_time = time.time()
                processing_time = end_time - start_time

                logger.info(f"=== Integrated Match Processing completed (gather only) ===")
                logger.info(
                    f"Gather phase: {gather_result['processed_matches']} matches processed, {gather_result['completed_matches']} completed"
                )
                logger.info(f"Matchmaking phase: No valid matches found")

                return {
                    "statusCode": 200,
                    "body": json.dumps(
                        {
                            "message": "Integrated processing completed: gather only (no valid matches found)",
                            "gather_results": gather_result,
                            "processing_time": processing_time,
                        }
                    ),
                }

            # 4. 複数マッチの処理
            created_matches = []
            total_matched_players = 0

            for i, match_result in enumerate(match_results):
                logger.info(f"Processing match {i + 1}/{len(match_results)}")

                # VC割り当て
                vc_a, vc_b = assign_voice_channels()

                # マッチID生成
                match_id = get_next_match_id()

                # マッチレコード作成
                match_record = create_match_record(match_id, match_result["teamA"], match_result["teamB"], vc_a, vc_b)

                # マッチしたプレイヤーをキューから削除
                all_matched_players = match_result["teamA"] + match_result["teamB"]
                remove_matched_players(all_matched_players)

                # マッチしたプレイヤーのassigned_match_idを設定（Legacy準拠）
                update_assigned_match_ids(all_matched_players, match_id)

                # 進行中試合プレイヤーリストを更新（自動試合画面切り替え用）
                update_ongoing_match_players_add(match_result["teamA"], match_result["teamB"])

                # Discord通知を送信
                try:
                    logger.info(f"Sending Discord notification for match {match_id}")
                    discord_success = send_discord_match_notification(
                        match_id, vc_a, vc_b, match_result["teamA"], match_result["teamB"]
                    )
                    if discord_success:
                        logger.info(f"Discord notification sent successfully for match {match_id}")
                    else:
                        logger.warning(f"Discord notification failed for match {match_id}")
                except Exception as discord_error:
                    logger.error(f"Discord notification error for match {match_id}: {discord_error}")

                created_matches.append(match_id)
                total_matched_players += len(all_matched_players)
                logger.info(f"Match {match_id} created successfully")

            # キューメタ情報を更新（Legacy準拠）
            update_queue_meta()

            # 成功ログ
            end_time = time.time()
            processing_time = end_time - start_time

            logger.info("=== Integrated Match Processing completed successfully ===")
            logger.info(
                f"Gather phase: {gather_result['processed_matches']} matches processed, {gather_result['completed_matches']} completed"
            )
            logger.info(f"Matchmaking phase: {len(created_matches)} matches created: {created_matches}")
            logger.info(f"Total processing time: {processing_time:.2f}s")
            logger.info(f"Total matched players: {total_matched_players}")

            return {
                "statusCode": 200,
                "body": json.dumps(
                    {
                        "message": "Integrated match processing completed: gather + matchmaking",
                        "gather_results": gather_result,
                        "match_ids": created_matches,
                        "matches_created": len(created_matches),
                        "processing_time": processing_time,
                        "matched_players": total_matched_players,
                    }
                ),
            }

        finally:
            # 9. ロック解放（必須）
            release_lock()

    except Exception as e:
        logger.error(f"Unexpected error in matchmaking: {e}")
        logger.error(f"Error details: {e!s}")

        # エラー時もロック解放を試行
        try:
            release_lock()
        except:
            logger.error("Failed to release lock during error cleanup")

        return {"statusCode": 500, "body": json.dumps({"error": "Internal server error"})}


# gather_match function is now implemented in src/handlers/match_judge.py


def debug_trigger_matchmaking(event, context):
    """
    デバッグ用: 手動でマッチメイキングを実行するハンドラー

    重要: このハンドラーは開発環境専用です。
    本番環境にデプロイする際は必ず削除してください。

    通常のマッチメイキングはEventBridge（CloudWatch Events）によって
    2分間隔で自動実行されますが、開発環境ではスケジューラーが無効化
    されているため、このエンドポイントを使用して手動でテストします。
    """
    logger.info("=== DEBUG: Manual matchmaking triggered ===")

    # match_make関数を直接呼び出す
    result = match_make(event, context)

    # レスポンスをHTTP APIフォーマットに変換
    if isinstance(result, dict) and "statusCode" in result:
        # 既にHTTPレスポンス形式の場合
        return result
    # match_makeが通常のレスポンスを返した場合
    return create_success_response(
        {
            "message": "Matchmaking executed successfully (debug mode)",
            "result": result if result else "No matches created",
        }
    )


def debug_update_queue_meta(event, context):
    """
    デバッグ用: 手動でキューメタ情報を更新するハンドラー

    重要: このハンドラーは開発環境専用です。
    本番環境にデプロイする際は必ず削除してください。
    """
    logger.info("=== DEBUG: Manual queue meta update triggered ===")

    try:
        success = update_queue_meta()
        if success:
            return create_success_response({"message": "Queue meta updated successfully (debug mode)"})
        return create_error_response(500, "Failed to update queue meta")
    except Exception as e:
        logger.error(f"Debug queue meta update failed: {e}")
        return create_error_response(500, f"Debug queue meta update failed: {e!s}")


def execute_ranking_calculation() -> dict:
    """ランキング計算を実行.
    
    Returns:
        dict: 計算結果
    """
    try:
        if not rankings_table:
            logger.warning("Rankings table not configured - skipping ranking calculation")
            return {"rankings_count": 0, "message": "Rankings table not configured"}

        logger.info("Starting ranking calculation")

        # ユーザーデータを取得（rate_indexを使用）
        response = users_table.query(
            IndexName="rate_index",
            KeyConditionExpression=Key("namespace").eq(NAMESPACE),
            ScanIndexForward=False,  # 降順でソート
            Limit=200,  # 上位200人を取得（余裕を持って）
        )

        items = response.get("Items", [])
        logger.info(f"Found {len(items)} users for ranking")

        # 必要なフィールドを取得して整形
        ranking_data = []
        for item in items:
            # 公開可能な情報のみを抽出
            user_data = {
                "user_id": item.get("user_id"),
                "trainer_name": item.get("trainer_name", item.get("user_id")),
                "rate": int(item.get("rate", 1500)),
                "best_rate": int(item.get("best_rate", 1500)),
                "win_rate": Decimal(str(item.get("win_rate", 0))),
                "win_count": int(item.get("win_count", 0)),
                "discord_username": item.get("discord_username"),
                "discord_avatar_url": item.get("discord_avatar_url"),
                "twitter_id": item.get("twitter_id"),
                "current_badge": item.get("current_badge"),
                "current_badge_2": item.get("current_badge_2"),
            }
            ranking_data.append(user_data)

        # レートと勝率でソート
        sorted_data = sorted(ranking_data, key=lambda x: (-x["rate"], -float(x["win_rate"])))

        # 上位100人を選出
        top_rankings = sorted_data[:100]

        # バッチ書き込みの準備
        timestamp = int(time.time())
        with rankings_table.batch_writer() as batch:
            # 新しいランキングを書き込み
            for i, user in enumerate(top_rankings):
                rank = i + 1
                item = {
                    "ranking_type": "rate",  # レートランキング
                    "rank": rank,
                    "user_id": user["user_id"],
                    "trainer_name": user["trainer_name"],
                    "rate": user["rate"],
                    "best_rate": user["best_rate"],
                    "win_rate": user["win_rate"],
                    "win_count": user["win_count"],
                    "discord_username": user.get("discord_username"),
                    "discord_avatar_url": user.get("discord_avatar_url"),
                    "twitter_id": user.get("twitter_id"),
                    "current_badge": user.get("current_badge"),
                    "current_badge_2": user.get("current_badge_2"),
                    "updated_at": timestamp,
                }
                # DynamoDBのNoneフィールドを削除
                item = {k: v for k, v in item.items() if v is not None}
                batch.put_item(Item=item)

        logger.info(f"Successfully calculated and stored {len(top_rankings)} rankings")

        return {
            "rankings_count": len(top_rankings),
            "timestamp": timestamp,
        }

    except Exception as e:
        logger.error(f"Failed to calculate rankings: {e}")
        return {
            "rankings_count": 0,
            "error": str(e),
        }
