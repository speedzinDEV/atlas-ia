"""
brain/prompt_builder.py
Monta o prompt enviado ao modelo: personalidade + ferramentas disponíveis
+ memória relevante + histórico recente + mensagem do usuário.
"""

from tools.registry import list_tools

SYSTEM_TEMPLATE = """Você é {name}, um assistente de IA pessoal, local e offline.
Personalidade: {tone}.
Regras:
- Responda em português do Brasil, de forma natural.
- Respostas curtas para perguntas simples; detalhadas quando necessário.
- Nunca finja ter capacidades que não possui.
- Se precisar usar uma ferramenta para responder (ex: ver RAM, ler arquivo,
  rodar comando, buscar na web), responda APENAS com:
  TOOL_CALL: {{"tool": "<nome_da_ferramenta>", "params": {{...}}}}
- Ferramentas disponíveis: {tools}
- Nunca invente resultado de ferramenta: espere o resultado real antes de responder.
"""


def build_system_prompt(config) -> str:
    personality = config.get("personality", {"name": "Atlas", "tone": "objetivo, educado"})
    return SYSTEM_TEMPLATE.format(
        name=personality.get("name", "Atlas"),
        tone=personality.get("tone", "objetivo, educado"),
        tools=", ".join(list_tools()),
    )


def build_prompt(config, history: list, memory_context: str, user_message: str) -> str:
    """history: lista de dicts {"role": "user"/"assistant", "content": str}"""
    parts = [build_system_prompt(config)]

    if memory_context:
        parts.append(f"\nContexto de memória:\n{memory_context}")

    for turn in history[-6:]:  # janela curta para não estourar contexto pequeno
        role = "Usuário" if turn["role"] == "user" else "Atlas"
        parts.append(f"{role}: {turn['content']}")

    parts.append(f"Usuário: {user_message}")
    parts.append("Atlas:")
    return "\n".join(parts)


def build_tool_result_prompt(base_prompt: str, tool_name: str, tool_result: dict) -> str:
    """Reinjeta o resultado da ferramenta para o modelo formular a resposta final."""
    return (
        f"{base_prompt}\n"
        f"[Resultado da ferramenta {tool_name}]: {tool_result}\n"
        f"Agora responda ao usuário em linguagem natural, usando esse resultado.\n"
        f"Atlas:"
    )
