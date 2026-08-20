#!/data/data/com.termux/files/usr/bin/bash
# scripts/start-inference.sh
# Sobe o llama-server apontando pra pasta de modelos do Atlas.
# Requer llama.cpp compilado (com llama-server) disponivel no PATH.
# Ajuste MODEL abaixo para o arquivo .gguf que você colocou em /models.

set -e

ATLAS_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
MODELS_DIR="$ATLAS_ROOT/models"
MODEL="${1:-$(ls "$MODELS_DIR"/*.gguf 2>/dev/null | head -n1)}"

if [ -z "$MODEL" ]; then
  echo "Nenhum modelo .gguf encontrado em $MODELS_DIR"
  echo "Uso: ./start-inference.sh /caminho/para/modelo.gguf"
  exit 1
fi

echo "Subindo llama-server com modelo: $MODEL"
llama-server -m "$MODEL" --host 127.0.0.1 --port 8080 -c 4096
