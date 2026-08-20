#!/data/data/com.termux/files/usr/bin/bash
# start.sh — inicia o Atlas sem precisar reinstalar
ATLAS_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ "$1" = "--low-memory" ]; then
    exec python "$ATLAS_DIR/main.py" chat --low-memory
else
    exec python "$ATLAS_DIR/main.py" "$@"
fi
