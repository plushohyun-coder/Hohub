# syntax=docker/dockerfile:1

# ---- Build the React frontend ----
FROM node:22-alpine AS frontend
WORKDIR /app/frontend
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

# ---- Install backend dependencies (full image: has git for the GitHub dependency) ----
FROM node:22 AS deps
WORKDIR /app/backend
COPY backend/package.json ./

# plus-erp-ai-client is a private GitHub repo. Pass a read-only token as the
# "github_token" build secret to install it; it is never stored in the image.
# Without the secret the build still succeeds and the AI assistant is disabled.
RUN --mount=type=secret,id=github_token \
    if [ -s /run/secrets/github_token ]; then \
      TOKEN="$(cat /run/secrets/github_token)"; \
      git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "https://github.com/"; \
      git config --global --add url."https://x-access-token:${TOKEN}@github.com/".insteadOf "ssh://git@github.com/"; \
      git config --global --add url."https://x-access-token:${TOKEN}@github.com/".insteadOf "git@github.com:"; \
      npm install --omit=dev --no-audit --no-fund; \
      status=$?; rm -f /root/.gitconfig; [ $status -eq 0 ] || exit $status; \
      if [ ! -f node_modules/plus-erp-ai-client/package.json ]; then \
        echo "ERROR: plus-erp-ai-client was not installed. Check that GITHUB_TOKEN can read plushohyun-coder/plus-erp-ai-client."; \
        exit 1; \
      fi; \
    else \
      echo "github_token secret not provided - building without the AI assistant"; \
      npm install --omit=dev --omit=optional --no-audit --no-fund; \
    fi

# ---- Runtime ----
FROM node:22-alpine
WORKDIR /app/backend
COPY --from=deps /app/backend/node_modules ./node_modules
COPY backend/package.json ./
COPY backend/src ./src
COPY --from=frontend /app/frontend/dist /app/frontend/dist

ENV NODE_ENV=production \
    PORT=5080
EXPOSE 5080
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" > /dev/null || exit 1
CMD ["node", "src/index.js"]
