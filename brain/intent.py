"""
brain/intent.py
Interpreta a resposta do LLM procurando por uma "tool call" estruturada.

Convenção usada com o modelo (ver prompt em brain/prompt_builder.py):
Se o Atlas precisar de uma ferramenta, o modelo deve responder EXATAMENTE
no formato:

    TOOL_CALL: {"tool": "system.ram", "params": {}}

Qualquer outra resposta é tratada como texto normal para o usuário.
Isso evita parsing ambíguo e mantém o modelo pequeno "no controle" de forma simples.
"""

import json
import re

TOOL_CALL_PATTERN = re.compile(r"TOOL_CALL:\s*(\{.*\})", re.DOTALL)


def extract_tool_call(model_output: str):
    """Retorna (tool_name, params) se houver uma tool call válida, senão None."""
    match = TOOL_CALL_PATTERN.search(model_output)
    if not match:
        return None
    try:
        data = json.loads(match.group(1))
        tool_name = data.get("tool")
        params = data.get("params", {})
        if not tool_name:
            return None
        return tool_name, params
    except json.JSONDecodeError:
        return None


def strip_tool_call(model_output: str) -> str:
    """Remove a sintaxe de tool call, deixando só o texto conversacional (se houver)."""
    return TOOL_CALL_PATTERN.sub("", model_output).strip()
