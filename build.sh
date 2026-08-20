#!/usr/bin/env bash
# build.sh — orquestra o build do Atlas.
#
# Uso:
#   ./build.sh web         -> instala deps e builda o frontend (dist/) + backend pronto pra rodar
#   ./build.sh android      -> builda o frontend e sincroniza com o projeto Android (Capacitor)
#   ./build.sh apk          -> detecta o ambiente e faz TUDO: instala deps, corrige problemas
#                              comuns (ex.: sharp no Termux), gera/configura o projeto Android,
#                              (opcionalmente) assina, e compila o .apk — ou prepara o GitHub
#                              Actions automaticamente se o ambiente não permitir compilar local
#   ./build.sh android-apk  -> alias de "apk" (mantido por compatibilidade)
#   ./build.sh all          -> web + android (sync, sem compilar apk)
#   ./build.sh doctor       -> diagnóstico completo do ambiente (sem builder nada)
#   ./build.sh clean        -> remove node_modules, dist e build artifacts
#
# Flags (usadas com "apk"):
#   --yes           não faz perguntas interativas, usa defaults / config salva
#   --reconfigure   força novas perguntas de configuração do app
#   --release       tenta gerar APK de release (assinado) em vez de debug
#
# Sem argumento, roda "web".

set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
FRONTEND="$ROOT/frontend"
BACKEND="$ROOT/backend"
ANDROID="$FRONTEND/android"
CONFIG_FILE="$ROOT/atlas.config.local"

TARGET="${1:-web}"
shift || true

NONINTERACTIVE=0
RECONFIGURE=0
WANT_RELEASE=0
for arg in "$@"; do
  case "$arg" in
    --yes) NONINTERACTIVE=1 ;;
    --reconfigure) RECONFIGURE=1 ;;
    --release) WANT_RELEASE=1 ;;
  esac
done
# Se não tem terminal interativo (ex.: CI), nunca faz perguntas.
if [ ! -t 0 ]; then NONINTERACTIVE=1; fi

log()  { echo -e "\033[1;36m[Atlas]\033[0m $1"; }
ok()   { echo -e "\033[1;32m[✓]\033[0m $1"; }
warn() { echo -e "\033[1;33m[!]\033[0m $1"; }
err()  { echo -e "\033[1;31m[Atlas erro]\033[0m $1" >&2; }
bad()  { echo -e "\033[1;31m[✗]\033[0m $1"; }

# =====================================================================
# DETECÇÃO DE AMBIENTE
# =====================================================================
IS_TERMUX=0
OS_NAME="$(uname -s 2>/dev/null || echo unknown)"
ARCH_NAME="$(uname -m 2>/dev/null || echo unknown)"

detect_env() {
  if [ -n "${TERMUX_VERSION:-}" ] || [ -d "/data/data/com.termux" ] || \
     [[ "${PREFIX:-}" == *com.termux* ]] || command -v termux-info >/dev/null 2>&1; then
    IS_TERMUX=1
  fi

  if [ "$IS_TERMUX" = "1" ]; then
    PLATFORM_LABEL="Termux (Android)"
  elif [[ "$OS_NAME" == "Darwin" ]]; then
    PLATFORM_LABEL="macOS"
  elif [[ "$OS_NAME" == "Linux" ]]; then
    if grep -qi microsoft /proc/version 2>/dev/null; then
      PLATFORM_LABEL="WSL (Linux em Windows)"
    else
      PLATFORM_LABEL="Linux"
    fi
  elif [[ "$OS_NAME" == MINGW* || "$OS_NAME" == MSYS* || "$OS_NAME" == CYGWIN* ]]; then
    PLATFORM_LABEL="Windows (Git Bash/MSYS)"
  else
    PLATFORM_LABEL="$OS_NAME"
  fi
  log "Ambiente detectado: $PLATFORM_LABEL ($ARCH_NAME)"
}

# =====================================================================
# RELOCAÇÃO NO TERMUX (armazenamento compartilhado não suporta symlinks)
# =====================================================================
relocate_to_home() {
  local name dest
  name="$(basename "$ROOT")"
  dest="$HOME/$name"

  log "Projeto em armazenamento compartilhado ($ROOT) — symlinks não funcionam aí."
  log "Copiando para $dest (filesystem nativo do Termux)..."

  mkdir -p "$dest"

  if command -v rsync >/dev/null 2>&1; then
    rsync -a \
      --exclude 'node_modules' \
      --exclude 'frontend/node_modules' \
      --exclude 'backend/node_modules' \
      --exclude 'frontend/dist' \
      --exclude 'frontend/android' \
      --exclude '.git' \
      --exclude 'data' \
      "$ROOT"/ "$dest"/
  elif command -v tar >/dev/null 2>&1; then
    (cd "$ROOT" && tar \
      --exclude='./node_modules' \
      --exclude='./frontend/node_modules' \
      --exclude='./backend/node_modules' \
      --exclude='./frontend/dist' \
      --exclude='./frontend/android' \
      --exclude='./.git' \
      --exclude='./data' \
      -cf - .) | (cd "$dest" && tar -xf -)
  else
    cp -r "$ROOT"/. "$dest"/
  fi

  chmod +x "$dest/build.sh" 2>/dev/null || true
  log "Copiado. Continuando o build em $dest ..."
  log "(pode rodar direto de lá também: cd $dest && ./build.sh $TARGET)"
  exec bash "$dest/build.sh" "$TARGET" "$@"
}

