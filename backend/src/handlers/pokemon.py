"""Lambda handlers for pokemon-related API endpoints."""

import json

from src.models.pokemon import CreatePokemonRequest, PokemonRole, UpdatePokemonRequest
from src.services.pokemon_service import PokemonService
from src.utils.response import create_error_response, create_success_response


def get_all_pokemon(event: dict, _context: object) -> dict:
    """全ポケモン取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: ポケモン一覧またはエラーレスポンス.

    """
    query_params = event.get("queryStringParameters") or {}
    include_inactive = query_params.get("include_inactive", "false").lower() == "true"

    pokemon_service = PokemonService()
    pokemon_list = pokemon_service.get_all_pokemon(include_inactive)

    return create_success_response([p.model_dump() for p in pokemon_list])


def get_pokemon(event: dict, _context: object) -> dict:
    """ポケモン情報取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: ポケモン情報またはエラーレスポンス.

    """
    pokemon_id = event["pathParameters"]["pokemonId"]

    pokemon_service = PokemonService()
    pokemon = pokemon_service.get_pokemon_by_id(pokemon_id)

    if not pokemon:
        return create_error_response(404, "Pokemon not found")

    return create_success_response(pokemon.model_dump())


def get_pokemon_by_role(event: dict, _context: object) -> dict:
    """ロール別ポケモン取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: ポケモン一覧またはエラーレスポンス.

    """
    role_str = event["pathParameters"]["role"].upper()

    try:
        role = PokemonRole(role_str)
    except ValueError:
        return create_error_response(400, f"Invalid role: {role_str}")

    query_params = event.get("queryStringParameters") or {}
    include_inactive = query_params.get("include_inactive", "false").lower() == "true"

    pokemon_service = PokemonService()
    pokemon_list = pokemon_service.get_pokemon_by_role(role, include_inactive)

    return create_success_response([p.model_dump() for p in pokemon_list])


def search_pokemon(event: dict, _context: object) -> dict:
    """ポケモン検索.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 検索結果またはエラーレスポンス.

    """
    query_params = event.get("queryStringParameters") or {}
    keyword = query_params.get("q", "")

    if not keyword:
        return create_error_response(400, "Search keyword is required")

    pokemon_service = PokemonService()
    pokemon_list = pokemon_service.search_pokemon(keyword)

    return create_success_response([p.model_dump() for p in pokemon_list])


def get_pokemon_by_difficulty(event: dict, _context: object) -> dict:
    """難易度別ポケモン取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: ポケモン一覧またはエラーレスポンス.

    """
    query_params = event.get("queryStringParameters") or {}
    min_difficulty = int(query_params.get("min", "1"))
    max_difficulty = int(query_params.get("max", "5"))

    if not (1 <= min_difficulty <= 5) or not (1 <= max_difficulty <= 5):
        return create_error_response(400, "Difficulty must be between 1 and 5")

    if min_difficulty > max_difficulty:
        return create_error_response(400, "Min difficulty must be less than or equal to max difficulty")

    pokemon_service = PokemonService()
    pokemon_list = pokemon_service.get_pokemon_by_difficulty(min_difficulty, max_difficulty)

    return create_success_response([p.model_dump() for p in pokemon_list])


def create_pokemon(event: dict, _context: object) -> dict:
    """ポケモン作成（管理者用）.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 作成されたポケモン情報またはエラーレスポンス.

    """
    try:
        body_data = json.loads(event["body"])
        request = CreatePokemonRequest(**body_data)
    except ValueError as e:
        return create_error_response(400, str(e))

    pokemon_service = PokemonService()
    pokemon = pokemon_service.create_pokemon(request)

    if not pokemon:
        return create_error_response(409, "Pokemon with this ID already exists")

    return create_success_response(pokemon.model_dump(), 201)


def update_pokemon(event: dict, _context: object) -> dict:
    """ポケモン更新（管理者用）.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 更新されたポケモン情報またはエラーレスポンス.

    """
    pokemon_id = event["pathParameters"]["pokemonId"]

    try:
        body_data = json.loads(event["body"])
        request = UpdatePokemonRequest(**body_data)
    except ValueError as e:
        return create_error_response(400, str(e))

    pokemon_service = PokemonService()
    pokemon = pokemon_service.update_pokemon(pokemon_id, request)

    if not pokemon:
        return create_error_response(404, "Pokemon not found")

    return create_success_response(pokemon.model_dump())


def deactivate_pokemon(event: dict, _context: object) -> dict:
    """ポケモン無効化（管理者用）.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 更新されたポケモン情報またはエラーレスポンス.

    """
    pokemon_id = event["pathParameters"]["pokemonId"]

    pokemon_service = PokemonService()
    pokemon = pokemon_service.deactivate_pokemon(pokemon_id)

    if not pokemon:
        return create_error_response(404, "Pokemon not found")

    return create_success_response(pokemon.model_dump())


def activate_pokemon(event: dict, _context: object) -> dict:
    """ポケモン有効化（管理者用）.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 更新されたポケモン情報またはエラーレスポンス.

    """
    pokemon_id = event["pathParameters"]["pokemonId"]

    pokemon_service = PokemonService()
    pokemon = pokemon_service.activate_pokemon(pokemon_id)

    if not pokemon:
        return create_error_response(404, "Pokemon not found")

    return create_success_response(pokemon.model_dump())


def get_pokemon_usage_stats(event: dict, _context: object) -> dict:
    """ポケモン使用統計取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: 使用統計またはエラーレスポンス.

    """
    query_params = event.get("queryStringParameters") or {}
    days = int(query_params.get("days", "30"))

    pokemon_service = PokemonService()
    stats = pokemon_service.get_pokemon_usage_stats(days)

    return create_success_response([s.model_dump() for s in stats])


def get_meta_report(event: dict, _context: object) -> dict:
    """メタレポート取得.

    Args:
        event (dict): Lambdaイベントオブジェクト.
        _context (object): Lambda実行コンテキスト.

    Returns:
        dict: メタレポートまたはエラーレスポンス.

    """
    pokemon_service = PokemonService()
    report = pokemon_service.get_meta_report()

    return create_success_response(report)
