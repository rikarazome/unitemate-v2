"""
試合結果集計システム（Legacy互換の新システム）

主な機能:
- 5分間隔で進行中の試合を監視
- 報告数が7件以上で結果集計
- 多数決による試合結果確定
- プレイヤーのレート変動と戦績更新
- ongoing_matches数の更新
"""

import json
import logging
import os
import time
from decimal import Decimal

import boto3
from botocore.exceptions import ClientError

from src.repositories.queue_repository import QueueRepository
from src.services.penalty_service import PenaltyService

# DynamoDBクライアント
dynamodb = boto3.resource("dynamodb")

# 環境変数からテーブル名を取得
QUEUE_TABLE_NAME = os.environ["QUEUE_TABLE_NAME"]
MATCHES_TABLE_NAME = os.environ["MATCHES_TABLE_NAME"]
USERS_TABLE_NAME = os.environ["USERS_TABLE_NAME"]
RECORDS_TABLE_NAME = os.environ["RECORDS_TABLE_NAME"]

# テーブルオブジェクト
queue_table = dynamodb.Table(QUEUE_TABLE_NAME)
matches_table = dynamodb.Table(MATCHES_TABLE_NAME)
users_table = dynamodb.Table(USERS_TABLE_NAME)
records_table = dynamodb.Table(RECORDS_TABLE_NAME)

# ロガー設定
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# 定数
NAMESPACE = "default"  # Legacy互換のnamespace
ELO_CONST = 16  # レート計算に使用する固定値


def is_report_enough(reports: list[dict], timeout_count: int) -> bool:
    """
    報告数が十分かチェック（7人以上の報告が必要）

    Args:
        reports: ユーザー報告リスト
        timeout_count: タイムアウト回数（未使用だが互換性のため保持）

    Returns:
        報告が十分かどうか

    """
    # 7人以上の報告があれば処理を実行
    # タイムアウト機能は使用せず、常に7人以上の報告を待つ
    return len(reports) >= 7


def get_result(reports: list[str]) -> str:
    """
    報告から試合結果を判定（Legacy準拠の多数決）

    Args:
        reports: 結果報告リスト ["A-win", "B-win", "Invalid", ...]

    Returns:
        "A-win", "B-win", or "Invalid"

    """
    a_count = reports.count("A-win")
    b_count = reports.count("B-win")
    i_count = reports.count("Invalid")

    # 1) "A-win" が "B-win"+"Invalid" を上回るか？
    if a_count > b_count + i_count:
        return "A-win"

    # 2) "B-win" が "A-win"+"Invalid" を上回るか？
    if b_count > a_count + i_count:
        return "B-win"

    # 3) いずれの条件も満たさない
    return "Invalid"


def calculate_elo_rating(rate_a: int, rate_b: int, result: str) -> list[int]:
    """
    ELOレーティング計算（Legacy準拠）

    Args:
        rate_a: プレイヤーAのレート
        rate_b: プレイヤーBのレート
        result: 試合結果 ("A-win" or "B-win")

    Returns:
        [new_rate_a, new_rate_b]

    """
    if result == "A-win":
        # Aが勝利
        delta = round(ELO_CONST * (1 - (1 / (10 ** ((rate_b - rate_a) / 400) + 1))))
        return [rate_a + delta, rate_b - delta]
    if result == "B-win":
        # Bが勝利
        delta = round(ELO_CONST * (1 - (1 / (10 ** ((rate_a - rate_b) / 400) + 1))))
        return [rate_a - delta, rate_b + delta]
    # 無効試合
    return [rate_a, rate_b]


