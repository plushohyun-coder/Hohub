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

COPY vendor/ /tmp/vendor/
COPY docker/drop-optional-deps.js /tmp/

# plus-erp-ai-client (private GitHub repo) is installed from, in order of preference:
#   1. vendor/ - the repo's ZIP extracted there (e.g. vendor/plus-erp-ai-client-main/); no token needed
#   2. the "github_token" build secret - a read-only token; it is never stored in the image
#   3. neither - the build still succeeds and the AI assistant is disabled
# Except when using the token, the GitHub entry in optionalDependencies is dropped from this
# build stage's package.json so npm does not try to fetch it (or treat the vendor copy as optional).
RUN --mount=type=secret,id=github_token \
    AI_DIR="$(dirname "$(grep -l '"name": *"plus-erp-ai-client"' /tmp/vendor/*/package.json 2>/dev/null | head -n 1)")"; \
    if [ -n "$AI_DIR" ] && [ "$AI_DIR" != "." ]; then \
      echo "Installing plus-erp-ai-client from ${AI_DIR#/tmp/}"; \
      node /tmp/drop-optional-deps.js || exit 1; \
      AI_TGZ="$(cd /tmp && npm pack "$AI_DIR" --silent)" || exit 1; \
      npm install --omit=dev --no-audit --no-fund "/tmp/$AI_TGZ" || exit 1; \
    elif [ -s /run/secrets/github_token ]; then \
      TOKEN="$(cat /run/secrets/github_token)"; \
      git config --global url."https://x-access-token:${TOKEN}@github.com/".insteadOf "https://github.com/"; \
      git config --global --add url."https://x-access-token:${TOKEN}@github.com/".insteadOf "ssh://git@github.com/"; \
      git config --global --add url."https://x-access-token:${TOKEN}@github.com/".insteadOf "git@github.com:"; \
      npm install --omit=dev --no-audit --no-fund; \
      status=$?; rm -f /root/.gitconfig; [ $status -eq 0 ] || exit $status; \
    else \
      echo "No vendor/ copy and no github_token secret - building without the AI assistant"; \
      node /tmp/drop-optional-deps.js || exit 1; \
      npm install --omit=dev --no-audit --no-fund || exit 1; \
      exit 0; \
    fi; \
    if [ ! -f node_modules/plus-erp-ai-client/package.json ]; then \
      echo "ERROR: plus-erp-ai-client was not installed. Check vendor/ or that GITHUB_TOKEN can read plushohyun-coder/plus-erp-ai-client."; \
      exit 1; \
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