check_storage_location() {
  if [ "$IS_TERMUX" = "1" ]; then
    case "$ROOT" in
      /storage/*|/sdcard/*|"$HOME"/storage/*)
        relocate_to_home
        ;;
    esac
  fi
}

# =====================================================================
# CHECAGENS DE DEPENDÊNCIA (usadas por "doctor" e por "apk")
# =====================================================================
NODE_OK=0; NPM_OK=0; JAVA_OK=0; SDK_OK=0; GRADLEW_OK=0; CAP_OK=0
SDK_PATH=""
JAVA_VERSION=""

check_node() {
  if command -v node >/dev/null 2>&1; then
    NODE_OK=1
    ok "Node.js encontrado ($(node -v))"
  else
    NODE_OK=0
    bad "Node.js não encontrado."
    [ "$IS_TERMUX" = "1" ] && err "  No Termux: pkg install nodejs"
  fi
}

check_npm() {
  if command -v npm >/dev/null 2>&1; then
    NPM_OK=1
    ok "npm encontrado ($(npm -v))"
  else
    NPM_OK=0
    bad "npm não encontrado (normalmente vem junto com o Node.js)."
  fi
}

check_java() {
  if command -v java >/dev/null 2>&1; then
    JAVA_VERSION="$(java -version 2>&1 | head -1 | grep -oE '[0-9]+' | head -1)"
    JAVA_OK=1
    ok "Java encontrado (versão detectada: ${JAVA_VERSION:-desconhecida})"
    if [ -n "$JAVA_VERSION" ] && [ "$JAVA_VERSION" -lt 17 ] 2>/dev/null; then
      warn "  Gradle/Android moderno geralmente precisa do JDK 17+. Considere atualizar."
    fi
  else
    JAVA_OK=0
    bad "Java (JDK) não encontrado — necessário para compilar Android."
    [ "$IS_TERMUX" = "1" ] && err "  No Termux: pkg install openjdk-17"
  fi
}

check_android_sdk() {
  local candidates=()
  [ -n "${ANDROID_HOME:-}" ] && candidates+=("$ANDROID_HOME")
  [ -n "${ANDROID_SDK_ROOT:-}" ] && candidates+=("$ANDROID_SDK_ROOT")
  candidates+=(
    "$HOME/android-sdk"
    "${PREFIX:-}/android-sdk"
    "$HOME/Android/Sdk"
    "$HOME/Library/Android/sdk"
    "/usr/lib/android-sdk"
    "/opt/android-sdk"
  )

  for c in "${candidates[@]}"; do
    [ -z "$c" ] && continue
    if [ -d "$c/platform-tools" ] && [ -d "$c/platforms" ]; then
      SDK_PATH="$c"
      SDK_OK=1
      break
    fi
  done

  if [ "$SDK_OK" = "1" ]; then
    ok "Android SDK encontrado em: $SDK_PATH"
    export ANDROID_HOME="$SDK_PATH"
    export ANDROID_SDK_ROOT="$SDK_PATH"
    if [ -d "$ANDROID" ]; then
      echo "sdk.dir=$SDK_PATH" > "$ANDROID/local.properties"
    fi
  else
    bad "Android SDK não encontrado (ANDROID_HOME/ANDROID_SDK_ROOT vazios e nenhum caminho comum tem platform-tools+platforms)."
  fi
}

check_gradlew() {
  if [ -f "$ANDROID/gradlew" ]; then
    GRADLEW_OK=1
    ok "gradlew encontrado em frontend/android/"
  else
    GRADLEW_OK=0
    warn "gradlew ainda não existe (projeto Android não foi gerado ainda — normal antes do primeiro sync)."
  fi
}

check_capacitor() {
  if [ -d "$FRONTEND/node_modules/.bin" ] && [ -f "$FRONTEND/node_modules/.bin/cap" ]; then
    CAP_OK=1
    ok "Capacitor CLI encontrado (dependências do frontend instaladas)."
  else
    CAP_OK=0
    warn "Capacitor CLI ainda não disponível (rode o build do frontend primeiro)."
  fi
}

# =====================================================================
# DOCTOR — diagnóstico completo, não builda nada
# =====================================================================
doctor() {
  detect_env
  echo
  log "Diagnóstico do ambiente Atlas"
  echo "----------------------------------------"
  check_node
  check_npm
  check_java
  check_android_sdk
  check_gradlew
  check_capacitor

  [ -d "$FRONTEND" ] && ok "Pasta frontend/ encontrada" || bad "Pasta frontend/ não encontrada"
  [ -d "$BACKEND" ] && ok "Pasta backend/ encontrada" || bad "Pasta backend/ não encontrada"

  if [ -f "$ROOT/scripts/start-inference.sh" ]; then
    ok "Script do llama-server encontrado (scripts/start-inference.sh)"
  else
    warn "scripts/start-inference.sh não encontrado."
  fi

  if ls "$ROOT"/models/*.gguf >/dev/null 2>&1; then
    ok "Modelo GGUF encontrado em models/"
  else
    warn "Nenhum modelo .gguf encontrado em models/ (necessário para rodar o llama-server)."
  fi

  if [ -w "$ROOT" ]; then
    ok "Permissão de escrita em $ROOT"
  else
    bad "Sem permissão de escrita em $ROOT"
  fi

  if command -v df >/dev/null 2>&1; then
    local avail
    avail="$(df -h "$ROOT" 2>/dev/null | awk 'NR==2{print $4}')"
    [ -n "$avail" ] && log "Espaço livre em disco: $avail"
  fi

  log "Arquitetura: $ARCH_NAME"
  echo "----------------------------------------"

  if [ "$NODE_OK" = "1" ] && [ "$NPM_OK" = "1" ]; then
    ok "Requisitos mínimos (Node/npm) OK — 'build.sh web' deve funcionar."
  else
    bad "Faltam requisitos mínimos para qualquer build."
  fi

  if [ "$JAVA_OK" = "1" ] && [ "$SDK_OK" = "1" ]; then
    ok "Requisitos para compilar APK localmente parecem OK."
  else
    warn "Faltam requisitos para compilar APK localmente (use 'build.sh apk' — ele prepara o GitHub Actions automaticamente)."
  fi
}

# =====================================================================
# BACKEND / FRONTEND WEB
# =====================================================================
build_backend() {
  log "Instalando dependências do backend..."
  (cd "$BACKEND" && npm install --no-fund --no-audit) || { err "Falha ao instalar dependências do backend."; exit 1; }
  log "Backend pronto. Rode com: cd backend && npm start"
}

build_frontend_web() {
  log "Instalando dependências do frontend..."

  local npm_install_flags=(--no-fund --no-audit)
  if [ "$IS_TERMUX" = "1" ]; then
    log "Termux detectado."
    log "Instalando sem rodar scripts de build nativos (--ignore-scripts)."
    log "  Isso evita que o 'sharp' (usado só pelo capacitor-assets, dependência de dev)"
    log "  tente baixar um binário libvips pra Android — que não existe — e derrube o"
    log "  \"npm install\" inteiro antes mesmo de chegarmos a checar se ele é usável."
    npm_install_flags+=(--ignore-scripts)
  fi

  (cd "$FRONTEND" && npm install "${npm_install_flags[@]}") || { err "Falha ao instalar dependências do frontend."; exit 1; }

  # Decide agora (antes do build) se dá pra contar com o sharp pra gerar os
  # ícones mais tarde, ou se já sabemos que vamos precisar do fallback
  # ImageMagick — assim generate_android_assets nunca perde tempo tentando
  # o capacitor-assets num ambiente onde ele já é sabido que não funciona.
  check_sharp

  log "Buildando frontend (produção)..."
  (cd "$FRONTEND" && npm run build) || { err "Falha ao buildar o frontend."; exit 1; }
  log "Build web pronto em frontend/dist/"
}

# =====================================================================
# SHARP / capacitor-assets — problema conhecido no Termux
# =====================================================================
# capacitor-assets (devDependency) usa "sharp" (que embute libvips nativo)
# pra redimensionar os ícones/splash. sharp só publica binários pré-
# compilados pra glibc/musl (linux-x64/arm64, darwin, win32) — o Termux usa
# a libc do Android (Bionic), que não é nenhum desses, então sharp não tem
# como funcionar lá sem compilar tudo na mão (frágil e pesado).
#
# O frontend em si NÃO depende de sharp (não é dependência direta nem é
# usada em tempo de execução do app) — só a ferramenta de geração de ícone
# usa. Por isso: nunca mexemos em node_modules/deps do app por causa disso,
# só pulamos a geração via sharp e resolvemos os ícones de outro jeito.
SHARP_USABLE=1
SHARP_CHECKED=0

# Idempotente: pode ser chamada várias vezes (build_frontend_web já chama
# logo após o "npm install", generate_android_assets chama de novo mais
# tarde por segurança) sem repetir o teste nem duplicar as mensagens.
check_sharp() {
  [ "$SHARP_CHECKED" = "1" ] && return
  SHARP_CHECKED=1

  if [ ! -d "$FRONTEND/node_modules" ]; then
    SHARP_USABLE=0
    return
  fi

  if [ -d "$FRONTEND/node_modules/sharp" ]; then
    # node_modules/sharp existe (os arquivos JS do pacote foram instalados
    # normalmente), mas com --ignore-scripts o postinstall que baixa o
    # binário nativo do libvips não rodou — então "require('sharp')" é o
    # teste real de "isso funciona ou não", independente do motivo.
    if (cd "$FRONTEND" && node -e "require('sharp')" >/dev/null 2>&1); then
      SHARP_USABLE=1
    else
      SHARP_USABLE=0
      if [ "$IS_TERMUX" = "1" ]; then
        log "sharp não é compatível com este ambiente Android (Termux usa libc Bionic;"
        log "  sharp/libvips só tem binários pré-compilados pra glibc/musl — não existe"
        log "  build pra android-arm64v8)."
        log "Usando fallback ImageMagick para os assets."
      else
        warn "sharp está instalado mas não carrega neste ambiente."
      fi
      log "Isso vem do 'capacitor-assets' (dependência de desenvolvimento, só usada pra gerar ícones)."
      log "O frontend web e o app em si NÃO usam sharp — build web não é afetado."
    fi
  else
    # Pacote nem chegou a ficar em node_modules (ex.: não está no lockfile
    # nesta árvore, ou --ignore-scripts + alguma outra razão) — tratamos
    # como indisponível, sem tentar instalar/rebaixar nada por conta própria.
    SHARP_USABLE=0
  fi
}

# Gera os ícones/splash do Android sem depender de sharp, usando ImageMagick
# (que tem build nativo pro Termux, ao contrário de sharp/libvips).
generate_icons_fallback() {
  local res="$FRONTEND/resources"
  local out="$ANDROID/app/src/main/res"
  local convert_bin=""

  if command -v magick >/dev/null 2>&1; then
    convert_bin="magick"
  elif command -v convert >/dev/null 2>&1; then
    convert_bin="convert"
  fi

  if [ -z "$convert_bin" ] && [ "$IS_TERMUX" = "1" ]; then
    log "ImageMagick não encontrado — tentando instalar (pkg install imagemagick)..."
    pkg install -y imagemagick >/dev/null 2>&1 || true
    command -v magick >/dev/null 2>&1 && convert_bin="magick"
    [ -z "$convert_bin" ] && command -v convert >/dev/null 2>&1 && convert_bin="convert"
  fi

  if [ -z "$convert_bin" ]; then
    warn "ImageMagick não disponível — não foi possível gerar os ícones/splash automaticamente."
    warn "  O projeto Android foi criado, mas com os ícones padrão do template do Capacitor"
    warn "  (não é um erro fatal, só não fica com a arte oficial do Atlas)."
    if [ "$IS_TERMUX" = "1" ]; then
      warn "  Instale no Termux com:"
      warn "    pkg install imagemagick"
    else
      warn "  Instale com o gerenciador de pacotes do seu sistema, ex.:"
      warn "    apt install imagemagick   (Debian/Ubuntu)"
      warn "    brew install imagemagick  (macOS)"
    fi
    warn "  Depois rode 'bash build.sh apk' de novo pra gerar os ícones corretos."
    return 1
  fi

  if [ ! -f "$res/icon.png" ]; then
    warn "frontend/resources/icon.png não encontrado — pulando geração de ícone."
    return 1
  fi

  log "Gerando ícones Android com ImageMagick (fallback sem sharp)..."

  # Ícone legado (mipmap-*/ic_launcher.png e ic_launcher_round.png)
  declare -A legacy_sizes=( [mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192 )
  for density in "${!legacy_sizes[@]}"; do
    local size="${legacy_sizes[$density]}"
    local dir="$out/mipmap-$density"
    mkdir -p "$dir"
    "$convert_bin" "$res/icon.png" -resize "${size}x${size}" "$dir/ic_launcher.png"
    "$convert_bin" "$res/icon.png" -resize "${size}x${size}" "$dir/ic_launcher_round.png"
  done

  # Ícone adaptativo (foreground/background), se as camadas existirem
  if [ -f "$res/icon-foreground.png" ] && [ -f "$res/icon-background.png" ]; then
    declare -A adaptive_sizes=( [mdpi]=108 [hdpi]=162 [xhdpi]=216 [xxhdpi]=324 [xxxhdpi]=432 )
    for density in "${!adaptive_sizes[@]}"; do
      local size="${adaptive_sizes[$density]}"
      local dir="$out/mipmap-$density"
      mkdir -p "$dir"
      "$convert_bin" "$res/icon-foreground.png" -resize "${size}x${size}" "$dir/ic_launcher_foreground.png"
      "$convert_bin" "$res/icon-background.png" -resize "${size}x${size}" "$dir/ic_launcher_background.png"
    done

    mkdir -p "$out/mipmap-anydpi-v26" "$out/values"
    cat > "$out/mipmap-anydpi-v26/ic_launcher.xml" << 'XMLEOF'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@mipmap/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
XMLEOF
    cp "$out/mipmap-anydpi-v26/ic_launcher.xml" "$out/mipmap-anydpi-v26/ic_launcher_round.xml"
  fi

  # Splash screen (resolução única — Android escala; suficiente como fallback)
  if [ -f "$res/splash.png" ]; then
    mkdir -p "$out/drawable"
    "$convert_bin" "$res/splash.png" -resize "1200x1200" "$out/drawable/splash.png"
  fi
  if [ -f "$res/splash-dark.png" ]; then
    mkdir -p "$out/drawable-night"
    "$convert_bin" "$res/splash-dark.png" -resize "1200x1200" "$out/drawable-night/splash.png"
  fi

  ok "Ícones e splash gerados via ImageMagick."
  return 0
}

