# Hohub

ERP Finance & Accounting (Express + PostgreSQL backend, React frontend).

## AI Assistant (plus-erp-ai-client)

The backend mounts [plus-erp-ai-client](https://github.com/plushohyun-coder/plus-erp-ai-client) at `/api/ai`, and the dashboard shows an **AI Assistant** panel that answers questions about accounts, invoices, budgets and the trial balance using Claude. The assistant is read-only and gets every figure from this server's own `/api` endpoints.

```bash
cd backend
npm install                 # installs plus-erp-ai-client (optional dependency, private repo: needs GitHub access)
cp .env.example .env        # set ANTHROPIC_API_KEY
npm start
```

- `GET /api/ai/status` - whether the assistant is enabled
- `POST /api/ai/chat` - `{ "message": "...", "history": [...] }`

Without `ANTHROPIC_API_KEY`, or if the package can't be installed, the ERP runs normally and the panel shows as disabled.
