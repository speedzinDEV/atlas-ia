import React from 'react';

export default function VoicePage() {
  return (
    <div className="page">
      <h1>Voz</h1>
      <p className="subtitle">Entrada por microfone e respostas faladas — em desenvolvimento.</p>
      <div className="card">
        <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 12.5 }}>
          Arquitetura planejada: Microfone → Speech-to-Text → Atlas → Text-to-Speech → alto-falante.
          A interface já não quebra sem esse recurso — o botão 🎤 no chat existe, mas está desativado
          até essa peça ser implementada.
        </p>
      </div>
    </div>
  );
}
