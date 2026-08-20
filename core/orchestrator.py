"""
core/orchestrator.py
O 'cérebro' do Atlas. Implementa o fluxo:

Usuário -> Atlas -> LLM -> interpretação da intenção -> Tool Calling
-> validação de segurança -> execução da ferramenta -> resultado -> LLM -> resposta

O LLM NUNCA executa nada diretamente: toda tool call passa pela
SecurityLayer antes de chegar em tools/registry.py.
"""

from brain.llm_engine import LlamaRunner
from brain.prompt_builder import build_prompt, build_tool_result_prompt
from brain.intent import extract_tool_call, strip_tool_call
from core.security import SecurityLayer
from memory.memory_manager import MemoryManager
from tools import registry

MAX_TOOL_HOPS = 3  # evita loop infinito de tool calls encadeadas


class Orchestrator:
    def __init__(self, config):
        self.config = config
        self.llm = LlamaRunner(config)
        self.memory = MemoryManager(
            enabled=config.get("memory", True),
            max_facts=config.get("memory_max_facts", 200),
            max_history=config.get("memory_max_history", 100),
        )
        self.security = SecurityLayer(confirm_destructive=config.get("confirm_destructive", True))
        self.session_history = []  # histórico apenas da sessão atual (RAM)

    def shutdown(self) -> None:
        self.llm.stop()

    def handle_message(self, user_message: str, confirm_callback=None) -> str:
        """
        confirm_callback: função opcional (tool_name, params) -> bool
        chamada quando uma ação precisa de confirmação explícita do usuário.
        Se None, ações que precisariam de confirmação são recusadas por padrão.
        """
        memory_context = self.memory.build_context()
        prompt = build_prompt(self.config, self.session_history, memory_context, user_message)

        response_text = None
        hops = 0

        while hops < MAX_TOOL_HOPS:
            raw_output = self.llm.generate(prompt)
            tool_call = extract_tool_call(raw_output)

            if not tool_call:
                response_text = strip_tool_call(raw_output) or raw_output
                break

            tool_name, params = tool_call
            validation = self.security.validate(tool_name, params)

            if not validation.allowed:
                prompt = build_tool_result_prompt(
                    prompt, tool_name, {"error": validation.reason}
                )
                hops += 1
                continue

            if validation.needs_confirmation:
                confirmed = confirm_callback(tool_name, params) if confirm_callback else False
                if not confirmed:
                    response_text = (
                        f"Essa ação ({tool_name}) precisa da sua confirmação explícita "
                        "e não foi confirmada, então não executei."
                    )
                    break

            result = registry.call(tool_name, params)
            prompt = build_tool_result_prompt(prompt, tool_name, result)
            hops += 1

        if response_text is None:
            response_text = "Não consegui concluir essa solicitação (limite de etapas atingido)."

        self.session_history.append({"role": "user", "content": user_message})
        self.session_history.append({"role": "assistant", "content": response_text})
        self.memory.add_message("user", user_message)
        self.memory.add_message("assistant", response_text)

        return response_text