def update_player_data(
    user_id: str, rate_delta: int, win: bool, match_id: int, started_date: int, pokemon: str
) -> bool:
    """
    プレイヤーデータを更新（Legacy準拠）

    Args:
        user_id: ユーザーID
        rate_delta: レート変動
        win: 勝利したかどうか
        match_id: マッチID
        started_date: 試合開始日時
        pokemon: 使用ポケモン

    Returns:
        成功したかどうか

    """
    try:
        # プレイヤーのデータを取得
        response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})

        if "Item" not in response:
            # プレイヤーデータが無い場合、新規作成
            initial_data = {
                "namespace": NAMESPACE,
                "user_id": user_id,
                "match_count": 0,
                "win_count": 0,
                "rate": 1500,
                "max_rate": 1500,
                "last_rate_delta": 0,
                "win_rate": 0,
                "last_match_id": 0,
            }
            users_table.put_item(Item=initial_data)
            response = users_table.get_item(Key={"namespace": NAMESPACE, "user_id": user_id})

        player_data = response["Item"]
        last_match_id = player_data.get("last_match_id", 0)

        # 二重記録を防ぐため最後のIDをチェック
        logger.info(f"Processing user {user_id}: last_match_id={last_match_id}, current_match_id={match_id}")

        if last_match_id != match_id:
            match_count = int(player_data.get("match_count", 0))
            win_count = int(player_data.get("win_count", 0))
            rate = int(player_data.get("rate", 1500))
            max_rate = int(player_data.get("max_rate", 1500))

            logger.info(
                f"Current stats for {user_id}: match_count={match_count}, win_count={win_count}, rate={rate}, max_rate={max_rate}"
            )

            # 更新するデータを計算
            new_match_count = match_count + 1
            new_win_count = win_count + 1 if win else win_count
            new_win_rate = Decimal(str(round(new_win_count * 100.0 / new_match_count, 1))) if new_match_count > 0 else Decimal("0.0")
            logger.info(
                f"Win rate calculation for {user_id}: win_count={new_win_count}, match_count={new_match_count}, calculated_rate={new_win_rate}"
            )

            # 初心者ボーナス（20試合未満は+5）
            corrected_rate_delta = rate_delta + 5 if match_count < 20 else rate_delta
            new_rate = rate + corrected_rate_delta
            new_max_rate = max(max_rate, new_rate)

            # プレイヤーデータを更新（assigned_match_idはリセットしない）
            users_table.update_item(
                Key={"namespace": NAMESPACE, "user_id": user_id},
                UpdateExpression="SET match_count = :mc, win_count = :wc, rate = :r, last_rate_delta = :lrd, win_rate = :wr, last_match_id = :lmi, max_rate = :mr",
                ExpressionAttributeValues={
                    ":mc": new_match_count,
                    ":wc": new_win_count,
                    ":r": new_rate,
                    ":lrd": corrected_rate_delta,
                    ":wr": new_win_rate,
                    ":lmi": match_id,
                    ":mr": new_max_rate,
                    # assigned_match_idはリセットしない（報告時のみリセット）
                },
            )

            # 戦績レコードを作成
            record_data = {
                "user_id": user_id,  # Partition Key
                "match_id": int(match_id),  # Sort Key
                "pokemon": pokemon if pokemon and pokemon != "null" else "null",
                "rate_delta": int(corrected_rate_delta),
                "started_date": int(started_date),
                "winlose": (1 if win else 0),  # 0: lose, 1: win, 2: invalid
            }

            logger.info(f"[RECORD CREATE] Creating record for user {user_id}, match {match_id}")
            logger.info(f"[RECORD CREATE] Record data: {record_data}")
            
            try:
                records_table.put_item(Item=record_data)
                logger.info(f"[RECORD CREATE] Successfully created record for user {user_id}, match {match_id}")
            except Exception as record_error:
                logger.error(f"[RECORD CREATE ERROR] Failed to create record for user {user_id}, match {match_id}: {record_error}")
                logger.error(f"[RECORD CREATE ERROR] Record data that failed: {record_data}")
                raise

            # 50試合ごとのペナルティ軽減処理
            penalty_service = PenaltyService()
            penalty_service.reduce_penalty_by_matches(user_id, new_match_count)

            logger.info(f"Updated player {user_id}: rate {rate} -> {new_rate} (delta: {corrected_rate_delta})")
            logger.info(
                f"New stats for {user_id}: match_count={new_match_count}, win_count={new_win_count}, win_rate={new_win_rate}, max_rate={new_max_rate}"
            )
        else:
            logger.info(f"Skipping duplicate processing for user {user_id}: already processed match {match_id}")

        return True

    except ClientError as e:
        logger.error(f"Failed to update player data for {user_id}: {e}")
        return False