generate_android_assets() {
  check_sharp
  if [ "$SHARP_USABLE" = "1" ]; then
    if (cd "$FRONTEND" && npx capacitor-assets generate --android); then
      ok "Ícone e splash gerados via capacitor-assets."
      return 0
    else
      warn "capacitor-assets falhou mesmo com sharp aparentemente OK — tentando fallback."
    fi
  fi
  generate_icons_fallback
}

# =====================================================================
# PROJETO ANDROID (criação + sync)
# =====================================================================
sync_android() {
  local first_time=0
  if [ ! -d "$ANDROID" ]; then
    first_time=1
    log "Projeto Android ainda não existe. Criando com Capacitor..."
    (cd "$FRONTEND" && npx cap add android) || { err "Falha ao criar o projeto Android (npx cap add android)."; exit 1; }

    log "Copiando network_security_config.xml (permite HTTP local/rede)..."
    mkdir -p "$ANDROID/app/src/main/res/xml"
    cp "$FRONTEND/android-config-template/xml/network_security_config.xml" \
       "$ANDROID/app/src/main/res/xml/network_security_config.xml"

    generate_android_assets

    local manifest="$ANDROID/app/src/main/AndroidManifest.xml"
    if [ -f "$manifest" ] && ! grep -q "networkSecurityConfig" "$manifest"; then
      sed -i.bak 's#<application#<application android:usesCleartextTraffic="true" android:networkSecurityConfig="@xml/network_security_config"#' "$manifest"
      rm -f "$manifest.bak"
      ok "AndroidManifest.xml atualizado (cleartext + networkSecurityConfig)."
    fi
  fi

  log "Sincronizando build web com o projeto Android..."
  (cd "$FRONTEND" && npx cap sync android) || { err "Falha ao sincronizar o projeto Android (npx cap sync android)."; exit 1; }
  log "Projeto Android sincronizado em frontend/android/"

  check_android_sdk >/dev/null 2>&1 || true
  if [ "$SDK_OK" = "1" ]; then
    echo "sdk.dir=$SDK_PATH" > "$ANDROID/local.properties"
  fi

  [ "$first_time" = "1" ] && apply_app_config
}

