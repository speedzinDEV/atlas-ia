"""
tools/shell.py
Execução de comandos de shell. Só deve ser chamado depois que
core/security.py já validou e (se necessário) confirmou o comando.
"""

import subprocess

TIMEOUT_SECONDS = 20


def run(command: str) -> dict:
    try:
        result = subprocess.run(
            command,
            shell=True,
            capture_output=True,
            text=True,
            timeout=TIMEOUT_SECONDS,
        )
        return {
            "command": command,
            "exit_code": result.returncode,
            "stdout": result.stdout[-4000:],
            "stderr": result.stderr[-2000:],
        }
    except subprocess.TimeoutExpired:
        return {"error": f"Comando excedeu {TIMEOUT_SECONDS}s e foi encerrado."}
    except OSError as e:
        return {"error": str(e)}
