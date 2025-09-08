# Legacy Matchmaking System - Comprehensive Requirements Specification

## Overview

This document provides a detailed analysis of the Legacy matchmaking system to ensure full compatibility when migrating to the new system. The Legacy system handles queue management, player matching, match creation, VC assignment, and result processing through a complex distributed architecture.

## 1. Scheduler Configuration & Timing

### 1.1 Step Functions State Machine
- **Name**: `{service}-{stage}-matchmake`
- **Execution Pattern**: 20-second intervals, maximum 3 iterations (1 minute total)
- **States**:
  ```yaml
  Initialize -> MatchMakeTask -> Wait20Seconds -> IncrementCounter -> CheckCounter
  ```
- **Counter Logic**: Starts at 0, increments to max 3, then ends
- **Lambda Target**: `match_make` function with 15-second timeout

### 1.2 EventBridge Scheduling Rules

#### Weekday Schedule (Mon-Fri)
- **Morning**: `cron(0/1 15-18 ? * SUN,MON,TUE,WED,THU *)` (JST 0:00-4:00)
- **Afternoon**: `cron(0/1 5-14 ? * MON,TUE,WED,THU *)` (JST 14:00-24:00)

#### Weekend Schedule
- **Friday**: `cron(0/1 5-23 ? * FRI *)` (JST 14:00-24:00)
- **Saturday**: `cron(0/1 * ? * SAT *)` (Full day UTC)
- **Sunday**: `cron(0/1 0-18 ? * SUN *)` (UTC 00:00-18:59)

#### Holiday Schedule (Monday)
- **Part 1**: `cron(0/1 19-23 ? * SUN *)` (JST 4:00-8:59)
- **Part 2**: `cron(0/1 0-4 ? * MON *)` (JST 9:00-14:00)

### 1.3 Match Judging Schedule
- **Frequency**: Every 5 minutes via `cron(*/5 * * * ? *)`
- **Function**: `gather_match` with 15-second timeout
- **Purpose**: Process match results and clean up completed matches

## 2. Queue Management & Lock System

### 2.1 Lock Mechanism
- **Lock Location**: DynamoDB META item (`#META#` user_id)
- **Lock Field**: `lock` (0=unlocked, 1=locked)
- **Lock Functions**:
  - `acquire_lock()`: Unconditionally sets lock=1
  - `release_lock()`: Unconditionally sets lock=0
  - `is_locked()`: Returns True if lock=1

### 2.2 Queue Operations
- **Inqueue**: Adds player to queue with rate and spread parameters
- **Dequeue**: Removes player from queue
- **Lock Checking**: Both operations check lock status (423 error if locked)

### 2.3 META Item Structure
```json
{
  "namespace": "default",
  "user_id": "#META#",
  "lock": 0,
  "LatestMatchID": 12345,
  "UnusedVC": [1, 3, 5, 7, 9, ...],
  "ongoing_matches": 5,
  "rate_list": [1600, 1550, 1400, ...],
  "range_list": [75, 100, 150, ...]
}
```

### 2.4 Player Queue Item Structure
```json
{
  "namespace": "default",
  "user_id": "user123",
  "rate": 1500,
  "best": 1600,
  "blocking": "block_value",
  "desired_role": "role_value",
  "range_spread_speed": 10,
  "range_spread_count": 2,
  "discord_id": "discord123",
  "inqueued_unixtime": 1640995200
}
```

## 3. Matchmaking Core Algorithm

### 3.1 Main Process Flow (lines 110-226)

#### Phase 1: Initialization & Lock
```python
acquire_lock()
waiting_users = get_waiting_users(queue_table)
```

#### Phase 2: Minimum Player Check
- **Requirement**: Minimum 10 players
- **Action if insufficient**: Increment all players' `range_spread_count`

#### Phase 3: Player Data Processing
```python
for user in waiting_users:
    rating = user["rate"]
    spread_count = user["range_spread_count"]
    spread_speed = user["range_spread_speed"]
    
    if spread_count >= 5:
        min_rating = -math.inf
        max_rating = math.inf
    else:
        base = 50 + spread_speed * spread_count
        min_rating = rating - base
        max_rating = rating + base
```

#### Phase 4: Sorting Strategy
- **Primary**: Descending by rate (highest first)
- **Alternative**: By inqueue time (oldest first) - currently commented out

#### Phase 5: Group Formation Algorithm
- **Method**: `form_matches_from_pool(players)`
- **Strategy**: Greedy anchor-based approach
- **Target**: 10-player groups with overlapping rating ranges