# =====================================================================
# CONFIGURAÇÃO INTERATIVA DO APP
# =====================================================================
# Defaults vêm do que já está no projeto hoje (capacitor.config.json).
DEF_APP_NAME="Atlas"
DEF_APP_ID="com.mplugins.atlas"
DEF_APP_DESC="Assistente pessoal de IA"
DEF_APP_COLOR="#0A84FF"
DEF_APP_VERSION="1.0.0"
DEF_APP_VERSION_CODE="1"

APP_NAME="$DEF_APP_NAME"
APP_ID="$DEF_APP_ID"
DEV_NAME=""
DEV_EMAIL=""
APP_DESC="$DEF_APP_DESC"
APP_COLOR="$DEF_APP_COLOR"
APP_VERSION="$DEF_APP_VERSION"
APP_VERSION_CODE="$DEF_APP_VERSION_CODE"
WANT_SIGNING="n"

load_config() {
  [ -f "$CONFIG_FILE" ] || return
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
}

save_config() {
  cat > "$CONFIG_FILE" << CFGEOF
# Gerado por build.sh — configuração local do app Atlas Android.
# Este arquivo NÃO deve ir pro Git (já está no .gitignore).
APP_NAME="$APP_NAME"
APP_ID="$APP_ID"
DEV_NAME="$DEV_NAME"
DEV_EMAIL="$DEV_EMAIL"
APP_DESC="$APP_DESC"
APP_COLOR="$APP_COLOR"
APP_VERSION="$APP_VERSION"
APP_VERSION_CODE="$APP_VERSION_CODE"
CFGEOF
}

