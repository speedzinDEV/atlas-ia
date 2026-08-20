import React, { useEffect, useState } from 'react';
import { api } from '../services/api.js';

export default function ModelsPage({ onModelChanged }) {
  const [local, setLocal] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.models.list();
      setLocal(res.local);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function select(modelId) {
    try {
      await api.models.select(modelId);
      await load();
      onModelChanged?.(modelId);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="page">
      <h1>Modelos</h1>
      <p className="subtitle">Modelos detectados na pasta /models. Nada aqui é assumido — é escaneado do disco.</p>

      {error && <div className="card" style={{ color: 'var(--danger)', marginBottom: 12 }}>{error}</div>}

      <h2 style={{ fontSize: 13, color: 'var(--text-dim)', marginBottom: 8 }}>MODELOS LOCAIS</h2>
      {loading ? (
        <p className="subtitle">Carregando...</p>
      ) : local.length === 0 ? (
        <p className="empty-state">
          Nenhum arquivo .gguf encontrado em /models. Coloque um modelo lá e recarregue.
        </p>
      ) : (
        local.map((m) => (
          <div key={m.id} className="list-item">
            <div>
              <strong>{m.name}</strong>
              <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>{m.size} · local</div>
            </div>
            <div className="actions">
              {m.selected ? (
                <span className="badge ok">selecionado</span>
              ) : (
                <button onClick={() => select(m.id)}>selecionar</button>
              )}
            </div>
          </div>
        ))
      )}

      <h2 style={{ fontSize: 13, color: 'var(--text-dim)', margin: '20px 0 8px' }}>MODELOS ONLINE</h2>
      <p className="empty-state">Em desenvolvimento — adicionar provedor ainda não está disponível.</p>
    </div>
  );
}
