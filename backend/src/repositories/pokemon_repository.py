import os

import boto3
from boto3.dynamodb.conditions import Attr, Key
from botocore.exceptions import ClientError

from ..models.pokemon import Pokemon, PokemonRole


class PokemonRepository:
    def __init__(self):
        self.dynamodb = boto3.resource("dynamodb")
        self.table = self.dynamodb.Table(os.environ["POKEMON_TABLE_NAME"])

    def get_by_pokemon_id(self, pokemon_id: str) -> Pokemon | None:
        try:
            response = self.table.get_item(Key={"pokemon_id": pokemon_id})
            if "Item" not in response:
                return None
            return Pokemon(**response["Item"])
        except ClientError as e:
            print(f"Error getting pokemon by pokemon_id {pokemon_id}: {e}")
            return None

    def get_all(self, include_inactive: bool = False) -> list[Pokemon]:
        try:
            if include_inactive:
                response = self.table.scan()
            else:
                response = self.table.scan(FilterExpression=Attr("is_active").eq(True))
            return [Pokemon(**item) for item in response.get("Items", [])]
        except ClientError as e:
            print(f"Error getting all pokemon: {e}")
            return []

    def get_by_role(self, role: PokemonRole, include_inactive: bool = False) -> list[Pokemon]:
        try:
            response = self.table.query(IndexName="RoleIndex", KeyConditionExpression=Key("role").eq(role.value))
            pokemon_list = [Pokemon(**item) for item in response.get("Items", [])]

            if not include_inactive:
                pokemon_list = [p for p in pokemon_list if p.is_active]

            return pokemon_list
        except ClientError as e:
            print(f"Error getting pokemon by role {role}: {e}")
            return []

    def search_by_name(self, keyword: str) -> list[Pokemon]:
        try:
            # 日本語名と英語名の両方で検索
            response = self.table.scan(
                FilterExpression=Attr("name_ja").contains(keyword) | Attr("name_en").contains(keyword.lower())
            )
            return [Pokemon(**item) for item in response.get("Items", [])]
        except ClientError as e:
            print(f"Error searching pokemon by name {keyword}: {e}")
            return []

    def create(self, pokemon: Pokemon) -> bool:
        try:
            # pokemon_idの重複チェック
            existing_pokemon = self.get_by_pokemon_id(pokemon.pokemon_id)
            if existing_pokemon:
                print(f"Pokemon with pokemon_id {pokemon.pokemon_id} already exists")
                return False

            self.table.put_item(Item=pokemon.model_dump())
            return True
        except ClientError as e:
            print(f"Error creating pokemon: {e}")
            return False

    def update(self, pokemon: Pokemon) -> bool:
        try:
            self.table.put_item(Item=pokemon.model_dump())
            return True
        except ClientError as e:
            print(f"Error updating pokemon: {e}")
            return False

    def delete(self, pokemon_id: str) -> bool:
        try:
            self.table.delete_item(Key={"pokemon_id": pokemon_id})
            return True
        except ClientError as e:
            print(f"Error deleting pokemon {pokemon_id}: {e}")
            return False

    def get_active_pokemon_count(self) -> int:
        try:
            response = self.table.scan(FilterExpression=Attr("is_active").eq(True), Select="COUNT")
            return response.get("Count", 0)
        except ClientError as e:
            print(f"Error getting active pokemon count: {e}")
            return 0

    def get_pokemon_by_difficulty(self, min_difficulty: int, max_difficulty: int) -> list[Pokemon]:
        try:
            response = self.table.scan(
                FilterExpression=Attr("difficulty").between(min_difficulty, max_difficulty) & Attr("is_active").eq(True)
            )
            return [Pokemon(**item) for item in response.get("Items", [])]
        except ClientError as e:
            print(f"Error getting pokemon by difficulty range: {e}")
            return []

    def bulk_create(self, pokemon_list: list[Pokemon]) -> bool:
        try:
            with self.table.batch_writer() as batch:
                for pokemon in pokemon_list:
                    batch.put_item(Item=pokemon.model_dump())
            return True
        except ClientError as e:
            print(f"Error bulk creating pokemon: {e}")
            return False