def process_violation_reports(user_reports: list[dict], team_a: list, team_b: list) -> bool:
    """
    迷惑行為通報を処理してペナルティを適用

    Args:
        user_reports: ユーザー報告リスト
        team_a: チームAのプレイヤーリスト
        team_b: チームBのプレイヤーリスト

    Returns:
        処理成功したかどうか

    """
    try:
        penalty_service = PenaltyService()

        # チームメンバーシップを辞書化
        team_assignments = {}
        for player in team_a:
            if isinstance(player, dict):
                user_id = player.get("user_id")
                if user_id:
                    team_assignments[user_id] = "A"
            elif isinstance(player, (list, tuple)) and len(player) > 0:
                team_assignments[player[0]] = "A"

        for player in team_b:
            if isinstance(player, dict):
                user_id = player.get("user_id")
                if user_id:
                    team_assignments[user_id] = "B"
            elif isinstance(player, (list, tuple)) and len(player) > 0:
                team_assignments[player[0]] = "B"

        # 通報集計用辞書
        violation_counts = {}

        # 各プレイヤーの通報を集計
        for report in user_reports:
            reporter_id = report.get("user_id")
            # 後方互換性: 旧フィールド名と新フィールド名の両方をチェック
            violation_report = report.get("violation_report", "") or report.get("vioration_report", "")

            # デバッグログ追加
            logger.info(f"Reporter: {reporter_id}, violation_report field value: '{violation_report}'")

            if not violation_report:
                continue

            # 通報されたプレイヤーIDをパース（カンマ区切りで複数可能）
            reported_users = [uid.strip() for uid in violation_report.split(",") if uid.strip()]
            logger.info(f"Parsed reported users: {reported_users}")

            for reported_user_id in reported_users:
                if reported_user_id not in violation_counts:
                    violation_counts[reported_user_id] = {"total": 0, "same_team": 0, "different_team": 0}

                # 通報者と被通報者のチームを確認
                reporter_team = team_assignments.get(reporter_id)
                reported_team = team_assignments.get(reported_user_id)

                violation_counts[reported_user_id]["total"] += 1

                if reporter_team == reported_team:
                    violation_counts[reported_user_id]["same_team"] += 1
                else:
                    violation_counts[reported_user_id]["different_team"] += 1

        # ペナルティ閾値チェックと適用
        logger.info(f"Final violation counts: {violation_counts}")
        for reported_user_id, counts in violation_counts.items():
            same_team_count = counts["same_team"]
            total_count = counts["total"]

            # 閾値チェック: 同チーム4人以上 OR 全体6人以上
            should_apply_penalty = same_team_count >= 4 or total_count >= 6
            logger.info(
                f"User {reported_user_id}: same_team={same_team_count}, total={total_count}, should_apply={should_apply_penalty}"
            )

            if should_apply_penalty:
                logger.info(
                    f"Applying penalty to user {reported_user_id}: same_team={same_team_count}, total={total_count}"
                )

                success = penalty_service.apply_penalty(
                    reported_user_id, f"match_reports (same_team: {same_team_count}, total: {total_count})"
                )

                if not success:
                    logger.error(f"Failed to apply penalty to user {reported_user_id}")
            else:
                logger.info(
                    f"User {reported_user_id} reported but under threshold: "
                    f"same_team={same_team_count}, total={total_count}"
                )

        return True

    except Exception as e:
        logger.error(f"Error processing violation reports: {e}")
        return False


