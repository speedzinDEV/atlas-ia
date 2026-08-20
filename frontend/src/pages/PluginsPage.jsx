import React from 'react';

export default function PluginsPage() {
  return (
    <div className="page">
      <h1>Plugins</h1>
      <p className="subtitle">Sistema de instalação e remoção de plugins — em desenvolvimento.</p>
      <div className="card">
        <p style={{ margin: 0, color: 'var(--text-dim)', fontSize: 12.5 }}>
          Um plugin declara nome, versão e descrição em um manifesto JSON. O backend já tem a pasta
          <code> backend/plugins/</code> reservada para isso; falta o loader.
        </p>
      </div>
    </div>
  );
}
