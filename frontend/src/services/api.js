// services/api.js
// Toda comunicação com o backend do Atlas passa por aqui.
//
// Resolução da URL base, em ordem de prioridade:
// 1. Valor salvo pelo usuário em Configurações (localStorage) — permite o
//    mesmo build (ex: o APK Android) apontar tanto pra 127.0.0.1 (backend
//    rodando no próprio celular via Termux) quanto pra outra máquina na rede.
// 2. VITE_API_BASE_URL definida no build (.env.production usa 127.0.0.1:3000
//    pro build mobile/produção).
// 3. '/api' — usado em dev web, onde o vite.config.js faz proxy pro backend.

const STORAGE_KEY = 'atlas:apiBaseUrl';

export function getApiBaseUrl() {
  const saved = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  if (saved) return saved.replace(/\/$/, '');
  return import.meta.env.VITE_API_BASE_URL || '/api';
}

export function setApiBaseUrl(url) {
  if (typeof localStorage === 'undefined') return;
  if (!url) {
    localStorage.removeItem(STORAGE_KEY);
  } else {
    localStorage.setItem(STORAGE_KEY, url.replace(/\/$/, ''));
  }
}

function BASE() {
  return getApiBaseUrl();
}

async function request(path, options = {}) {
  const res = await fetch(`${BASE()}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Erro ${res.status}`);
  }
  return res.json();
}

export const api = {
  health: () => request('/health'),
  systemStats: () => request('/system/stats'),

  // Testa uma URL específica antes de salvar (usado na tela de Configurações
  // ao trocar o endereço do backend, pra não travar o app com URL errada).
  testConnection: async (url) => {
    const res = await fetch(`${url.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) throw new Error(`Servidor respondeu ${res.status}`);
    return res.json();
  },

  // chat com streaming via SSE
  streamChat({ messages, onToken, onDone, onError }) {
    const controller = new AbortController();
    fetch(`${BASE()}/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal: controller.signal,
    })
      .then(async (res) => {
        if (!res.body) throw new Error('Sem corpo de resposta do servidor.');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split('\n\n');
          buffer = parts.pop() ?? '';
          for (const part of parts) {
            const line = part.trim();
            if (!line.startsWith('data:')) continue;
            const json = JSON.parse(line.slice(5).trim());
            if (json.error) return onError(new Error(json.error));
            if (json.done) return onDone();
            if (json.token) onToken(json.token);
          }
        }
        onDone();
      })
      .catch((err) => {
        if (err.name !== 'AbortError') onError(err);
      });
    return () => controller.abort();
  },

  memory: {
    list: () => request('/memory'),
    add: (text) => request('/memory', { method: 'POST', body: JSON.stringify({ text }) }),
    update: (id, text) => request(`/memory/${id}`, { method: 'PUT', body: JSON.stringify({ text }) }),
    remove: (id) => request(`/memory/${id}`, { method: 'DELETE' }),
  },

  models: {
    list: () => request('/models'),
    select: (modelId) => request('/models/select', { method: 'POST', body: JSON.stringify({ modelId }) }),
  },

  settings: {
    get: () => request('/settings'),
    update: (partial) => request('/settings', { method: 'POST', body: JSON.stringify(partial) }),
  },
};
