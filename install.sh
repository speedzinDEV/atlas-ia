#!/data/data/com.termux/files/usr/bin/bash
# install.sh — instalador do Atlas para Termux/Android
# Uso: bash install.sh
set -e

ATLAS_DIR="$(cd "$(dirname "$0")" && pwd)"
BIN_DIR="$PREFIX/bin"
LLAMA_DIR="$ATLAS_DIR/vendor/llama.cpp"

echo "=============================="
echo "  Instalando o Atlas"
echo "=============================="

# 1. Detectar Termux
if [ -z "$PREFIX" ] || [ ! -d "$PREFIX" ]; then
    echo "[erro] Isso não parece ser um ambiente Termux. Abortando."
    exit 1
fi
echo "[ok] Termux detectado em $PREFIX"

# 2. Verificar Python
if ! command -v python >/dev/null 2>&1; then
    echo "[info] Python não encontrado. Instalando..."
    pkg install -y python
else
    echo "[ok] Python encontrado: $(python --version)"
fi

# 3. Verificar compiladores (necessários para compilar o llama.cpp)
if ! command -v clang >/dev/null 2>&1; then
    echo "[info] Instalando toolchain de compilação..."
    pkg install -y clang cmake make git
else
    echo "[ok] Toolchain de compilação encontrada."
fi

# 4. Instalar apenas dependências necessárias (nenhuma lib pesada)
echo "[info] Verificando dependências do sistema..."
pkg install -y git python >/dev/null 2>&1 || true

# 5. Criar diretórios
mkdir -p "$ATLAS_DIR/models" "$ATLAS_DIR/data" "$ATLAS_DIR/memory"
echo "[ok] Diretórios prontos."

# 6. Compilar/configurar o motor da IA (llama.cpp)
if [ ! -f "$BIN_DIR/llama-server" ]; then
    echo "[info] Compilando llama.cpp (isso pode demorar alguns minutos)..."
    mkdir -p "$(dirname "$LLAMA_DIR")"
    if [ ! -d "$LLAMA_DIR" ]; then
        git clone --depth 1 https://github.com/ggml-org/llama.cpp "$LLAMA_DIR"
    fi
    cd "$LLAMA_DIR"

    # Compilação leve: sem CUDA/GPU, otimizada para CPU ARM.
    # Se a build falhar por falta de memória (SIGKILL), tente reduzir jobs paralelos.
    JOBS=$(nproc 2>/dev/null || echo 2)
    if [ "$JOBS" -gt 2 ]; then JOBS=2; fi

    cmake -B build -DGGML_NATIVE=ON -DLLAMA_CURL=OFF
    cmake --build build --config Release -j "$JOBS" || {
        echo "[aviso] Build paralela falhou (possível falta de RAM). Tentando com 1 job..."
        cmake --build build --config Release -j 1
    }

    cp build/bin/llama-server "$BIN_DIR/llama-server"
    cp build/bin/llama-cli "$BIN_DIR/llama-cli" 2>/dev/null || true
    cd "$ATLAS_DIR"
    echo "[ok] llama.cpp compilado e instalado em $BIN_DIR"
else
    echo "[ok] llama-server já instalado."
fi

# 7. Configurar o Atlas (config padrão já vem no repositório)
if [ ! -f "$ATLAS_DIR/config/config.json" ]; then
    echo "[erro] config/config.json ausente. Reinstale o pacote do Atlas."
    exit 1
fi
echo "[ok] Configuração presente."

# 8. Criar o comando global "atlas"
cat > "$BIN_DIR/atlas" << EOF
#!/data/data/com.termux/files/usr/bin/bash
exec python "$ATLAS_DIR/main.py" "\$@"
EOF
chmod +x "$BIN_DIR/atlas"
echo "[ok] Comando global 'atlas' criado."

# 9. Teste automático
echo "[info] Rodando teste automático (atlas tools)..."
python "$ATLAS_DIR/main.py" tools || {
    echo "[erro] Teste automático falhou. Verifique a instalação do Python."
    exit 1
}

echo ""
echo "=============================="
echo " Instalação concluída!"
echo "=============================="
echo "Próximos passos:"
echo "1. Baixe um modelo GGUF (0.5B-3B, quantização Q4) e salve em:"
echo "   $ATLAS_DIR/models/atlas.gguf"
echo "2. Rode: atlas"
echo "   (ou 'atlas --low-memory' em celulares fracos)"
