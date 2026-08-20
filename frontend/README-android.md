# Atlas no Android

O app Android é um wrapper WebView (Capacitor) em cima do mesmo frontend React
usado na web. Ele **não roda o backend embutido** — ele se conecta a um Atlas
API por HTTP, igual ao frontend web faz. A diferença é só a URL:

- Se o backend (`atlas/backend`) e o `llama-server` estiverem rodando no
  **próprio celular via Termux**, o app conecta em `http://127.0.0.1:3000`.
- Se estiverem rodando no **seu PC**, o app conecta no IP do PC na rede local,
  ex: `http://192.168.0.10:3000`.

Essa URL é configurável **dentro do próprio app**, em Configurações → Conexão
com o Atlas → testa e salva. Não precisa recompilar pra trocar.

## Por que não compilar o APK direto no Termux

Compilar um APK exige o Android SDK + Gradle + JDK completos (vários GB,
variáveis de ambiente, licenças do SDK). Isso é frágil e pesado dentro do
Termux. Os dois caminhos que realmente funcionam:

### Opção A — GitHub Actions (recomendado, sem instalar nada)

1. Suba este projeto (`atlas/`) num repositório no GitHub.
2. O workflow `.github/workflows/android-build.yml` já está configurado:
   roda no push pra `main` (mudando algo em `frontend/`) ou manualmente pela
   aba **Actions → Build Atlas Android APK → Run workflow**.
3. Quando terminar, baixe o artefato `atlas-debug-apk` — é o `.apk` pronto
   pra instalar (ative "fontes desconhecidas" no Android pra instalar).

### Opção B — Android Studio no PC

```bash
cd atlas
./build.sh android
```

Isso builda o frontend e gera a pasta `frontend/android/` (projeto Android
completo via Capacitor). Depois:

```bash
cd frontend
npx cap open android
```

Abre no Android Studio, onde você builda/roda normalmente (emulador ou
celular por USB).

## Rodando o build a partir do Termux: onde colocar a pasta

Se o projeto estiver em armazenamento compartilhado do Android
(`/storage/emulated/0/...`, `/sdcard/...` ou `~/storage/shared/...`), o `npm
install` **sempre** falharia com `EACCES ... symlink` — essa pasta é montada
via FUSE e não suporta links simbólicos, que o npm precisa criar em
`node_modules/.bin`. Não é um bug do Atlas, é qualquer projeto Node.

Por isso `./build.sh` detecta isso sozinho: se rodar de dentro do
armazenamento compartilhado, ele copia o projeto para `~/<nome-da-pasta>`
(filesystem nativo do Termux) e continua o build de lá automaticamente — você
não precisa fazer nada manualmente. Rodar de novo depois de editar arquivos
em `/storage` sincroniza as mudanças pro destino antes de buildar (dados em
`data/`, `node_modules/` e `frontend/android/` já existentes no destino não
são apagados). Se preferir, pode trabalhar direto em `~/<nome-da-pasta>` pra
pular a cópia.

## Passo a passo completo (primeira vez)

```bash
cd atlas
chmod +x build.sh
./build.sh android          # gera frontend/android/
```

Isso já:
- builda o frontend em modo produção;
- cria o projeto Android via `npx cap add android` (se ainda não existir);
- copia o `network_security_config.xml` (necessário pro Android permitir
  HTTP puro — sem HTTPS — falando com o backend local/rede);
- te avisa pra confirmar 2 atributos no `AndroidManifest.xml` (o workflow do
  GitHub Actions já faz isso sozinho; localmente, confira manualmente na
  tag `<application>`):
  ```xml
  android:usesCleartextTraffic="true"
  android:networkSecurityConfig="@xml/network_security_config"
  ```

- gera o ícone e a splash screen do Atlas (marca "A" azul, ver
  `frontend/resources/`) em todas as resoluções Android via
  `npx capacitor-assets generate --android` — não são ícones genéricos.

Depois disso, use a Opção A ou B acima pra virar `.apk`.

## Ícone e splash

A identidade visual (ícone `frontend/resources/icon.png` e splash
`frontend/resources/splash.png`, ambos usando as cores do Atlas) já está
pronta. Toda vez que `android/` for (re)criado, `./build.sh android` roda
`capacitor-assets generate --android` automaticamente e popula
`android/app/src/main/res/mipmap-*` e `drawable-*` com os tamanhos corretos.
Se quiser trocar a marca, basta substituir esses dois PNGs e rodar o comando
de novo.

## Rodando 100% no celular (Termux + APK no mesmo aparelho)

1. No Termux: suba o backend (`cd backend && npm start`) e o `llama-server`
   (`./scripts/start-inference.sh`).
2. Instale o `.apk` normalmente (fora do Termux, como um app comum).
3. Abra o app → Configurações → URL do backend → `http://127.0.0.1:3000` →
   Testar e salvar.
4. Pronto — o app (processo Android normal) e o backend (processo Termux)
   conversam por loopback, mesmo sendo apps "separados" do ponto de vista
   do sistema.
