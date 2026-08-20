"""
memory/memory_manager.py
Memória leve do Atlas:
- profile.json      -> dados fixos do usuário (nome, preferências gerais)
- facts.json         -> fatos curtos aprendidos ("usuário prefere respostas curtas")
- preferences.json   -> preferências de comportamento
- history.db (SQLite) -> histórico de conversas, com limite de tamanho

Tudo é opcional e limitado (config: memory_max_facts / memory_max_history)
para evitar crescimento infinito de RAM/armazenamento.
"""

import json
import os
import sqlite3
import time

MEMORY_DIR = os.path.dirname(os.path.abspath(__file__))
PROFILE_PATH = os.path.join(MEMORY_DIR, "profile.json")
FACTS_PATH = os.path.join(MEMORY_DIR, "facts.json")
PREFERENCES_PATH = os.path.join(MEMORY_DIR, "preferences.json")
HISTORY_DB_PATH = os.path.join(MEMORY_DIR, "history.db")


def _load_json(path: str, default):
    if not os.path.exists(path):
        return default
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return default


def _save_json(path: str, data) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


class MemoryManager:
    def __init__(self, enabled: bool = True, max_facts: int = 200, max_history: int = 100):
        self.enabled = enabled
        self.max_facts = max_facts
        self.max_history = max_history
        self._init_db()

    def _init_db(self) -> None:
        if not self.enabled:
            return
        conn = sqlite3.connect(HISTORY_DB_PATH)
        conn.execute(
            """CREATE TABLE IF NOT EXISTS history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                ts REAL NOT NULL
            )"""
        )
        conn.commit()
        conn.close()

    # ---------- profile / preferences ----------

    def get_profile(self) -> dict:
        return _load_json(PROFILE_PATH, {})

    def set_profile(self, data: dict) -> None:
        _save_json(PROFILE_PATH, data)

    def get_preferences(self) -> dict:
        return _load_json(PREFERENCES_PATH, {})

    def set_preference(self, key: str, value) -> None:
        prefs = self.get_preferences()
        prefs[key] = value
        _save_json(PREFERENCES_PATH, prefs)

    # ---------- facts ----------

    def add_fact(self, fact: str) -> None:
        if not self.enabled:
            return
        facts = _load_json(FACTS_PATH, [])
        if fact not in facts:
            facts.append(fact)
        if len(facts) > self.max_facts:
            facts = facts[-self.max_facts:]
        _save_json(FACTS_PATH, facts)

    def get_facts(self) -> list:
        return _load_json(FACTS_PATH, [])

    # ---------- history ----------

    def add_message(self, role: str, content: str) -> None:
        if not self.enabled:
            return
        conn = sqlite3.connect(HISTORY_DB_PATH)
        conn.execute(
            "INSERT INTO history (role, content, ts) VALUES (?, ?, ?)",
            (role, content, time.time()),
        )
        # mantém só as últimas N mensagens
        conn.execute(
            """DELETE FROM history WHERE id NOT IN (
                SELECT id FROM history ORDER BY id DESC LIMIT ?
            )""",
            (self.max_history,),
        )
        conn.commit()
        conn.close()

    def get_history(self, limit: int = 20) -> list:
        if not self.enabled or not os.path.exists(HISTORY_DB_PATH):
            return []
        conn = sqlite3.connect(HISTORY_DB_PATH)
        rows = conn.execute(
            "SELECT role, content FROM history ORDER BY id DESC LIMIT ?", (limit,)
        ).fetchall()
        conn.close()
        return [{"role": r, "content": c} for r, c in reversed(rows)]

    def build_context(self) -> str:
        """Resumo curto de memória para injetar no prompt (leve, sem embeddings)."""
        if not self.enabled:
            return ""
        facts = self.get_facts()
        profile = self.get_profile()
        parts = []
        if profile:
            parts.append(f"Perfil: {profile}")
        if facts:
            parts.append("Fatos conhecidos: " + "; ".join(facts[-10:]))
        return "\n".join(parts)

    def clear(self) -> None:
        _save_json(FACTS_PATH, [])
        if os.path.exists(HISTORY_DB_PATH):
            os.remove(HISTORY_DB_PATH)
        self._init_db()
