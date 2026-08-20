"""
brain/llm_engine.py
Motor de inferência local usando llama.cpp.

Estratégia (leve, sem libs pesadas):
- O Atlas NÃO mantém o modelo carregado o tempo todo.
- Na primeira mensagem de uma sessão, sobe o `llama-server` (llama.cpp)
  em localhost como subprocess.
- Conversa acontece via HTTP local (stdlib apenas: urllib).
- Ao encerrar o Atlas (ou por inatividade), o processo é finalizado.

Requer que o binário `llama-server` (compilado do llama.cpp) esteja
disponível no PATH ou apontado em config.json -> "llama_server_bin".
Compile o llama.cpp separadamente (ver install.sh) — o Atlas apenas
consome o binário já compilado, mantendo o núcleo em Python leve.
"""

import json
import os
import shutil
import subprocess
import time
import urllib.error
import urllib.request

DEFAULT_HOST = "127.0.0.1"
DEFAULT_PORT = 8721
STARTUP_TIMEOUT = 25
POLL_INTERVAL = 0.5


class LlamaRunner:
    def __init__(self, config):
        self.config = config
        self.process = None
        self.host = DEFAULT_HOST
        self.port = DEFAULT_PORT
        self._bin = config.get("llama_server_bin", "llama-server")

    # ---------- ciclo de vida ----------

    def is_running(self) -> bool:
        return self.process is not None and self.process.poll() is None

    def ensure_started(self) -> tuple:
        """Garante que o servidor está no ar. Retorna (ok: bool, msg: str)."""
        if self.is_running():
            return True, "já em execução"

        bin_path = shutil.which(self._bin) or self._bin
        model_path = self.config.model_path() if hasattr(self.config, "model_path") else self.config.get("model")

        if not os.path.exists(model_path):
            return False, (
                f"Modelo GGUF não encontrado em '{model_path}'. "
                "Baixe um modelo (0.5B-3B, quantização Q4) e coloque em models/."
            )

        if shutil.which(self._bin) is None and not os.path.exists(bin_path):
            return False, (
                f"Binário '{self._bin}' não encontrado no PATH. "
                "Compile o llama.cpp (ver install.sh) antes de usar o Atlas."
            )

        cmd = [
            bin_path,
            "-m", model_path,
            "--host", self.host,
            "--port", str(self.port),
            "-c", str(self.config.get("context_size", 2048)),
            "-t", str(self.config.get("threads", 4)),
            "-ngl", str(self.config.get("gpu_layers", 0)),
        ]

        try:
            self.process = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
        except OSError as e:
            return False, f"Falha ao iniciar llama-server: {e}"

        if self._wait_ready():
            return True, "modelo iniciado"

        self.stop()
        return False, "Timeout esperando o modelo iniciar."

    def _wait_ready(self) -> bool:
        deadline = time.time() + STARTUP_TIMEOUT
        health_url = f"http://{self.host}:{self.port}/health"
        while time.time() < deadline:
            if self.process.poll() is not None:
                return False  # processo morreu
            try:
                with urllib.request.urlopen(health_url, timeout=2) as resp:
                    if resp.status == 200:
                        return True
            except (urllib.error.URLError, ConnectionError):
                pass
            time.sleep(POLL_INTERVAL)
        return False

    def stop(self) -> None:
        if self.process and self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self.process.kill()
        self.process = None

    # ---------- inferência ----------

    def generate(self, prompt: str, max_tokens: int = None, temperature: float = None) -> str:
        ok, msg = self.ensure_started()
        if not ok:
            return f"[erro do motor de IA] {msg}"

        payload = {
            "prompt": prompt,
            "n_predict": max_tokens or self.config.get("max_tokens", 256),
            "temperature": temperature if temperature is not None else self.config.get("temperature", 0.7),
            "stop": ["\nUsuário:", "\nUser:"],
        }
        url = f"http://{self.host}:{self.port}/completion"
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=90) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="replace"))
            return data.get("content", "").strip()
        except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as e:
            return f"[erro do motor de IA] {e}"
