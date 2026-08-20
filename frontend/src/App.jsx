import React, { useEffect, useState } from 'react';
import Sidebar from './components/Sidebar.jsx';
import HomePage from './pages/HomePage.jsx';
import ChatPage from './pages/ChatPage.jsx';
import MemoryPage from './pages/MemoryPage.jsx';
import ModelsPage from './pages/ModelsPage.jsx';
import ToolsPage from './pages/ToolsPage.jsx';
import PluginsPage from './pages/PluginsPage.jsx';
import VoicePage from './pages/VoicePage.jsx';
import SettingsPage from './pages/SettingsPage.jsx';
import DevPage from './pages/DevPage.jsx';
import { api } from './services/api.js';

export default function App() {
  const [page, setPage] = useState('chat');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [health, setHealth] = useState({ api: false, inferenceServer: false, memory: false });
  const [currentModel, setCurrentModel] = useState(null);
  const [memoryEntries, setMemoryEntries] = useState([]);
  const [systemStats, setSystemStats] = useState(null);

  async function refreshAll() {
    try {
      const h = await api.health();
      setHealth(h);
    } catch {
      setHealth({ api: false, inferenceServer: false, memory: false });
    }
    try {
      const res = await api.settings.get();
      setCurrentModel(res.settings.ai.defaultModel);
    } catch { /* backend offline: mantém último estado conhecido */ }
    try {
      const res = await api.memory.list();
      setMemoryEntries(res.entries);
    } catch { /* idem */ }
    try {
      const res = await api.systemStats();
      setSystemStats(res.stats);
    } catch { /* idem */ }
  }

  useEffect(() => {
    refreshAll();
    const interval = setInterval(refreshAll, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="app-shell">
      <div className="mobile-topbar">
        <button onClick={() => setSidebarOpen((v) => !v)}>☰</button>
        <strong>ATLAS</strong>
        <span style={{ width: 34 }} />
      </div>

      {sidebarOpen && <div className="overlay" onClick={() => setSidebarOpen(false)} />}

      <Sidebar
        page={page}
        setPage={setPage}
        open={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
        currentModel={currentModel}
        apiOnline={health.api}
        systemStats={systemStats}
      />

      {page === 'home' && <HomePage apiOnline={health.api} currentModel={currentModel} setPage={setPage} />}
      {page === 'chat' && (
        <ChatPage
          currentModel={currentModel}
          health={health}
          memoryEntries={memoryEntries}
          setPage={setPage}
        />
      )}
      {page === 'memory' && <MemoryPage />}
      {page === 'models' && <ModelsPage onModelChanged={setCurrentModel} />}
      {page === 'tools' && <ToolsPage />}
      {page === 'plugins' && <PluginsPage />}
      {page === 'voice' && <VoicePage />}
      {page === 'settings' && <SettingsPage />}
      {page === 'dev' && <DevPage />}
    </div>
  );
}
