from ..models.user import CreateUserRequest, UpdateProfileRequest, User
from ..repositories.user_repository import UserRepository


class UserService:
    def __init__(self):
        self.user_repository = UserRepository()

    def get_user_by_auth0_sub(self, auth0_sub: str) -> User | None:
        return self.user_repository.get_by_auth0_sub(auth0_sub)

    def get_user_by_user_id(self, user_id: str) -> User | None:
        return self.user_repository.get_by_user_id(user_id)

    def create_user(self, user_id: str, auth0_sub: str, request: CreateUserRequest) -> User | None:
        # Discord IDとAuth0 subの両方をチェック
        existing_user = self.user_repository.get_by_user_id(user_id)
        if existing_user:
            return None

        existing_auth0_user = self.user_repository.get_by_auth0_sub(auth0_sub)
        if existing_auth0_user:
            return None

        user = User.create_new_user(
            user_id=user_id,
            auth0_sub=auth0_sub,
            discord_username=request.discord_username,
            discord_discriminator=request.discord_discriminator,
            discord_avatar_url=request.discord_avatar_url,
            trainer_name=request.trainer_name,
        )

        if self.user_repository.create(user):
            return user
        return None

    def update_profile(self, user_id: str, request: UpdateProfileRequest) -> User | None:
        print(f"UserService.update_profile - user_id: {user_id}")
        print(f"UserService.update_profile - request: {request}")

        user = self.user_repository.get_by_user_id(user_id)
        if not user:
            print(f"UserService.update_profile - User not found: {user_id}")
            return None

        print(f"UserService.update_profile - User before update: {user}")

        # 勲章装着時の所持確認
        owned_badges = set(user.owned_badges or [])

        # 勲章装着の場合は所持確認
        if request.current_badge and request.current_badge not in owned_badges:
            print(f"UserService.update_profile - User does not own badge: {request.current_badge}")
            raise ValueError(f"所持していない勲章は装着できません: {request.current_badge}")

        if request.current_badge_2 and request.current_badge_2 not in owned_badges:
            print(f"UserService.update_profile - User does not own badge: {request.current_badge_2}")
            raise ValueError(f"所持していない勲章は装着できません: {request.current_badge_2}")

        # 同じ勲章を装着することを禁止
        if request.current_badge and request.current_badge_2 and request.current_badge == request.current_badge_2:
            print(f"UserService.update_profile - Cannot equip same badge twice: {request.current_badge}")
            raise ValueError("同じ勲章を2つの枠に装着することはできません")

        user.update_profile(
            trainer_name=request.trainer_name,
            twitter_id=request.twitter_id,
            preferred_roles=request.preferred_roles,
            favorite_pokemon=request.favorite_pokemon,
            current_badge=request.current_badge,
            current_badge_2=request.current_badge_2,
            bio=request.bio,
        )

        print(f"UserService.update_profile - User after update: {user}")

        if self.user_repository.update(user):
            print(f"UserService.update_profile - Update successful")
            # 更新後のユーザーを再取得して確認
            updated_user = self.user_repository.get_by_user_id(user_id)
            print(f"UserService.update_profile - User after DB update: {updated_user}")
            return updated_user

        print(f"UserService.update_profile - Update failed")
        return None

    def update_user_stats(self, user_id: str, rate_change: int, is_win: bool) -> User | None:
        user = self.user_repository.get_by_user_id(user_id)
        if not user:
            return None

        user.update_stats(rate_change, is_win)

        if self.user_repository.update(user):
            return user
        return None

    def create_user_auto(
        self,
        auth0_sub: str,
        discord_id: str,
        discord_username: str | None = None,
        discord_discriminator: str | None = None,
        discord_avatar_url: str | None = None,
    ) -> User | None:
        """Auth0認証後に自動的にユーザーを作成する."""
        print(f"UserService.create_user_auto - auth0_sub: {auth0_sub}, discord_id: {discord_id}")
        print(f"UserService.create_user_auto - discord_username: {discord_username}")

        # 既存ユーザーチェック
        existing_user = self.user_repository.get_by_user_id(discord_id)
        if existing_user:
            print(f"UserService.create_user_auto - User already exists: {discord_id}")
            return existing_user

        existing_auth0_user = self.user_repository.get_by_auth0_sub(auth0_sub)
        if existing_auth0_user:
            print(f"UserService.create_user_auto - Auth0 user already exists: {auth0_sub}")
            return existing_auth0_user

        # 自動ユーザー作成（Auth0から取得した情報を使用）
        try:
            user = User.create_new_user(
                user_id=discord_id,
                auth0_sub=auth0_sub,
                discord_username=discord_username
                or f"User_{discord_id[:8]}",  # Auth0から取得できない場合のフォールバック
                discord_discriminator=discord_discriminator,
                discord_avatar_url=discord_avatar_url
                or "https://cdn.discordapp.com/embed/avatars/0.png",  # デフォルトアバター
                trainer_name="",  # デフォルトは空欄
            )

            if self.user_repository.create(user):
                print(f"UserService.create_user_auto - Successfully created user: {discord_id}")
                return user
            else:
                print(f"UserService.create_user_auto - Failed to save user: {discord_id}")
                return None

        except Exception as e:
            print(f"UserService.create_user_auto - Error creating user: {e}")
            return None
