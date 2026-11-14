const { z } = require('zod');
const { HttpStatus, ErrorCode } = require('../constants');

// Request bodies for creating accounts, invoices and budgets. Unknown fields are rejected,
// sizes and allowed values follow database/schema.sql, and amounts are bounded to DECIMAL(15,2).
const ACCOUNT_TYPES = Object.freeze(['Asset', 'Liability', 'Equity', 'Revenue', 'Expense']);
const NORMAL_BALANCES = Object.freeze(['DEBIT', 'CREDIT']);
const INVOICE_TYPES = Object.freeze(['CUSTOMER', 'VENDOR']);
const INVOICE_STATUSES = Object.freeze(['DRAFT', 'POSTED', 'PARTIALLY_PAID', 'PAID', 'CANCELLED']);
const BUDGET_STATUSES = Object.freeze(['DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED']);

const MAX_AMOUNT = 9999999999999.99; // DECIMAL(15, 2)
const MAX_NOTE_LENGTH = 2000;
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

const code = (max) => z.string().trim().min(1).max(max).regex(CODE_PATTERN);
const text = (max) => z.string().trim().min(1).max(max);
const note = z.string().max(MAX_NOTE_LENGTH);
const id = z.number().int().positive().max(2147483647);
const amount = z
  .number()
  .finite()
  .min(0)
  .max(MAX_AMOUNT)
  .refine((value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6, 'at most 2 decimals');
// A real calendar date written as YYYY-MM-DD.
const date = z.iso.date();

const accountSchema = z.strictObject({
  account_code: code(20),
  account_name: text(255),
  account_type: z.enum(ACCOUNT_TYPES),
  normal_balance: z.enum(NORMAL_BALANCES).optional(),
  description: note.optional()
});

const invoiceSchema = z
  .strictObject({
    invoice_no: code(50),
    invoice_type: z.enum(INVOICE_TYPES).default('CUSTOMER'),
    customer_id: id.nullable().optional(),
    vendor_id: id.nullable().optional(),
    invoice_date: date,
    due_date: date,
    subtotal: amount.optional(),
    tax_amount: amount.optional(),
    total_amount: amount.optional(),
    balance_due: amount.optional(),
    status: z.enum(INVOICE_STATUSES).optional(),
    notes: note.optional()
  })
  .refine((v) => v.due_date >= v.invoice_date, { message: 'due_date must not be before invoice_date', path: ['due_date'] })
  .refine((v) => (v.invoice_type === 'CUSTOMER' ? !v.vendor_id : !v.customer_id), {
    message: 'a customer invoice has no vendor_id, a vendor invoice no customer_id',
    path: ['invoice_type']
  })
  .refine((v) => v.balance_due === undefined || v.total_amount === undefined || v.balance_due <= v.total_amount, {
    message: 'balance_due must not exceed total_amount',
    path: ['balance_due']
  });

const budgetSchema = z
  .strictObject({
    budget_name: text(255),
    budget_code: code(50),
    fiscal_year: z.string().regex(/^\d{4}$/),
    start_date: date,
    end_date: date,
    total_budget: amount.optional(),
    status: z.enum(BUDGET_STATUSES).optional()
  })
  .refine((v) => v.end_date >= v.start_date, { message: 'end_date must not be before start_date', path: ['end_date'] })
  .refine((v) => v.start_date.startsWith(v.fiscal_year), { message: 'start_date must fall in fiscal_year', path: ['start_date'] });

// Replaces req.body with the parsed value, or answers 400 naming the fields at fault.
// The values the client sent are never echoed back.
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const fields = [...new Set(result.error.issues.map((issue) => issue.path.join('.') || '(body)'))];
    return res.status(HttpStatus.BAD_REQUEST).json({ code: ErrorCode.VALIDATION_FAILED, message: 'Invalid request body', fields });
  }
  req.body = result.data;
  return next();
};

module.exports = { accountSchema, invoiceSchema, budgetSchema, validateBody };
