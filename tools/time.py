"""
tools/time.py
Ferramenta simples de data/hora. Sem dependências externas.
"""

from datetime import datetime


def now() -> dict:
    dt = datetime.now()
    return {
        "iso": dt.isoformat(),
        "data": dt.strftime("%d/%m/%Y"),
        "hora": dt.strftime("%H:%M:%S"),
        "dia_semana": dt.strftime("%A"),
    }
