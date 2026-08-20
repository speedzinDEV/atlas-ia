// core/inference.js
// Unico lugar do backend que fala com o llama-server. O frontend NUNCA
// acessa o modelo diretamente - sempre passa por aqui.

const { get: getSettings } = require('./settingsStore');

async function isInferenceServerUp() {
  const { system } = getSettings();
  try {
    const res = await fetch(`${system.inferenceServerUrl}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// Faz streaming de tokens do llama-server (formato OpenAI-compatible /v1/chat/completions,
// que o llama.cpp llama-server expõe nativamente) e repassa via callback onToken.
async function streamChat({ messages, onToken, onDone, onError }) {
  const settings = getSettings();
  const { system, ai } = settings;

  if (!ai.defaultModel) {
    onError(new Error('Nenhum modelo selecionado. Vá em Modelos e selecione um.'));
    return;
  }

  const up = await isInferenceServerUp();
  if (!up) {
    onError(new Error('Não consegui conectar ao servidor de inferência local.'));
    return;
  }

  try {
    const response = await fetch(`${system.inferenceServerUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        temperature: ai.temperature,
        max_tokens: ai.maxTokens,
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      onError(new Error(`Servidor de inferência respondeu com erro (${response.status}).`));
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') {
          onDone();
          return;
        }
        try {
          const json = JSON.parse(payload);
          const token = json.choices?.[0]?.delta?.content;
          if (token) onToken(token);
        } catch {
          // linha incompleta ou nao-JSON: ignora, o buffer cuida disso
        }
      }
    }
    onDone();
  } catch (err) {
    // log tecnico completo no servidor
    console.error('[inference] erro no stream:', err);
    onError(new Error('Falha ao conversar com o modelo local. Veja os logs para detalhes.'));
  }
}

module.exports = { isInferenceServerUp, streamChat };
