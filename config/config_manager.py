"""
config_manager.py
Carrega e gerencia a configuração do Atlas.
Leve: apenas JSON padrão da biblioteca, sem dependências externas.
"""

import json
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CONFIG_DIR = os.path.join(BASE_DIR, "config")
DEFAULT_CONFIG_PATH = os.path.join(CONFIG_DIR, "config.json")
LOW_MEMORY_CONFIG_PATH = os.path.join(CONFIG_DIR, "config.low_memory.json")

_DEFAULTS = {
    "model": "models/atlas.gguf",
    "llama_bin": "llama-cli",
    "llama_server_bin": "llama-server",
    "context_size": 2048,
    "threads": 4,
    "temperature": 0.7,
    "max_tokens": 256,
    "gpu_layers": 0,
    "memory": True,
    "memory_max_facts": 200,
    "memory_max_history": 100,
    "voice": False,
    "web": False,
    "confirm_destructive": True,
    "low_memory": False,
    "personality": {"name": "Atlas", "tone": "objetivo, educado, direto"},
}


class ConfigManager:
    """Gerencia leitura, escrita e valores padrão da configuração."""

    def __init__(self, low_memory: bool = False):
        path = LOW_MEMORY_CONFIG_PATH if low_memory else DEFAULT_CONFIG_PATH
        self.path = path
        self.data = self._load(path)

    def _load(self, path: str) -> dict:
        if not os.path.exists(path):
            self._write(path, _DEFAULTS)
            return dict(_DEFAULTS)
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            merged = dict(_DEFAULTS)
            merged.update(data)
            return merged
        except (json.JSONDecodeError, OSError):
            # Config corrompida: cai para os padrões sem travar o Atlas.
            return dict(_DEFAULTS)

    def _write(self, path: str, data: dict) -> None:
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def get(self, key: str, default=None):
        return self.data.get(key, default)

    def set(self, key: str, value) -> None:
        self.data[key] = value
        self._write(self.path, self.data)

    def all(self) -> dict:
        return dict(self.data)

    def model_path(self) -> str:
        model = self.data.get("model", "models/atlas.gguf")
        if os.path.isabs(model):
            return model
        return os.path.join(BASE_DIR, model)
