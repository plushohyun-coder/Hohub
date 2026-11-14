const test = require('node:test');
const assert = require('node:assert');
const { accountSchema, invoiceSchema, budgetSchema, validateBody } = require('../src/validation/dataRequests');

const ok = (schema, value) => assert.ok(schema.safeParse(value).success, JSON.stringify(value));
const bad = (schema, value) => assert.ok(!schema.safeParse(value).success, JSON.stringify(value));

test('accounts: known fields, sizes and account types only', () => {
  const base = { account_code: '6100', account_name: 'Office supplies', account_type: 'Expense' };
  ok(accountSchema, base);
  ok(accountSchema, { ...base, normal_balance: 'DEBIT', description: 'Pens' });
  bad(accountSchema, { ...base, is_active: false }); // unknown field
  bad(accountSchema, { ...base, account_type: 'Cash' });
  bad(accountSchema, { ...base, account_code: 'x'.repeat(21) });
  bad(accountSchema, { ...base, account_code: "1'; DROP TABLE x;--" });
  bad(accountSchema, { ...base, account_name: '   ' });
  bad(accountSchema, { ...base, description: 'x'.repeat(2001) });
  bad(accountSchema, { ...base, account_code: 6100 }); // must be a string
  bad(accountSchema, ['6100']);
});

test('invoices: dates, amounts and customer/vendor consistency', () => {
  const base = { invoice_no: 'INV-2001', invoice_date: '2026-11-01', due_date: '2026-11-30', customer_id: 1, total_amount: 1200.5 };
  ok(invoiceSchema, base);
  assert.strictEqual(invoiceSchema.parse(base).invoice_type, 'CUSTOMER', 'defaults to a customer invoice');
  ok(invoiceSchema, { ...base, customer_id: undefined, vendor_id: 2, invoice_type: 'VENDOR' });
  bad(invoiceSchema, { ...base, due_date: '2026-10-31' }); // before the invoice date
  bad(invoiceSchema, { ...base, invoice_date: '2026-02-30' }); // not a real date
  bad(invoiceSchema, { ...base, invoice_date: '01/11/2026' });
  bad(invoiceSchema, { ...base, total_amount: -1 });
  bad(invoiceSchema, { ...base, total_amount: 1.234 }); // more than 2 decimals
  bad(invoiceSchema, { ...base, total_amount: 1e14 }); // beyond DECIMAL(15,2)
  bad(invoiceSchema, { ...base, total_amount: '1200' }); // must be a number
  bad(invoiceSchema, { ...base, vendor_id: 2 }); // customer invoice with a vendor
  bad(invoiceSchema, { ...base, balance_due: 2000 }); // more than the total
  bad(invoiceSchema, { ...base, status: 'VOID' });
  bad(invoiceSchema, { ...base, paid_amount: 0 }); // unknown field
  bad(invoiceSchema, { ...base, customer_id: 1.5 });
});

test('budgets: fiscal year, period and status', () => {
  const base = { budget_name: '2027 Marketing', budget_code: 'MKT-2027', fiscal_year: '2027', start_date: '2027-01-01', end_date: '2027-12-31', total_budget: 50000 };
  ok(budgetSchema, base);
  bad(budgetSchema, { ...base, end_date: '2026-12-31' });
  bad(budgetSchema, { ...base, fiscal_year: '27' });
  bad(budgetSchema, { ...base, start_date: '2026-06-01' }); // outside the fiscal year
  bad(budgetSchema, { ...base, status: 'SPENT' });
  bad(budgetSchema, { ...base, approved_by: 'me' });
});

test('a rejected body names the fields at fault but never echoes the values', () => {
  let status;
  let body;
  const res = { status(code) { status = code; return this; }, json(value) { body = value; return this; } };
  const secret = 'SECRET-VALUE-<script>';
  validateBody(accountSchema)({ body: { account_code: secret, account_name: 'x', account_type: 'Nope' } }, res, () => assert.fail('should not pass'));
  assert.strictEqual(status, 400);
  assert.strictEqual(body.code, 'VALIDATION_FAILED');
  assert.deepStrictEqual(body.fields.sort(), ['account_code', 'account_type']);
  assert.ok(!JSON.stringify(body).includes('SECRET-VALUE'));
});
