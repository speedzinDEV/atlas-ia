import React from 'react';

const QUICK_TOOLS = [
  { icon: '🧮', name: 'Calculadora' },
  { icon: '🌐', name: 'Web Search' },
  { icon: '📁', name: 'Arquivos' },
  { icon: '💻', name: 'Terminal' },
  { icon: '📝', name: 'Notas' },
  { icon: '🖥️', name: 'Código' },
];

export default function RightPanel({ open, onClose, health, memoryEntries, onGoMemory, onGoTools, conversationStats, onClearConversation }) {
  return (
    <>
      {open && <div className="overlay" onClick={onClose} />}
      <aside className={`right-panel ${open ? 'open' : ''}`}>
        <div className="system-status-card">
          <div className="heading">
            <span className={`dot-lg ${health?.api ? '' : 'off'}`} />
            <div>
              <strong>Status do sistema</strong>
              <div className="sub">
                {health?.api && health?.inferenceServer && health?.memory
                  ? 'Todos os sistemas operacionais'
                  : 'Alguns sistemas indisponíveis'}
              </div>
            </div>
          </div>
          <div className="status-grid">
            <StatusTile icon="🔌" name="API" ok={health?.api} />
            <StatusTile icon="🤖" name="Modelo" ok={health?.modelSelected} neutral={health?.modelSelected === undefined} />
            <StatusTile icon="🧠" name="Memória" ok={health?.memory} />
            <StatusTile icon="⚙️" name="Inferência" ok={health?.inferenceServer} />
          </div>
        </div>

        <div>
          <div className="panel-section-title">
            <h3>Memória</h3>
            <button className="link" onClick={onGoMemory}>Ver todas</button>
          </div>
          <div className="card">
            {memoryEntries.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>Nenhuma memória salva ainda.</div>
            ) : (
              memoryEntries.slice(0, 4).map((m) => (
                <div className="mem-item" key={m.id}>
                  <div className="icon">🧠</div>
                  <div>
                    <div className="title">{m.text}</div>
                  </div>
                </div>
              ))
            )}
            <button className="add-memory-btn" onClick={onGoMemory}>+ Adicionar memória</button>
          </div>
        </div>

        <div>
          <div className="panel-section-title">
            <h3>Ferramentas rápidas</h3>
            <button className="link" onClick={onGoTools}>Ver todas</button>
          </div>
          <div className="quick-tools-grid">
            {QUICK_TOOLS.map((t) => (
              <button key={t.name} className="quick-tool" onClick={onGoTools}>
                <div className="icon">{t.icon}</div>
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="panel-section-title">
            <h3>Conversa atual</h3>
          </div>
          <div className="card">
            <div className="conv-stats-row">
              <span className="label">💬 Mensagens</span>
              <span>{conversationStats.messages}</span>
            </div>
            <div className="conv-stats-row">
              <span className="label">🔠 Palavras (~tokens)</span>
              <span>{conversationStats.approxTokens}</span>
            </div>
            <div className="conv-stats-row">
              <span className="label">🕐 Tempo</span>
              <span>{conversationStats.elapsed}</span>
            </div>
            <button className="clear-conv-btn" onClick={onClearConversation}>🗑 Limpar conversa</button>
          </div>
        </div>
      </aside>
    </>
  );
}

function StatusTile({ icon, name, ok, neutral }) {
  const state = neutral ? 'neutral' : ok ? 'ok' : 'off';
  const label = neutral ? '—' : ok ? (name === 'Modelo' ? 'Carregado' : name === 'Memória' ? 'Ativa' : 'Online') : 'Offline';
  return (
    <div className="status-tile">
      <div className="icon">{icon}</div>
      <div className="name">{name}</div>
      <div className={`state ${state}`}>{label}</div>
    </div>
  );
}
