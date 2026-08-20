import React from 'react';

export default function HomePage({ apiOnline, currentModel, setPage }) {
  return (
    <div className="page">
      <h1>Bem-vindo ao Atlas</h1>
      <p className="subtitle">Seu assistente pessoal de IA, rodando localmente.</p>

      <div className="card" style={{ marginBottom: 12 }}>
        <div>Status da API: <span className={apiOnline ? 'badge ok' : 'badge warn'}>{apiOnline ? 'online' : 'offline'}</span></div>
        <div style={{ marginTop: 6 }}>Modelo atual: {currentModel || 'nenhum selecionado'}</div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button className="icon-btn send" style={{ width: 'auto', padding: '0 16px' }} onClick={() => setPage('chat')}>
          Iniciar conversa
        </button>
        <button className="icon-btn" style={{ width: 'auto', padding: '0 16px' }} onClick={() => setPage('models')}>
          Escolher modelo
        </button>
      </div>
    </div>
  );
}
