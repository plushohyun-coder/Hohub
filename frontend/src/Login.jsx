import { useState } from 'react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setSending(true);
    setError('');
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setPassword('');
        onLogin(data.user);
        return;
      }
      if (response.status === 429) setError('시도가 너무 많습니다. 잠시 후 다시 시도하세요.');
      else if (response.status === 503) setError('로그인을 사용할 수 없습니다. 서버의 DATABASE_URL 설정을 확인하세요.');
      else setError('아이디 또는 비밀번호가 올바르지 않습니다. 여러 번 틀리면 계정이 잠시 잠깁니다.');
    } catch {
      setError('서버에 연결할 수 없습니다.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="login-shell">
      <form className="panel login-panel" onSubmit={submit}>
        <p className="eyebrow">ERP / Finance & Accounting</p>
        <h1>Hohub</h1>
        <label>
          아이디
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" maxLength={100} required autoFocus />
        </label>
        <label>
          비밀번호
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" maxLength={256} required />
        </label>
        {error && <p className="login-error" role="alert">{error}</p>}
        <button type="submit" disabled={sending || !username || !password}>{sending ? '확인 중…' : '로그인'}</button>
      </form>
    </div>
  );
}
