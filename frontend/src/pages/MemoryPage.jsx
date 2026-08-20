import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export default function MemoryPage() {
  const [entries, setEntries] = useState([]);
  const [newText, setNewText] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.memory.list();
      setEntries(res.entries);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addEntry() {
    if (!newText.trim()) return;
    await api.memory.add(newText.trim());
    setNewText('');
    load();
  }

  async function saveEdit(id) {
    await api.memory.update(id, editingText);
    setEditingId(null);
    load();
  }

  async function removeEntry(id) {
    await api.memory.remove(id);
    load();
  }

  return (
    <div className="page">
      <h1>Memória do Atlas</h1>
      <p className="subtitle">Informações que você permitiu salvar.</p>

      {error && <div className="card" style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}

      <div className="card" style={{ marginBottom: 16, display: 'flex', gap: 8 }}>
        <input
          type="text"
          placeholder="Adicionar memória manualmente..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addEntry()}
          style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text)', padding: '8px 10px' }}
        />
        <button className="icon-btn send" style={{ width: 'auto', padding: '0 14px' }} onClick={addEntry}>
          Adicionar
        </button>
      </div>

      {loading ? (
        <p className="subtitle">Carregando...</p>
      ) : entries.length === 0 ? (
        <p className="empty-state">Nenhuma memória salva ainda.</p>
      ) : (
        entries.map((e) => (
          <div key={e.id} className="list-item">
            {editingId === e.id ? (
              <input
                type="text"
                value={editingText}
                onChange={(ev) => setEditingText(ev.target.value)}
                onKeyDown={(ev) => ev.key === 'Enter' && saveEdit(e.id)}
                style={{ flex: 1, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '4px 8px', marginRight: 8 }}
                autoFocus
              />
            ) : (
              <span>• {e.text}</span>
            )}
            <div className="actions">
              {editingId === e.id ? (
                <button onClick={() => saveEdit(e.id)}>salvar</button>
              ) : (
                <button onClick={() => { setEditingId(e.id); setEditingText(e.text); }}>editar</button>
              )}
              <button onClick={() => removeEntry(e.id)}>excluir</button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