ask() {
  # ask "pergunta" "default" -> resultado em $REPLY_VAL
  local prompt="$1" default="$2" val
  read -r -p "$prompt [$default]: " val || val=""
  REPLY_VAL="${val:-$default}"
}

interactive_configure() {
  load_config

  if [ "$NONINTERACTIVE" = "1" ] && [ "$RECONFIGURE" = "0" ]; then
    return
  fi
  if [ -f "$CONFIG_FILE" ] && [ "$RECONFIGURE" = "0" ]; then
    return
  fi

  echo
  echo "========================================"
  echo "        ATLAS APK BUILDER"
  echo "========================================"
  ask "Nome do aplicativo" "$APP_NAME"; APP_NAME="$REPLY_VAL"
  ask "ID do aplicativo" "$APP_ID"; APP_ID="$REPLY_VAL"
  ask "Nome do desenvolvedor" "${DEV_NAME:-Digite aqui}"; DEV_NAME="$REPLY_VAL"
  ask "E-mail do desenvolvedor (só como identificação, nunca senha)" "${DEV_EMAIL:-Digite aqui}"; DEV_EMAIL="$REPLY_VAL"
  ask "Descrição" "$APP_DESC"; APP_DESC="$REPLY_VAL"
  ask "Cor principal" "$APP_COLOR"; APP_COLOR="$REPLY_VAL"
  ask "Versão" "$APP_VERSION"; APP_VERSION="$REPLY_VAL"
  ask "Versão interna (versionCode)" "$APP_VERSION_CODE"; APP_VERSION_CODE="$REPLY_VAL"
  echo
  read -r -p "Deseja configurar assinatura do APK? [s/N]: " WANT_SIGNING || WANT_SIGNING="n"

  save_config
  ok "Configuração salva em atlas.config.local"
}

