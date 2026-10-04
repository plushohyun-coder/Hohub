const accounts = [
  { id: 1, account_code: '1000', account_name: 'Cash and Cash Equivalents', account_type: 'Asset', normal_balance: 'DEBIT', description: 'Operating cash', is_active: true },
  { id: 2, account_code: '1100', account_name: 'Accounts Receivable', account_type: 'Asset', normal_balance: 'DEBIT', description: 'Customer receivables', is_active: true },
  { id: 3, account_code: '1200', account_name: 'Inventory', account_type: 'Asset', normal_balance: 'DEBIT', description: 'Stock inventory', is_active: true },
  { id: 4, account_code: '2000', account_name: 'Accounts Payable', account_type: 'Liability', normal_balance: 'CREDIT', description: 'Vendor payables', is_active: true },
  { id: 5, account_code: '3000', account_name: 'Owner Equity', account_type: 'Equity', normal_balance: 'CREDIT', description: 'Owner capital', is_active: true },
  { id: 6, account_code: '4000', account_name: 'Sales Revenue', account_type: 'Revenue', normal_balance: 'CREDIT', description: 'Revenue from sales', is_active: true },
  { id: 7, account_code: '5000', account_name: 'Cost of Goods Sold', account_type: 'Expense', normal_balance: 'DEBIT', description: 'Production and inventory costs', is_active: true }
];

let accountSequence = accounts.length + 1;

const invoices = [
  {
    id: 1,
    invoice_no: 'INV-1001',
    invoice_type: 'CUSTOMER',
    customer_id: 1,
    vendor_id: null,
    invoice_date: '2026-10-01',
    due_date: '2026-10-15',
    subtotal: 2400,
    tax_amount: 192,
    total_amount: 2592,
    paid_amount: 1500,
    balance_due: 1092,
    status: 'PARTIALLY_PAID',
    notes: 'Monthly service invoice'
  },
  {
    id: 2,
    invoice_no: 'INV-1002',
    invoice_type: 'VENDOR',
    customer_id: null,
    vendor_id: 1,
    invoice_date: '2026-10-03',
    due_date: '2026-10-20',
    subtotal: 1800,
    tax_amount: 144,
    total_amount: 1944,
    paid_amount: 0,
    balance_due: 1944,
    status: 'POSTED',
    notes: 'Software subscription'
  }
];

const budgets = [
  {
    id: 1,
    budget_name: 'Operating Budget 2026',
    budget_code: 'BUD-2026',
    fiscal_year: '2026',
    start_date: '2026-01-01',
    end_date: '2026-12-31',
    total_budget: 150000,
    status: 'ACTIVE'
  }
];

const trialBalance = [
  { account_code: '1000', account_name: 'Cash and Cash Equivalents', account_type: 'Asset', debit_balance: 250000, credit_balance: 0 },
  { account_code: '1100', account_name: 'Accounts Receivable', account_type: 'Asset', debit_balance: 120000, credit_balance: 0 },
  { account_code: '1200', account_name: 'Inventory', account_type: 'Asset', debit_balance: 202000, credit_balance: 0 },
  { account_code: '2000', account_name: 'Accounts Payable', account_type: 'Liability', debit_balance: 0, credit_balance: 87000 },
  { account_code: '3000', account_name: 'Owner Equity', account_type: 'Equity', debit_balance: 0, credit_balance: 250000 },
  { account_code: '4000', account_name: 'Sales Revenue', account_type: 'Revenue', debit_balance: 0, credit_balance: 385000 },
  { account_code: '5000', account_name: 'Cost of Goods Sold', account_type: 'Expense', debit_balance: 150000, credit_balance: 0 }
];

const summaryReport = () => ({
  total_assets: 572000,
  total_liabilities: 87000,
  total_equity: 250000,
  net_income: 235000,
  cash_balance: 250000,
  outstanding_ar: 120000,
  outstanding_ap: 87000,
  monthly_budget_used: 62.5
});

const createAccount = (payload = {}) => {
  const newAccount = {
    id: accountSequence++,
    account_code: payload.account_code || `ACC-${accountSequence}`,
    account_name: payload.account_name || 'New Account',
    account_type: payload.account_type || 'Asset',
    normal_balance: payload.normal_balance || 'DEBIT',
    description: payload.description || '',
    is_active: payload.is_active !== false
  };

  accounts.push(newAccount);
  return newAccount;
};

const createInvoice = (payload = {}) => {
  const subtotal = Number(payload.subtotal || 0);
  const taxAmount = Number(payload.tax_amount || 0);
  const total = Number(payload.total_amount || subtotal + taxAmount);
  const balance = Number(payload.balance_due || total);

  const newInvoice = {
    id: invoices.length + 1,
    invoice_no: payload.invoice_no || `INV-${Date.now()}`,
    invoice_type: payload.invoice_type || 'CUSTOMER',
    customer_id: payload.customer_id || null,
    vendor_id: payload.vendor_id || null,
    invoice_date: payload.invoice_date || new Date().toISOString().slice(0, 10),
    due_date: payload.due_date || new Date().toISOString().slice(0, 10),
    subtotal,
    tax_amount: taxAmount,
    total_amount: total,
    paid_amount: payload.paid_amount || 0,
    balance_due: balance,
    status: payload.status || 'POSTED',
    notes: payload.notes || ''
  };

  invoices.push(newInvoice);
  return newInvoice;
};

const createBudget = (payload = {}) => {
  const newBudget = {
    id: budgets.length + 1,
    budget_name: payload.budget_name || 'New Budget',
    budget_code: payload.budget_code || `BUD-${Date.now()}`,
    fiscal_year: payload.fiscal_year || '2026',
    start_date: payload.start_date || '2026-01-01',
    end_date: payload.end_date || '2026-12-31',
    total_budget: Number(payload.total_budget || 0),
    status: payload.status || 'ACTIVE'
  };

  budgets.push(newBudget);
  return newBudget;
};

const getAccountSummary = () => accounts.map((account) => ({
  ...account,
  current_balance: account.account_type === 'Asset' ? 50000 + account.id * 7000 : 25000 + account.id * 5000
}));

module.exports = {
  accounts,
  invoices,
  budgets,
  trialBalance,
  summaryReport,
  createAccount,
  createInvoice,
  createBudget,
  getAccountSummary
};
