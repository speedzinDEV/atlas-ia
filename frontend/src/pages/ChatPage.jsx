import React, { useEffect, useRef, useState } from 'react';
import MessageBubble from '../components/MessageBubble.jsx';
import RightPanel from '../components/RightPanel.jsx';
import { api } from '../services/api.js';

export default function ChatPage({ currentModel, health, memoryEntries, setPage }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [startedAt] = useState(Date.now());
  const [elapsedLabel, setElapsedLabel] = useState('00:00:00');
  const stopRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const secs = Math.floor((Date.now() - startedAt) / 1000);
      const h = String(Math.floor(secs / 3600)).padStart(2, '0');
      const m = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
      const s = String(secs % 60).padStart(2, '0');
      setElapsedLabel(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  function send() {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg = { role: 'user', text, time: nowLabel() };
    const assistantMsg = { role: 'assistant', text: '', time: nowLabel() };
    const nextMessages = [...messages, userMsg];

    setMessages([...nextMessages, assistantMsg]);
    setInput('');
    setError(null);
    setStreaming(true);

    const apiMessages = nextMessages.map((m) => ({ role: m.role, content: m.text }));

    stopRef.current = api.streamChat({
      messages: apiMessages,
      onToken: (token) => {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = {
            ...copy[copy.length - 1],
            text: copy[copy.length - 1].text + token,
          };
          return copy;
        });
      },
      onDone: () => setStreaming(false),
      onError: (err) => {
        setStreaming(false);
        setError(err.message);
      },
    });
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function regenerate(index) {
    if (streaming) return;
    const history = messages.slice(0, index);
    setMessages([...history, { role: 'assistant', text: '', time: nowLabel() }]);
    setStreaming(true);
    stopRef.current = api.streamChat({
      messages: history.map((m) => ({ role: m.role, content: m.text })),
      onToken: (token) => {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { ...copy[copy.length - 1], text: copy[copy.length - 1].text + token };
          return copy;
        });
      },
      onDone: () => setStreaming(false),
      onError: (err) => {
        setStreaming(false);
        setError(err.message);
      },
    });
  }

  function newConversation() {
    stopRef.current?.();
    setMessages([]);
    setError(null);
    setStreaming(false);
  }

  function cancelGeneration() {
    stopRef.current?.();
    setStreaming(false);
  }

  const approxTokens = messages.reduce((sum, m) => sum + (m.text ? m.text.trim().split(/\s+/).filter(Boolean).length : 0), 0);

  return (
    <div className="main-area">
      <div className="chat-body">
        <div className="chat-column">
          <div className="chat-header">
            <div>
              <h1>Chat</h1>
              <p className="subtitle" style={{ marginBottom: 0 }}>Converse com o Atlas</p>
            </div>
            <div className="chat-header-actions">
              <button className="primary" onClick={newConversation}>+ Nova conversa</button>
              <button className="icon-only" title="Pesquisar">🔍</button>
              <button className="icon-only" title="Histórico">🕐</button>
              <button className="icon-only" title="Status do sistema" onClick={() => setPanelOpen(true)}>⋮</button>
            </div>
          </div>

          <div className="chat-messages">
            {messages.length === 0 && (
              <div className="empty-state">Diga oi para o Atlas. 🎤 Falar com Atlas em breve.</div>
            )}
            {messages.map((m, i) => (
              <MessageBubble
                key={i}
                role={m.role}
                text={m.text}
                time={m.time}
                onRegenerate={m.role === 'assistant' ? () => regenerate(i) : undefined}
                onFeedback={m.role === 'assistant' ? () => {} : undefined}
              />
            ))}
            {error && (
              <div className="empty-state" style={{ color: 'var(--danger)' }}>
                {error}
              </div>
            )}
          </div>

          <div className="chat-input-bar">
            <div className="chat-input-pills">
              <button onClick={() => setPage('tools')}>✨ Ferramentas</button>
              <button onClick={() => setPage('memory')}>🧠 Memória</button>
              <button title="Anexar (em desenvolvimento)">📎 Anexos</button>
            </div>
            <div className="chat-input-row">
              <button className="icon-btn ghost" title="Adicionar">+</button>
              <textarea
                rows={1}
                placeholder="Digite sua mensagem para o Atlas..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <button className="icon-btn ghost" title="Falar com Atlas (em desenvolvimento)">🎤</button>
              {streaming ? (
                <button className="icon-btn send stop" onClick={cancelGeneration} title="Parar geração">■</button>
              ) : (
                <button className="icon-btn send" onClick={send} disabled={!input.trim()} title="Enviar">➤</button>
              )}
            </div>
          </div>
          <div className="chat-disclaimer">O Atlas pode cometer erros. Verifique informações importantes.</div>
        </div>

        <RightPanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          health={{ ...health, modelSelected: !!currentModel }}
          memoryEntries={memoryEntries}
          onGoMemory={() => setPage('memory')}
          onGoTools={() => setPage('tools')}
          conversationStats={{
            messages: messages.length,
            approxTokens,
            elapsed: elapsedLabel,
          }}
          onClearConversation={newConversation}
        />
      </div>
    </div>
  );
}

function nowLabel() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}