def process_match_result(match_id: int) -> bool:
    """
    個別マッチの結果処理

    Args:
        match_id: 処理するマッチID

    Returns:
        処理成功したかどうか

    """
    try:
        logger.info(f"[PROCESS START] Processing match {match_id}")
        
        # マッチデータを取得
        response = matches_table.get_item(Key={"namespace": NAMESPACE, "match_id": match_id})

        if "Item" not in response:
            logger.warning(f"[PROCESS ERROR] Match {match_id} not found")
            return False

        match_item = response["Item"]
        user_reports = match_item.get("user_reports", [])
        logger.info(f"[PROCESS] Match {match_id} has {len(user_reports)} reports")
        timeout_count = match_item.get("judge_timeout_count", 0)

        logger.info(f"Processing match {match_id}: {len(user_reports)} reports, timeout_count={timeout_count}")

        # 報告数が不十分な場合は処理を保留（タイムアウト機能は使用しない）
        if not is_report_enough(user_reports, timeout_count):
            logger.info(
                f"Match {match_id} reports insufficient: {len(user_reports)}/7 required - keeping for next processing"
            )
            return True  # 処理続行（次回の処理タイミングで再度チェック）

        # 報告が十分な場合、結果を集計
        # チーム情報を取得（レート計算用）
        team_a = match_item.get("team_a", [])
        team_b = match_item.get("team_b", [])

        # フロントエンドから送られた結果（A-win/B-win/invalid）を直接集計
        results = []
        for report in user_reports:
            user_result = report.get("result")
            # フロントエンドが既にチーム判定済みの結果を送信
            # "A-win", "B-win", "invalid" のいずれか
            if user_result in ["A-win", "B-win", "invalid"]:
                results.append(user_result)
            else:
                # 古い形式（win/lose）の場合はInvalidとして扱う
                logger.warning(f"Invalid result format: {user_result}, treating as invalid")
                results.append("invalid")

        final_result = get_result(results)

        # マッチステータスを完了に更新し、最終結果も保存
        matches_table.update_item(
            Key={"namespace": NAMESPACE, "match_id": match_id},
            UpdateExpression="SET #sts = :done, final_result = :result",
            ExpressionAttributeNames={"#sts": "status"},
            ExpressionAttributeValues={":done": "done", ":result": final_result},
        )

        if final_result != "Invalid":
            # 有効な結果の場合、レート計算とプレイヤーデータ更新
            # 既に上で取得済み
            started_date = match_item.get("matched_unixtime", int(time.time()))

            # 各プレイヤーペアでレート計算
            for i in range(min(len(team_a), len(team_b))):
                # 新しい辞書形式と古い配列形式の両方に対応
                player_a = team_a[i]
                player_b = team_b[i]

                if isinstance(player_a, dict):
                    user_a_id = player_a.get("user_id")
                    user_a_rate = player_a.get("rate", 1500)
                elif isinstance(player_a, (list, tuple)) and len(player_a) > 0:
                    user_a_id = player_a[0]
                    user_a_rate = player_a[1] if len(player_a) > 1 else 1500
                else:
                    continue  # 無効なデータをスキップ

                if isinstance(player_b, dict):
                    user_b_id = player_b.get("user_id")
                    user_b_rate = player_b.get("rate", 1500)
                elif isinstance(player_b, (list, tuple)) and len(player_b) > 0:
                    user_b_id = player_b[0]
                    user_b_rate = player_b[1] if len(player_b) > 1 else 1500
                else:
                    continue  # 無効なデータをスキップ

                # レート計算
                new_rates = calculate_elo_rating(user_a_rate, user_b_rate, final_result)
                rate_delta_a = new_rates[0] - user_a_rate
                rate_delta_b = new_rates[1] - user_b_rate

                # 使用ポケモン情報を取得
                pokemon_a = "unknown"
                pokemon_b = "unknown"
                for report in user_reports:
                    if report.get("user_id") == user_a_id and report.get("picked_pokemon"):
                        pokemon_a = report.get("picked_pokemon")
                    if report.get("user_id") == user_b_id and report.get("picked_pokemon"):
                        pokemon_b = report.get("picked_pokemon")

                # プレイヤーデータを更新
                update_player_data(user_a_id, rate_delta_a, final_result == "A-win", match_id, started_date, pokemon_a)
                update_player_data(user_b_id, rate_delta_b, final_result == "B-win", match_id, started_date, pokemon_b)

        # 迷惑行為通報を処理（試合結果に関係なく実行）
        logger.info(f"Processing violation reports for match {match_id}, final_result={final_result}")
        logger.info(f"User reports: {json.dumps(user_reports, default=str)}")
        process_violation_reports(user_reports, team_a, team_b)

        # VCを返却
        vc_a = match_item.get("vc_a")  # 小文字に修正
        if vc_a:
            queue_repo = QueueRepository()
            success = queue_repo.return_vc_channels([vc_a])
            if success:
                logger.info(f"Returned VC {vc_a} to unused_vc list")
            else:
                logger.error(f"Failed to return VC {vc_a}")

        logger.info(f"Match {match_id} result: {final_result} - processing completed")
        return True

    except ClientError as e:
        logger.error(f"Failed to process match {match_id}: {e}")
        return False


