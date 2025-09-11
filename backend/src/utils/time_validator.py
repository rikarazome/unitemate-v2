"""Time validation utility for match scheduling."""

from datetime import datetime, timezone, timedelta, time
from typing import Optional

# JST timezone
JST = timezone(timedelta(hours=+9), "JST")


def is_match_time_active() -> bool:
    """現在がマッチ時間かどうかを判定.
    
    マッチ時間:
    - 平日: 14:00-翌4:00 (JST)
    - 土日: 終日
    
    Returns:
        bool: マッチ時間の場合True
    """
    now_jst = datetime.now(JST)
    current_time = now_jst.time()
    weekday = now_jst.weekday()  # 0=月曜, 6=日曜
    
    # 土日は終日
    if weekday >= 5:  # 土曜(5), 日曜(6)
        return True
    
    # 平日の場合
    # 14:00-23:59 または 00:00-04:00
    afternoon_start = time(14, 0)  # 14:00
    midnight = time(23, 59, 59)  # 23:59:59
    morning_end = time(4, 0)  # 04:00
    
    # 14:00-23:59の範囲
    if afternoon_start <= current_time <= midnight:
        return True
    
    # 00:00-04:00の範囲
    if current_time <= morning_end:
        return True
    
    return False


def format_next_match_time() -> str:
    """次のマッチ時間開始時刻を文字列で返す.
    
    Returns:
        str: 次のマッチ時間開始時刻（JST）
    """
    now_jst = datetime.now(JST)
    current_time = now_jst.time()
    weekday = now_jst.weekday()
    
    # 土日の場合、すでにマッチ時間なので「現在」を返す
    if weekday >= 5:
        return "現在"
    
    # 平日の場合
    afternoon_start = time(14, 0)
    morning_end = time(4, 0)
    
    # 現在が04:01-13:59の場合、今日の14:00が次のマッチ時間
    if current_time > morning_end and current_time < afternoon_start:
        next_match = now_jst.replace(hour=14, minute=0, second=0, microsecond=0)
        return next_match.strftime("%Y-%m-%d %H:%M JST")
    
    # 現在が00:00-04:00または14:00-23:59の場合、すでにマッチ時間
    return "現在"


def get_match_schedule_info() -> dict:
    """マッチスケジュール情報を取得.
    
    Returns:
        dict: スケジュール情報
    """
    return {
        "is_active": is_match_time_active(),
        "next_match_time": format_next_match_time(),
        "schedule_info": {
            "weekdays": "平日 14:00-翌04:00 (JST)",
            "weekends": "土日 終日"
        }
    }