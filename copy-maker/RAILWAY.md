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

## 2. Build-time environment variables (Vite)

`VITE_*` variables are inlined when `npm run build` runs. In Railway, add them under the service **Variables** tab and ensure they are available to the **build** step (Railway exposes the same variables to build and deploy by default).

Minimum for a working production UI with Gemini from the browser:

- `VITE_GEMINI_API_KEY` — Google AI Studio key (or use the aliases listed in `.env.example`).

Optional (same as local `.env`):

- `VITE_GEMINI_COPY_MODEL_PRIMARY`, `VITE_GEMINI_COPY_MODEL_FALLBACK`
- `VITE_NANO_BANANA_MODEL`
- `VITE_OPENROUTER_API_KEY` — **recommended** for the header’s **Opus** and **GPT** copy options (one key). The app calls same-origin `/api/openrouter/...`; `vite preview` proxies to OpenRouter with this key (browser cannot call OpenRouter directly due to CORS). You may also set `OPENROUTER_API_KEY` (server-only duplicate). Images still use Gemini (`VITE_GEMINI_API_KEY`).
- Optional OpenRouter: `VITE_OPENROUTER_MODEL_OPUS`, `VITE_OPENROUTER_MODEL_OPENAI`, `VITE_OPENROUTER_HTTP_REFERER`, `VITE_OPENROUTER_APP_TITLE`
- Legacy direct APIs (if you do not use OpenRouter): `VITE_ANTHROPIC_API_KEY`, `VITE_OPENAI_API_KEY`
- `VITE_ANTHROPIC_COPY_MODEL`, `VITE_OPENAI_COPY_MODEL`

If you omit Gemini keys, the app still builds; copy/image calls fall back to mocks or show errors when you try those actions.

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