### 3.2 Group Formation Logic (`try_form_group`)

#### Intersection Algorithm
```python
current_min = anchor["min_rating"]
current_max = anchor["max_rating"]

for candidate in pool:
    new_min = max(current_min, candidate["min_rating"])
    new_max = min(current_max, candidate["max_rating"])
    if new_min <= new_max:
        # Add candidate to group
        group.append(candidate)
        current_min, current_max = new_min, new_max
        if len(group) == 10:
            return group
```

#### Success Criteria
- Group size exactly 10 players
- All players' rating ranges have non-empty intersection
- No player can be in multiple groups simultaneously

## 4. Match Creation & Finalization

### 4.1 Match Table Schema
```yaml
TableName: {stage}-{service}-matches
KeySchema:
  - namespace (HASH)
  - match_id (RANGE, Number)
LocalSecondaryIndexes:
  - status_index (namespace, status)
  - match_time_index (namespace, matched_unixtime)
```

### 4.2 Match Record Structure
```json
{
  "namespace": "default",
  "match_id": 12346,
  "team_A": [["user1", 1600, 1650], ["user2", 1550, 1600], ...],
  "team_B": [["user3", 1580, 1620], ["user4", 1520, 1580], ...],
  "matched_unix_time": 1640995200,
  "status": "matched",
  "user_reports": [],
  "penalty_player": [],
  "judge_timeout_count": 0,
  "vc_A": 15,
  "vc_B": 16
}
```

### 4.3 Team Assignment Algorithm
```python
# Sort group by rating (descending)
group.sort(key=lambda x: x["rate"], reverse=True)

# Create pairs from adjacent players
pairs = []
for i in range(0, len(group), 2):
    pair = group[i:i+2]
    random.shuffle(pair)  # Random assignment within pair
    pairs.append(pair)

team_a_players = [pair[0] for pair in pairs]
team_b_players = [pair[1] for pair in pairs]
```

## 5. VC (Voice Channel) Assignment System

### 5.1 VC Pool Management
- **Initial Pool**: Odd numbers 1, 3, 5, 7, 9, ..., 99
- **Storage**: META item `UnusedVC` field
- **Assignment**: Pop from front of list
- **Team Assignment**: 
  - Team A: Assigned VC number
  - Team B: Assigned VC number + 1

### 5.2 VC Allocation Process
```python
unused_vc = meta_item.get("UnusedVC", list(range(1, 100, 2)))
if len(unused_vc) < 1:
    raise Exception("UnusedVCが不足しています。")
vc_a = unused_vc.pop(0)
vc_b = vc_a + 1
```

### 5.3 VC Return Mechanism (from match_judge.py)
```python
# When match is finalized
vc_a = match_item.get("vc_A")
queue_table.update_item(
    Key={"namespace": "default", "user_id": "#META#"},
    UpdateExpression="SET #unused_vc = list_append(if_not_exists(#unused_vc, :emptyList), :vcValue)",
    ExpressionAttributeNames={"#unused_vc": "UnusedVC"},
    ExpressionAttributeValues={
        ":emptyList": [],
        ":vcValue": [vc_a]
    }
)
```

## 6. Error Handling & Recovery

### 6.1 Lock Timeout Handling
- **No automatic timeout**: Lock must be manually released
- **Recovery**: `finally` block ensures `release_lock()` is called
- **Error Response**: 423 status code when locked

### 6.2 Queue State Management
- **Failed Matches**: Increment `range_spread_count` for unmatched players
- **Queue Cleanup**: Remove matched players from queue
- **META Updates**: Update rate_list and range_list after changes

### 6.3 Match ID Collision Prevention
```python
meta_item = queue_table.get_item(Key={"namespace": "default", "user_id": "#META#"})
match_id_base = int(meta_item.get("LatestMatchID", 0))
# Assign sequential IDs: match_id_base + 1, match_id_base + 2, ...
new_match_id_base = match_id_base + len(matched_groups)
```

### 6.4 User Assignment Protection
```python
# Check if user is already in a match
assigned_match_id = user_item.get("assigned_match_id", 0)
if assigned_match_id != 0:
    # User already assigned, reject enqueue
    return {"statusCode": 200, "body": None}
```

## 7. Integration Points & External APIs

### 7.1 SQS Message Processing
- **Queue Type**: FIFO queue with content-based deduplication
- **Handler**: `db_process_queue_handler`
- **Actions**: `match_make`, `match_report`, `match_judge`
- **Message Format**:
```json
{
  "action": "match_make",
  "payload": {...}
}
```

