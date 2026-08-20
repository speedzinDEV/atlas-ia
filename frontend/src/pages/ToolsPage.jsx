import React from 'react';

const TOOLS = [
  { icon: '🧮', name: 'Calculadora' },
  { icon: '🌐', name: 'Pesquisa' },
  { icon: '📁', name: 'Arquivos' },
  { icon: '💻', name: 'Terminal' },
  { icon: '📝', name: 'Editor' },
  { icon: '🖼️', name: 'Imagens' },
  { icon: '🎤', name: 'Voz' },
];

export default function ToolsPage() {
  return (
    <div className="page">
      <h1>Ferramentas</h1>
      <p className="subtitle">Cada ferramenta é um módulo independente. Nenhuma está conectada ainda.</p>
      <div className="tools-grid">
        {TOOLS.map((t) => (
          <div key={t.name} className="tool-card">
            <div style={{ fontSize: 22, marginBottom: 6 }}>{t.icon}</div>
            {t.name}
            <div style={{ marginTop: 6, fontSize: 10 }}>Em desenvolvimento</div>
          </div>
        ))}
      </div>
    </div>
  );
}
