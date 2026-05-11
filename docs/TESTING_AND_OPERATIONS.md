# Testing And Operations

## Repo tests vs CLI

- Backend keeps code-coupled tests under `tests/`
  - `unit`
  - `integration`
  - `performance`
  - `security`
  - `resilience`
  - `readiness`
- Frontend keeps one lightweight smoke script under `tests/e2e/`
- Repeated local/prod checks are wrapped by `fansctl`

## fansctl

Run from `fans-backend/`:

```bash
bash scripts/fansctl local-check
bash scripts/fansctl prod-http
bash scripts/fansctl prod-ops
bash scripts/fansctl prod-auth-upload
bash scripts/fansctl prod-logs fans-backend
```

`prod-auth-upload` requires:

```bash
nano .env.local
```

Then fill these optional keys in `.env.local`:

```bash
PROD_SMOKE_USERNAME="your-smoke-user"
PROD_SMOKE_PASSWORD="your-smoke-password"
FRONTEND_BASE_URL="https://enjoycorner.com"
```

It verifies:

- frontend credential login
- next-auth session contains `accessToken`
- authenticated `/api/upload/init` still works after login
- temporary upload record is cancelled for cleanup

### Why it exists

- Avoid memorizing long deployment and diagnosis commands
- Separate repo tests from runtime operations
- Provide one stable entrypoint for local validation and production smoke checks

## Cleanup rules

- Keep real automated tests in repo
- Remove empty `test-*` app routes and placeholder directories
- Do not keep empty folders as “future maybe” placeholders
- Put reusable operator workflows in `fansctl`
- Put agent reasoning/process guidance into skills later, not into shell scripts
