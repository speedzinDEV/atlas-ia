"""
tools/system.py
Ferramentas de leitura de informações do dispositivo (RAM, armazenamento,
bateria, info do Android/Termux). Usa apenas comandos nativos, sem libs pesadas.
"""

import os
import shutil
import subprocess


def _run(cmd: list) -> str:
    try:
        out = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
        return out.stdout.strip()
    except (FileNotFoundError, subprocess.TimeoutExpired, OSError):
        return ""


def ram() -> dict:
    """Retorna RAM total/disponível em MB. Usa /proc/meminfo (Linux/Termux)."""
    info = {}
    try:
        with open("/proc/meminfo", "r") as f:
            for line in f:
                if line.startswith(("MemTotal:", "MemAvailable:", "MemFree:")):
                    key, val = line.split(":")
                    kb = int(val.strip().split()[0])
                    info[key] = round(kb / 1024, 1)  # MB
        return {
            "total_mb": info.get("MemTotal"),
            "available_mb": info.get("MemAvailable", info.get("MemFree")),
        }
    except OSError:
        return {"error": "Não foi possível ler /proc/meminfo"}


def storage(path: str = "/data/data/com.termux/files/home") -> dict:
    """Retorna espaço em disco (GB) para o caminho informado."""
    target = path if os.path.exists(path) else os.path.expanduser("~")
    try:
        total, used, free = shutil.disk_usage(target)
        return {
            "path": target,
            "total_gb": round(total / (1024 ** 3), 2),
            "used_gb": round(used / (1024 ** 3), 2),
            "free_gb": round(free / (1024 ** 3), 2),
        }
    except OSError as e:
        return {"error": str(e)}


def battery() -> dict:
    """Usa termux-battery-status se o pacote termux-api estiver instalado."""
    out = _run(["termux-battery-status"])
    if not out:
        return {"error": "termux-api não disponível (instale: pkg install termux-api)"}
    import json
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return {"raw": out}


def device_info() -> dict:
    """Informações básicas do ambiente Android/Termux."""
    info = {
        "termux_version": _run(["termux-info"]) or "desconhecido",
        "python_version": _run(["python", "--version"]),
        "uname": _run(["uname", "-a"]),
    }
    return info
