#!/usr/bin/env python3
"""
main.py
Ponto de entrada do Atlas.

Comandos:
    atlas               -> inicia o chat interativo
    atlas chat           -> idem
    atlas status          -> mostra RAM/armazenamento/bateria e status do motor
    atlas memory          -> mostra fatos e histórico salvos
    atlas memory clear    -> limpa a memória
    atlas tools            -> lista ferramentas disponíveis
    atlas config           -> mostra a configuração atual
    atlas model <caminho>  -> troca o modelo GGUF usado
    atlas voice            -> inicia o modo de voz (opcional)

Flags:
    --low-memory   -> usa o perfil de configuração econômico
"""

import sys

from config.config_manager import ConfigManager
from core.orchestrator import Orchestrator
from tools import registry

BANNER = r"""
╔══════════════════════════════════╗
║             ATLAS                ║
║        Local AI Assistant        ║
╚══════════════════════════════════╝
"""


def print_banner():
    print(BANNER)


def cmd_chat(config):
    print_banner()
    print("Atlas > Olá. Como posso ajudar? (digite 'sair' para encerrar)\n")
    orchestrator = Orchestrator(config)

    def confirm_callback(tool_name, params):
        resp = input(f"\n[Confirmação necessária] Executar '{tool_name}' com {params}? (s/N): ")
        return resp.strip().lower() == "s"

    try:
        while True:
            try:
                user_input = input("Você: ").strip()
            except (EOFError, KeyboardInterrupt):
                print()
                break

            if not user_input:
                continue
            if user_input.lower() in ("sair", "exit", "quit"):
                break

            response = orchestrator.handle_message(user_input, confirm_callback=confirm_callback)
            print(f"Atlas: {response}\n")
    finally:
        orchestrator.shutdown()
        print("Atlas encerrado. Até logo.")


def cmd_status(config):
    from tools import system as system_tool

    print_banner()
    print("RAM:", system_tool.ram())
    print("Armazenamento:", system_tool.storage())
    print("Bateria:", system_tool.battery())
    print("Modelo configurado:", config.get("model"))
    print("Modo econômico:", config.get("low_memory"))


def cmd_memory(config, args):
    from memory.memory_manager import MemoryManager

    mem = MemoryManager(
        enabled=config.get("memory", True),
        max_facts=config.get("memory_max_facts", 200),
        max_history=config.get("memory_max_history", 100),
    )
    if args and args[0] == "clear":
        mem.clear()
        print("Memória limpa.")
        return

    print("Fatos conhecidos:")
    for f in mem.get_facts():
        print(" -", f)
    print("\nÚltimas mensagens do histórico:")
    for turn in mem.get_history(limit=10):
        print(f" [{turn['role']}] {turn['content']}")


def cmd_tools(config):
    print("Ferramentas disponíveis:")
    for t in registry.list_tools():
        print(" -", t)


def cmd_config(config):
    import json
    print(json.dumps(config.all(), indent=2, ensure_ascii=False))


def cmd_model(config, args):
    if not args:
        print("Uso: atlas model <caminho/para/modelo.gguf>")
        return
    config.set("model", args[0])
    print(f"Modelo atualizado para: {args[0]}")


def cmd_voice(config):
    from voice.voice_module import voice_loop

    orchestrator = Orchestrator(config)
    try:
        voice_loop(orchestrator)
    finally:
        orchestrator.shutdown()


def main():
    argv = sys.argv[1:]
    low_memory = "--low-memory" in argv
    argv = [a for a in argv if a != "--low-memory"]

    config = ConfigManager(low_memory=low_memory)

    command = argv[0] if argv else "chat"
    rest = argv[1:]

    if command == "chat":
        cmd_chat(config)
    elif command == "status":
        cmd_status(config)
    elif command == "memory":
        cmd_memory(config, rest)
    elif command == "tools":
        cmd_tools(config)
    elif command == "config":
        cmd_config(config)
    elif command == "model":
        cmd_model(config, rest)
    elif command == "voice":
        cmd_voice(config)
    else:
        print(f"Comando desconhecido: {command}")
        print(__doc__)


if __name__ == "__main__":
    main()