### 7.2 Discord Notifications
```python
async def notify_discord(match_id, vc_a, vc_b, team_a, team_b):
    content = (
        f"**VC有りバトルでマッチしました**\r"
        f"先攻チーム VC{vc_a}\r {team_a_str}\r\r"
        f"後攻チーム VC{vc_b}\r {team_b_str}\r\r"
        f"ID: ||{match_id}||\r"
    )
    # Send to webhook URL
```

### 7.3 Bubble API Integration
- **Match Assignment**: POST to `BUBBLE_ASSIGN_MATCH_URL`
- **Penalty System**: POST to `BUBBLE_PENALTY`
- **Authentication**: Bearer token in headers

### 7.4 WebSocket Broadcasting
- **Queue Updates**: Broadcast queue count changes
- **Connection Management**: Track active connections
- **Rate Limiting**: 1-second minimum interval between broadcasts

## 8. Match Result Processing

### 8.1 Report Collection
- **Timeout Strategy**: Dynamic threshold based on `judge_timeout_count`
- **Thresholds**: `[10, 9, 8, 8, 7, 7, 7, 6, 6, 6, 6, 5, 5, 5, 5, 5]`
- **Decision Logic**: 
  - A-win if A votes > B votes + Invalid votes
  - B-win if B votes > A votes + Invalid votes  
  - Invalid otherwise

### 8.2 Rating Calculation
- **Algorithm**: ELO with K-factor = 16
- **Newbie Bonus**: +5 rating for first 20 matches
- **Formula**: `ELO_CONST * (1 - (1 / (10^((rate_lose - rate_win) / 400) + 1)))`

### 8.3 User Data Updates
```python
new_rate = current_rate + rate_delta + (5 if games < 20 else 0)
new_max_rate = max(current_max_rate, new_rate)
new_winrate = round(wins * 100 / total_games)
```

### 8.4 Record Table Schema
```yaml
TableName: {stage}-{service}-record-table
KeySchema:
  - user_id (HASH)
  - match_id (RANGE, Number)
GlobalSecondaryIndexes:
  - started_date_index (user_id, started_date)
```

## 9. Database Schemas

### 9.1 Match Queue Table
```yaml
AttributeDefinitions:
  - namespace (S)
  - user_id (S)
  - rate (N)
LocalSecondaryIndexes:
  - rate_index (namespace, rate)
```

### 9.2 User Table
```yaml
AttributeDefinitions:
  - namespace (S)
  - user_id (S)
  - rate (N)
LocalSecondaryIndexes:
  - rate_index (namespace, rate)
```

### 9.3 Essential User Fields
- `rate`: Current ELO rating
- `unitemate_max_rate`: Highest achieved rating
- `assigned_match_id`: Current match assignment (0 if none)
- `unitemate_num_record`: Total games played
- `unitemate_num_win`: Total wins
- `unitemate_winrate`: Win percentage
- `unitemate_last_rate_delta`: Last rating change
- `unitemate_penalty`: Penalty points

## 10. Critical Implementation Notes

### 10.1 Timing Requirements
- **Match Processing**: Every 20 seconds when scheduled
- **Result Judging**: Every 5 minutes for active matches
- **Lock Duration**: Must not exceed Lambda timeout (15 seconds)

### 10.2 Data Consistency
- **Sequential Match IDs**: Must increment atomically
- **VC Allocation**: Must prevent double-assignment
- **User Assignment**: Must prevent double-booking

### 10.3 Backward Compatibility
- **API Contracts**: All existing endpoints must work unchanged
- **Data Formats**: DynamoDB items must maintain exact structure
- **Business Logic**: Rating calculations and team formation must be identical

### 10.4 Performance Requirements  
- **Queue Capacity**: Support 100+ concurrent players
- **Match Creation**: Handle multiple simultaneous groups
- **Response Times**: API calls under 5 seconds
- **VC Pool**: Support 50+ concurrent matches

## 11. Migration Considerations

### 11.1 State Preservation
- Existing queue items must be preserved
- META item structure must remain compatible
- Match IDs must continue sequential numbering

### 11.2 Feature Parity
- All current matchmaking logic must be replicated
- Role assignment and Pokemon systems must integrate
- Discord/Bubble integrations must remain functional

### 11.3 Testing Requirements
- End-to-end matchmaking scenarios
- Error recovery and timeout handling
- Lock contention and race conditions
- VC allocation edge cases

This specification provides the complete blueprint for maintaining Legacy system compatibility while implementing the new matchmaking features.