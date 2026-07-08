# Deploy Content OS to Railway

## Project on Railway

A Railway project named **Content OS** can be created from the repo root with:

`railway init --name "Content OS"`

Then link the folder: `railway link -p <projectId>` (or use the interactive `railway link`).

## 1. Create the service

1. In [Railway](https://railway.app), open project **Content OS** (or create it as above).
2. **New** → **GitHub Repo** → select repo **`chubbywueez/content-os`** (after you push; see `../../GITHUB_SETUP.md`).
3. Service **Settings** → set **Root Directory** to `.` so Railway uses root `Dockerfile` and `railway.toml`.
4. Rename the deployed **service** to **Content OS** in Settings → General if you want the service tab to match the product name.

## 2. Environment variables (server only — no `VITE_` keys)

`vite preview` reads these at **runtime** from the container environment (Railway **Variables**). They are **not** baked into the JS bundle.

Required for real **copy** (all three header models use OpenRouter):

- **`OPENROUTER_API_KEY`** — one key for Opus, GPT, and “Gemini” copy (OpenRouter chat completions).

Required for **Nano Banana images** (Google Gemini image API, proxied at `/api/gemini`):

- **`GEMINI_API_KEY`** or **`GOOGLE_AI_API_KEY`**

If a key is missing, the matching proxy returns **503** with a short JSON hint; the UI may fall back to mocks for copy.

## 3. What Railway runs (root Docker deploy)

- **Build:** Docker image build from repo root.
- **Start:** `node scripts/railway-start.mjs` inside `apps/copy-maker`.

## 4. Repo layout in container

The preview middleware reads from:

- `/app/data/os` — style guide, voices, personas
- `/app/data/outliers/data` — outlier index + framework cache + swipe catalog
- `/app/data/skills` — transcript/scoring prompts
- `/app/data/presentations` — interview pipeline data

So the GitHub repo pushed to Railway must include `apps/` and `data/`.

## 5. Favicon / branding

- Tab title: **Content OS** (`index.html`).
- Favicon: `public/favicon.svg` (Vantum mark). Linked from `index.html` and `public/manifest.webmanifest`.
