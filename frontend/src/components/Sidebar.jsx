import React from 'react';

const NAV_ITEMS = [
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'memory', label: 'Memória', icon: '🧠' },
  { id: 'models', label: 'Modelos', icon: '🤖' },
  { id: 'tools', label: 'Ferramentas', icon: '🛠️' },
  { id: 'plugins', label: 'Plugins', icon: '🔌' },
  { id: 'voice', label: 'Voz', icon: '🔊', badge: 'Em breve' },
  { id: 'settings', label: 'Configurações', icon: '⚙️' },
  { id: 'dev', label: 'Desenvolvedor', icon: '🧪' },
];

export default function Sidebar({ page, setPage, open, onNavigate, currentModel, apiOnline, systemStats }) {
  const ram = systemStats?.ram;
  const ramPct = ram ? Math.round((ram.usedGB / ram.totalGB) * 100) : null;

  return (
    <aside className={`sidebar ${open ? 'open' : ''}`}>
      <div className="sidebar-brand">
        <div className="brand-mark">A</div>
        <div className="brand-text">
          <strong>ATLAS</strong>
          <span>Seu assistente de IA pessoal</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`sidebar-item ${page === item.id ? 'active' : ''}`}
            onClick={() => {
              setPage(item.id);
              onNavigate?.();
            }}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
            {item.badge && <span className="badge-inline">{item.badge}</span>}
          </button>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="status-card">
          <span className={`dot-lg ${apiOnline ? '' : 'off'}`} />
          <div>
            <div className="label">Atlas</div>
            <div className="sub">{apiOnline ? 'Online' : 'Offline'}</div>
          </div>
        </div>

        <div className="model-card">
          <div className="sub" style={{ color: 'var(--text-dim)', fontSize: 11, marginBottom: 4 }}>Modelo ativo</div>
          <div className="model-name">{currentModel || 'nenhum selecionado'}</div>
          {currentModel && <span className="badge ok">Carregado</span>}
          {systemStats && (
            <div className="stats-row-wrap">
              <div className="stats-row">
                <span>CPU</span>
                <span>{systemStats.cpuPercent != null ? `${systemStats.cpuPercent}%` : '—'}</span>
              </div>
              {systemStats.cpuPercent != null && (
                <div className="stat-bar"><div style={{ width: `${systemStats.cpuPercent}%` }} /></div>
              )}
              <div className="stats-row">
                <span>RAM</span>
                <span>{ram ? `${ram.usedGB} / ${ram.totalGB} GB` : '—'}</span>
              </div>
              {ramPct != null && (
                <div className="stat-bar"><div style={{ width: `${ramPct}%` }} /></div>
              )}
              <div className="stats-row">
                <span>VRAM</span>
                <span>{systemStats.vram ? `${systemStats.vram.usedGB} / ${systemStats.vram.totalGB} GB` : 'não disponível'}</span>
              </div>
            </div>
          )}
        </div>

        <div className="sidebar-version">Atlas v0.2.0</div>
      </div>
    </aside>
  );
}
