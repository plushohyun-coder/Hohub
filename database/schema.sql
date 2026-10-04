-- Hohub ERP Finance & Accounting Schema
-- PostgreSQL Database Schema for Complete Accounting Management

-- ============================================================================
-- CHART OF ACCOUNTS
-- ============================================================================

CREATE TABLE chart_of_accounts (
    id SERIAL PRIMARY KEY,
    account_code VARCHAR(20) UNIQUE NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    account_type VARCHAR(50) NOT NULL, -- Asset, Liability, Equity, Revenue, Expense
    sub_type VARCHAR(100), -- Checking, Savings, Accounts Payable, etc.
    parent_account_id INTEGER REFERENCES chart_of_accounts(id),
    description TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    normal_balance VARCHAR(10), -- DEBIT or CREDIT
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_coa_code ON chart_of_accounts(account_code);
CREATE INDEX idx_coa_type ON chart_of_accounts(account_type);
CREATE INDEX idx_coa_parent ON chart_of_accounts(parent_account_id);

-- ============================================================================
-- CUSTOMERS & VENDORS
-- ============================================================================

CREATE TABLE customers (
    id SERIAL PRIMARY KEY,
    customer_code VARCHAR(20) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    tax_id VARCHAR(50),
    credit_limit DECIMAL(15, 2) DEFAULT 0,
    currency VARCHAR(3) DEFAULT 'USD',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customer_code ON customers(customer_code);
CREATE INDEX idx_customer_active ON customers(is_active);

CREATE TABLE vendors (
    id SERIAL PRIMARY KEY,
    vendor_code VARCHAR(20) UNIQUE NOT NULL,
    vendor_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(20),
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    country VARCHAR(100),
    tax_id VARCHAR(50),
    payment_terms VARCHAR(50),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vendor_code ON vendors(vendor_code);
CREATE INDEX idx_vendor_active ON vendors(is_active);

-- ============================================================================
-- INVOICING
-- ============================================================================

CREATE TABLE invoices (
    id SERIAL PRIMARY KEY,
    invoice_no VARCHAR(50) UNIQUE NOT NULL,
    invoice_type VARCHAR(20) NOT NULL, -- CUSTOMER or VENDOR
    customer_id INTEGER REFERENCES customers(id),
    vendor_id INTEGER REFERENCES vendors(id),
    invoice_date DATE NOT NULL,
    due_date DATE NOT NULL,
    reference_no VARCHAR(100),
    currency VARCHAR(3) DEFAULT 'USD',
    subtotal DECIMAL(15, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    discount_amount DECIMAL(15, 2) DEFAULT 0,
    total_amount DECIMAL(15, 2) DEFAULT 0,
    paid_amount DECIMAL(15, 2) DEFAULT 0,
    balance_due DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, POSTED, PARTIALLY_PAID, PAID, CANCELLED
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoice_no ON invoices(invoice_no);
CREATE INDEX idx_invoice_customer ON invoices(customer_id);
CREATE INDEX idx_invoice_vendor ON invoices(vendor_id);
CREATE INDEX idx_invoice_status ON invoices(status);
CREATE INDEX idx_invoice_date ON invoices(invoice_date);

CREATE TABLE invoice_line_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL,
    description VARCHAR(255) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(15, 2) NOT NULL,
    line_total DECIMAL(15, 2) NOT NULL,
    account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
    tax_rate DECIMAL(5, 2) DEFAULT 0,
    tax_amount DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_invoice_line_invoice ON invoice_line_items(invoice_id);
CREATE INDEX idx_invoice_line_account ON invoice_line_items(account_id);

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    payment_no VARCHAR(50) UNIQUE NOT NULL,
    invoice_id INTEGER NOT NULL REFERENCES invoices(id),
    payment_date DATE NOT NULL,
    payment_type VARCHAR(50) NOT NULL, -- CASH, CHECK, BANK_TRANSFER, CREDIT_CARD, etc.
    amount_paid DECIMAL(15, 2) NOT NULL,
    reference_no VARCHAR(100),
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, CLEARED, CANCELLED
    notes TEXT,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_payment_invoice ON payments(invoice_id);
CREATE INDEX idx_payment_date ON payments(payment_date);
CREATE INDEX idx_payment_status ON payments(status);

-- ============================================================================
-- GENERAL LEDGER & JOURNAL ENTRIES
-- ============================================================================

CREATE TABLE journal_entries (
    id SERIAL PRIMARY KEY,
    entry_no VARCHAR(50) UNIQUE NOT NULL,
    entry_date DATE NOT NULL,
    fiscal_period VARCHAR(10), -- Format: YYYY-MM
    description VARCHAR(255) NOT NULL,
    reference_type VARCHAR(50), -- INVOICE, PAYMENT, MANUAL, etc.
    reference_id INTEGER,
    status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, POSTED, REVERSED
    posted_by VARCHAR(100),
    posted_at TIMESTAMP,
    created_by VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_journal_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_period ON journal_entries(fiscal_period);
CREATE INDEX idx_journal_status ON journal_entries(status);

CREATE TABLE journal_entry_lines (
    id SERIAL PRIMARY KEY,
    journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_no INTEGER NOT NULL,
    account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
    debit_amount DECIMAL(15, 2) DEFAULT 0,
    credit_amount DECIMAL(15, 2) DEFAULT 0,
    description VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_journal_line_entry ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_line_account ON journal_entry_lines(account_id);

CREATE TABLE general_ledger (
    id SERIAL PRIMARY KEY,
    account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
    transaction_date DATE NOT NULL,
    journal_entry_line_id INTEGER NOT NULL REFERENCES journal_entry_lines(id),
    debit_amount DECIMAL(15, 2) DEFAULT 0,
    credit_amount DECIMAL(15, 2) DEFAULT 0,
    running_balance DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_gl_account ON general_ledger(account_id);
CREATE INDEX idx_gl_date ON general_ledger(transaction_date);
CREATE INDEX idx_gl_journal_line ON general_ledger(journal_entry_line_id);

-- ============================================================================
-- FINANCIAL REPORTS
-- ============================================================================

CREATE TABLE trial_balance (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL,
    account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
    debit_balance DECIMAL(15, 2) DEFAULT 0,
    credit_balance DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_trial_balance_date ON trial_balance(report_date);
CREATE INDEX idx_trial_balance_account ON trial_balance(account_id);
CREATE UNIQUE INDEX idx_trial_balance_unique ON trial_balance(report_date, account_id);

CREATE TABLE balance_sheet_snapshot (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL,
    account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
    balance DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_balance_sheet_date ON balance_sheet_snapshot(report_date);
CREATE INDEX idx_balance_sheet_account ON balance_sheet_snapshot(account_id);

CREATE TABLE income_statement_snapshot (
    id SERIAL PRIMARY KEY,
    report_date DATE NOT NULL,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
    total_amount DECIMAL(15, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_income_statement_date ON income_statement_snapshot(report_date);
CREATE INDEX idx_income_statement_account ON income_statement_snapshot(account_id);

-- ============================================================================
-- BUDGETS & CONTROLS
-- ============================================================================

CREATE TABLE budgets (
    id SERIAL PRIMARY KEY,
    budget_name VARCHAR(255) NOT NULL,
    budget_code VARCHAR(50) UNIQUE NOT NULL,
    fiscal_year VARCHAR(4) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    total_budget DECIMAL(15, 2) DEFAULT 0,
    status VARCHAR(50) DEFAULT 'DRAFT', -- DRAFT, APPROVED, ACTIVE, CLOSED
    created_by VARCHAR(100),
    approved_by VARCHAR(100),
    approved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_budget_fiscal_year ON budgets(fiscal_year);
CREATE INDEX idx_budget_status ON budgets(status);
CREATE INDEX idx_budget_code ON budgets(budget_code);

CREATE TABLE budget_lines (
    id SERIAL PRIMARY KEY,
    budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
    budgeted_amount DECIMAL(15, 2) NOT NULL,
    month_01 DECIMAL(15, 2) DEFAULT 0,
    month_02 DECIMAL(15, 2) DEFAULT 0,
    month_03 DECIMAL(15, 2) DEFAULT 0,
    month_04 DECIMAL(15, 2) DEFAULT 0,
    month_05 DECIMAL(15, 2) DEFAULT 0,
    month_06 DECIMAL(15, 2) DEFAULT 0,
    month_07 DECIMAL(15, 2) DEFAULT 0,
    month_08 DECIMAL(15, 2) DEFAULT 0,
    month_09 DECIMAL(15, 2) DEFAULT 0,
    month_10 DECIMAL(15, 2) DEFAULT 0,
    month_11 DECIMAL(15, 2) DEFAULT 0,
    month_12 DECIMAL(15, 2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_budget_line_budget ON budget_lines(budget_id);
CREATE INDEX idx_budget_line_account ON budget_lines(account_id);

CREATE TABLE budget_vs_actual (
    id SERIAL PRIMARY KEY,
    budget_id INTEGER NOT NULL REFERENCES budgets(id),
    account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
    month VARCHAR(10), -- Format: YYYY-MM
    budgeted_amount DECIMAL(15, 2) DEFAULT 0,
    actual_amount DECIMAL(15, 2) DEFAULT 0,
    variance DECIMAL(15, 2) DEFAULT 0,
    variance_percent DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_budget_actual_budget ON budget_vs_actual(budget_id);
CREATE INDEX idx_budget_actual_account ON budget_vs_actual(account_id);
CREATE INDEX idx_budget_actual_month ON budget_vs_actual(month);

CREATE TABLE spending_controls (
    id SERIAL PRIMARY KEY,
    control_name VARCHAR(255) NOT NULL,
    control_code VARCHAR(50) UNIQUE NOT NULL,
    account_id INTEGER NOT NULL REFERENCES chart_of_accounts(id),
    control_type VARCHAR(50) NOT NULL, -- MONTHLY_LIMIT, ANNUAL_LIMIT, PER_TRANSACTION_LIMIT
    limit_amount DECIMAL(15, 2) NOT NULL,
    alert_threshold DECIMAL(5, 2) DEFAULT 80, -- Trigger alert at 80% of limit
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_spending_control_account ON spending_controls(account_id);
CREATE INDEX idx_spending_control_active ON spending_controls(is_active);

CREATE TABLE spending_alerts (
    id SERIAL PRIMARY KEY,
    spending_control_id INTEGER NOT NULL REFERENCES spending_controls(id),
    alert_date DATE NOT NULL,
    alert_type VARCHAR(50), -- WARNING, EXCEEDED
    current_amount DECIMAL(15, 2) NOT NULL,
    limit_amount DECIMAL(15, 2) NOT NULL,
    alert_message TEXT,
    status VARCHAR(50) DEFAULT 'ACTIVE', -- ACTIVE, ACKNOWLEDGED, RESOLVED
    acknowledged_by VARCHAR(100),
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_spending_alert_control ON spending_alerts(spending_control_id);
CREATE INDEX idx_spending_alert_date ON spending_alerts(alert_date);
CREATE INDEX idx_spending_alert_status ON spending_alerts(status);

-- ============================================================================
-- AUDIT & USERS
-- ============================================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL, -- ADMIN, ACCOUNTANT, APPROVER, VIEWER
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_username ON users(username);
CREATE INDEX idx_user_active ON users(is_active);

CREATE TABLE audit_log (
    id SERIAL PRIMARY KEY,
    entity_type VARCHAR(100) NOT NULL,
    entity_id INTEGER NOT NULL,
    action VARCHAR(50) NOT NULL, -- CREATE, UPDATE, DELETE, POST
    user_id INTEGER REFERENCES users(id),
    old_values JSONB,
    new_values JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_date ON audit_log(created_at);

-- ============================================================================
-- VIEWS FOR REPORTING
-- ============================================================================

-- Account Balances - Summary of all account balances
CREATE VIEW account_balances AS
SELECT 
    coa.id,
    coa.account_code,
    coa.account_name,
    coa.account_type,
    coa.normal_balance,
    COALESCE(SUM(CASE WHEN jel.debit_amount > 0 THEN jel.debit_amount ELSE 0 END), 0) as total_debits,
    COALESCE(SUM(CASE WHEN jel.credit_amount > 0 THEN jel.credit_amount ELSE 0 END), 0) as total_credits,
    COALESCE(SUM(jel.debit_amount - jel.credit_amount), 0) as balance
FROM chart_of_accounts coa
LEFT JOIN journal_entry_lines jel ON coa.id = jel.account_id
LEFT JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE je.status = 'POSTED' OR je.status IS NULL
GROUP BY coa.id, coa.account_code, coa.account_name, coa.account_type, coa.normal_balance;

-- Accounts Receivable Aging - Customer invoice aging analysis
CREATE VIEW accounts_receivable_aging AS
SELECT 
    c.customer_code,
    c.customer_name,
    i.invoice_no,
    i.invoice_date,
    i.due_date,
    i.total_amount,
    i.paid_amount,
    i.balance_due,
    CAST((CURRENT_DATE - i.due_date) AS INTEGER) as days_overdue,
    CASE 
        WHEN CAST((CURRENT_DATE - i.due_date) AS INTEGER) <= 0 THEN 'Not Due'
        WHEN CAST((CURRENT_DATE - i.due_date) AS INTEGER) <= 30 THEN '1-30 Days'
        WHEN CAST((CURRENT_DATE - i.due_date) AS INTEGER) <= 60 THEN '31-60 Days'
        WHEN CAST((CURRENT_DATE - i.due_date) AS INTEGER) <= 90 THEN '61-90 Days'
        ELSE 'Over 90 Days'
    END as aging_bucket
FROM invoices i
JOIN customers c ON i.customer_id = c.id
WHERE i.invoice_type = 'CUSTOMER' 
  AND i.status IN ('POSTED', 'PARTIALLY_PAID')
  AND i.balance_due > 0
ORDER BY c.customer_code, i.due_date;

-- Accounts Payable Aging - Vendor invoice aging analysis
CREATE VIEW accounts_payable_aging AS
SELECT 
    v.vendor_code,
    v.vendor_name,
    i.invoice_no,
    i.invoice_date,
    i.due_date,
    i.total_amount,
    i.paid_amount,
    i.balance_due,
    CAST((CURRENT_DATE - i.due_date) AS INTEGER) as days_overdue,
    CASE 
        WHEN CAST((CURRENT_DATE - i.due_date) AS INTEGER) <= 0 THEN 'Not Due'
        WHEN CAST((CURRENT_DATE - i.due_date) AS INTEGER) <= 30 THEN '1-30 Days'
        WHEN CAST((CURRENT_DATE - i.due_date) AS INTEGER) <= 60 THEN '31-60 Days'
        WHEN CAST((CURRENT_DATE - i.due_date) AS INTEGER) <= 90 THEN '61-90 Days'
        ELSE 'Over 90 Days'
    END as aging_bucket
FROM invoices i
JOIN vendors v ON i.vendor_id = v.id
WHERE i.invoice_type = 'VENDOR' 
  AND i.status IN ('POSTED', 'PARTIALLY_PAID')
  AND i.balance_due > 0
ORDER BY v.vendor_code, i.due_date;

-- Budget vs Actual Summary - Monthly budget performance
CREATE VIEW budget_performance AS
SELECT 
    b.budget_code,
    b.budget_name,
    b.fiscal_year,
    coa.account_code,
    coa.account_name,
    bva.month,
    bva.budgeted_amount,
    bva.actual_amount,
    bva.variance,
    bva.variance_percent,
    CASE 
        WHEN bva.variance_percent <= -10 THEN 'Over Budget'
        WHEN bva.variance_percent >= 10 THEN 'Under Budget'
        ELSE 'On Track'
    END as status
FROM budget_vs_actual bva
JOIN budgets b ON bva.budget_id = b.id
JOIN chart_of_accounts coa ON bva.account_id = coa.id
ORDER BY b.fiscal_year, b.budget_code, bva.month, coa.account_code;

-- ============================================================================
-- SAMPLE DATA
-- ============================================================================

-- Chart of Accounts - Standard Structure
INSERT INTO chart_of_accounts (account_code, account_name, account_type, description, normal_balance, is_active) VALUES
('1000', 'Cash and Cash Equivalents', 'Asset', 'All cash accounts', 'DEBIT', TRUE),
('1010', 'Petty Cash', 'Asset', 'Small cash on hand', 'DEBIT', TRUE),
('1020', 'Cash - Operating Account', 'Asset', 'Main operating bank account', 'DEBIT', TRUE),
('1100', 'Accounts Receivable', 'Asset', 'Customer receivables', 'DEBIT', TRUE),
('1200', 'Inventory', 'Asset', 'Finished goods and materials', 'DEBIT', TRUE),
('1500', 'Fixed Assets', 'Asset', 'Property and equipment', 'DEBIT', TRUE),
('1510', 'Equipment', 'Asset', 'Office equipment', 'DEBIT', TRUE),
('1520', 'Accumulated Depreciation', 'Asset', 'Depreciation reserve', 'CREDIT', TRUE),
('2000', 'Accounts Payable', 'Liability', 'Vendor payables', 'CREDIT', TRUE),
('2100', 'Accrued Expenses', 'Liability', 'Accrued liabilities', 'CREDIT', TRUE),
('2200', 'Short-term Loans', 'Liability', 'Current portion of debt', 'CREDIT', TRUE),
('3000', 'Owner Equity', 'Equity', 'Owner contributions', 'CREDIT', TRUE),
('3100', 'Retained Earnings', 'Equity', 'Accumulated profits', 'CREDIT', TRUE),
('4000', 'Sales Revenue', 'Revenue', 'Revenue from product sales', 'CREDIT', TRUE),
('4100', 'Service Revenue', 'Revenue', 'Revenue from services', 'CREDIT', TRUE),
('4200', 'Interest Income', 'Revenue', 'Interest earned', 'CREDIT', TRUE),
('5000', 'Cost of Goods Sold', 'Expense', 'Direct cost of goods sold', 'DEBIT', TRUE),
('5100', 'Salaries and Wages', 'Expense', 'Employee compensation', 'DEBIT', TRUE),
('5200', 'Rent Expense', 'Expense', 'Office rent', 'DEBIT', TRUE),
('5300', 'Utilities Expense', 'Expense', 'Electricity, water, gas', 'DEBIT', TRUE),
('5400', 'Depreciation Expense', 'Expense', 'Asset depreciation', 'DEBIT', TRUE),
('5500', 'Office Supplies Expense', 'Expense', 'Office supplies and materials', 'DEBIT', TRUE),
('5600', 'Marketing Expense', 'Expense', 'Advertising and promotion', 'DEBIT', TRUE),
('5700', 'Professional Services', 'Expense', 'Consulting and professional fees', 'DEBIT', TRUE);

-- Sample User
INSERT INTO users (username, email, full_name, role, is_active) VALUES
('admin', 'admin@hohub.local', 'System Administrator', 'ADMIN', TRUE),
('accountant', 'accountant@hohub.local', 'Chief Accountant', 'ACCOUNTANT', TRUE),
('approver', 'approver@hohub.local', 'Financial Approver', 'APPROVER', TRUE);