apply_app_config() {
  load_config
  [ -f "$CONFIG_FILE" ] || return

  local cap_config="$FRONTEND/capacitor.config.json"
  if [ -f "$cap_config" ]; then
    ATLAS_APP_ID="$APP_ID" ATLAS_APP_NAME="$APP_NAME" node -e "
      const fs = require('fs');
      const p = '$cap_config';
      const cfg = JSON.parse(fs.readFileSync(p, 'utf8'));
      cfg.appId = process.env.ATLAS_APP_ID || cfg.appId;
      cfg.appName = process.env.ATLAS_APP_NAME || cfg.appName;
      fs.writeFileSync(p, JSON.stringify(cfg, null, 2) + '\n');
    " 2>/dev/null || true
  fi

  local strings="$ANDROID/app/src/main/res/values/strings.xml"
  if [ -f "$strings" ]; then
    sed -i.bak "s#<string name=\"app_name\">.*</string>#<string name=\"app_name\">$APP_NAME</string>#" "$strings" 2>/dev/null
    sed -i.bak "s#<string name=\"title_activity_main\">.*</string>#<string name=\"title_activity_main\">$APP_NAME</string>#" "$strings" 2>/dev/null
    rm -f "$strings.bak"
  fi

  local gradle_props="$ANDROID/app/build.gradle"
  if [ -f "$gradle_props" ]; then
    sed -i.bak "s#versionName \"[^\"]*\"#versionName \"$APP_VERSION\"#" "$gradle_props" 2>/dev/null
    sed -i.bak "s#versionCode [0-9]*#versionCode $APP_VERSION_CODE#" "$gradle_props" 2>/dev/null
    rm -f "$gradle_props.bak"
  fi

  ok "Configuração do app aplicada (nome, id, versão)."
  warn "Trocar o ID do aplicativo (applicationId) depois que o projeto Android já existe exige"
  warn "editar frontend/android manualmente (ou apagar frontend/android e rodar de novo)."
}

# =====================================================================
# ASSINATURA DO APK
# =====================================================================
setup_signing() {
  if ! command -v keytool >/dev/null 2>&1; then
    warn "keytool não encontrado (parte do JDK) — não é possível gerar keystore aqui."
    return 1
  fi

  echo
  ask "Nome da chave" "atlas"; local key_name="$REPLY_VAL"
  ask "Nome do arquivo" "atlas-release.jks"; local key_file="$REPLY_VAL"
  ask "Alias" "atlas"; local key_alias="$REPLY_VAL"

  local store_pass key_pass
  read -r -s -p "Senha da keystore: " store_pass; echo
  read -r -s -p "Senha da chave (Enter para usar a mesma): " key_pass; echo
  key_pass="${key_pass:-$store_pass}"

  if [ -z "$store_pass" ]; then
    err "Senha vazia — abortando geração de keystore."
    return 1
  fi

  local key_path="$ANDROID/app/$key_file"
  keytool -genkeypair -v \
    -keystore "$key_path" \
    -alias "$key_alias" \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$store_pass" -keypass "$key_pass" \
    -dname "CN=$key_name, OU=Atlas, O=Atlas, L=,, S=,, C=BR" \
    >/dev/null 2>&1 || { err "Falha ao gerar a keystore."; return 1; }

  cat > "$ANDROID/key.properties" << PROPEOF
storePassword=$store_pass
keyPassword=$key_pass
keyAlias=$key_alias
storeFile=$key_file
PROPEOF

  ok "Keystore gerada em android/app/$key_file"
  ok "android/key.properties criado (fica só local, nunca vai pro Git)."

  patch_gradle_signing
}

