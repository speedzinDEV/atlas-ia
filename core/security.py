"""
security.py
Camada de segurança do Atlas.

Regra de ouro: o modelo NUNCA executa nada diretamente.
Toda 'tool call' passa por aqui antes de ser executada.

Fluxo:
comando solicitado -> validação -> lista de permitidos -> confirmação -> execução
"""

from dataclasses import dataclass


# Ferramentas consideradas seguras (somente leitura / baixo risco)
SAFE_TOOLS = {
    "system.ram",
    "system.storage",
    "system.battery",
    "system.info",
    "files.read",
    "files.list",
    "time.now",
    "web.search",
}

# Ferramentas que alteram o sistema/arquivos, mas de forma controlada
CONFIRM_TOOLS = {
    "files.write",
    "files.create",
    "files.delete",
    "files.move",
    "shell.run",
}

# Comandos de shell nunca permitidos, mesmo com confirmação
SHELL_BLOCKLIST = [
    "rm -rf /",
    "rm -rf ~",
    "rm -rf *",
    ":(){ :|:& };:",
    "mkfs",
    "dd if=",
    "> /dev/sda",
    "chmod -R 777 /",
    "chown -R",
    "reboot",
    "shutdown",
    "killall -9",
]


@dataclass
class ValidationResult:
    allowed: bool
    needs_confirmation: bool
    reason: str = ""


class SecurityLayer:
    """Valida cada tool call antes da execução real."""

    def __init__(self, confirm_destructive: bool = True):
        self.confirm_destructive = confirm_destructive

    def validate(self, tool_name: str, params: dict) -> ValidationResult:
        if tool_name in SAFE_TOOLS:
            return ValidationResult(allowed=True, needs_confirmation=False)

        if tool_name == "shell.run":
            command = str(params.get("command", ""))
            if self._is_blocked_shell(command):
                return ValidationResult(
                    allowed=False,
                    needs_confirmation=False,
                    reason="Comando bloqueado por política de segurança.",
                )
            return ValidationResult(
                allowed=True,
                needs_confirmation=self.confirm_destructive,
                reason="Execução de shell requer confirmação.",
            )

        if tool_name in CONFIRM_TOOLS:
            return ValidationResult(
                allowed=True,
                needs_confirmation=self.confirm_destructive,
                reason="Ação modifica o sistema de arquivos.",
            )

        # Ferramenta desconhecida: nega por padrão (allowlist estrita)
        return ValidationResult(
            allowed=False,
            needs_confirmation=False,
            reason=f"Ferramenta '{tool_name}' não está na allowlist.",
        )

    def _is_blocked_shell(self, command: str) -> bool:
        normalized = " ".join(command.lower().split())
        return any(bad in normalized for bad in SHELL_BLOCKLIST)
