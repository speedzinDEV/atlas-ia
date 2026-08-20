"""
tools/registry.py
Mapa central: nome da ferramenta (string) -> função Python real.
O orquestrador (core/orchestrator.py) só conhece nomes e parâmetros,
nunca chama código arbitrário — apenas o que está registrado aqui.
"""

from tools import system, files, shell, time as time_tool, web

TOOL_MAP = {
    "system.ram": lambda params: system.ram(),
    "system.storage": lambda params: system.storage(params.get("path", "~")),
    "system.battery": lambda params: system.battery(),
    "system.info": lambda params: system.device_info(),

    "files.read": lambda params: files.read(params["path"]),
    "files.list": lambda params: files.list_dir(params.get("path", ".")),
    "files.create": lambda params: files.create(params["path"], params.get("content", "")),
    "files.write": lambda params: files.write(
        params["path"], params.get("content", ""), params.get("append", False)
    ),
    "files.delete": lambda params: files.delete(params["path"]),
    "files.move": lambda params: files.move(params["src"], params["dst"]),

    "shell.run": lambda params: shell.run(params["command"]),

    "time.now": lambda params: time_tool.now(),

    "web.search": lambda params: web.search(params["query"], params.get("max_results", 3)),
}


def list_tools() -> list:
    return sorted(TOOL_MAP.keys())


def call(tool_name: str, params: dict) -> dict:
    fn = TOOL_MAP.get(tool_name)
    if fn is None:
        return {"error": f"Ferramenta desconhecida: {tool_name}"}
    try:
        return fn(params or {})
    except KeyError as e:
        return {"error": f"Parâmetro obrigatório ausente: {e}"}
    except Exception as e:
        return {"error": f"Erro ao executar {tool_name}: {e}"}
