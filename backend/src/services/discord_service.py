"""Discord通知サービス"""

import asyncio
import logging
import os

import aiohttp
import boto3

logger = logging.getLogger(__name__)

# Discord WebhookURL (環境変数から取得、フォールバックでLegacyの値を使用)
WEBHOOK_URL = os.environ.get(
    "DISCORD_WEBHOOK_URL",
    "https://discord.com/api/webhooks/1185019044391305226/NbOT6mnrZNHS61T5ro7iu2smxyhhSPH_tecLnWmZ91kup96-mtpdcGwvvo3kjmyzR96_",
)

# VC番号からDiscordチャンネルIDへのマッピング
VC_CHANNEL_IDS = {
    1: "1146297345106002001",
    2: "1146297378979197000",
    3: "1146297399564828692",
    4: "1146297435568742410",
    5: "1146297458058596394",
    6: "1146297490325377047",
    7: "1146297519979106334",
    8: "1146297542716444672",
    9: "1146297560617730168",
    10: "1146297640720551976",
    11: "1146297670055497799",
    12: "1146297705350578226",
    13: "1146297728641544293",
    14: "1146297751643111555",
    15: "1146297774615310386",
    16: "1146297797243576380",
    17: "1146297826125561946",
    18: "1146297858862108804",
    19: "1146297880743772200",
    20: "1146297991062364241",
    21: "1146527365023932546",
    22: "1146527393633276015",
    23: "1146527437224677456",
    24: "1146527472754638849",
    25: "1146527506191618118",
    26: "1146527530971574385",
    27: "1146527561145385111",
    28: "1146527594456551444",
    29: "1146527625506988053",
    30: "1146527654317658112",
    31: "1146621602050609152",
    32: "1146621649249116160",
    33: "1146621703720534026",
    34: "1146621735333015552",
    35: "1146621758854676551",
    36: "1146621793109557278",
    37: "1146621817004507167",
    38: "1146621842937888819",
    39: "1146621867130617957",
    40: "1146621893902876772",
    41: "1146671872243671121",
    42: "1146671916636176434",
    43: "1146671943282606090",
    44: "1146671973355757568",
    45: "1146672003999342602",  # 45番以降は推定値
    46: "1146672037021110332",
    47: "1146672176662056971",
    48: "1146672207955767338",
    49: "1146296889470365700",
    50: "1146296889470365701",
}

# DynamoDB設定
dynamodb = boto3.resource("dynamodb")
users_table = dynamodb.Table(os.environ.get("USERS_TABLE_NAME", "unitemate-v2-users-dev"))


async def notify_discord_match_found(
    match_id: int,
    vc_a: int,
    vc_b: int,
    team_a_players: list[dict],
    team_b_players: list[dict],
) -> bool:
    """
    マッチメイキング成功時にDiscordに通知を送信

    Args:
        match_id: マッチID
        vc_a: チームAのVC番号
        vc_b: チームBのVC番号
        team_a_players: チームAのプレイヤー情報
        team_b_players: チームBのプレイヤー情報

    Returns:
        bool: 通知送信成功したかどうか

    """
    try:
        logger.info(f"Discord notification - Team A players: {team_a_players}")
        logger.info(f"Discord notification - Team B players: {team_b_players}")

        # プレイヤー情報からDiscord IDを取得
        team_a_discord_ids = []
        team_b_discord_ids = []

        # player_dataは {"player": {"id": "...", ...}, "role": "..."} の形式
        for player_data in team_a_players:
            player_user_id = player_data["player"].get("id")
            team_a_discord_ids.append(player_user_id)

        for player_data in team_b_players:
            player_user_id = player_data["player"].get("id")
            team_b_discord_ids.append(player_user_id)

        # Discord メンション形式に変換
        team_a_mentions = " ".join([f"<@{discord_id}>" for discord_id in team_a_discord_ids])
        team_b_mentions = " ".join([f"<@{discord_id}>" for discord_id in team_b_discord_ids])

        # VCチャンネルリンクを取得
        vc_a_channel_id = VC_CHANNEL_IDS.get(vc_a, None)
        vc_b_channel_id = VC_CHANNEL_IDS.get(vc_b, None)
        
        # チャンネルリンクまたはVC番号を表示
        vc_a_link = f"<#{vc_a_channel_id}>" if vc_a_channel_id else f"VC{vc_a}"
        vc_b_link = f"<#{vc_b_channel_id}>" if vc_b_channel_id else f"VC{vc_b}"

        # メッセージ内容作成（Legacyと同じフォーマット、VCリンク付き）
        content = (
            f"**VC有りバトルでマッチしました**\r"
            f"先攻チーム {vc_a_link}\r {team_a_mentions}\r\r"
            f"後攻チーム {vc_b_link}\r {team_b_mentions}\r\r"
            f"*サイト上のタイマー以内にロビーに集合してください。集まらない場合、試合を無効にしてください。*\r"
            f"ID: ||{match_id}||\r"
        )

        payload = {"content": content}
        headers = {"Content-Type": "application/json"}

        # Discord Webhookに送信
        async with (
            aiohttp.ClientSession() as session,
            session.post(WEBHOOK_URL, json=payload, headers=headers) as response,
        ):
            if response.status == 204:
                logger.info("Discord通知送信成功: Match ID %s", match_id)
                return True
            text = await response.text()
            logger.error("Discord通知送信失敗: %s, Response: %s", response.status, text)
            return False

    except Exception:
        logger.exception("Discord通知送信でエラーが発生")
        return False


def send_discord_match_notification(
    match_id: int,
    vc_a: int,
    vc_b: int,
    team_a_players: list[dict],
    team_b_players: list[dict],
) -> bool:
    """
    Discord通知の同期ラッパー関数

    Args:
        match_id: マッチID
        vc_a: チームAのVC番号
        vc_b: チームBのVC番号
        team_a_players: チームAのプレイヤー情報
        team_b_players: チームBのプレイヤー情報

    Returns:
        bool: 通知送信成功したかどうか

    """
    try:
        return asyncio.run(notify_discord_match_found(match_id, vc_a, vc_b, team_a_players, team_b_players))
    except Exception:
        logger.exception("Discord通知の同期実行でエラーが発生")
        return False
