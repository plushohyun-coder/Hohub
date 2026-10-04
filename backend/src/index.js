const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { pool } = require('./config/db');
const {
  accounts,
  invoices,
  budgets,
  summaryReport,
  trialBalance,
  createAccount,
  createInvoice,
  createBudget,
  getAccountSummary
} = require('./data/store');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Hohub ERP Finance API',
    database: pool ? 'connected' : 'memory-mode'
  });
});

app.get('/api/accounts', async (req, res) => {
  try {
    if (pool) {
      const result = await pool.query('SELECT * FROM chart_of_accounts ORDER BY account_code');
      return res.json(result.rows);
    }

    return res.json(accounts);
  } catch (error) {
    console.error('Error fetching accounts:', error.message);
    return res.status(500).json({ message: 'Failed to fetch accounts' });
  }
});

app.post('/api/accounts', async (req, res) => {
  try {
    const record = req.body;

    if (pool) {
      const result = await pool.query(
        `INSERT INTO chart_of_accounts (account_code, account_name, account_type, normal_balance, description, is_active)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
        [record.account_code, record.account_name, record.account_type, record.normal_balance || 'DEBIT', record.description || '', true]
      );
      return res.status(201).json(result.rows[0]);
    }

    const newAccount = createAccount(record);
    return res.status(201).json(newAccount);
  } catch (error) {
    console.error('Error creating account:', error.message);
    return res.status(500).json({ message: 'Failed to create account' });
  }
});

app.get('/api/invoices', async (req, res) => {
  try {
    if (pool) {
      const result = await pool.query(`
        SELECT i.*, c.customer_name, v.vendor_name
        FROM invoices i
        LEFT JOIN customers c ON c.id = i.customer_id
        LEFT JOIN vendors v ON v.id = i.vendor_id
        ORDER BY i.invoice_date DESC
      `);
      return res.json(result.rows);
    }

    return res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error.message);
    return res.status(500).json({ message: 'Failed to fetch invoices' });
  }
});

app.post('/api/invoices', async (req, res) => {
  try {
    const payload = req.body;

    if (pool) {
      const result = await pool.query(
        `INSERT INTO invoices (invoice_no, invoice_type, customer_id, vendor_id, invoice_date, due_date, subtotal, tax_amount, total_amount, balance_due, status, notes)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
        [payload.invoice_no, payload.invoice_type || 'CUSTOMER', payload.customer_id || null, payload.vendor_id || null, payload.invoice_date, payload.due_date, payload.subtotal || 0, payload.tax_amount || 0, payload.total_amount || 0, payload.balance_due || (payload.total_amount || 0), payload.status || 'POSTED', payload.notes || '']
      );
      return res.status(201).json(result.rows[0]);
    }

    const newInvoice = createInvoice(payload);
    return res.status(201).json(newInvoice);
  } catch (error) {
    console.error('Error creating invoice:', error.message);
    return res.status(500).json({ message: 'Failed to create invoice' });
  }
});

app.get('/api/budgets', async (req, res) => {
  try {
    if (pool) {
      const result = await pool.query('SELECT * FROM budgets ORDER BY fiscal_year DESC');
      return res.json(result.rows);
    }

    return res.json(budgets);
  } catch (error) {
    console.error('Error fetching budgets:', error.message);
    return res.status(500).json({ message: 'Failed to fetch budgets' });
  }
});

app.post('/api/budgets', async (req, res) => {
  try {
    const payload = req.body;

    if (pool) {
      const result = await pool.query(
        `INSERT INTO budgets (budget_name, budget_code, fiscal_year, start_date, end_date, total_budget, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [payload.budget_name, payload.budget_code, payload.fiscal_year, payload.start_date, payload.end_date, payload.total_budget || 0, payload.status || 'ACTIVE']
      );
      return res.status(201).json(result.rows[0]);
    }

    const newBudget = createBudget(payload);
    return res.status(201).json(newBudget);
  } catch (error) {
    console.error('Error creating budget:', error.message);
    return res.status(500).json({ message: 'Failed to create budget' });
  }
});

app.get('/api/reports/summary', async (req, res) => {
  const data = summaryReport();
  return res.json(data);
});

app.get('/api/reports/trial-balance', async (req, res) => {
  try {
    if (pool) {
      const result = await pool.query(`
        SELECT ca.account_code, ca.account_name, ca.account_type,
               COALESCE(SUM(CASE WHEN jel.debit_amount > 0 THEN jel.debit_amount ELSE 0 END),0) AS debit_balance,
               COALESCE(SUM(CASE WHEN jel.credit_amount > 0 THEN jel.credit_amount ELSE 0 END),0) AS credit_balance
        FROM chart_of_accounts ca
        LEFT JOIN journal_entry_lines jel ON jel.account_id = ca.id
        LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
        WHERE je.status = 'POSTED' OR je.status IS NULL
        GROUP BY ca.account_code, ca.account_name, ca.account_type
        ORDER BY ca.account_code
      `);
      return res.json(result.rows);
    }

    return res.json(trialBalance);
  } catch (error) {
    console.error('Error fetching trial balance:', error.message);
    return res.status(500).json({ message: 'Failed to fetch trial balance' });
  }
});

app.get('/api/reports/accounts', async (req, res) => {
  return res.json(getAccountSummary());
});

app.listen(PORT, () => {
  console.log(`Hohub ERP API listening on http://localhost:${PORT}`);
});
