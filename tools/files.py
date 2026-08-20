"""
tools/files.py
Ferramentas de leitura/escrita/organização de arquivos.
Todas as operações destrutivas passam pela camada de segurança (core/security.py)
antes de chegarem aqui — este módulo assume que já foi autorizado.
"""

import os
import shutil

MAX_READ_BYTES = 200_000  # limite de leitura para não estourar contexto/RAM


def read(path: str) -> dict:
    path = os.path.expanduser(path)
    if not os.path.isfile(path):
        return {"error": f"Arquivo não encontrado: {path}"}
    try:
        size = os.path.getsize(path)
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            content = f.read(MAX_READ_BYTES)
        truncated = size > MAX_READ_BYTES
        return {"path": path, "content": content, "truncated": truncated}
    except OSError as e:
        return {"error": str(e)}


def list_dir(path: str = ".") -> dict:
    path = os.path.expanduser(path)
    if not os.path.isdir(path):
        return {"error": f"Diretório não encontrado: {path}"}
    try:
        entries = sorted(os.listdir(path))
        return {"path": path, "entries": entries}
    except OSError as e:
        return {"error": str(e)}


def create(path: str, content: str = "") -> dict:
    path = os.path.expanduser(path)
    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        if os.path.exists(path):
            return {"error": f"Arquivo já existe: {path} (use files.write para sobrescrever)"}
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return {"path": path, "created": True}
    except OSError as e:
        return {"error": str(e)}


def write(path: str, content: str, append: bool = False) -> dict:
    path = os.path.expanduser(path)
    mode = "a" if append else "w"
    try:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with open(path, mode, encoding="utf-8") as f:
            f.write(content)
        return {"path": path, "written": True, "append": append}
    except OSError as e:
        return {"error": str(e)}


def delete(path: str) -> dict:
    path = os.path.expanduser(path)
    try:
        if os.path.isdir(path):
            shutil.rmtree(path)
        elif os.path.isfile(path):
            os.remove(path)
        else:
            return {"error": f"Caminho não encontrado: {path}"}
        return {"path": path, "deleted": True}
    except OSError as e:
        return {"error": str(e)}


def move(src: str, dst: str) -> dict:
    src, dst = os.path.expanduser(src), os.path.expanduser(dst)
    try:
        os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
        shutil.move(src, dst)
        return {"src": src, "dst": dst, "moved": True}
    except OSError as e:
        return {"error": str(e)}
