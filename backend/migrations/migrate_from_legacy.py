#!/usr/bin/env python3
"""Migration script to transfer data from legacy backend to new backend."""

import sys
from pathlib import Path
from typing import Any

import boto3

# Add the src directory to Python path
sys.path.append(str(Path(__file__).parent.parent / "src"))

from models.record import Record
from models.user import User
from repositories.record_repository import RecordRepository
from repositories.user_repository import UserRepository


class LegacyMigrator:
    """Migrates data from legacy backend to new backend."""

    def __init__(self, legacy_stage: str = "dev", new_stage: str = "dev") -> None:
        self.legacy_stage = legacy_stage
        self.new_stage = new_stage

        # Legacy table names (based on legacy serverless.yml)
        self.legacy_tables = {
            "users": f"{legacy_stage}-unitemate-users",
            "matches": f"{legacy_stage}-unitemate-matches",
            "records": f"{legacy_stage}-unitemate-record-table",
            "queue": f"{legacy_stage}-unitemate-match-queue",
        }

        # New repositories
        self.user_repo = UserRepository()
        self.record_repo = RecordRepository()

        # DynamoDB client
        self.dynamodb = boto3.resource("dynamodb")

    def migrate_users(self) -> dict[str, int]:
        """Migrate users from legacy to new format."""
        print("Starting user migration...")

        legacy_table = self.dynamodb.Table(self.legacy_tables["users"])

        stats = {"success": 0, "errors": 0, "skipped": 0}

        try:
            # Scan all users from legacy table
            response = legacy_table.scan()
            users = response.get("Items", [])

            # Handle pagination if needed
            while "LastEvaluatedKey" in response:
                response = legacy_table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
                users.extend(response.get("Items", []))

            print(f"Found {len(users)} users in legacy table")

            for legacy_user in users:
                try:
                    # Skip if user already exists in new format
                    discord_id = legacy_user.get("user_id", "")
                    if self.user_repo.get_user_by_user_id(discord_id):
                        print(f"User {discord_id} already exists, skipping")
                        stats["skipped"] += 1
                        continue

                    # Convert legacy user format to new format
                    new_user = self._convert_legacy_user(legacy_user)

                    if self.user_repo.create_user(new_user):
                        print(f"✓ Migrated user: {discord_id}")
                        stats["success"] += 1
                    else:
                        print(f"✗ Failed to create user: {discord_id}")
                        stats["errors"] += 1

                except Exception as e:
                    print(f"✗ Error migrating user {legacy_user.get('user_id', 'unknown')}: {e}")
                    stats["errors"] += 1

        except Exception as e:
            print(f"Error accessing legacy users table: {e}")
            stats["errors"] += 1

        return stats

    def migrate_records(self) -> Dict[str, int]:
        """Migrate match records from legacy to new format."""
        print("Starting record migration...")

        legacy_table = self.dynamodb.Table(self.legacy_tables["records"])

        stats = {"success": 0, "errors": 0, "skipped": 0}

        try:
            # Scan all records from legacy table
            response = legacy_table.scan()
            records = response.get("Items", [])

            # Handle pagination if needed
            while "LastEvaluatedKey" in response:
                response = legacy_table.scan(ExclusiveStartKey=response["LastEvaluatedKey"])
                records.extend(response.get("Items", []))

            print(f"Found {len(records)} records in legacy table")

            for legacy_record in records:
                try:
                    # Convert legacy record format to new format
                    new_record = self._convert_legacy_record(legacy_record)

                    # Skip if record already exists
                    if self.record_repo.get_record(new_record.record_id):
                        stats["skipped"] += 1
                        continue

                    if self.record_repo.create_record(new_record):
                        print(f"✓ Migrated record: {new_record.record_id}")
                        stats["success"] += 1
                    else:
                        print(f"✗ Failed to create record: {new_record.record_id}")
                        stats["errors"] += 1

                except Exception as e:
                    print(f"✗ Error migrating record: {e}")
                    stats["errors"] += 1

        except Exception as e:
            print(f"Error accessing legacy records table: {e}")
            stats["errors"] += 1

        return stats

    def _convert_legacy_user(self, legacy_user: Dict[str, Any]) -> User:
        """Convert legacy user format to new User model."""
        # Extract data from legacy format (namespace-based)
        user_id = legacy_user.get("user_id", "")

        # Map legacy fields to new fields
        return User(
            user_id=user_id,  # Discord ID
            auth0_sub=f"discord|{user_id}",  # Generate Auth0 sub
            discord_username=legacy_user.get("discord_username", ""),
            discord_discriminator=legacy_user.get("discord_discriminator"),
            discord_avatar_url=legacy_user.get("discord_avatar_url", ""),
            trainer_name=legacy_user.get("trainer_name", legacy_user.get("discord_username", "")),
            twitter_id=legacy_user.get("twitter_id"),
            preferred_roles=legacy_user.get("preferred_roles", []),
            favorite_pokemon=legacy_user.get("favorite_pokemon", []),
            current_badge=legacy_user.get("current_badge"),
            bio=legacy_user.get("bio"),
            rate=int(legacy_user.get("rate", 1500)),
            max_rate=int(legacy_user.get("unitemate_max_rate", legacy_user.get("rate", 1500))),
            match_count=int(legacy_user.get("unitemate_num_record", 0)),
            win_count=int(legacy_user.get("unitemate_num_win", 0)),
            win_rate=float(legacy_user.get("unitemate_winrate", 0.0)),
            penalty_count=int(legacy_user.get("penalty_count", 0)),
            season_data=legacy_user.get("season_data", []),
            created_at=int(legacy_user.get("created_at", 0)) or int(__import__("datetime").datetime.now().timestamp()),
            updated_at=int(legacy_user.get("updated_at", 0)) or int(__import__("datetime").datetime.now().timestamp()),
        )

    def _convert_legacy_record(self, legacy_record: Dict[str, Any]) -> Record:
        """Convert legacy record format to new Record model."""
        import uuid

        # Generate new record ID
        record_id = f"record_{uuid.uuid4().hex[:12]}"

        return Record(
            record_id=record_id,
            user_id=legacy_record.get("user_id", ""),
            match_id=str(legacy_record.get("match_id", "")),
            pokemon=legacy_record.get("pokemon", ""),
            result="win" if legacy_record.get("winlose", False) else "loss",
            rate_before=int(legacy_record.get("rate_before", 1500)),
            rate_after=int(legacy_record.get("rate_after", 1500)),
            rate_delta=int(legacy_record.get("rate_delta", 0)),
            team_a_players=legacy_record.get("team_A", []),
            team_b_players=legacy_record.get("team_B", []),
            started_date=int(legacy_record.get("started_date", 0))
            or int(__import__("datetime").datetime.now().timestamp()),
            created_at=int(legacy_record.get("created_at", 0))
            or int(__import__("datetime").datetime.now().timestamp()),
            updated_at=int(__import__("datetime").datetime.now().timestamp()),
        )

    def run_full_migration(self):
        """Run complete migration from legacy to new backend."""
        print("Starting full migration from legacy backend...")
        print(f"Legacy stage: {self.legacy_stage}")
        print(f"New stage: {self.new_stage}")
        print("=" * 50)

        # Migrate users first
        user_stats = self.migrate_users()
        print(
            f"User migration: {user_stats['success']} success, {user_stats['errors']} errors, {user_stats['skipped']} skipped"
        )
        print()

        # Migrate records
        record_stats = self.migrate_records()
        print(
            f"Record migration: {record_stats['success']} success, {record_stats['errors']} errors, {record_stats['skipped']} skipped"
        )
        print()

        print("Migration completed!")
        print(f"Total success: {user_stats['success'] + record_stats['success']}")
        print(f"Total errors: {user_stats['errors'] + record_stats['errors']}")
        print(f"Total skipped: {user_stats['skipped'] + record_stats['skipped']}")


def main():
    """Main migration function."""
    import argparse

    parser = argparse.ArgumentParser(description="Migrate data from legacy backend")
    parser.add_argument("--legacy-stage", default="dev", help="Legacy backend stage (default: dev)")
    parser.add_argument("--new-stage", default="dev", help="New backend stage (default: dev)")
    parser.add_argument("--users-only", action="store_true", help="Migrate only users")
    parser.add_argument("--records-only", action="store_true", help="Migrate only records")

    args = parser.parse_args()

    migrator = LegacyMigrator(args.legacy_stage, args.new_stage)

    if args.users_only:
        stats = migrator.migrate_users()
        print(f"User migration completed: {stats}")
    elif args.records_only:
        stats = migrator.migrate_records()
        print(f"Record migration completed: {stats}")
    else:
        migrator.run_full_migration()


if __name__ == "__main__":
    main()