def gather_match(event, context):
    """
    進行中試合の結果集計（効率化版）
    METAデータの進行中試合IDリストから直接処理
    """
    logger.info("=== Match result gathering started ===")
    logger.info(f"Event: {event}")
    logger.info(f"Context: {context}")

    try:
        logger.info("Step 1: Checking environment variables...")
        logger.info(f"QUEUE_TABLE_NAME: {os.environ.get('QUEUE_TABLE_NAME', 'NOT_SET')}")
        logger.info(f"MATCHES_TABLE_NAME: {os.environ.get('MATCHES_TABLE_NAME', 'NOT_SET')}")

        logger.info("Step 2: Initializing QueueRepository...")
        try:
            queue_repo = QueueRepository()
            logger.info("QueueRepository initialized successfully")
        except Exception as e:
            logger.error(f"Failed to initialize QueueRepository: {e}")
            import traceback

            logger.error(f"QueueRepository init traceback: {traceback.format_exc()}")
            raise

        # 進行中試合IDリストを取得
        logger.info("Step 3: Getting ongoing match IDs...")
        try:
            ongoing_match_ids = queue_repo.get_ongoing_match_ids()
            logger.info(f"Retrieved ongoing_match_ids: {ongoing_match_ids}")
        except Exception as e:
            logger.error(f"Failed to get ongoing match IDs: {e}")
            import traceback

            logger.error(f"Get ongoing match IDs traceback: {traceback.format_exc()}")
            raise

        if not ongoing_match_ids:
            logger.info("No ongoing matches found")
            return {
                "statusCode": 200,
                "body": json.dumps(
                    {"message": "No ongoing matches to process", "processed_matches": 0, "total_matches": 0}
                ),
            }

        logger.info(f"Found {len(ongoing_match_ids)} ongoing matches: {ongoing_match_ids}")

        processed_count = 0
        completed_match_ids = []

        # 各進行中試合を処理
        for match_id in ongoing_match_ids:
            logger.info(f"Processing match_id: {match_id}")
            try:
                # 先に試合のステータスをチェック
                response = matches_table.get_item(Key={"namespace": NAMESPACE, "match_id": match_id})
                if "Item" not in response:
                    logger.warning(f"Match {match_id} not found")
                    continue

                match_item = response["Item"]
                match_status = match_item.get("status", "unknown")

                # 既にdoneの場合はスキップして、ongoing_match_idsからの削除対象に追加
                if match_status == "done":
                    logger.info(f"[AGGREGATE SKIP] Match {match_id} already done, adding to removal list")
                    completed_match_ids.append(match_id)
                    continue

                # doneでない場合のみ処理を実行
                logger.info(f"[AGGREGATE PROCESS] Starting process_match_result for match {match_id}")
                success = process_match_result(match_id)
                logger.info(f"[AGGREGATE PROCESS] Match {match_id} processing result: {success}")
                if success:
                    processed_count += 1
                    # 処理成功後、改めてステータスを確認
                    response = matches_table.get_item(Key={"namespace": NAMESPACE, "match_id": match_id})
                    if "Item" in response and response["Item"].get("status") == "done":
                        completed_match_ids.append(match_id)
                        logger.info(f"Match {match_id} completed and marked for removal from ongoing list")

            except Exception as e:
                logger.error(f"Error processing match {match_id}: {e}")
                continue

        # 完了した試合を進行中リストから削除
        if completed_match_ids:
            queue_repo.remove_ongoing_matches(completed_match_ids)
            logger.info(f"Removed {len(completed_match_ids)} completed matches from ongoing list")

        # ongoing_matches数を更新
        remaining_ongoing = len(ongoing_match_ids) - len(completed_match_ids)
        queue_repo.update_ongoing_matches(remaining_ongoing)

        logger.info(
            f"Match result gathering completed: processed {processed_count}/{len(ongoing_match_ids)} matches, {len(completed_match_ids)} completed"
        )

        return {
            "statusCode": 200,
            "body": json.dumps(
                {
                    "message": "Match result gathering completed",
                    "processed_matches": processed_count,
                    "total_matches": len(ongoing_match_ids),
                    "completed_matches": len(completed_match_ids),
                    "remaining_ongoing": remaining_ongoing,
                }
            ),
        }

    except Exception as e:
        import traceback

        error_details = traceback.format_exc()
        logger.error(f"Error in match result gathering: {e}")
        logger.error(f"Full traceback: {error_details}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Internal server error", "details": str(e), "traceback": error_details}),
        }