patch_gradle_signing() {
  local gradle="$ANDROID/app/build.gradle"
  [ -f "$gradle" ] || return 1

  if grep -q "ATLAS_SIGNING_CONFIG" "$gradle"; then
    ok "build.gradle já tem configuração de assinatura."
    return 0
  fi

  cp "$gradle" "$gradle.orig"

  {
    echo "// ATLAS_SIGNING_CONFIG — inserido automaticamente por build.sh"
    echo "def keystorePropertiesFile = rootProject.file(\"key.properties\")"
    echo "def keystoreProperties = new Properties()"
    echo "if (keystorePropertiesFile.exists()) {"
    echo "    keystoreProperties.load(new FileInputStream(keystorePropertiesFile))"
    echo "}"
    echo
    cat "$gradle.orig"
  } > "$gradle"

  # Adiciona signingConfigs logo depois de "android {"
  awk '
    /^android \{/ && !done {
      print;
      print "    signingConfigs {";
      print "        release {";
      print "            if (keystorePropertiesFile.exists()) {";
      print "                storeFile file(keystoreProperties[\"storeFile\"])";
      print "                storePassword keystoreProperties[\"storePassword\"]";
      print "                keyAlias keystoreProperties[\"keyAlias\"]";
      print "                keyPassword keystoreProperties[\"keyPassword\"]";
      print "            }";
      print "        }";
      print "    }";
      done=1;
      next
    }
    { print }
  ' "$gradle" > "$gradle.tmp" && mv "$gradle.tmp" "$gradle"

  # Aponta buildTypes.release pra signingConfigs.release (só dentro do
  # bloco buildTypes { ... }, pra não bater no "release {" do signingConfigs
  # que acabamos de inserir).
  awk '
    /buildTypes[[:space:]]*\{/ { in_bt=1 }
    in_bt && /release[[:space:]]*\{/ && !done {
      print;
      print "            if (keystorePropertiesFile.exists()) { signingConfig signingConfigs.release }";
      done=1;
      next
    }
    { print }
  ' "$gradle" > "$gradle.tmp" && mv "$gradle.tmp" "$gradle"

  rm -f "$gradle.orig"
  ok "build.gradle atualizado com suporte a assinatura (só ativa se key.properties existir)."
}

# =====================================================================
# .gitignore / GitHub Actions
# =====================================================================
ensure_gitignore() {
  local gi="$ROOT/.gitignore"
  touch "$gi"
  local entries=("*.jks" "*.keystore" "android/key.properties" ".env" ".env.*" "atlas.config.local")
  local changed=0
  for e in "${entries[@]}"; do
    grep -qxF "$e" "$gi" || { echo "$e" >> "$gi"; changed=1; }
  done
  [ "$changed" = "1" ] && ok ".gitignore atualizado (keystore/segredos protegidos)."
}

ensure_github_workflow() {
  mkdir -p "$ROOT/.github/workflows"
  cat > "$ROOT/.github/workflows/android-build.yml" << 'YMLEOF'
name: Build Atlas Android APK

# Compila o APK na nuvem. Dispara em push na main que mexa no frontend,
# ou manualmente pela aba "Actions" do GitHub (workflow_dispatch).
# Gerado/mantido automaticamente por build.sh (bash build.sh apk).
on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'
      - '.github/workflows/android-build.yml'
  workflow_dispatch: {}

jobs:
  build-android:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout do código
        uses: actions/checkout@v4

      - name: Configurar Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Configurar JDK
        uses: actions/setup-java@v4
        with:
          distribution: 'temurin'
          java-version: '17'

      - name: Instalar dependências do frontend
        working-directory: frontend
        run: npm install --no-fund --no-audit

      - name: Build web (Vite)
        working-directory: frontend
        run: npm run build

      - name: Criar/atualizar projeto Android (Capacitor)
        working-directory: frontend
        run: |
          if [ ! -d "android" ]; then
            npx cap add android
            mkdir -p android/app/src/main/res/xml
            cp android-config-template/xml/network_security_config.xml \
               android/app/src/main/res/xml/network_security_config.xml
            npx capacitor-assets generate --android
          fi
          npx cap sync android

      - name: Garantir cleartext + networkSecurityConfig no manifest
        working-directory: frontend
        run: |
          MANIFEST=android/app/src/main/AndroidManifest.xml
          if ! grep -q "networkSecurityConfig" "$MANIFEST"; then
            sed -i 's#<application#<application android:usesCleartextTraffic="true" android:networkSecurityConfig="@xml/network_security_config"#' "$MANIFEST"
          fi

      # Se os 4 secrets de assinatura estiverem configurados no repositório
      # (Settings -> Secrets and variables -> Actions), gera key.properties
      # e compila release assinado. Caso contrário, compila debug normal.
      - name: Preparar assinatura (se secrets existirem)
        working-directory: frontend/android
        env:
          KEYSTORE_BASE64: ${{ secrets.KEYSTORE_BASE64 }}
          KEYSTORE_PASSWORD: ${{ secrets.KEYSTORE_PASSWORD }}
          KEY_ALIAS: ${{ secrets.KEY_ALIAS }}
          KEY_PASSWORD: ${{ secrets.KEY_PASSWORD }}
        run: |
          if [ -n "$KEYSTORE_BASE64" ] && [ -n "$KEYSTORE_PASSWORD" ] && [ -n "$KEY_ALIAS" ] && [ -n "$KEY_PASSWORD" ]; then
            echo "$KEYSTORE_BASE64" | base64 -d > app/atlas-release.jks
            cat > key.properties << EOF
          storePassword=$KEYSTORE_PASSWORD
          keyPassword=$KEY_PASSWORD
          keyAlias=$KEY_ALIAS
          storeFile=atlas-release.jks
          EOF
            echo "SIGNED=1" >> "$GITHUB_ENV"
          else
            echo "SIGNED=0" >> "$GITHUB_ENV"
          fi

      - name: Compilar APK debug
        if: env.SIGNED == '0'
        working-directory: frontend/android
        run: |
          chmod +x gradlew
          ./gradlew assembleDebug

      - name: Compilar APK release (assinado)
        if: env.SIGNED == '1'
        working-directory: frontend/android
        run: |
          chmod +x gradlew
          ./gradlew assembleRelease

      - name: Publicar APK debug como artefato
        if: env.SIGNED == '0'
        uses: actions/upload-artifact@v4
        with:
          name: atlas-debug-apk
          path: frontend/android/app/build/outputs/apk/debug/app-debug.apk

      - name: Publicar APK release como artefato
        if: env.SIGNED == '1'
        uses: actions/upload-artifact@v4
        with:
          name: atlas-release-apk
          path: frontend/android/app/build/outputs/apk/release/app-release.apk
YMLEOF
  ok "Workflow .github/workflows/android-build.yml criado/atualizado."
  log "Pra APK assinado no GitHub Actions, configure os secrets: KEYSTORE_BASE64, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD"
  log "  (gere KEYSTORE_BASE64 com: base64 -w0 android/app/atlas-release.jks)"
}

# =====================================================================
# COMANDO PRINCIPAL: apk
# =====================================================================
apk_command() {
  echo "╔══════════════════════════════════════╗"
  echo "║           ATLAS APK BUILDER           ║"
  echo "╚══════════════════════════════════════╝"

  detect_env
  check_storage_location

  check_node;    [ "$NODE_OK" = "1" ]    || { err "Instale o Node.js e rode de novo."; exit 2; }
  check_npm;     [ "$NPM_OK" = "1" ]     || { err "Instale o npm e rode de novo."; exit 2; }
  check_java
  check_android_sdk

  interactive_configure
  ensure_gitignore

  build_frontend_web
  check_capacitor
  sync_android
  check_gradlew

  case "${WANT_SIGNING:-n}" in
    s|S|sim|Sim|SIM|y|Y|yes) setup_signing ;;
  esac

  if [ "$SDK_OK" != "1" ] || [ "$JAVA_OK" != "1" ] || [ "$GRADLEW_OK" != "1" ]; then
    echo
    warn "Android SDK/Gradle/Java não estão completos neste ambiente."
    ensure_github_workflow

    echo
    echo "========================================"
    echo " APK NÃO COMPILADO LOCALMENTE"
    echo "========================================"
    echo "Motivo:"
    [ "$JAVA_OK" != "1" ] && echo "  - Java (JDK) não encontrado"
    [ "$SDK_OK" != "1" ]  && echo "  - Android SDK não encontrado"
    [ "$GRADLEW_OK" != "1" ] && echo "  - gradlew não gerado"
    echo
    echo "O projeto Android foi preparado em frontend/android/."
    echo
    echo "Próximo passo: GitHub Actions"
    echo "Arquivo: .github/workflows/android-build.yml"
    echo "========================================"

    if [ "$NONINTERACTIVE" = "0" ]; then
      echo
      echo "Escolha:"
      echo "1. Já preparei o GitHub Actions (nada a fazer agora)"
      echo "2. Tentar configurar Android SDK manualmente (ver instruções)"
      echo "3. Cancelar"
      read -r -p "> " choice || choice=1
      if [ "$choice" = "2" ]; then
        echo
        log "Instale o Android SDK command-line tools e defina ANDROID_HOME, por exemplo:"
        log "  export ANDROID_HOME=\$HOME/android-sdk"
        log "  (baixe as 'command line tools' do site do Android, extraia em \$ANDROID_HOME/cmdline-tools/latest)"
        log "  sdkmanager 'platform-tools' 'platforms;android-34' 'build-tools;34.0.0'"
        log "Depois rode 'bash build.sh apk' de novo."
      fi
    fi
    exit 3
  fi

  log "Compilando APK ($([ "$WANT_RELEASE" = "1" ] && echo release || echo debug))..."
  local gradle_task="assembleDebug"
  local apk_out="$ANDROID/app/build/outputs/apk/debug/app-debug.apk"
  if [ "$WANT_RELEASE" = "1" ] && [ -f "$ANDROID/key.properties" ]; then
    gradle_task="assembleRelease"
    apk_out="$ANDROID/app/build/outputs/apk/release/app-release.apk"
  fi

  (cd "$ANDROID" && chmod +x gradlew && ./gradlew "$gradle_task")
  local gradle_status=$?

  echo
  if [ "$gradle_status" -eq 0 ] && [ -f "$apk_out" ]; then
    local size
    size="$(du -h "$apk_out" 2>/dev/null | cut -f1)"
    echo "========================================"
    echo "       ATLAS APK GERADO"
    echo "========================================"
    echo "Status: SUCESSO"
    echo
    echo "APK:"
    echo "$apk_out"
    echo
    echo "Tamanho: ${size:-desconhecido}"
    echo "Versão: $APP_VERSION"
    echo "Application ID: $APP_ID"
    echo "========================================"
    exit 0
  else
    err "Build do Gradle falhou ou o APK não foi encontrado em: $apk_out"
    err "Rode 'bash build.sh doctor' para checar o ambiente, ou veja o log do Gradle acima."
    exit 1
  fi
}

# =====================================================================
# LIMPEZA
# =====================================================================
clean() {
  log "Limpando artefatos de build..."
  rm -rf "$FRONTEND/node_modules" "$FRONTEND/dist" "$BACKEND/node_modules"
  log "Limpo. (a pasta frontend/android não é removida automaticamente)"
}

# =====================================================================
# DISPATCH
# =====================================================================
case "$TARGET" in
  web)
    detect_env
    check_storage_location
    check_node
    build_backend
    build_frontend_web
    ;;
  android)
    detect_env
    check_storage_location
    check_node
    build_frontend_web
    sync_android
    ;;
  apk|android-apk)
    apk_command
    ;;
  all)
    detect_env
    check_storage_location
    check_node
    build_backend
    build_frontend_web
    sync_android
    ;;
  doctor)
    doctor
    ;;
  clean)
    clean
    ;;
  *)
    err "Alvo desconhecido: $TARGET (use web | android | apk | android-apk | all | doctor | clean)"
    exit 1
    ;;
esac

[ "$TARGET" != "apk" ] && [ "$TARGET" != "android-apk" ] && log "Concluído."
