"""
tools/web.py
Ferramenta de consulta à internet. Totalmente opcional — só é chamada se
config["web"] == true. Usa apenas urllib da stdlib para não adicionar peso.
"""

import json
import urllib.parse
import urllib.request

TIMEOUT = 8


def search(query: str, max_results: int = 3) -> dict:
    """Busca leve usando a API instant answer do DuckDuckGo (sem chave/API paga)."""
    try:
        url = "https://api.duckduckgo.com/?" + urllib.parse.urlencode(
            {"q": query, "format": "json", "no_html": 1, "skip_disambig": 1}
        )
        req = urllib.request.Request(url, headers={"User-Agent": "Atlas/1.0"})
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            data = json.loads(resp.read().decode("utf-8", errors="replace"))

        results = []
        if data.get("AbstractText"):
            results.append({"title": data.get("Heading", query), "text": data["AbstractText"]})
        for topic in data.get("RelatedTopics", [])[:max_results]:
            if isinstance(topic, dict) and topic.get("Text"):
                results.append({"title": topic.get("Text")[:80], "text": topic.get("Text")})

        return {"query": query, "results": results[:max_results]}
    except Exception as e:
        return {"error": f"Falha na busca web: {e}"}
