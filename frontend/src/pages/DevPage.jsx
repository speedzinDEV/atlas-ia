import React, { useState } from 'react';
import { api, getApiBaseUrl } from '../services/api.js';

export default function DevPage() {
  const [health, setHealth] = useState(null);
  const [stats, setStats] = useState(null);
  const [running, setRunning] = useState(false);

  async function runDiagnostics() {
    setRunning(true);
    try {
      const [h, s] = await Promise.all([api.health(), api.systemStats()]);
      setHealth(h);
      setStats(s.stats);
    } catch (err) {
      setHealth({ ok: false, error: err.message });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page">
      <h1>Desenvolvedor</h1>
      <p className="subtitle">Logs, status e diagnóstico real do backend.</p>

      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12.5, color: 'var(--text-dim)' }}>Backend conectado em</div>
        <div style={{ fontSize: 13, marginTop: 2 }}>{getApiBaseUrl()}</div>
      </div>

      <button className="icon-btn send" style={{ width: 'auto', padding: '0 14px', marginBottom: 14 }} onClick={runDiagnostics} disabled={running}>
        {running ? 'Rodando...' : 'Executar diagnóstico'}
      </button>

      {health && (
        <div className="card" style={{ marginBottom: 12, fontSize: 12.5 }}>
          <div>API: {health.api ? '✅' : '❌'}</div>
          <div>Servidor de inferência: {health.inferenceServer ? '✅' : '❌ (verifique se o llama-server está rodando)'}</div>
          <div>Memória: {health.memory ? '✅' : '❌'}</div>
          {health.error && <div style={{ color: 'var(--danger)' }}>{health.error}</div>}
        </div>
      )}

      {stats && (
        <div className="card" style={{ fontSize: 12.5 }}>
          <div>CPU: {stats.cpuPercent != null ? `${stats.cpuPercent}%` : '—'}</div>
          <div>RAM: {stats.ram ? `${stats.ram.usedGB} / ${stats.ram.totalGB} GB` : '—'}</div>
          <div>VRAM: {stats.vram ? `${stats.vram.usedGB} / ${stats.vram.totalGB} GB` : 'não disponível nesta plataforma'}</div>
        </div>
      )}
    </div>
  );
}
