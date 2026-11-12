# Hohub

ERP Finance & Accounting (Express + PostgreSQL backend, React frontend).

## Login

Every `/api` route except `/api/health` and the login itself needs a signed-in user. Accounts live in
PostgreSQL, so `DATABASE_URL` is required (without it the API stays locked).

```bash
psql "$DATABASE_URL" -f database/schema.sql                 # new database only
psql "$DATABASE_URL" -f database/migrations/001_login.sql   # adds login (safe to re-run)
cd backend
npm run user -- add kim --name "Kim Minjun" --email kim@example.com --role ACCOUNTANT   # asks for the password
npm run user -- disable kim                                  # or enable
```

- Roles: `ADMIN` and `ACCOUNTANT` may create accounts, invoices and budgets; `APPROVER` and `VIEWER` read only.
- Passwords: 12+ characters, stored as Argon2id. Running `add` for an existing user resets their password and ends their sessions.
  The sample users in `schema.sql` have no password until you run `add` for them.
- Sessions: HttpOnly, SameSite=Strict cookie; 30 minutes idle, 12 hours at most; only a SHA-256 of the token is stored.
- 5 wrong passwords lock an account for 15 minutes; logins are rate-limited per IP; state-changing requests must come from this site.
- `npm test` runs the tests; set `TEST_DATABASE_URL` to also run the login tests against PostgreSQL (they use their own schema).

## AI Assistant (plus-erp-ai-client)

The backend mounts [plus-erp-ai-client](https://github.com/plushohyun-coder/plus-erp-ai-client) at `/api/ai`, and the dashboard shows an **AI Assistant** panel that answers questions about accounts, invoices, budgets and the trial balance using Claude. The assistant is available to signed-in users only. It reads every figure from a read-only copy of the data API that listens on `127.0.0.1:INTERNAL_API_PORT` (default `PORT + 1`) and has no write routes.

```bash
cd backend
npm install                 # installs plus-erp-ai-client (optional dependency, private repo: needs GitHub access)
cp .env.example .env        # set DATABASE_URL and ANTHROPIC_API_KEY
npm start
```

- `GET /api/ai/status` - whether the assistant is enabled
- `POST /api/ai/chat` - `{ "message": "...", "history": [...] }`

Without `ANTHROPIC_API_KEY`, or if the package can't be installed, the ERP runs normally and the panel shows as disabled.

## NAS deployment (Docker)

To run Hohub with the AI assistant on a NAS against its PostgreSQL database, see [docs/NAS-DEPLOY.md](docs/NAS-DEPLOY.md) (Korean). In short: `cp .env.docker.example .env`, fill it in, then `docker compose up -d --build`; the app is served on port 5080.
