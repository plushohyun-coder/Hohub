import { useCallback, useEffect, useState } from 'react';
import AiAssistant from './AiAssistant.jsx';
import Login from './Login.jsx';

class SessionEnded extends Error {}

const api = async (endpoint) => {
  const response = await fetch(`/api${endpoint}`);
  if (response.status === 401) throw new SessionEnded();
  if (!response.ok) throw new Error('Request failed');
  return response.json();
};

export default function App() {
  // undefined: still checking the session, null: signed out.
  const [user, setUser] = useState(undefined);
  const [summary, setSummary] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);

  const sessionEnded = useCallback(() => setUser(null), []);

  useEffect(() => {
    api('/auth/me')
      .then((data) => setUser(data.user))
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      try {
        const [summaryData, accountsData, invoiceData, budgetData] = await Promise.all([
          api('/reports/summary'),
          api('/accounts'),
          api('/invoices'),
          api('/budgets')
        ]);

        setSummary(summaryData);
        setAccounts(accountsData);
        setInvoices(invoiceData);
        setBudgets(budgetData);
      } catch (error) {
        if (error instanceof SessionEnded) sessionEnded();
        else console.error('Failed to load ERP data', error);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [user, sessionEnded]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
    setUser(null);
  };

  if (user === undefined) {
    return <div className="app">Loading Hohub ERP...</div>;
  }

  if (user === null) {
    return <Login onLogin={setUser} />;
  }

  if (loading) {
    return <div className="app">Loading Hohub ERP data...</div>;
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">ERP / Finance & Accounting</p>
          <h1>Hohub</h1>
        </div>
        <div className="user-box">
          <span>{user.fullName} ({user.role})</span>
          <button type="button" onClick={logout}>로그아웃</button>
        </div>
      </header>

      <section className="stats-grid">
        <StatCard label="Total Assets" value={`$${(summary?.total_assets || 0).toLocaleString()}`} />
        <StatCard label="Total Liabilities" value={`$${(summary?.total_liabilities || 0).toLocaleString()}`} />
        <StatCard label="Net Income" value={`$${(summary?.net_income || 0).toLocaleString()}`} />
        <StatCard label="Cash Balance" value={`$${(summary?.cash_balance || 0).toLocaleString()}`} />
      </section>

      <section className="panel-grid">
        <div className="panel">
          <h2>Chart of Accounts</h2>
          <ul className="line-list">
            {accounts.slice(0, 6).map((account) => (
              <li key={account.id}>
                <span>{account.account_code}</span>
                <strong>{account.account_name}</strong>
                <em>{account.account_type}</em>
              </li>
            ))}
          </ul>
        </div>

        <div className="panel">
          <h2>Recent Invoices</h2>
          <ul className="line-list">
            {invoices.slice(0, 5).map((invoice) => (
              <li key={invoice.id}>
                <span>{invoice.invoice_no}</span>
                <strong>{invoice.status}</strong>
                <em>${Number(invoice.total_amount || 0).toLocaleString()}</em>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel-grid">
        <div className="panel wide">
          <h2>Budgets</h2>
          <ul className="budget-list">
            {budgets.map((budget) => (
              <li key={budget.id}>
                <div>
                  <strong>{budget.budget_name}</strong>
                  <small>{budget.budget_code}</small>
                </div>
                <span>{budget.status}</span>
                <em>${Number(budget.total_budget || 0).toLocaleString()}</em>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="panel-grid">
        <AiAssistant onSessionEnded={sessionEnded} />
      </section>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="stat-card">
      <p>{label}</p>
      <h3>{value}</h3>
    </div>
  );
}
