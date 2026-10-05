# vendor/

Put the AI client here to build the Docker image **without a GitHub token**.

1. On GitHub, open `plushohyun-coder/plus-erp-ai-client` → **Code** → **Download ZIP**.
2. Extract the ZIP into this folder. You should end up with
   `vendor/plus-erp-ai-client-main/package.json` (any folder name works).
3. Run `sudo docker compose up -d --build`.

Everything in this folder except this README is ignored by git.
