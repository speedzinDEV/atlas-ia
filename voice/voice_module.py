"""
voice/voice_module.py
Módulo de voz OPCIONAL. Nunca é importado/carregado automaticamente pelo
núcleo do Atlas — só entra em ação se o usuário rodar `atlas voice` ou
ativar "voice": true na config, e tiver o pacote termux-api instalado.

Fluxo: Microfone -> STT -> Atlas -> TTS -> Áudio
Usa os comandos nativos do Termux:API (termux-speech-to-text, termux-tts-speak),
que já são leves e rodam fora do processo Python.
"""

import shutil
import subprocess


def is_available() -> bool:
    return shutil.which("termux-speech-to-text") is not None and shutil.which("termux-tts-speak") is not None


def listen(timeout: int = 10) -> str:
    """Captura áudio do microfone e retorna o texto transcrito."""
    if shutil.which("termux-speech-to-text") is None:
        return ""
    try:
        result = subprocess.run(
            ["termux-speech-to-text"], capture_output=True, text=True, timeout=timeout
        )
        return result.stdout.strip()
    except (subprocess.TimeoutExpired, OSError):
        return ""


def speak(text: str) -> None:
    """Fala o texto usando o TTS nativo do Android via termux-api."""
    if shutil.which("termux-tts-speak") is None:
        return
    try:
        subprocess.run(["termux-tts-speak", text], timeout=30)
    except (subprocess.TimeoutExpired, OSError):
        pass


def voice_loop(orchestrator, stop_word: str = "encerrar"):
    """Loop simples de conversa por voz. Chamado explicitamente por `atlas voice`."""
    if not is_available():
        print("Voz indisponível. Instale: pkg install termux-api (e o app Termux:API).")
        return

    print("Modo voz ativo. Diga 'encerrar' para sair.")
    while True:
        text = listen()
        if not text:
            continue
        print(f"Você: {text}")
        if stop_word in text.lower():
            speak("Até logo.")
            break
        response = orchestrator.handle_message(text)
        print(f"Atlas: {response}")
        speak(response)
