import { useEffect, useRef, useState } from 'react';

const SUGGESTIONS = ['현재 현금 잔액은?', '미결제 송장 현황 알려줘', '2026년 예산 사용률은?'];

export default function AiAssistant() {
  const [status, setStatus] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  useEffect(() => {
    fetch('/api/ai/status')
      .then((response) => (response.ok ? response.json() : { enabled: false }))
      .then(setStatus)
      .catch(() => setStatus({ enabled: false }));
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages]);

  const send = async (text) => {
    const message = text.trim();
    if (!message || sending) return;

    const history = messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content }));
    setMessages((current) => [...current, { role: 'user', content: message }]);
    setInput('');
    setSending(true);

    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, history })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || 'AI 요청이 실패했습니다.');
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: data.answer, sources: data.toolCalls?.filter((call) => call.ok).map((call) => call.name) }
      ]);
    } catch (error) {
      setMessages((current) => [...current, { role: 'assistant', content: error.message, error: true }]);
    } finally {
      setSending(false);
    }
  };

  const enabled = status?.enabled;

  return (
    <div className="panel wide ai-panel">
      <div className="ai-header">
        <h2>AI Assistant</h2>
        <span className={`ai-badge ${enabled ? 'on' : 'off'}`}>
          {status === null ? '확인 중' : enabled ? status.model : '비활성'}
        </span>
      </div>

      {status && !enabled && (
        <p className="ai-note">백엔드에 ANTHROPIC_API_KEY를 설정하면 AI 어시스턴트가 활성화됩니다.</p>
      )}

      <ul className="ai-messages" ref={listRef}>
        {messages.map((m, index) => (
          <li key={index} className={`ai-msg ${m.role}${m.error ? ' error' : ''}`}>
            <p>{m.content}</p>
            {m.sources?.length > 0 && <small>근거: {[...new Set(m.sources)].join(', ')}</small>}
          </li>
        ))}
        {sending && <li className="ai-msg assistant pending"><p>ERP 데이터를 조회하는 중…</p></li>}
      </ul>

      {enabled && messages.length === 0 && (
        <div className="ai-suggestions">
          {SUGGESTIONS.map((s) => (
            <button key={s} type="button" onClick={() => send(s)}>{s}</button>
          ))}
        </div>
      )}

      <form
        className="ai-form"
        onSubmit={(event) => {
          event.preventDefault();
          send(input);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="재무 데이터에 대해 질문하세요"
          maxLength={4000}
          disabled={!enabled || sending}
        />
        <button type="submit" disabled={!enabled || sending || !input.trim()}>보내기</button>
      </form>
    </div>
  );
}
