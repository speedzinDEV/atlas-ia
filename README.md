# Atlas

Assistente pessoal de IA — interface + backend funcionais, arquitetura preparada
para expandir (voz, plugins, ferramentas) sem reescrever nada.

## Arquitetura

```
Interface (React)
   ↓
Atlas API (Express)
   ↓
Model Manager  →  llama-server (llama.cpp)  →  modelo .gguf
   ↓
Memória / Settings (JSON em disco)
```

O frontend **nunca** fala com o modelo diretamente — sempre passa pela API do Atlas
(`backend/core/inference.js`).

## Rodando no Termux

### 1. Backend

```bash
cd atlas/backend
npm install
npm start
```

Sobe em `http://127.0.0.1:3000`. Testa com:

```bash
curl http://127.0.0.1:3000/health
```

### 2. Servidor de inferência (llama.cpp)

Precisa do `llama-server` compilado (via `pkg install` + build do llama.cpp, ou
binário pronto). Coloque um `.gguf` em `atlas/models/` e rode:

```bash
chmod +x atlas/scripts/start-inference.sh
./atlas/scripts/start-inference.sh
```

Isso sobe o modelo em `http://127.0.0.1:8080`, que é a URL padrão configurada em
`backend/core/settingsStore.js` (ajustável na tela de Configurações do app).

### 3. Frontend

```bash
cd atlas/frontend
npm install
npm run dev
```

Abre em `http://127.0.0.1:5173`. Em dev, o Vite faz proxy de `/api` para o backend
(porta 3000) — configurado em `vite.config.js`.

## Fluxo de primeira execução

1. Backend online + nenhum modelo selecionado → app mostra "Nenhum modelo" no chat.
2. Vá em **Modelos** → selecione um `.gguf` detectado em `/models`.
3. Suba o `llama-server` (passo 2 acima).
4. Volte pro **Chat** e converse — as respostas chegam via streaming real (SSE).

## O que já funciona de verdade

- Chat com streaming real (SSE) contra o llama-server, formato OpenAI-compatible.
- Memória: CRUD completo persistido em `data/memory/memory.json`.
- Modelos: escaneia `/models` de verdade — nunca assume que algo está instalado.
- Configurações: persistidas em `data/settings/settings.json`, aplicadas de fato
  (temperatura, tokens, URL do servidor de inferência, etc.).
- Diagnóstico: `Configurações → Desenvolvedor → Executar diagnóstico` chama
  `/health` de verdade (API, servidor de inferência, memória).
- Sidebar responsiva: vira menu hambúrguer abaixo de 820px.

## O que está marcado como "Em desenvolvimento" (de propósito)

Voz (STT/TTS), Ferramentas (calculadora, terminal, etc.), Plugins (loader), e
modelos online. As pastas/rotas já existem (`backend/tools`, `backend/plugins`)
para plugar essas features sem reescrever a arquitetura.

## Build

Use `./build.sh` na raiz:

```bash
./build.sh web          # instala deps + builda backend e frontend web
./build.sh android       # builda o frontend + gera/sincroniza projeto Android (Capacitor)
./build.sh android-apk   # idem + compila o .apk (precisa Android SDK/Gradle — não recomendado no Termux)
./build.sh all           # web + android (sem compilar apk)
./build.sh clean         # remove node_modules e dist
```

## App Android

Detalhes completos em [`frontend/README-android.md`](frontend/README-android.md).
Resumo: o app Android é um wrapper WebView (Capacitor) do mesmo frontend React,
que conversa por HTTP com o Atlas API — local (`127.0.0.1`, se o backend rodar
no próprio celular via Termux) ou remoto (IP do seu PC na rede). A URL é
configurável dentro do app, sem precisar recompilar. Como compilar um `.apk`
dentro do Termux é inviável na prática (precisa do Android SDK/Gradle
completos), o build real do APK roda via GitHub Actions
(`.github/workflows/android-build.yml`) ou Android Studio no PC.

## Rumo ao Tauri (build desktop pra Windows)

Este scaffold web (Vite + Express) também é a base pro empacotamento desktop
via Tauri, se quiser um `.exe` no Windows depois:

1. `npm create tauri-app@latest` numa pasta `atlas/desktop/`, apontando o
   `frontendDist` pro build do Vite (`frontend/dist`).
2. Os comandos Tauri (Rust) viram wrappers finos que chamam o backend Express
   local (ou reimplementam `backend/` em Rust puro, se quiser tirar o Node do
   pacote final).
3. O `inference.js` (proxy pro llama-server) pode virar um `sidecar` do Tauri,
   subindo o `llama-server` junto com o app.
