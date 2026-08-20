import React from 'react';
import ReactMarkdown from 'react-markdown';

function CodeBlock({ children, className }) {
  const text = String(children).replace(/\n$/, '');
  const copy = () => navigator.clipboard.writeText(text);
  return (
    <pre>
      <button
        className="icon-btn"
        style={{ position: 'absolute', top: 6, right: 6, width: 'auto', height: 'auto', padding: '4px 8px', fontSize: 11 }}
        onClick={copy}
      >
        Copiar código
      </button>
      <code className={className}>{text}</code>
    </pre>
  );
}

export default function MessageBubble({ role, text, time, onRegenerate, onFeedback }) {
  const isUser = role === 'user';
  const copyMessage = () => navigator.clipboard.writeText(text);

  return (
    <div className={`msg-row ${isUser ? 'user' : ''}`}>
      {!isUser && <div className="msg-avatar">A</div>}
      <div className="msg-bubble-wrap">
        <div className="msg-bubble">
          <ReactMarkdown
            components={{
              code({ inline, className, children }) {
                if (inline) return <code>{children}</code>;
                return <CodeBlock className={className}>{children}</CodeBlock>;
              },
            }}
          >
            {text || '…'}
          </ReactMarkdown>
        </div>
        <div className="msg-meta">
          <span>{time}</span>
          <button onClick={copyMessage} title="Copiar">📋</button>
          {!isUser && onRegenerate && <button onClick={onRegenerate} title="Regenerar">🔁</button>}
          {!isUser && onFeedback && (
            <>
              <button onClick={() => onFeedback('up')}>👍</button>
              <button onClick={() => onFeedback('down')}>👎</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
