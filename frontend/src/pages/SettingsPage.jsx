import React, { useEffect, useState } from 'react';
import { api, getApiBaseUrl, setApiBaseUrl } from '../services/api.js';

export default function SettingsPage() {
  const [settings, setSettings] = useState(null);
  const [apiUrl, setApiUrl] = useState(getApiBaseUrl());
  const [apiUrlStatus, setApiUrlStatus] = useState(null); // null | 'testing' | 'ok' | 'error'
  const [apiUrlError, setApiUrlError] = useState(null);

  async function load() {
    const res = await api.settings.get();
    setSettings(res.settings);
  }

  useEffect(() => { load(); }, []);

  async function save(category, patch) {
    const res = await api.settings.update({ [category]: patch });
    setSettings(res.settings);
  }

  async function saveApiUrl() {
    setApiUrlStatus('testing');
    setApiUrlError(null);
    try {
      await api.testConnection(apiUrl);
      setApiBaseUrl(apiUrl);
      setApiUrlStatus('ok');
    } catch (err) {
      setApiUrlStatus('error');
      setApiUrlError(err.message);
    }
  }

  if (!settings) return <div className="page"><p className="subtitle">Carregando...</p></div>;

  return (
    <div className="page">
      <h1>Configurações</h1>
      <p className="subtitle">Todas as mudanças são salvas de verdade no backend.</p>

      <div className="settings-section">
        <h2>Aparência</h2>
        <div className="settings-row">
          <span>Tema</span>
          <select value={settings.appearance.theme} onChange={(e) => save('appearance', { theme: e.target.value })}>
            <option value="dark">Escuro</option>
            <option value="light">Claro</option>
            <option value="auto">Automático</option>
          </select>
        </div>
        <div className="settings-row">
          <span>Animações</span>
          <input type="checkbox" checked={settings.appearance.animations} onChange={(e) => save('appearance', { animations: e.target.checked })} />
        </div>
      </div>

      <div className="settings-section">
        <h2>IA</h2>
        <div className="settings-row">
          <span>Temperatura</span>
          <input type="number" step="0.1" min="0" max="2" value={settings.ai.temperature} onChange={(e) => save('ai', { temperature: parseFloat(e.target.value) })} />
        </div>
        <div className="settings-row">
          <span>Contexto (tokens)</span>
          <input type="number" value={settings.ai.contextSize} onChange={(e) => save('ai', { contextSize: parseInt(e.target.value) })} />
        </div>
        <div className="settings-row">
          <span>Máximo de tokens de resposta</span>
          <input type="number" value={settings.ai.maxTokens} onChange={(e) => save('ai', { maxTokens: parseInt(e.target.value) })} />
        </div>
      </div>

      <div className="settings-section">
        <h2>Voz</h2>
        <div className="settings-row">
          <span>Ativar voz (em desenvolvimento)</span>
          <input type="checkbox" checked={settings.voice.enabled} onChange={(e) => save('voice', { enabled: e.target.checked })} />
        </div>
      </div>

      <div className="settings-section">
        <h2>Memória</h2>
        <div className="settings-row">
          <span>Ativar memória</span>
          <input type="checkbox" checked={settings.memory.enabled} onChange={(e) => save('memory', { enabled: e.target.checked })} />
        </div>
      </div>

      <div className="settings-section">
        <h2>Conexão com o Atlas</h2>
        <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: -4, marginBottom: 10 }}>
          Endereço do backend do Atlas (API). No celular, se o backend estiver rodando no
          próprio aparelho via Termux, use <code>http://127.0.0.1:3000</code>. Se estiver
          rodando no seu PC, use o IP dele na rede local, ex: <code>http://192.168.0.10:3000</code>.
        </p>
        <div className="settings-row">
          <span>URL do backend</span>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => { setApiUrl(e.target.value); setApiUrlStatus(null); }}
            placeholder="http://127.0.0.1:3000"
            style={{ minWidth: 220 }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8 }}>
          <button className="icon-btn send" style={{ width: 'auto', padding: '0 14px' }} onClick={saveApiUrl}>
            Testar e salvar
          </button>
          {apiUrlStatus === 'testing' && <span className="badge">testando...</span>}
          {apiUrlStatus === 'ok' && <span className="badge ok">conectado</span>}
          {apiUrlStatus === 'error' && <span className="badge warn">falhou: {apiUrlError}</span>}
        </div>
      </div>

      <div className="settings-section">
        <h2>Sistema</h2>
        <div className="settings-row">
          <span>URL do servidor de inferência</span>
          <input type="text" value={settings.system.inferenceServerUrl} onChange={(e) => save('system', { inferenceServerUrl: e.target.value })} />
        </div>
        <div className="settings-row">
          <span>Porta da API</span>
          <input type="number" value={settings.system.apiPort} onChange={(e) => save('system', { apiPort: parseInt(e.target.value) })} />
        </div>
      </div>

    </div>
  );
}
