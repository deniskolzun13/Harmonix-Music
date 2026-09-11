import logging
from typing import Dict, Optional, Tuple
from app.models import PlatformEnum, AuthConfig, AuthStatus
from app.platforms.base import BasePlatformAdapter
from app.platforms.yandex_adapter import YandexMusicAdapter
from app.platforms.vk_adapter import VkMusicAdapter
from app.platforms.spotify_adapter import SpotifyAdapter
from app.platforms.demo_adapter import DemoPlatformAdapter
from app.config import load_auth_config, save_auth_config

logger = logging.getLogger("harmonix.manager")

class PlatformManager:
    def __init__(self):
        self.config: AuthConfig = load_auth_config()
        self.adapters: Dict[PlatformEnum, BasePlatformAdapter] = {}
        self.demo_adapters: Dict[PlatformEnum, BasePlatformAdapter] = {
            PlatformEnum.YANDEX: DemoPlatformAdapter(PlatformEnum.YANDEX),
            PlatformEnum.VK: DemoPlatformAdapter(PlatformEnum.VK),
            PlatformEnum.SPOTIFY: DemoPlatformAdapter(PlatformEnum.SPOTIFY),
        }
        self._init_adapters()

    def _init_adapters(self):
        # Yandex
        self.adapters[PlatformEnum.YANDEX] = YandexMusicAdapter(token=self.config.yandex_token)
        # VK
        self.adapters[PlatformEnum.VK] = VkMusicAdapter(token=self.config.vk_token)
        # Spotify
        self.adapters[PlatformEnum.SPOTIFY] = SpotifyAdapter(
            client_id=self.config.spotify_client_id,
            client_secret=self.config.spotify_client_secret,
            refresh_token=self.config.spotify_refresh_token,
            access_token=getattr(self.config, 'spotify_token', None)
        )

    def get_adapter(self, platform: PlatformEnum, allow_demo: bool = True) -> BasePlatformAdapter:
        adapter = self.adapters.get(platform)
        if adapter and adapter.is_authenticated():
            return adapter
        if allow_demo:
            return self.demo_adapters.get(platform)
        return adapter

    def get_auth_status(self) -> AuthStatus:
        ym = self.adapters.get(PlatformEnum.YANDEX)
        vk = self.adapters.get(PlatformEnum.VK)
        sp = self.adapters.get(PlatformEnum.SPOTIFY)

        ym_ok, ym_name = ym.get_user_info() if ym else (False, None)
        vk_ok, vk_name = vk.get_user_info() if vk else (False, None)
        sp_ok, sp_name = sp.get_user_info() if sp else (False, None)

        return AuthStatus(
            yandex=ym_ok,
            yandex_username=ym_name,
            vk=vk_ok,
            vk_username=vk_name,
            spotify=sp_ok,
            spotify_username=sp_name
        )

    def update_tokens(self, new_config: AuthConfig):
        self.config = new_config
        save_auth_config(self.config)
        self._init_adapters()

manager = PlatformManager()
