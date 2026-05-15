# Deploy Content OS to Railway

## Project on Railway

A Railway project named **Content OS** can be created from the `copy-maker` folder with:

`railway init --name "Content OS"`

Then link the folder: `railway link -p <projectId>` (or use the interactive `railway link`).

## 1. Create the service

1. In [Railway](https://railway.app), open project **Content OS** (or create it as above).
2. **New** → **GitHub Repo** → select repo **`chubbywueez/content-os`** (after you push; see `../GITHUB_SETUP.md`).
3. Service **Settings** → set **Root Directory** to `copy-maker` (repo root is the parent folder that contains `copy-maker/`, `OS/`, and `linkedin_influencers/`).
4. Rename the deployed **service** to **Content OS** in Settings → General if you want the service tab to match the product name.

## 2. Environment variables (server only — no `VITE_` keys)

`vite preview` reads these at **runtime** from the container environment (Railway **Variables**). They are **not** baked into the JS bundle.

Required for real **copy** (all three header models use OpenRouter):

- **`OPENROUTER_API_KEY`** — one key for Opus, GPT, and “Gemini” copy (OpenRouter chat completions).

Required for **Nano Banana images** (Google Gemini image API, proxied at `/api/gemini`):

- **`GEMINI_API_KEY`** or **`GOOGLE_AI_API_KEY`**

If a key is missing, the matching proxy returns **503** with a short JSON hint; the UI may fall back to mocks for copy.

## 3. What Railway runs

- **Build:** `npm run build` (Nixpacks auto-detects Node and runs `npm install` + `npm run build` when `package.json` has a `build` script).
- **Start:** `npm run start` → `vite preview` on `0.0.0.0:$PORT` so OS files and outlier catalog APIs keep working (they are not static files in `dist/`).

## 4. Repo layout on the server

The preview middleware reads from paths **relative to the `copy-maker` folder**:

- `../OS` — style guide, voices, personas  
- `../linkedin_influencers/data` — outlier index + framework cache  

So the GitHub repo pushed to Railway must include those folders (not only `copy-maker/`). Setting **Root Directory** to `copy-maker` still clones the full repo; parent paths resolve correctly.

## 5. Favicon / branding

- Tab title: **Content OS** (`index.html`).
- Favicon: `public/favicon.svg` (Vantum mark). Linked from `index.html` and `public/manifest.webmanifest`.
